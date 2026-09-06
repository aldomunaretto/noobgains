import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exercises, plannedExercises, workoutDays, workoutPlans, workoutSessions, setLogs } from "@/db/schema";
import { currentUser } from "@/auth";
import { getCurrentUserProfile } from "@/lib/profile";
import { getCurrentWorkoutPlan } from "@/lib/workouts";
import { callClaudeJson, type ClaudeEffort } from "@/lib/claude";

type CurrentUser = Awaited<ReturnType<typeof currentUser>>;
type CurrentProfile = NonNullable<Awaited<ReturnType<typeof getCurrentUserProfile>>>;
type CurrentPlan = NonNullable<Awaited<ReturnType<typeof getCurrentWorkoutPlan>>>;

const SYSTEM_PROMPT = `Eres un entrenador personal certificado y experto en fuerza y acondicionamiento.
Tu tarea es generar planes de entrenamiento semanales personalizados.

REGLAS ESTRICTAS:
1. Solo usa ejercicios del catálogo proporcionado (referenciados por su "id" numérico)
2. Aplica Double Progression: si el usuario alcanzó el tope de repeticiones en todas las series con RPE ≤ 8, sugiere subir peso
3. Implementa mesociclos de 4 semanas: 3 progresivas + 1 deload
4. Rota ejercicios después de 8-12 semanas de uso consecutivo
5. Prioriza movimientos compuestos, añade aislamiento como accesorio
6. Tiempos de descanso: compuestos 120-180s, aislamiento 60-90s, cardio 30-60s
7. Incluye calentamiento y cardio cuando sea apropiado
8. Los form_tips deben estar en español
9. El campo notes debe estar en español

FORMATO DE RESPUESTA (JSON estricto):
{
  "plan_name": "string - nombre descriptivo del plan",
  "split_type": "string - tipo de split (push/pull/legs, upper/lower, full_body, etc.)",
  "periodization_phase": "string - progressive|deload|intensification",
  "mesocycle_week": number,
  "ai_reasoning": "string - explicación en español de por qué elegiste estos ejercicios y esta estructura",
  "days": [
    {
      "day_of_week": number (0=lunes, 6=domingo),
      "focus": "string - grupo muscular principal",
      "name": "string - nombre del día en español",
      "exercises": [
        {
          "exercise_id": number (ID del catálogo),
          "order_index": number,
          "target_sets": number,
          "target_reps_min": number,
          "target_reps_max": number,
          "target_weight_kg": number|null,
          "rest_seconds": number,
          "notes": "string|null - notas en español",
          "form_tips": "string - consejos de forma en español"
        }
      ]
    }
  ]
}`;

// El catálogo real de exercises (Fase 2) trae "olympic weightlifting" con
// espacio, tal como viene del JSON fuente. El legacy filtraba por
// "olympic_weightlifting" con guion bajo, así que esos 35 ejercicios nunca
// llegaban al catálogo que ve Claude: aquí se corrige a propósito (decisión
// confirmada), no es fidelidad al bug original.
const CATALOG_CATEGORIES = ["strength", "cardio", "olympic weightlifting", "powerlifting", "plyometrics"];

const VALID_PERIODIZATION_PHASES = new Set(["progressive", "deload", "intensification"]);

type TrainingHistoryRow = {
  exerciseId: number;
  exerciseName: string;
  performedAt: Date;
  setNumber: number;
  repsCompleted: number;
  weightKg: number;
  rpe: number | null;
};

async function getTrainingHistory(userId: number, weeks = 12): Promise<TrainingHistoryRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  return db
    .select({
      exerciseId: setLogs.exerciseId,
      exerciseName: exercises.name,
      performedAt: setLogs.performedAt,
      setNumber: setLogs.setNumber,
      repsCompleted: setLogs.repsCompleted,
      weightKg: setLogs.weightKg,
      rpe: setLogs.rpe,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.status, "completed"),
        eq(setLogs.completed, true),
        gte(setLogs.performedAt, cutoff),
      ),
    )
    .orderBy(desc(setLogs.performedAt));
}

function eligibleExerciseLevels(experienceLevel: string): string[] {
  const levels = ["beginner", "intermediate"];
  if (experienceLevel === "intermediate" || experienceLevel === "advanced") {
    levels.push("expert");
  }
  return levels;
}

