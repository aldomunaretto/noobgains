import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/profile";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
