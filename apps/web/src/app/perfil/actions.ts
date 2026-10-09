"use server";

import { revalidatePath } from "next/cache";
import { updateChildInputSchema, upsertProfileInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function upsertProfileAction(formData: FormData) {
  const input = upsertProfileInputSchema.parse({ fullName: formData.get("parentFullName") });
  const { pairing, parentId } = await getRequestContext();
  await pairing.upsertProfile(parentId, input);
  revalidatePath("/perfil");
}

export async function updateChildAction(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const input = updateChildInputSchema.parse({
    fullName: formData.get("childFullName"),
    birthDate: formData.get("childBirthDate"),
  });
  const { pairing, parentId } = await getRequestContext();
  await pairing.updateChild(parentId, childId, input);
  revalidatePath("/perfil");
}
