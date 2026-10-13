"use server";

import { revalidatePath } from "next/cache";
import { pensionPaymentInputSchema, pensionSettingsInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export async function upsertPensionSettingsAction(formData: FormData) {
  const input = pensionSettingsInputSchema.parse({
    payerParentId: formData.get("payerParentId"),
    amountMxn: Number(formData.get("amountMxn")),
    dueDay: formData.get("dueDay"),
  });
  const { pension, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await pension.upsertSettings(parentId, input);
  revalidatePath("/gastos");
}

export async function registerPensionPaymentAction(formData: FormData) {
  const input = pensionPaymentInputSchema.parse({ period: formData.get("period") });
  const { pension, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  const payment = await pension.registerPayment(parentId, input);
  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Pago de pensión registrado",
    body: `${payment.period} — ${MXN.format(payment.amountMxn)}`,
    url: "/gastos?tab=pension",
  });
}

export async function confirmPensionPaymentAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  const { pension, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  const payment = await pension.confirmPayment(parentId, paymentId);
  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Confirmaron tu pago de pensión",
    body: `${payment.period} — ${MXN.format(payment.amountMxn)}`,
    url: "/gastos?tab=pension",
  });
}
