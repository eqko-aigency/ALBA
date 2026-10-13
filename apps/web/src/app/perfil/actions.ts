"use server";

import { revalidatePath } from "next/cache";
import { updateChildDetailsInputSchema, updateChildInputSchema, upsertProfileInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function upsertProfileAction(formData: FormData) {
  const input = upsertProfileInputSchema.parse({ fullName: formData.get("parentFullName") });
  const { pairing, parentId } = await getRequestContext();
  await pairing.upsertProfile(parentId, input);
  revalidatePath("/perfil");
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
  revalidatePath(`/perfil/hijo/${childId}`);
}

/**
 * contactsJson llega como JSON armado client-side (ChildDetailsForm) — la
 * lista de contactos es dinámica (agregar/quitar filas), así que un <form>
 * sin JS no alcanza para mandarla como campos sueltos.
 */
export async function updateChildDetailsAction(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  let contacts: unknown = [];
  try {
    contacts = JSON.parse(String(formData.get("contactsJson") ?? "[]"));
  } catch {
    contacts = [];
  }

  const input = updateChildDetailsInputSchema.parse({
    contacts,
    therapistName: formData.get("therapistName"),
    therapistPhone: formData.get("therapistPhone"),
    schoolName: formData.get("schoolName"),
    schoolContact: formData.get("schoolContact"),
    allergies: formData.get("allergies"),
    specialNotes: formData.get("specialNotes"),
    sleepRoutine: formData.get("sleepRoutine"),
  });

  const { pairing, parentId } = await getRequestContext();
  await pairing.updateChildDetails(parentId, childId, input);
  revalidatePath(`/perfil/hijo/${childId}`);
}
