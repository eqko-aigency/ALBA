import Anthropic from "@anthropic-ai/sdk";
import type { ToneAnalyzer, ToneAnalysis, ToneLevel } from "@alba/core";

const SYSTEM_PROMPT = `Eres el Tone Meter de ALBA, una app de coparentalidad. Analizas UN mensaje que un progenitor está por enviar al otro y evalúas si su tono podría escalar el conflicto.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"level": "neutral" | "tenso" | "hostil", "suggestion": string | null}

- "neutral": el mensaje es informativo o cordial. suggestion debe ser null.
- "tenso": hay indirectas, sarcasmo o acumulación de quejas. suggestion es una reformulación más calmada, misma información, sin acusaciones.
- "hostil": hay insultos, amenazas o descalificaciones. suggestion es una reformulación que preserva la intención (ej. pedir algo, poner un límite) sin el lenguaje agresivo.

Nunca inventes hechos que no estén en el mensaje original. No agregues explicaciones fuera del JSON.`;

/**
 * Haiku a veces envuelve el JSON en un bloque de markdown (```json ... ```)
 * pese a que el prompt pide "ÚNICAMENTE JSON" — eso rompía JSON.parse()
 * directo y caía siempre al fallback de "neutral" en silencio, dejando
 * pasar mensajes hostiles sin aviso. Quita el fencing y se queda solo con
 * el primer bloque {...} del texto.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const braces = candidate.match(/\{[\s\S]*\}/);
  return braces ? braces[0] : candidate;
}

/**
 * Implementación real — nunca se llama desde el cliente (la API key no
 * puede vivir en un binario/bundle del navegador). Se instancia server-side
 * en apps/web/src/lib/repository.ts cuando existe ANTHROPIC_API_KEY.
 */
export function createAnthropicToneAnalyzer(apiKey: string): ToneAnalyzer {
  const client = new Anthropic({ apiKey });

  return {
    async analyze(body): Promise<ToneAnalysis> {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: body }],
      });

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "{}";

      let parsed: { level?: string; suggestion?: string | null };
      try {
        parsed = JSON.parse(extractJson(text));
      } catch (err) {
        // Fallar hacia "neutral" en vez de bloquear el envío del mensaje
        // por un error de parseo — pero logueando fuerte, porque esto
        // significa que un mensaje genuinamente hostil pudo pasar sin
        // aviso. Antes fallaba en silencio total, sin señal de que el
        // modelo está devolviendo algo no parseable.
        console.error("[anthropicToneAnalyzer] respuesta no parseable como JSON, fallback a neutral", {
          text,
          err,
        });
        return { level: "neutral", suggestion: null };
      }

      const level: ToneLevel =
        parsed.level === "tenso" || parsed.level === "hostil" ? parsed.level : "neutral";
      return { level, suggestion: level === "neutral" ? null : (parsed.suggestion ?? null) };
    },
  };
}
