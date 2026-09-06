"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { currentUser } from "@/auth";
import { calculateBmi } from "@/lib/bmi";

export type CreateProfileInput = {
  dateOfBirth: string;
  weightKg: number;
  heightCm: number;
  activityLevel?: string;
  experienceLevel?: string;
  trainingDaysPerWeek?: number;
  defaultRestSeconds?: number;
};

export type UpdateProfileInput = Partial<Omit<CreateProfileInput, "dateOfBirth">>;

function validateProfileRanges(input: {
  weightKg?: number;
  heightCm?: number;
  trainingDaysPerWeek?: number;
}) {
  if (input.weightKg !== undefined && (input.weightKg < 20 || input.weightKg > 300)) {
    throw new Error("El peso debe estar entre 20 y 300 kg");
  }
  if (input.heightCm !== undefined && (input.heightCm < 100 || input.heightCm > 250)) {
    throw new Error("La altura debe estar entre 100 y 250 cm");
  }
  if (
    input.trainingDaysPerWeek !== undefined &&
    (input.trainingDaysPerWeek < 1 || input.trainingDaysPerWeek > 7)
  ) {
    throw new Error("Los días de entrenamiento deben estar entre 1 y 7");
  }
}

export async function createProfile(input: CreateProfileInput): Promise<void> {
  const user = await currentUser();
  validateProfileRanges(input);

  const [existing] = await db
    .select({ id: userProfile.id })
    .from(userProfile)
    .where(eq(userProfile.userId, user.id))
    .limit(1);

  if (existing) {
    throw new Error("El perfil ya existe. Usa updateProfile para actualizarlo.");
  }

  await db.insert(userProfile).values({
    userId: user.id,
    dateOfBirth: input.dateOfBirth,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    bmi: calculateBmi(input.weightKg, input.heightCm),
    activityLevel: input.activityLevel ?? "sedentary",
    experienceLevel: input.experienceLevel ?? "beginner",
    trainingDaysPerWeek: input.trainingDaysPerWeek ?? 3,
    defaultRestSeconds: input.defaultRestSeconds ?? 90,
  });

  revalidatePath("/");
}

export async function updateProfile(input: UpdateProfileInput): Promise<void> {
  const user = await currentUser();
  validateProfileRanges(input);

  const [existing] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, user.id))
    .limit(1);

  if (!existing) {
    throw new Error("Perfil no encontrado. Crea uno primero.");
  }

  const bmiChanged = input.weightKg !== undefined || input.heightCm !== undefined;
  const bmi = bmiChanged
    ? calculateBmi(input.weightKg ?? existing.weightKg, input.heightCm ?? existing.heightCm)
    : undefined;

  await db
    .update(userProfile)
    .set({
      ...input,
      ...(bmi !== undefined ? { bmi } : {}),
      updatedAt: new Date(),
    })
    .where(eq(userProfile.userId, user.id));

  revalidatePath("/profile");
  revalidatePath("/");
}
