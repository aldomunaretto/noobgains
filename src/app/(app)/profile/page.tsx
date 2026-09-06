import { getCurrentUserProfile } from "@/lib/profile";
import { ProfileEditForm } from "@/components/profile-edit-form";

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null; // el layout de (app) ya garantiza que existe

  return (
    <div className="page">
      <div className="page-header">
        <h1>Perfil</h1>
      </div>

      <div className="card mb-md">
        <div className="flex justify-between items-center">
          <div>
            <div
              className="text-muted"
              style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              Índice de Masa Corporal
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", fontWeight: 800, color: profile.bmiColor }}>
              {profile.bmi}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: profile.bmiColor, fontWeight: 600 }}>{profile.bmiCategory}</div>
            <div className="text-muted" style={{ fontSize: "0.8rem" }}>
              {profile.age} años
            </div>
          </div>
        </div>
      </div>

      <ProfileEditForm
        weightKg={profile.weightKg}
        heightCm={profile.heightCm}
        trainingDaysPerWeek={profile.trainingDaysPerWeek}
        defaultRestSeconds={profile.defaultRestSeconds}
      />

      <div className="card mt-lg">
        <div className="text-muted" style={{ fontSize: "0.8rem" }}>
          <div>Fecha de nacimiento: {new Date(profile.dateOfBirth).toLocaleDateString("es-ES")}</div>
          <div>Nivel: {profile.experienceLevel}</div>
          <div>Actividad: {profile.activityLevel}</div>
          <div>Perfil creado: {profile.createdAt.toLocaleDateString("es-ES")}</div>
        </div>
      </div>
    </div>
  );
}
