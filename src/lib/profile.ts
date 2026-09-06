import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { currentUser } from "@/auth";
import { calculateAge, categorizeBmi } from "@/lib/bmi";

export async function getCurrentUserProfile() {
  const user = await currentUser();

  const [profile] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, user.id))
    .limit(1);

  if (!profile) return null;

  const { category, color } = categorizeBmi(profile.bmi);

  return {
    ...profile,
    age: calculateAge(profile.dateOfBirth),
    bmiCategory: category,
    bmiColor: color,
  };
}
