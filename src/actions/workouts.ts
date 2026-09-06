"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/auth";
import { getCurrentUserProfile } from "@/lib/profile";
import { generateWeeklyRoutine } from "@/lib/routine-generator";
import type { ClaudeEffort } from "@/lib/claude";

export async function generateWorkoutPlan(input?: { forceRegenerate?: boolean; effort?: ClaudeEffort }) {
  const user = await currentUser();
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error("Primero debes crear tu perfil en el onboarding");
  }

  const plan = await generateWeeklyRoutine(user, profile, {
    forceRegenerate: input?.forceRegenerate ?? false,
    effort: input?.effort,
  });

  revalidatePath("/");
  return plan;
}
