"use client";

import { useState } from "react";
import { updateProfile } from "@/actions/profile";

type Props = {
  weightKg: number;
  heightCm: number;
  trainingDaysPerWeek: number;
  defaultRestSeconds: number;
};

export function ProfileEditForm({ weightKg, heightCm, trainingDaysPerWeek, defaultRestSeconds }: Props) {
  const [weight, setWeight] = useState(String(weightKg));
  const [height, setHeight] = useState(String(heightCm));
  const [days, setDays] = useState(trainingDaysPerWeek);
  const [rest, setRest] = useState(defaultRestSeconds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateProfile({
        weightKg: Number(weight),
        heightCm: Number(height),
        trainingDaysPerWeek: days,
        defaultRestSeconds: rest,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <div style={{ display: "flex", gap: "var(--space-md)" }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label>Peso (kg)</label>
          <input
            type="number"
            className="input input-number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            step="0.1"
          />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label>Altura (cm)</label>
          <input
            type="number"
            className="input input-number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>

      <div className="input-group">
        <label>Días de entrenamiento / semana</label>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          {[2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              className={`btn ${days === d ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setDays(d)}
              style={{ flex: 1, padding: "var(--space-sm)" }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label>Descanso por defecto (segundos)</label>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          {[60, 90, 120, 150, 180].map((s) => (
            <button
              key={s}
              className={`btn ${rest === s ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setRest(s)}
              style={{ flex: 1, padding: "var(--space-sm)", fontSize: "0.85rem" }}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>}

      <button className="btn btn-primary btn-large mt-md" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar Cambios"}
      </button>
    </div>
  );
}
