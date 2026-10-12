import type { PairingRepository, VerbalAgreement, VerbalAgreementInput, VerbalAgreementRepository } from "@alba/core";

/**
 * Implementación en memoria de Acuerdos verbales — mismo patrón que
 * mockDocumentRepository: depende de PairingRepository para resolver a qué
 * familia pertenece cada progenitor.
 */
export function createMockVerbalAgreementRepository(pairingRepository: PairingRepository): VerbalAgreementRepository {
  const agreements = new Map<string, VerbalAgreement>();

  async function getFamilyId(parentId: string): Promise<string> {
    const family = await pairingRepository.getOrCreateMyFamily(parentId);
    return family.id;
  }

  return {
    async listVerbalAgreements(parentId) {
      const familyId = await getFamilyId(parentId);
      return [...agreements.values()]
        .filter((a) => a.familyId === familyId)
        .sort((a, b) => new Date(b.agreedAt).getTime() - new Date(a.agreedAt).getTime());
    },

    async createVerbalAgreement(parentId, input: VerbalAgreementInput) {
      const familyId = await getFamilyId(parentId);
      const agreement: VerbalAgreement = {
        id: crypto.randomUUID(),
        familyId,
        createdByParentId: parentId,
        childId: input.childId,
        description: input.description,
        agreedAt: input.agreedAt,
        confirmedByParentId: null,
        confirmedAt: null,
        createdAt: new Date().toISOString(),
      };
      agreements.set(agreement.id, agreement);
      return agreement;
    },

    async confirmVerbalAgreement(parentId, agreementId) {
      const familyId = await getFamilyId(parentId);
      const agreement = agreements.get(agreementId);
      if (!agreement || agreement.familyId !== familyId) throw new Error("acuerdo no encontrado");
      if (agreement.createdByParentId === parentId) {
        throw new Error("quien registró el acuerdo no puede confirmarlo — necesita al otro progenitor");
      }
      if (!agreement.confirmedAt) {
        agreement.confirmedByParentId = parentId;
        agreement.confirmedAt = new Date().toISOString();
      }
      return agreement;
    },
  };
}
