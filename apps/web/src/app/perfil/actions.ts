"use server";

import { revalidatePath } from "next/cache";
import { updateChildInputSchema, upsertProfileInputSchema } from "@alba/core";
import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID } from "@/lib/demoSession";

export async function upsertProfileAction(formData: FormData) {
  const input = upsertProfileInputSchema.parse({ fullName: formData.get("parentFullName") });
  await pairingRepository.upsertProfile(DEMO_PARENT_A_ID, input);
  revalidatePath("/perfil");
}

export async function updateChildAction(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const input = updateChildInputSchema.parse({
    fullName: formData.get("childFullName"),
    birthDate: formData.get("childBirthDate"),
  });
  await pairingRepository.updateChild(DEMO_PARENT_A_ID, childId, input);
  revalidatePath("/perfil");
}
