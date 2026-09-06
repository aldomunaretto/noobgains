import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exercises, plannedExercises, workoutDays, workoutPlans } from "@/db/schema";
import { currentUser } from "@/auth";

export async function getCurrentWorkoutPlan() {
  const user = await currentUser();

  const [plan] = await db
    .select()
    .from(workoutPlans)
    .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.isActive, true)))
    .orderBy(desc(workoutPlans.createdAt))
    .limit(1);

  if (!plan) return null;

  const days = await db
    .select()
    .from(workoutDays)
    .where(eq(workoutDays.planId, plan.id))
    .orderBy(workoutDays.dayOfWeek);

  if (days.length === 0) {
    return { ...plan, days: [] };
  }

  const dayIds = days.map((day) => day.id);

  // Solo el subconjunto de columnas que necesita la UI del ejercicio dentro
  // del plan (equivalente a ExerciseInPlan del legacy), no la fila completa.
  const exerciseRows = await db
    .select({
      plannedExercise: plannedExercises,
      exercise: {
        id: exercises.id,
        name: exercises.name,
        nameEs: exercises.nameEs,
        equipment: exercises.equipment,
        primaryMuscles: exercises.primaryMuscles,
        imagePaths: exercises.imagePaths,
        instructions: exercises.instructions,
      },
    })
    .from(plannedExercises)
    .innerJoin(exercises, eq(plannedExercises.exerciseId, exercises.id))
    .where(inArray(plannedExercises.workoutDayId, dayIds))
    .orderBy(plannedExercises.orderIndex);

  const exercisesByDayId = new Map<number, typeof exerciseRows>();
  for (const row of exerciseRows) {
    const dayId = row.plannedExercise.workoutDayId;
    const bucket = exercisesByDayId.get(dayId);
    if (bucket) {
      bucket.push(row);
    } else {
      exercisesByDayId.set(dayId, [row]);
    }
  }

  return {
    ...plan,
    days: days.map((day) => ({
      ...day,
      exercises: (exercisesByDayId.get(day.id) ?? []).map((row) => ({
        ...row.plannedExercise,
        exercise: row.exercise,
      })),
    })),
  };
}
