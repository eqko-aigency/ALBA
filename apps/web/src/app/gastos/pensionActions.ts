"use server";

import { revalidatePath } from "next/cache";
import { pensionPaymentInputSchema, pensionSettingsInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

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
  const { pension, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await pension.registerPayment(parentId, input);
  revalidatePath("/gastos");
}

export async function confirmPensionPaymentAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  const { pension, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await pension.confirmPayment(parentId, paymentId);
  revalidatePath("/gastos");
}
