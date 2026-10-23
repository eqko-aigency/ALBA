"use server";

import { revalidatePath } from "next/cache";
import { documentUploadInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

/**
 * A diferencia de Gastos (createExpenseAction), acá NO hay fallback de
 * URL manual: el archivo siempre se sube de verdad, porque el hash
 * SHA-256 (computeSha256Hex, calculado dentro de documents.uploadDocument
 * — ver supabaseDocumentRepository.ts) se calcula sobre esos bytes
 * server-side y no tiene sentido sin el archivo real. file.arrayBuffer()
 * lee los bytes en el servidor (Server Action, nunca en el cliente) —
 * esto es lo que exige README.md en "Hash evidenciario".
 *
 * Devuelve {error}|{success} en vez de lanzar: antes, un título muy corto
 * o cualquier error de subida tronaba directo al error boundary genérico
 * sin explicar qué pasó — exactamente lo que reportó la clienta ("al
 * principio no me dejó subir un documento"). El mensaje de "no perteneces
 * a ninguna familia" (supabaseDocumentRepository.ts) también se reescribe
 * acá para no mostrarle la ruta técnica "/registro" a la usuaria.
 */
export async function uploadDocumentAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const as = String(formData.get("as") ?? "");
  const parsedTitle = documentUploadInputSchema.safeParse({ title: formData.get("title") });
  if (!parsedTitle.success) {
    return { error: "El título debe tener entre 3 y 160 caracteres." };
  }
  const { title } = parsedTitle.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo o toma una foto — en Bóveda el documento siempre se sube de verdad." };
  }
  const rawChildId = String(formData.get("childId") ?? "");
  const childId = rawChildId.length > 0 ? rawChildId : null;

  const fileBytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { documents, pairing, parentId } = await getRequestContext(as);
    await documents.uploadDocument(parentId, {
      title,
      fileBytes,
      fileName: file.name,
      mimeType: file.type,
      childId,
    });

    revalidatePath("/boveda");

    const family = await pairing.getOrCreateMyFamily(parentId);
    await notifyFamilyMembers({
      familyId: family.id,
      excludeParentId: parentId,
      title: "Nuevo documento en Bóveda",
      body: title,
      url: "/boveda",
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message.includes("No perteneces a ninguna familia")) {
      return { error: "Primero necesitas emparejarte con el otro progenitor para subir documentos." };
    }
    return { error: "No se pudo subir el documento. Intenta de nuevo." };
  }
}

/**
 * Anclaje (POC) — disparado por un botón explícito en la UI, no
 * automático, así el progenitor ve el ciclo completo pendiente → anclado
 * en la demo. Ancla TODOS los documentos "pending" de la familia bajo
 * una sola raíz Merkle (ver anchorPendingDocuments en
 * supabaseDocumentRepository.ts / mockDocumentRepository.ts).
 */
export async function anchorPendingDocumentsAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const { documents, parentId } = await getRequestContext(as);
  await documents.anchorPendingDocuments(parentId);

  revalidatePath("/boveda");
}
