"use server";

import { revalidatePath } from "next/cache";
import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID } from "@/lib/demoSession";

export async function createInvitationAction() {
  await pairingRepository.getOrCreateMyFamily(DEMO_PARENT_A_ID);
  await pairingRepository.createInvitation(DEMO_PARENT_A_ID);
  revalidatePath("/registro");
}

export async function createChildAction(formData: FormData) {
  const fullName = String(formData.get("childFullName") ?? "").trim();
  const birthDate = String(formData.get("childBirthDate") ?? "");

  if (fullName.length < 2 || !birthDate) {
    throw new Error("Nombre y fecha de nacimiento son requeridos");
  }

  await pairingRepository.getOrCreateMyFamily(DEMO_PARENT_A_ID);
  await pairingRepository.createChild(DEMO_PARENT_A_ID, { fullName, birthDate });
  revalidatePath("/registro");
}
