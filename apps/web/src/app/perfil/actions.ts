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

/** Todas las listas dinámicas del formulario (contactos, salud, escuela,
 * notas) llegan como JSON armado client-side (ChildDetailsForm) — un
 * <form> sin JS no alcanza para mandar un arreglo que crece/encoge como
 * campos sueltos. */
function parseJsonArray(formData: FormData, field: string): unknown {
  try {
    const parsed = JSON.parse(String(formData.get(field) ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function updateChildDetailsAction(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");

  const input = updateChildDetailsInputSchema.parse({
    contacts: parseJsonArray(formData, "contactsJson"),
    healthProviders: parseJsonArray(formData, "healthProvidersJson"),
    schoolName: formData.get("schoolName"),
    schoolContacts: parseJsonArray(formData, "schoolContactsJson"),
    allergies: formData.get("allergies"),
    notes: parseJsonArray(formData, "notesJson"),
  });

  const { pairing, parentId } = await getRequestContext();
  await pairing.updateChildDetails(parentId, childId, input);
  revalidatePath(`/perfil/hijo/${childId}`);
}
