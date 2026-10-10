const TOPIC_AVATAR_COLORS: Record<string, string> = {
  Salud: "bg-sea",
  Escuela: "bg-sky",
  Pensiones: "bg-purple",
  Vacaciones: "bg-dawn",
};

/** Color de fondo del avatar circular de un hilo — por tema, no por hijo
 * (un mismo tema siempre se ve igual, sea cual sea el hijo etiquetado). */
export function topicAvatarClass(topic: string): string {
  return TOPIC_AVATAR_COLORS[topic] ?? "bg-salmon";
}
