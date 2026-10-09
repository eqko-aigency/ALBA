"use server";

import { revalidatePath } from "next/cache";
import { getRequestContext } from "@/lib/repository";

export async function createInvitationAction() {
  const { pairing, parentId } = await getRequestContext();
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.createInvitation(parentId);
  revalidatePath("/registro");
}

export async function createChildAction(formData: FormData) {
  const fullName = String(formData.get("childFullName") ?? "").trim();
  const birthDate = String(formData.get("childBirthDate") ?? "");

  if (fullName.length < 2 || !birthDate) {
    throw new Error("Nombre y fecha de nacimiento son requeridos");
  }

  const { pairing, parentId } = await getRequestContext();
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.createChild(parentId, { fullName, birthDate });
  revalidatePath("/registro");
}
