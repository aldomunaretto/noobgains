"use client";

import { useState, useTransition } from "react";
import { generateWorkoutPlan } from "@/actions/workouts";

export function GenerateWorkoutButton({ hasPlan }: { hasPlan: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleGenerate = () => {
    setError("");
    startTransition(async () => {
      try {
        await generateWorkoutPlan({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error generando rutina");
      }
    });
  };

  if (!hasPlan) {
    return (
      <>
        <button
          className="btn btn-primary btn-large"
          style={{ maxWidth: 320 }}
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? "🤖 Generando con IA..." : "✨ Generar Rutina Semanal"}
        </button>
        {error && (
          <p style={{ color: "var(--danger)", marginTop: "var(--space-md)", fontSize: "0.85rem" }}>{error}</p>
        )}
      </>
    );
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={handleGenerate} disabled={isPending}>
        {isPending ? "🤖 Regenerando..." : "🔄 Regenerar Rutina"}
      </button>
      {error && <p style={{ color: "var(--danger)", marginTop: "var(--space-md)", fontSize: "0.85rem" }}>{error}</p>}
    </>
  );
}
