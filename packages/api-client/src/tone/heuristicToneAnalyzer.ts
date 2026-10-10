import type { ToneAnalyzer, ToneAnalysis, ToneLevel } from "@alba/core";

const HOSTILE_PATTERNS = [
  /\bnunca\s+haces\b/i,
  /\bsiempre\s+haces\b/i,
  // Antes "eres un/una " solo, sin exigir una palabra ofensiva después —
  // marcaba como hostil frases como "eres un gran papá". Ahora exige que
  // le siga un insulto conocido.
  /\beres\s+un[a]?\s+(idiota|estúpid[oa]|inútil|imbécil|tont[oa]|desastre|fracasad[oa])\b/i,
  /\bme\s+vale\b/i,
  /\bno\s+me\s+importa\b/i,
  /\bidiota\b/i,
  /\bestúpid[oa]\b/i,
  /\binútil\b/i,
  // Lenguaje de amenaza o violencia — la categoría más grave, faltaba por
  // completo: el heurístico solo cubría insultos, no amenazas.
  /\bte\s+voy\s+a\s+(matar|golpear|pegar|lastimar)\b/i,
  /\b(matar|golpear|lastimar)te\b/i,
  /\bte\s+quiero\s+matar\b/i,
  /\bamenaza/i,
];

const TENSE_PATTERNS = [/\botra\s+vez\b/i, /\bde\s+nuevo\b/i, /\bcomo\s+siempre\b/i, /\bya\s+basta\b/i];

/**
 * Heurístico simple para construir y probar el flujo del Tone Meter sin
 * depender de una API key de Anthropic — no es el análisis real, solo
 * imita sus tres niveles de salida. Reemplazar por AnthropicToneAnalyzer
 * en cuanto exista la key.
 */
export function createHeuristicToneAnalyzer(): ToneAnalyzer {
  return {
    async analyze(body) {
      const level = classify(body);
      return { level, suggestion: level === "neutral" ? null : soften(body) };
    },
  };
}

function classify(body: string): ToneLevel {
  const isShouting = body.length > 12 && body === body.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(body);
  const hasHeavyPunctuation = /[!?]{2,}/.test(body);

  if (HOSTILE_PATTERNS.some((p) => p.test(body)) || (isShouting && hasHeavyPunctuation)) {
    return "hostil";
  }
  if (TENSE_PATTERNS.some((p) => p.test(body)) || isShouting || hasHeavyPunctuation) {
    return "tenso";
  }
  return "neutral";
}

function soften(body: string): string {
  const cleaned = body
    .replace(/[!?]{2,}/g, (m) => m[0])
    .toLowerCase()
    .trim();
  return `Me gustaría platicar sobre esto: ${cleaned}`;
}
