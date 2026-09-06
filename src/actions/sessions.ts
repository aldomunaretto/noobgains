"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { setLogs, workoutDays, workoutPlans, workoutSessions } from "@/db/schema";
import { currentUser } from "@/auth";

export type LogSetInput = {
  plannedExerciseId?: number;
  exerciseId: number;
  setNumber: number;
  repsCompleted: number;
  weightKg: number;
  rpe?: number;
  restTakenSeconds?: number;
};

async function getSessionWithSetLogs(sessionId: number) {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);

  const logs = await db
    .select()
    .from(setLogs)
    .where(eq(setLogs.sessionId, sessionId))
    .orderBy(setLogs.performedAt);

  return { ...session, setLogs: logs };
}

export async function startSession(workoutDayId: number) {
  const user = await currentUser();

  // El día tiene que pertenecer a un plan del usuario actual (el legacy no
  // validaba esto porque era single-user sin auth).
  const [day] = await db
    .select({ id: workoutDays.id })
    .from(workoutDays)
    .innerJoin(workoutPlans, eq(workoutDays.planId, workoutPlans.id))
    .where(and(eq(workoutDays.id, workoutDayId), eq(workoutPlans.userId, user.id)))
    .limit(1);

  if (!day) {
    throw new Error("Día de entrenamiento no encontrado");
  }

  const [session] = await db
    .insert(workoutSessions)
    .values({
      userId: user.id,
      workoutDayId,
      status: "in_progress",
    })
    .returning();

  revalidatePath("/history");
  return { ...session, setLogs: [] as (typeof setLogs.$inferSelect)[] };
}

export async function logSet(sessionId: number, input: LogSetInput) {
  const user = await currentUser();

  const [session] = await db
    .select({ status: workoutSessions.status })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
    .limit(1);

  if (!session) {
    throw new Error("Sesión no encontrada");
  }
  if (session.status !== "in_progress") {
    throw new Error("La sesión ya está finalizada");
  }

  await db.insert(setLogs).values({
    sessionId,
    plannedExerciseId: input.plannedExerciseId ?? null,
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    repsCompleted: input.repsCompleted,
    weightKg: input.weightKg,
    rpe: input.rpe ?? null,
    restTakenSeconds: input.restTakenSeconds ?? null,
    completed: true,
  });

  revalidatePath("/history");
  return getSessionWithSetLogs(sessionId);
}

export async function completeSession(sessionId: number) {
  const user = await currentUser();

  const [session] = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
    .limit(1);

  if (!session) {
    throw new Error("Sesión no encontrada");
  }

  // total_volume_kg se calcula solo aquí, al completar — igual que el legacy,
  // que nunca lo tocaba en log-set.
  const logs = await db
    .select({ repsCompleted: setLogs.repsCompleted, weightKg: setLogs.weightKg, completed: setLogs.completed })
    .from(setLogs)
    .where(eq(setLogs.sessionId, sessionId));

  const totalVolumeKg =
    Math.round(
      logs.filter((log) => log.completed).reduce((sum, log) => sum + log.repsCompleted * log.weightKg, 0) * 10,
    ) / 10;

  await db
    .update(workoutSessions)
    .set({
      status: "completed",
      completedAt: new Date(),
      totalVolumeKg,
    })
    .where(eq(workoutSessions.id, sessionId));

  revalidatePath("/history");
  return getSessionWithSetLogs(sessionId);
}
