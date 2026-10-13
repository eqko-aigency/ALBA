"use server";

import { revalidatePath } from "next/cache";
import { verbalAgreementInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

export async function createVerbalAgreementAction(formData: FormData) {
  const input = verbalAgreementInputSchema.parse({
    childId: formData.get("childId"),
    description: formData.get("description"),
    agreedAt: formData.get("agreedAt"),
  });
  const { verbalAgreements, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  const agreement = await verbalAgreements.createVerbalAgreement(parentId, input);
  revalidatePath("/boveda/acuerdos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo acuerdo verbal registrado",
    body: agreement.description.slice(0, 120),
    url: "/boveda/acuerdos",
  });
}

export async function confirmVerbalAgreementAction(formData: FormData) {
  const agreementId = String(formData.get("agreementId") ?? "");
  const { verbalAgreements, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  const agreement = await verbalAgreements.confirmVerbalAgreement(parentId, agreementId);
  revalidatePath("/boveda/acuerdos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Confirmaron tu acuerdo verbal",
    body: agreement.description.slice(0, 120),
    url: "/boveda/acuerdos",
  });
}
