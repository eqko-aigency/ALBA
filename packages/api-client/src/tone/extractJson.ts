/**
 * Haiku a veces envuelve el JSON en un bloque de markdown (```json ... ```)
 * pese a que el prompt pide "ÚNICAMENTE JSON" — sin esto, JSON.parse()
 * truena directo. Compartido entre anthropicToneAnalyzer y
 * anthropicAgreementDetector: ambos tienen exactamente el mismo problema.
 */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const braces = candidate.match(/\{[\s\S]*\}/);
  return braces ? braces[0] : candidate;
}
