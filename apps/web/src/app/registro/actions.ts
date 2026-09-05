"use server";

import { revalidatePath } from "next/cache";
import { createInvitationInputSchema } from "@alba/core";
import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID } from "@/lib/demoSession";

export async function createChildAction(formData: FormData) {
  const fullName = String(formData.get("childFullName") ?? "").trim();
  const birthDate = String(formData.get("childBirthDate") ?? "");

  if (fullName.length < 2 || !birthDate) {
    throw new Error("Nombre y fecha de nacimiento son requeridos");
  }

  await pairingRepository.createChild(DEMO_PARENT_A_ID, { fullName, birthDate });
  revalidatePath("/registro");
}

export async function createInvitationAction(formData: FormData) {
  const input = createInvitationInputSchema.parse({ childId: formData.get("childId") });
  await pairingRepository.createInvitation(DEMO_PARENT_A_ID, input);
  revalidatePath("/registro");
}
