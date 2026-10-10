"use server";

import { revalidatePath } from "next/cache";
import { documentUploadInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

/**
 * A diferencia de Gastos (createExpenseAction), acá NO hay fallback de
 * URL manual: el archivo siempre se sube de verdad, porque el hash
 * SHA-256 (computeSha256Hex, calculado dentro de documents.uploadDocument
 * — ver supabaseDocumentRepository.ts) se calcula sobre esos bytes
 * server-side y no tiene sentido sin el archivo real. file.arrayBuffer()
 * lee los bytes en el servidor (Server Action, nunca en el cliente) —
 * esto es lo que exige README.md en "Hash evidenciario".
 */
export async function uploadDocumentAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const { title } = documentUploadInputSchema.parse({ title: formData.get("title") });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona un archivo — en Bóveda el documento siempre se sube de verdad.");
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());

  const { documents, parentId } = await getRequestContext(as);
  await documents.uploadDocument(parentId, {
    title,
    fileBytes,
    fileName: file.name,
    mimeType: file.type,
  });

  revalidatePath("/boveda");
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
