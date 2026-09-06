import { getSessionHistory } from "@/lib/sessions";

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function formatDuration(start: Date, end: Date | null): string {
  if (!end) return "—";
  const ms = end.getTime() - start.getTime();
  const mins = Math.round(ms / 60000);
  return `${mins} min`;
}

export default async function HistoryPage() {
  const sessions = await getSessionHistory();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Historial</h1>
      </div>

      {sessions.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-3xl) 0" }}>
          <div style={{ fontSize: "3rem" }}>📊</div>
          <h3 style={{ marginTop: "var(--space-md)" }}>Sin sesiones aún</h3>
          <p className="text-muted">Completa tu primer entrenamiento para ver tu historial.</p>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {sessions.map((session) => (
          <div key={session.id} className="card animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{formatDate(session.startedAt)}</div>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                  {/* dayName solo es null si el día de origen se borró después de crear
                      la sesión (startSession siempre exige un día válido) — nunca
                      significa "sin día asignado". */}
                  {session.dayName ?? "Entrenamiento (día eliminado)"} · {session.setLogsCount} series ·{" "}
                  {formatDuration(session.startedAt, session.completedAt)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-light)" }}>
                  {session.totalVolumeKg?.toLocaleString() ?? 0} kg
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: session.status === "completed" ? "var(--success)" : "var(--warning)",
                  }}
                >
                  {session.status === "completed" ? "✓ Completada" : "⏸ En progreso"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
