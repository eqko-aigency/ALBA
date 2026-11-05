import type { CustodyDocumentAnalyzer } from "@alba/core";

/**
 * Heurístico para probar el flujo sin ANTHROPIC_API_KEY — IGNORA por
 * completo el contenido del documento (no hay forma de "leerlo" sin una
 * API real) y devuelve una propuesta fija de ejemplo usando los primeros
 * hijo(s)/progenitores de la familia. Mismo criterio que
 * heuristicAgreementDetector.ts: imita la FORMA de la salida real, no el
 * análisis. Se reemplaza por createAnthropicCustodyDocumentAnalyzer en
 * cuanto exista la key.
 */
export function createHeuristicCustodyDocumentAnalyzer(): CustodyDocumentAnalyzer {
  return {
    async proposeSchedule({ children, familyMembers }) {
      if (children.length === 0 || familyMembers.length === 0) return { slots: [] };
      const child = children[0];
      const [parentA, parentB] = familyMembers;

      return {
        slots: [
          { childId: child.id, parentId: parentA.id, weekday: 1, startTime: "08:00", endTime: "18:00" },
          { childId: child.id, parentId: parentA.id, weekday: 3, startTime: "08:00", endTime: "18:00" },
          { childId: child.id, parentId: (parentB ?? parentA).id, weekday: 5, startTime: "08:00", endTime: "18:00" },
        ],
      };
    },

    async proposeReminders({ children }) {
      if (children.length === 0) return { reminders: [] };
      const child = children[0];
      const today = new Date();
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);
      const toDateKey = (d: Date) => d.toISOString().slice(0, 10);

      return {
        reminders: [
          {
            title: `Entrega de útiles escolares de ${child.fullName} (ejemplo detectado)`,
            childId: child.id,
            startDate: toDateKey(in30Days),
            endDate: toDateKey(in30Days),
          },
        ],
      };
    },
  };
}
