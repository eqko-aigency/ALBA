"use server";

import { redirect } from "next/navigation";
import { setWhatsappNumberInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function setWhatsappNumberAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const input = setWhatsappNumberInputSchema.parse({ whatsappNumber: formData.get("whatsappNumber") });
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.setWhatsappNumber(parentId, input);
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