async function getExerciseCatalog(experienceLevel: string): Promise<string> {
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      equipment: exercises.equipment,
      primaryMuscles: exercises.primaryMuscles,
      force: exercises.force,
      mechanic: exercises.mechanic,
    })
    .from(exercises)
    .where(
      and(
        inArray(exercises.category, CATALOG_CATEGORIES),
        inArray(exercises.level, eligibleExerciseLevels(experienceLevel)),
      ),
    )
    .orderBy(exercises.primaryMuscles, exercises.name);

  const lines = ["id|name|equipment|muscles|force|mechanic"];
  for (const e of rows) {
    lines.push(
      `${e.id}|${e.name}|${e.equipment ?? "body"}|${e.primaryMuscles.join(",")}|${e.force ?? ""}|${e.mechanic ?? ""}`,
    );
  }
  return lines.join("\n");
}

function buildCurrentPlanSummary(plan: CurrentPlan) {
  return {
    name: plan.name,
    split_type: plan.splitType,
    mesocycle_week: plan.mesocycleWeek,
    week_start: plan.weekStart,
    days: plan.days.map((day) => ({
      day: day.name,
      focus: day.focus,
      exercises: day.exercises.map((pe) => ({
        exercise_id: pe.exerciseId,
        exercise_name: pe.exercise.name,
        sets: pe.targetSets,
        reps_range: `${pe.targetRepsMin}-${pe.targetRepsMax}`,
        weight_kg: pe.targetWeightKg,
      })),
    })),
  };
}

function buildUserPrompt(
  profile: CurrentProfile,
  currentPlanSummary: ReturnType<typeof buildCurrentPlanSummary> | null,
  history: TrainingHistoryRow[],
  catalog: string,
): string {
  let prompt = `Genera un plan de entrenamiento semanal para el siguiente usuario:

PERFIL DEL USUARIO:
- Edad: ${profile.age} años
- Peso: ${profile.weightKg} kg
- Altura: ${profile.heightCm} cm
- IMC: ${profile.bmi}
- Nivel de actividad: ${profile.activityLevel}
- Nivel de experiencia: ${profile.experienceLevel}
- Días de entrenamiento por semana: ${profile.trainingDaysPerWeek}
- Descanso por defecto: ${profile.defaultRestSeconds} segundos

`;

  if (currentPlanSummary) {
    const nextWeek = (currentPlanSummary.mesocycle_week % 4) + 1;
    const isDeload = currentPlanSummary.mesocycle_week % 4 === 3;
    prompt += `PLAN ACTUAL (semana anterior):
${JSON.stringify(currentPlanSummary, null, 2)}

Esta es la semana ${nextWeek} del mesociclo actual.
${isDeload ? "⚠️ Esta semana debería ser DELOAD (semana 4 del mesociclo)." : "Continúa con progresión."}

`;
  }

  if (history.length > 0) {
    const exerciseSummary: Record<number, { name: string; sessions: unknown[] }> = {};
    for (const h of history.slice(0, 200)) {
      const entry = (exerciseSummary[h.exerciseId] ??= { name: h.exerciseName, sessions: [] });
      entry.sessions.push({
        date: h.performedAt.toISOString().slice(0, 10),
        set: h.setNumber,
        reps: h.repsCompleted,
        weight: h.weightKg,
        rpe: h.rpe,
      });
    }

    prompt += `HISTORIAL DE ENTRENAMIENTO (últimas 12 semanas):
${JSON.stringify(exerciseSummary, null, 2)}

`;
  } else {
    prompt += `HISTORIAL: Este es el PRIMER plan del usuario. No hay historial previo.
Sugiere pesos conservadores apropiados para un principiante. Si no puedes estimar el peso, usa null.

`;
  }

  prompt += `CATÁLOGO DE EJERCICIOS DISPONIBLES (formato: id|name|equipment|muscles|force|mechanic):
${catalog}

IMPORTANTE: Usa solo los IDs del catálogo anterior en el campo "exercise_id" del JSON.
Genera el plan semanal siguiendo las reglas del sistema. Responde SOLO con JSON válido.`;

  return prompt;
}

function normalizePeriodizationPhase(raw: string | undefined): "progressive" | "deload" | "intensification" {
  return raw && VALID_PERIODIZATION_PHASES.has(raw)
    ? (raw as "progressive" | "deload" | "intensification")
    : "progressive";
}

function mondayOfWeek(date: Date): Date {
  const day = date.getDay(); // 0=domingo..6=sábado
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysSinceMonday);
  return monday;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

