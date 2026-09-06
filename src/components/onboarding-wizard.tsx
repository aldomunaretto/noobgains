"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculateBmi, categorizeBmi } from "@/lib/bmi";
import { createProfile } from "@/actions/profile";

const STEPS = ["bienvenida", "nacimiento", "medidas", "imc", "actividad", "dias", "generando"] as const;
type Step = (typeof STEPS)[number];

// Valores en inglés (estado de dominio persistido); labels/desc en español.
const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentario", desc: "Trabajo de oficina, poca actividad", icon: "🪑" },
  { value: "lightly_active", label: "Ligeramente activo", desc: "Caminas a diario, algo de movimiento", icon: "🚶" },
  { value: "moderately_active", label: "Moderadamente activo", desc: "Ejercicio 2-3 veces/semana", icon: "🏃" },
  { value: "very_active", label: "Muy activo", desc: "Ejercicio intenso 4+ veces/semana", icon: "💪" },
];

function bmiMarkerPosition(bmi: number): number {
  // Mapea IMC 15-40 a 0-100%
  return Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100));
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("bienvenida");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("sedentary");
  const [trainingDays, setTrainingDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = STEPS.indexOf(step);
  const bmi = weight && height ? calculateBmi(Number(weight), Number(height)) : 0;
  const bmiInfo = categorizeBmi(bmi);

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]);
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) setStep(STEPS[prevIndex]);
  };

  const handleSubmit = async () => {
    setStep("generando");
    setLoading(true);
    setError("");

    try {
      await createProfile({
        dateOfBirth: dob,
        weightKg: Number(weight),
        heightCm: Number(height),
        activityLevel,
        experienceLevel: "beginner",
        trainingDaysPerWeek: trainingDays,
        defaultRestSeconds: 90,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear perfil");
      setStep("dias");
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {step !== "bienvenida" && step !== "generando" && (
        <div className="step-indicator" style={{ paddingTop: "var(--space-lg)" }}>
          {STEPS.filter((s) => s !== "bienvenida" && s !== "generando").map((s) => (
            <div
              key={s}
              className={`step-dot ${STEPS.indexOf(s) < stepIndex ? "done" : ""} ${s === step ? "active" : ""}`}
            />
          ))}
        </div>
      )}

      {step === "bienvenida" && (
        <div className="onboarding-step animate-fade-in">
          <div style={{ fontSize: "4rem" }}>🏋️</div>
          <h2>Bienvenido a NoobGains</h2>
          <p className="text-muted" style={{ maxWidth: 300 }}>
            Tu entrenador personal de gimnasio con inteligencia artificial. Vamos a configurar tu perfil para
            crear tu primera rutina.
          </p>
          <button className="btn btn-primary btn-large" onClick={handleNext} style={{ maxWidth: 300 }}>
            Empezar
          </button>
        </div>
      )}

      {step === "nacimiento" && (
        <div className="onboarding-step animate-fade-in">
          <div style={{ fontSize: "3rem" }}>📅</div>
          <h2>¿Cuándo naciste?</h2>
          <p className="text-muted">Necesitamos tu edad para personalizar la rutina.</p>
          <div className="input-group" style={{ width: "100%", maxWidth: 300 }}>
            <input
              type="date"
              className="input"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              style={{ fontSize: "1.1rem", textAlign: "center" }}
            />
          </div>
          <div className="flex gap-md" style={{ maxWidth: 300, width: "100%" }}>
            <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
              Atrás
            </button>
            <button className="btn btn-primary" onClick={handleNext} disabled={!dob} style={{ flex: 2 }}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {step === "medidas" && (
        <div className="onboarding-step animate-fade-in">
          <div style={{ fontSize: "3rem" }}>📏</div>
          <h2>Tus medidas</h2>
          <p className="text-muted">Peso y altura para calcular tu IMC.</p>
          <div style={{ display: "flex", gap: "var(--space-md)", maxWidth: 300, width: "100%" }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Peso (kg)</label>
              <input
                type="number"
                className="input input-number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="75"
                min="20"
                max="300"
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
                placeholder="175"
                min="100"
                max="250"
              />
            </div>
          </div>
          <div className="flex gap-md" style={{ maxWidth: 300, width: "100%" }}>
            <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
              Atrás
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!weight || !height}
              style={{ flex: 2 }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {step === "imc" && (
        <div className="onboarding-step animate-fade-in">
          <h2>Tu Índice de Masa Corporal</h2>
          <div className="card" style={{ width: "100%", maxWidth: 320 }}>
            <div className="bmi-display">
              <div className="bmi-value" style={{ color: bmiInfo.color }}>
                {bmi}
              </div>
              <div style={{ marginTop: "var(--space-sm)", fontSize: "1.1rem", color: bmiInfo.color, fontWeight: 600 }}>
                {bmiInfo.emoji} {bmiInfo.category}
              </div>
              <div className="bmi-bar" style={{ marginTop: "var(--space-lg)" }}>
                <div className="bmi-marker" style={{ left: `${bmiMarkerPosition(bmi)}%` }} />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                }}
              >
                <span>Bajo</span>
                <span>Normal</span>
                <span>Sobrepeso</span>
                <span>Obesidad</span>
              </div>
            </div>
          </div>
          <div className="flex gap-md" style={{ maxWidth: 300, width: "100%" }}>
            <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
              Atrás
            </button>
            <button className="btn btn-primary" onClick={handleNext} style={{ flex: 2 }}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {step === "actividad" && (
        <div className="onboarding-step animate-fade-in">
          <div style={{ fontSize: "3rem" }}>🏃</div>
          <h2>Tu nivel de actividad</h2>
          <p className="text-muted">¿Cómo describirías tu nivel de actividad actual?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", width: "100%", maxWidth: 320 }}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`card ${activityLevel === opt.value ? "card-glow" : ""}`}
                onClick={() => setActivityLevel(opt.value)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  border: activityLevel === opt.value ? "1px solid var(--accent)" : undefined,
                }}
              >
                <div className="flex items-center gap-md">
                  <span style={{ fontSize: "1.5rem" }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{opt.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-md" style={{ maxWidth: 300, width: "100%" }}>
            <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
              Atrás
            </button>
            <button className="btn btn-primary" onClick={handleNext} style={{ flex: 2 }}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {step === "dias" && (
        <div className="onboarding-step animate-fade-in">
          <div style={{ fontSize: "3rem" }}>📆</div>
          <h2>Días de entrenamiento</h2>
          <p className="text-muted">¿Cuántos días por semana quieres entrenar?</p>
          <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "center" }}>
            {[2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                className={`btn ${trainingDays === d ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTrainingDays(d)}
                style={{ width: 52, height: 52, fontSize: "1.2rem", borderRadius: "var(--radius-md)" }}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            {trainingDays === 2 && "Full body × 2"}
            {trainingDays === 3 && "Push / Pull / Legs"}
            {trainingDays === 4 && "Upper / Lower × 2"}
            {trainingDays === 5 && "Push / Pull / Legs + Upper / Lower"}
            {trainingDays === 6 && "Push / Pull / Legs × 2"}
          </p>
          {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>}
          <div className="flex gap-md" style={{ maxWidth: 300, width: "100%" }}>
            <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
              Atrás
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ flex: 2 }}>
              {loading ? "Creando..." : "Crear Perfil"}
            </button>
          </div>
        </div>
      )}

      {step === "generando" && (
        <div className="onboarding-step animate-fade-in">
          <div style={{ fontSize: "4rem", animation: "pulse-glow 1s infinite alternate" }}>🤖</div>
          <h2>Creando tu perfil...</h2>
          <p className="text-muted">Estamos preparando todo para ti.</p>
          <div className="skeleton" style={{ width: 200, height: 8, margin: "0 auto" }} />
        </div>
      )}
    </div>
  );
}
