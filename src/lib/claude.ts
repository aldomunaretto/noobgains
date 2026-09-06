import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
// 16000 (no 4096 como el legacy): en Sonnet 5 el thinking adaptativo consume
// del mismo presupuesto que el texto visible, y un plan de varios días con
// notes/form_tips por ejercicio necesita ese margen.
const MAX_TOKENS = 16000;
const JSON_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";
const DEFAULT_EFFORT: ClaudeEffort = "medium";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Distintas de un Error genérico para que callClaudeJson pueda decidir si
// reintentar (fallo de parseo/transitorio) o relanzar de inmediato (igual que
// el legacy hacía con "except HTTPException: raise" antes de capturar el resto).
export class ClaudeRateLimitError extends Error {}
export class ClaudeApiError extends Error {}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  effort: ClaudeEffort = DEFAULT_EFFORT,
): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      thinking: { type: "adaptive" },
      output_config: { effort },
    });

    // Sonnet 5 piensa por defecto (thinking adaptativo): el bloque de texto
    // no es necesariamente content[0] — ese suele ser el bloque "thinking"
    // que precede al texto real. Hay que buscarlo, no asumir la posición.
    const block = message.content.find((b) => b.type === "text");
    if (!block) {
      throw new ClaudeApiError("Claude no devolvió una respuesta de texto");
    }
    return block.text;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new ClaudeRateLimitError(
        "Límite de uso de la API de Claude alcanzado. Espera un minuto e inténtalo de nuevo.",
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new ClaudeApiError(`Error de la API de Claude: ${err.message}`);
    }
    throw err;
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.includes("```json")) {
    return trimmed.split("```json")[1].split("```")[0].trim();
  }
  if (trimmed.includes("```")) {
    return trimmed.split("```")[1].split("```")[0].trim();
  }
  return trimmed;
}

export async function callClaudeJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { retries?: number; effort?: ClaudeEffort },
): Promise<T> {
  const retries = options?.retries ?? JSON_RETRIES;
  const effort = options?.effort ?? DEFAULT_EFFORT;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let prompt = userPrompt;
    if (attempt > 0 && lastError) {
      prompt += `\n\n⚠️ El intento anterior falló con este error: ${lastError}\nPor favor corrige y devuelve JSON válido.`;
    }
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    try {
      const responseText = await callClaude(systemPrompt, prompt, effort);
      return JSON.parse(extractJson(responseText)) as T;
    } catch (err) {
      if (err instanceof ClaudeRateLimitError || err instanceof ClaudeApiError) {
        throw err;
      }
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(
    `Claude no devolvió JSON válido tras ${retries + 1} intentos. Último error: ${lastError}`,
  );
}
