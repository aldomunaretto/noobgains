import { notFound } from "next/navigation";
import { getCurrentWorkoutPlan } from "@/lib/workouts";
import { ActiveWorkoutClient } from "@/components/active-workout-client";

export default async function ActiveWorkoutPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;

  // getCurrentWorkoutPlan() ya está escopado al plan activo del usuario actual,
  // así que un día encontrado acá pertenece por construcción a ese usuario —
  // no hace falta una query de propiedad aparte.
  const plan = await getCurrentWorkoutPlan();
  const day = plan?.days.find((d) => d.id === Number(dayId));

  if (!day) {
    notFound();
  }

  return <ActiveWorkoutClient day={day} />;
}