type GeneratedPlanData = {
  plan_name?: string;
  split_type?: string;
  periodization_phase?: string;
  mesocycle_week?: number;
  ai_reasoning?: string;
  days?: {
    day_of_week?: number;
    focus?: string;
    name?: string;
    exercises?: {
      exercise_id?: number | string;
      id?: number | string; // Claude a veces devuelve "id" en vez de "exercise_id"
      order_index?: number;
      target_sets?: number;
      target_reps_min?: number;
      target_reps_max?: number;
      target_weight_kg?: number | null;
      rest_seconds?: number;
      notes?: string | null;
      form_tips?: string | null;
    }[];
  }[];
};

export async function generateWeeklyRoutine(
  user: CurrentUser,
  profile: CurrentProfile,
  options?: {
    // No-op por ahora, igual que en el legacy: se acepta pero no se usa todavía.
    // Pendiente de decisión de producto en la Fase 6, cuando se defina el flujo
    // real del botón de generar/regenerar (ver nota en el plan de proyecto).
    forceRegenerate?: boolean;
    effort?: ClaudeEffort;
  },
): Promise<CurrentPlan> {
  void options?.forceRegenerate;

  const [history, catalog, currentPlan] = await Promise.all([
    getTrainingHistory(user.id),
    getExerciseCatalog(profile.experienceLevel),
    getCurrentWorkoutPlan(),
  ]);

  const currentPlanSummary = currentPlan ? buildCurrentPlanSummary(currentPlan) : null;
  const userPrompt = buildUserPrompt(profile, currentPlanSummary, history, catalog);

  const planData = await callClaudeJson<GeneratedPlanData>(SYSTEM_PROMPT, userPrompt, {
    effort: options?.effort,
  });

  const referencedIds = new Set<number>();
  for (const day of planData.days ?? []) {
    for (const ex of day.exercises ?? []) {
      const rawId = ex.exercise_id ?? ex.id;
      if (rawId !== undefined) referencedIds.add(Number(rawId));
    }
  }

  const validExerciseIds =
    referencedIds.size > 0
      ? new Set(
          (
            await db
              .select({ id: exercises.id })
              .from(exercises)
              .where(inArray(exercises.id, [...referencedIds]))
          ).map((row) => row.id),
        )
      : new Set<number>();

  await db
    .update(workoutPlans)
    .set({ isActive: false })
    .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.isActive, true)));

  const today = new Date();
  const monday = mondayOfWeek(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [newPlan] = await db
    .insert(workoutPlans)
    .values({
      userId: user.id,
      name: planData.plan_name ?? `Semana ${isoWeekNumber(today)}`,
      weekStart: formatDate(monday),
      weekEnd: formatDate(sunday),
      splitType: planData.split_type ?? "custom",
      periodizationPhase: normalizePeriodizationPhase(planData.periodization_phase),
      mesocycleWeek: planData.mesocycle_week ?? 1,
      isActive: true,
      aiReasoning: planData.ai_reasoning ?? null,
    })
    .returning();

  try {
    for (const dayData of planData.days ?? []) {
      const [newDay] = await db
        .insert(workoutDays)
        .values({
          planId: newPlan.id,
          dayOfWeek: dayData.day_of_week ?? 0,
          focus: dayData.focus ?? "general",
          name: dayData.name ?? "Entrenamiento",
        })
        .returning();

      const validExercises = (dayData.exercises ?? [])
        .map((ex) => ({ ...ex, resolvedId: Number(ex.exercise_id ?? ex.id) }))
        .filter((ex) => Number.isFinite(ex.resolvedId) && validExerciseIds.has(ex.resolvedId));

      if (validExercises.length > 0) {
        await db.insert(plannedExercises).values(
          validExercises.map((ex) => ({
            workoutDayId: newDay.id,
            exerciseId: ex.resolvedId,
            orderIndex: ex.order_index ?? 0,
            targetSets: ex.target_sets ?? 3,
            targetRepsMin: ex.target_reps_min ?? 8,
            targetRepsMax: ex.target_reps_max ?? 12,
            targetWeightKg: ex.target_weight_kg ?? null,
            restSeconds: ex.rest_seconds ?? 90,
            notes: ex.notes ?? null,
            formTips: ex.form_tips ?? null,
          })),
        );
      }
    }
  } catch (err) {
    // neon-http no soporta transacciones reales: si falla a mitad de la
    // creación de días/ejercicios, borramos el plan a mano (la cascada del
    // schema limpia días/ejercicios ya insertados) para no dejar un plan
    // activo a medio construir.
    await db.delete(workoutPlans).where(eq(workoutPlans.id, newPlan.id));
    throw err;
  }

  const created = await getCurrentWorkoutPlan();
  if (!created) {
    throw new Error("El plan se creó pero no se pudo recuperar");
  }
  return created;
}
