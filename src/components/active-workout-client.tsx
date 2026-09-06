"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTimer } from "@/hooks/useTimer";
import { startSession, logSet, completeSession } from "@/actions/sessions";
import type { getCurrentWorkoutPlan } from "@/lib/workouts";
import type { WeightSuggestion } from "@/lib/progression";

type Plan = NonNullable<Awaited<ReturnType<typeof getCurrentWorkoutPlan>>>;
type Day = Plan["days"][number];
type PlannedExercise = Day["exercises"][number];
type SessionWithSetLogs = Awaited<ReturnType<typeof startSession>>;

export function ActiveWorkoutClient({ day }: { day: Day }) {
  const router = useRouter();

  const [session, setSession] = useState<SessionWithSetLogs | null>(null);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [currentSetNum, setCurrentSetNum] = useState(1);
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [rpe, setRpe] = useState(7);
  const [suggestion, setSuggestion] = useState<WeightSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);

  const currentExercise: PlannedExercise | null = day.exercises[currentExIndex] ?? null;
  const timer = useTimer(currentExercise?.restSeconds ?? 90);

  async function loadSuggestion(exerciseId: number) {
    try {
      const res = await fetch(`/api/sessions/suggestions/${exerciseId}`);
      if (!res.ok) return;
      const s: WeightSuggestion = await res.json();
      setSuggestion(s);
      if (s.suggestedWeightKg > 0) setWeight(s.suggestedWeightKg);
    } catch {
      // Sin sugerencia disponible
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const newSession = await startSession(day.id);
        if (cancelled) return;
        setSession(newSession);

        if (day.exercises.length > 0) {
          const first = day.exercises[0];
          setReps(first.targetRepsMax);
          setWeight(first.targetWeightKg ?? 0);
          await loadSuggestion(first.exerciseId);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.id]);

  const handleSetComplete = async () => {
    if (!session || !currentExercise) return;

    const updated = await logSet(session.id, {
      plannedExerciseId: currentExercise.id,
      exerciseId: currentExercise.exerciseId,
      setNumber: currentSetNum,
      repsCompleted: reps,
      weightKg: weight,
      rpe,
      restTakenSeconds: timer.elapsed,
    });
    setSession(updated);

    if (currentSetNum < currentExercise.targetSets) {
      setCurrentSetNum((prev) => prev + 1);
      timer.start();
    } else if (currentExIndex < day.exercises.length - 1) {
      const nextIdx = currentExIndex + 1;
      setCurrentExIndex(nextIdx);
      setCurrentSetNum(1);
      timer.reset();
      const nextEx = day.exercises[nextIdx];
      setReps(nextEx.targetRepsMax);
      setWeight(nextEx.targetWeightKg ?? 0);
      await loadSuggestion(nextEx.exerciseId);
    } else {
      const final = await completeSession(session.id);
      setSession(final);
      setShowSummary(true);
    }
  };

  const completedSetsForExercise =
    session?.setLogs.filter((s) => s.plannedExerciseId === currentExercise?.id) ?? [];

  if (loading) {
    return (
      <div className="page flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
        <div className="skeleton" style={{ width: 200, height: 200, borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton mt-md" style={{ width: 150, height: 24 }} />
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="page animate-fade-in">
        <div style={{ textAlign: "center", padding: "var(--space-3xl) 0" }}>
          <div style={{ fontSize: "4rem" }}>🎉</div>
          <h2 style={{ marginTop: "var(--space-md)" }}>¡Entrenamiento Completado!</h2>
          <div className="card mt-lg">
            <div className="flex justify-between" style={{ padding: "var(--space-sm) 0" }}>
              <span className="text-muted">Volumen total</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                {session?.totalVolumeKg?.toLocaleString() ?? 0} kg
              </span>
            </div>
            <div className="flex justify-between" style={{ padding: "var(--space-sm) 0" }}>
              <span className="text-muted">Series completadas</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{session?.setLogs.length ?? 0}</span>
            </div>
            <div className="flex justify-between" style={{ padding: "var(--space-sm) 0" }}>
              <span className="text-muted">Ejercicios</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{day.exercises.length}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-large mt-lg" onClick={() => router.push("/")}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) return null;

  const exerciseName = currentExercise.exercise?.nameEs || currentExercise.exercise?.name || "Ejercicio";

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => router.push("/")}>
          ← Volver
        </button>
        <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.85rem" }}>
          {day.name}
        </span>
        <span className="text-muted" style={{ fontSize: "0.8rem" }}>
          {currentExIndex + 1}/{day.exercises.length}
        </span>
      </div>

      <div style={{ margin: "var(--space-md) 0" }}>
        <h2>{exerciseName}</h2>
        <div className="text-muted" style={{ fontSize: "0.9rem" }}>
          Serie {currentSetNum} / {currentExercise.targetSets}
        </div>
      </div>

      {currentExercise.formTips && (
        <div className="form-tip mb-md">
          <span className="form-tip-icon">💡</span>
          <span>{currentExercise.formTips}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label style={{ textAlign: "center" }}>Reps</label>
          <input
            type="number"
            className="input input-number"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            min={1}
            max={100}
          />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label style={{ textAlign: "center" }}>Peso (kg)</label>
          <input
            type="number"
            className="input input-number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            min={0}
            step={0.5}
          />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label style={{ textAlign: "center" }}>RPE</label>
          <input
            type="number"
            className="input input-number"
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            min={1}
            max={10}
          />
        </div>
      </div>

      <div className="weight-suggestion">
        <button className="weight-adjust-btn down" onClick={() => setWeight((prev) => Math.max(0, prev - 2.5))}>
          −2.5
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700 }}>{weight} kg</div>
          {suggestion && (
            <span
              className={`suggestion-badge ${suggestion.direction === "up" ? "up" : suggestion.direction === "down" ? "down" : "same"}`}
            >
              {suggestion.direction === "up" ? "▲" : suggestion.direction === "down" ? "▼" : "●"}{" "}
              {suggestion.direction === "up"
                ? "¡Sube peso!"
                : suggestion.direction === "down"
                  ? "Baja peso"
                  : "Mantener"}
            </span>
          )}
        </div>
        <button className="weight-adjust-btn up" onClick={() => setWeight((prev) => prev + 2.5)}>
          +2.5
        </button>
      </div>

      <button
        className="btn btn-success btn-large mt-md"
        onClick={handleSetComplete}
        style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "0.05em" }}
      >
        ✓ SERIE COMPLETADA
      </button>

      <div className={`rest-timer mt-md ${timer.isRunning ? (timer.isDone ? "done" : "active") : ""}`}>
        <div className="timer-label">Tiempo de descanso</div>
        <div
          className="timer-display"
          style={{
            color: timer.isDone ? "var(--success)" : timer.isRunning ? "var(--accent-light)" : "var(--text-muted)",
          }}
        >
          {timer.isRunning ? timer.formattedRemaining : timer.formattedTarget}
        </div>
        {timer.isRunning && (
          <>
            <div className="timer-progress">
              <div className="timer-progress-bar" style={{ width: `${100 - timer.progress}%` }} />
            </div>
            {timer.isDone && (
              <div
                style={{ marginTop: "var(--space-sm)", color: "var(--success)", fontWeight: 600, fontSize: "0.9rem" }}
              >
                ¡Descanso completado! Comienza la serie.
              </div>
            )}
          </>
        )}
      </div>

      <div className="set-list mt-md">
        {Array.from({ length: currentExercise.targetSets }, (_, i) => {
          const setNum = i + 1;
          const log = completedSetsForExercise.find((s) => s.setNumber === setNum);
          const isCurrent = setNum === currentSetNum;

          return (
            <div key={setNum} className={`set-item ${log ? "completed" : isCurrent ? "current" : "pending"}`}>
              <div className={`set-dot ${log ? "completed" : isCurrent ? "current" : "pending"}`} />
              <span>Serie {setNum}</span>
              {log && (
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                  {log.repsCompleted}×{log.weightKg}kg
                  {log.rpe && <span className="text-muted"> RPE {log.rpe}</span>}
                </span>
              )}
              {isCurrent && !log && <span style={{ marginLeft: "auto", fontSize: "0.8rem" }}>← actual</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
