import type {
  PairingRepository,
  PensionPayment,
  PensionPaymentInput,
  PensionRepository,
  PensionSettings,
  PensionSettingsInput,
} from "@alba/core";

/**
 * Implementación en memoria de Pensión — mismo patrón que
 * mockVerbalAgreementRepository: depende de PairingRepository para
 * resolver a qué familia pertenece cada progenitor.
 */
export function createMockPensionRepository(pairingRepository: PairingRepository): PensionRepository {
  const settingsByFamily = new Map<string, PensionSettings>();
  const payments = new Map<string, PensionPayment>();

  async function getFamilyId(parentId: string): Promise<string> {
    const family = await pairingRepository.getOrCreateMyFamily(parentId);
    return family.id;
  }

  return {
    async getSettings(parentId) {
      const familyId = await getFamilyId(parentId);
      return settingsByFamily.get(familyId) ?? null;
    },

    async upsertSettings(parentId, input: PensionSettingsInput) {
      const familyId = await getFamilyId(parentId);
      const existing = settingsByFamily.get(familyId);
      const settings: PensionSettings = {
        id: existing?.id ?? crypto.randomUUID(),
        familyId,
        payerParentId: input.payerParentId,
        amountMxn: input.amountMxn,
        dueDay: input.dueDay,
      };
      settingsByFamily.set(familyId, settings);
      return settings;
    },

    async listPayments(parentId) {
      const familyId = await getFamilyId(parentId);
      return [...payments.values()]
        .filter((p) => p.familyId === familyId)
        .sort((a, b) => b.period.localeCompare(a.period));
    },

    async registerPayment(parentId, input: PensionPaymentInput) {
      const familyId = await getFamilyId(parentId);
      const settings = settingsByFamily.get(familyId);
      if (!settings) throw new Error("Configura el monto y día de vencimiento antes de registrar un pago.");
      const existing = [...payments.values()].find((p) => p.familyId === familyId && p.period === input.period);
      if (existing) return existing;

      const payment: PensionPayment = {
        id: crypto.randomUUID(),
        familyId,
        period: input.period,
        amountMxn: settings.amountMxn,
        paidByParentId: parentId,
        paidAt: new Date().toISOString(),
        confirmedByParentId: null,
        confirmedAt: null,
        createdAt: new Date().toISOString(),
      };
      payments.set(payment.id, payment);
      return payment;
    },

    async confirmPayment(parentId, paymentId) {
      const familyId = await getFamilyId(parentId);
      const payment = payments.get(paymentId);
      if (!payment || payment.familyId !== familyId) throw new Error("pago no encontrado");
      if (payment.paidByParentId === parentId) {
        throw new Error("quien registró el pago no puede confirmarlo — necesita al otro progenitor");
      }
      if (!payment.confirmedAt) {
        payment.confirmedByParentId = parentId;
        payment.confirmedAt = new Date().toISOString();
      }
      return payment;
    },
  };
}
