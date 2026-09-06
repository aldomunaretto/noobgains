import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/profile";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (profile) {
    redirect("/");
  }

  return <OnboardingWizard />;
}
