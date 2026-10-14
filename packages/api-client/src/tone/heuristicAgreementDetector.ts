import type { AgreementDetector, AgreementDetectionResult } from "@alba/core";

const CONFIRMATION_PATTERNS = [/\bva\b/i, /\bde\s+acuerdo\b/i, /\bconfirmado\b/i, /\bperfecto\b/i, /\bsale\b/i, /\bok(?:ay)?\b/i];
const QUESTION_PATTERN = /[¿?]/;

/**
 * Heurístico simple para construir y probar el flujo sin depender de una
 * API key de Anthropic — no es el análisis real, solo imita su forma de
 * salida. Mismo criterio que heuristicToneAnalyzer.ts: reemplazar por
 * AnthropicAgreementDetector en cuanto exista la key.
 */
export function createHeuristicAgreementDetector(): AgreementDetector {
  return {
    async detect(messages): Promise<AgreementDetectionResult> {
      if (messages.length < 2) return { isAgreement: false, description: null };

      const last = messages[messages.length - 1];
      const previous = messages[messages.length - 2];

      const lastConfirms = CONFIRMATION_PATTERNS.some((p) => p.test(last.body));
      const previousProposed = QUESTION_PATTERN.test(previous.body);

      if (lastConfirms && previousProposed) {
        // previous.senderLabel ya viene calculado correctamente (quién mandó
        // ESE mensaje) — invertirlo con un ternario (como estaba antes)
        // atribuía la propuesta al progenitor equivocado. Confirmado en
        // verificación en vivo: con B proponiendo y A confirmando, el texto
        // decía "Tú propuso... y Tú lo confirmó" (los dos "Tú"), en vez de
        // "El otro progenitor propuso... y Tú lo confirmó".
        return {
          isAgreement: true,
          description: `${previous.senderLabel} propuso algo y ${last.senderLabel} lo confirmó: "${previous.body.replace(/[¿?]/g, "").trim()}"`,
        };
      }

      return { isAgreement: false, description: null };
    },
  };
}
