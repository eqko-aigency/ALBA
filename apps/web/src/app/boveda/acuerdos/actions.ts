"use server";

import { revalidatePath } from "next/cache";
import { verbalAgreementInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function createVerbalAgreementAction(formData: FormData) {
  const input = verbalAgreementInputSchema.parse({
    childId: formData.get("childId"),
    description: formData.get("description"),
    agreedAt: formData.get("agreedAt"),
  });
  const { verbalAgreements, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await verbalAgreements.createVerbalAgreement(parentId, input);
  revalidatePath("/boveda/acuerdos");
}

export async function confirmVerbalAgreementAction(formData: FormData) {
  const agreementId = String(formData.get("agreementId") ?? "");
  const { verbalAgreements, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await verbalAgreements.confirmVerbalAgreement(parentId, agreementId);
  revalidatePath("/boveda/acuerdos");
}
