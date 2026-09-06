import Link from "next/link";
import { getCurrentWorkoutPlan } from "@/lib/workouts";
import { getCurrentUserProfile } from "@/lib/profile";
import { GenerateWorkoutButton } from "@/components/generate-workout-button";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function DashboardPage() {
  const [plan, profile] = await Promise.all([getCurrentWorkoutPlan(), getCurrentUserProfile()]);

  const today = new Date().getDay(); // 0=domingo
  const todayIndex = today === 0 ? 6 : today - 1; // 0=lunes
  const todaysWorkout = plan?.days.find((d) => d.dayOfWeek === todayIndex);

  return (
    <div className="page">
      <div className="page-header">
        <h1>NoobGains</h1>
        {profile && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {profile.age} años · {profile.weightKg}kg
          </div>
        )}
      </div>

      {plan && todaysWorkout && (
        <div className="card card-glow animate-fade-in" style={{ marginBottom: "var(--space-md)" }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "var(--space-xs)",
            }}
          >
            Hoy — {DAY_FULL[todayIndex]}
          </div>
          <h2 style={{ marginBottom: "var(--space-xs)" }}>{todaysWorkout.name}</h2>
          <div className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "var(--space-md)" }}>
            {todaysWorkout.exercises.length} ejercicios · {todaysWorkout.focus}
          </div>
          <Link href={`/workout/${todaysWorkout.id}`} className="btn btn-primary btn-large">
            🏋️ COMENZAR ENTRENAMIENTO
          </Link>
        </div>
      )}

      {plan && !todaysWorkout && (
        <div className="card animate-fade-in" style={{ marginBottom: "var(--space-md)", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)" }}>😴</div>
          <h3>Día de descanso</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Recuperación activa. Descansa bien para tu próximo entrenamiento.
          </p>
        </div>
      )}

      {plan && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-md">
            <h3>Semana</h3>
            <span className="text-muted" style={{ fontSize: "0.8rem" }}>
              Mesociclo {plan.mesocycleWeek}/4 · {plan.periodizationPhase}
            </span>
          </div>
          <div className="flex flex-col gap-sm">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
              const dayWorkout = plan.days.find((d) => d.dayOfWeek === dayIdx);
              const isToday = dayIdx === todayIndex;

              const card = (
                <div className={`day-card ${isToday ? "today" : ""} ${!dayWorkout ? "rest" : ""}`}>
                  <div className={`day-number ${isToday ? "today" : dayIdx < todayIndex ? "past" : "future"}`}>
                    {DAY_NAMES[dayIdx]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {dayWorkout ? dayWorkout.name : "Descanso"}
                    </div>
                    {dayWorkout && (
                      <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {dayWorkout.exercises.length} ejercicios
                      </div>
                    )}
                  </div>
                  {isToday && dayWorkout && (
                    <span style={{ color: "var(--accent-light)", fontSize: "0.8rem", fontWeight: 600 }}>HOY →</span>
                  )}
                </div>
              );

              return dayWorkout ? (
                <Link key={dayIdx} href={`/workout/${dayWorkout.id}`}>
                  {card}
                </Link>
              ) : (
                <div key={dayIdx}>{card}</div>
              );
            })}
          </div>
        </div>
      )}

      {plan?.aiReasoning && (
        <div className="card mt-lg animate-fade-in">
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "var(--space-sm)",
            }}
          >
            🤖 Razonamiento de la IA
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{plan.aiReasoning}</p>
        </div>
      )}

      {!plan && (
        <div className="animate-fade-in" style={{ textAlign: "center", padding: "var(--space-3xl) 0" }}>
          <div style={{ fontSize: "4rem", marginBottom: "var(--space-md)" }}>🏋️</div>
          <h2 style={{ marginBottom: "var(--space-sm)" }}>¡Genera tu primera rutina!</h2>
          <p className="text-muted" style={{ marginBottom: "var(--space-lg)", maxWidth: 280, margin: "0 auto var(--space-lg)" }}>
            La IA creará un plan personalizado basado en tu perfil y nivel de experiencia.
          </p>
          <GenerateWorkoutButton hasPlan={false} />
        </div>
      )}

      {plan && (
        <div style={{ marginTop: "var(--space-lg)", textAlign: "center" }}>
          <GenerateWorkoutButton hasPlan={true} />
        </div>
      )}
    </div>
  );
}
