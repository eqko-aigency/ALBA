import type { CustodyAgreement, CustodyEvent, CustodyEventType, CustodyRepository, CustodySlot, PairingRepository } from "@alba/core";

/**
 * Implementación en memoria del Calendario — mismo patrón que
 * mockChatRepository: depende de PairingRepository para resolver a qué
 * familia pertenece cada progenitor, así ambos repos comparten la misma
 * noción de "familia" sin duplicar ese estado.
 */
export function createMockCustodyRepository(pairingRepository: PairingRepository): CustodyRepository {
  const agreementsByFamily = new Map<string, CustodyAgreement>();
  const events = new Map<string, CustodyEvent>();

  async function getFamilyId(parentId: string): Promise<string> {
    const family = await pairingRepository.getOrCreateMyFamily(parentId);
    return family.id;
  }

  function getOrCreateAgreement(familyId: string): CustodyAgreement {
    let agreement = agreementsByFamily.get(familyId);
    if (!agreement) {
      // childId "" — el convenio es de la familia, no de un hijo en
      // particular; cada slot carga su propio childId. Ver comentario en
      // CustodyRepository (packages/core/src/domain/ports.ts).
      agreement = { id: crypto.randomUUID(), childId: "", toleranceMinutes: 15, slots: [] };
      agreementsByFamily.set(familyId, agreement);
    }
    return agreement;
  }

  // Mismo orden determinístico que supabaseCustodyRepository (weekday,
  // startTime) — necesario porque la UI remueve slots por índice dentro del
  // arreglo ya ordenado, no por id (CustodySlot no tiene id propio).
  function sortedSlots(agreement: CustodyAgreement): CustodySlot[] {
    return [...agreement.slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  }

  function confirm(parentId: string, childId: string, type: CustodyEventType, scheduledAt: string): CustodyEvent {
    const existing = [...events.values()].find(
      (e) => e.childId === childId && e.parentId === parentId && e.type === type && e.scheduledAt === scheduledAt
    );
    const confirmedAt = new Date().toISOString();
    if (existing) {
      existing.confirmedAt = confirmedAt;
      return existing;
    }
    const event: CustodyEvent = { id: crypto.randomUUID(), childId, parentId, type, scheduledAt, confirmedAt, location: null };
    events.set(event.id, event);
    return event;
  }

  return {
    async getMyAgreement(parentId) {
      const familyId = await getFamilyId(parentId);
      const agreement = getOrCreateAgreement(familyId);
      return { ...agreement, slots: sortedSlots(agreement) };
    },

    async upsertSlots(parentId, slots) {
      const familyId = await getFamilyId(parentId);
      const agreement = getOrCreateAgreement(familyId);
      agreement.slots = [...slots];
      return { ...agreement, slots: sortedSlots(agreement) };
    },

    async listEventsForWeek(parentId, weekStart) {
      const children = await pairingRepository.getMyChildren(parentId);
      const childIds = new Set(children.map((c) => c.id));
      const start = new Date(`${weekStart}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return [...events.values()].filter((e) => {
        if (!childIds.has(e.childId)) return false;
        const at = new Date(e.scheduledAt);
        return at >= start && at < end;
      });
    },

    async confirmCheckin(parentId, childId, scheduledAt) {
      return confirm(parentId, childId, "checkin", scheduledAt);
    },

    async confirmCheckout(parentId, childId, scheduledAt) {
      return confirm(parentId, childId, "checkout", scheduledAt);
    },
  };
}
