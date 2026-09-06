import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plannedExercises, setLogs, workoutSessions } from "@/db/schema";
import { currentUser } from "@/auth";

export type WeightSuggestion = {
  exerciseId: number;
  suggestedWeightKg: number;
  direction: "up" | "down" | "keep";
  reason: string;
  lastWeightKg: number | null;
  lastReps: number | null;
};

const WEIGHT_INCREMENT_KG = 2.5;
const RECENT_SETS_LIMIT = 12; // ~últimas 3 sesiones

export async function getWeightSuggestion(exerciseId: number): Promise<WeightSuggestion> {
  const user = await currentUser();

  const recentSets = await db
    .select({
      weightKg: setLogs.weightKg,
      repsCompleted: setLogs.repsCompleted,
      rpe: setLogs.rpe,
    })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(setLogs.exerciseId, exerciseId),
        eq(setLogs.completed, true),
        eq(workoutSessions.status, "completed"),
        eq(workoutSessions.userId, user.id),
      ),
    )
    .orderBy(desc(setLogs.performedAt))
    .limit(RECENT_SETS_LIMIT);

  const [latestPlanned] = await db
    .select({
      targetWeightKg: plannedExercises.targetWeightKg,
      targetRepsMin: plannedExercises.targetRepsMin,
      targetRepsMax: plannedExercises.targetRepsMax,
    })
    .from(plannedExercises)
    .where(eq(plannedExercises.exerciseId, exerciseId))
    .orderBy(desc(plannedExercises.id))
    .limit(1);

  if (recentSets.length === 0) {
    return {
      exerciseId,
      suggestedWeightKg: latestPlanned?.targetWeightKg ?? 0,
      direction: "keep",
      reason: "Sin historial previo. Empieza con un peso cómodo.",
      lastWeightKg: null,
      lastReps: null,
    };
  }

  const lastWeight = recentSets[0].weightKg;
  const lastReps = recentSets[0].repsCompleted;
  const targetMax = latestPlanned?.targetRepsMax ?? 12;
  const targetMin = latestPlanned?.targetRepsMin ?? 8;

  // Solo las series con el mismo peso que la última registrada, igual que el
  // legacy: aproxima "la última sesión" sin guardar un session_id explícito.
  const lastSessionSets = recentSets.filter((s) => s.weightKg === lastWeight);
  const avgReps = lastSessionSets.reduce((sum, s) => sum + s.repsCompleted, 0) / lastSessionSets.length;
  const rpeValues = lastSessionSets.map((s) => s.rpe).filter((r): r is number => r !== null);
  const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : 7;

  if (avgReps >= targetMax && avgRpe <= 8) {
    return {
      exerciseId,
      suggestedWeightKg: Math.round((lastWeight + WEIGHT_INCREMENT_KG) * 10) / 10,
      direction: "up",
      reason: `¡Buen trabajo! Alcanzaste ${avgReps.toFixed(0)} reps con RPE ${avgRpe.toFixed(0)}. Sube ${WEIGHT_INCREMENT_KG}kg.`,
      lastWeightKg: lastWeight,
      lastReps: lastReps,
    };
  }

  if (avgRpe > 9 || avgReps < targetMin) {
    return {
      exerciseId,
      suggestedWeightKg: Math.round(Math.max(0, lastWeight - WEIGHT_INCREMENT_KG) * 10) / 10,
      direction: "down",
      reason: `El peso anterior fue muy exigente (RPE ${avgRpe.toFixed(0)}, ${avgReps.toFixed(0)} reps). Baja ${WEIGHT_INCREMENT_KG}kg.`,
      lastWeightKg: lastWeight,
      lastReps: lastReps,
    };
  }

  return {
    exerciseId,
    suggestedWeightKg: lastWeight,
    direction: "keep",
    reason: `Mantén ${lastWeight}kg e intenta llegar a ${targetMax} reps en todas las series.`,
    lastWeightKg: lastWeight,
    lastReps: lastReps,
  };
}
