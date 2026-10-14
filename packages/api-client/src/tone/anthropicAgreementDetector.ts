import Anthropic from "@anthropic-ai/sdk";
import type { AgreementDetector, AgreementDetectionResult } from "@alba/core";
import { extractJson } from "./extractJson";

const SYSTEM_PROMPT = `Eres el detector de acuerdos de ALBA, una app de coparentalidad. Revisas los últimos mensajes de una conversación entre dos progenitores y decides si concluyeron en un acuerdo concreto (una fecha, hora, actividad, responsabilidad, etc.) que valdría la pena registrar formalmente.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"isAgreement": boolean, "description": string | null}

- "isAgreement": true SOLO si la conversación reciente concluye en algo concreto que ambos progenitores parecen aceptar. Una pregunta sin responder, o una propuesta que sigue en discusión, NO cuenta.
- "description": una sola frase en español, en tercera persona, resumiendo el acuerdo (ej. "Acuerdan que Eugenia va al pediatra el jueves a las 5pm"). null cuando isAgreement es false.
- Nunca inventes fechas, horas o nombres que no estén explícitos en los mensajes.`;

function formatConversation(messages: { senderLabel: "Tú" | "El otro progenitor"; body: string }[]): string {
  return messages.map((m) => `${m.senderLabel}: ${m.body}`).join("\n");
}

/**
 * Implementación real — nunca se llama desde el cliente (la API key no
 * puede vivir en un binario/bundle del navegador). Se instancia server-side
 * en apps/web/src/lib/repository.ts cuando existe ANTHROPIC_API_KEY, mismo
 * criterio que createAnthropicToneAnalyzer.
 */
export function createAnthropicAgreementDetector(apiKey: string): AgreementDetector {
  const client = new Anthropic({ apiKey });

  return {
    async detect(messages): Promise<AgreementDetectionResult> {
      if (messages.length === 0) return { isAgreement: false, description: null };

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: formatConversation(messages) }],
      });

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "{}";

      let parsed: { isAgreement?: boolean; description?: string | null };
      try {
        parsed = JSON.parse(extractJson(text));
      } catch (err) {
        // Fallar hacia "no es acuerdo" en vez de romper el envío del
        // mensaje por un error de parseo — mismo criterio que
        // anthropicToneAnalyzer. Se loguea fuerte porque significa que el
        // modelo devolvió algo no parseable.
        console.error("[anthropicAgreementDetector] respuesta no parseable como JSON", { text, err });
        return { isAgreement: false, description: null };
      }

      if (parsed.isAgreement === true && typeof parsed.description === "string" && parsed.description.trim().length > 0) {
        return { isAgreement: true, description: parsed.description.trim() };
      }
      return { isAgreement: false, description: null };
    },
  };
}
