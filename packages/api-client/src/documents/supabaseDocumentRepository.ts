import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMerkleRoot, computeSha256Hex } from "@alba/core";
import type { Document, DocumentRepository } from "@alba/core";
import { createFamilyIdResolver } from "../family/resolveFamilyId";

const BUCKET = "documentos";

export function createSupabaseDocumentRepository(client: SupabaseClient): DocumentRepository {
  const getMyFamilyId = createFamilyIdResolver(client);

  return {
    async listDocuments(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data, error } = await client
        .from("documents")
        .select()
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDocument);
    },

    async getDocument(parentId, documentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;
      const { data, error } = await client
        .from("documents")
        .select()
        .eq("id", documentId)
        .eq("family_id", familyId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDocument(data) : null;
    },

    async uploadDocument(parentId, input) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) {
        throw new Error("No perteneces a ninguna familia todavía — empareja al otro progenitor en /registro.");
      }

      // El hash SHA-256 se calcula acá, sobre los mismos bytes que se suben
      // a Storage en el siguiente paso — nunca en el cliente (README.md,
      // "Reglas de arquitectura no negociables"). computeSha256Hex es puro
      // y determinístico (packages/core/src/evidence/merkleEngine.ts).
      const sha256Hex = computeSha256Hex(input.fileBytes);

      const safeName = input.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${familyId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(path, input.fileBytes, { contentType: input.mimeType || undefined });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = client.storage.from(BUCKET).getPublicUrl(path);

      // Insert directo siguiendo el patrón normal de RLS (igual que
      // children/invitations/chat/custody_events/expenses) — ver nota en
      // 0011_boveda.sql sobre por qué esto es distinto del UPDATE de
      // anclaje (anchorPendingDocuments abajo), que sí necesita RPC.
      const { data, error } = await client
        .from("documents")
        .insert({
          family_id: familyId,
          uploaded_by_parent_id: parentId,
          title: input.title,
          file_url: publicUrlData.publicUrl,
          sha256_hex: sha256Hex,
          merkle_root: null,
          anchor_status: "pending",
          anchor_reference: null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapDocument(data);
    },

    async anchorPendingDocuments(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];

      const { data: pending, error: pendingError } = await client
        .from("documents")
        .select()
        .eq("family_id", familyId)
        .eq("anchor_status", "pending");
      if (pendingError) throw pendingError;
      if (!pending || pending.length === 0) return [];

      const merkleRoot = buildMerkleRoot(pending.map((d: any) => d.sha256_hex));
      const anchorReference = buildAnchorReference(merkleRoot);

      // La tabla "documents" deliberadamente NO tiene política de UPDATE
      // (ver 0011_boveda.sql) — los documentos son evidencia y sus campos
      // core deben quedar inmutables. anchor_pending_documents() es una
      // función SECURITY DEFINER acotada: solo puede tocar las columnas de
      // anclaje de los documentos "pending" de la familia del caller,
      // nunca title/file_url/sha256_hex. El cálculo de la raíz Merkle ya
      // viene hecho (arriba, con buildMerkleRoot de @alba/core) — la
      // función SQL solo persiste el resultado.
      const { data, error } = await client.rpc("anchor_pending_documents", {
        p_merkle_root: merkleRoot,
        p_anchor_reference: anchorReference,
      });
      if (error) throw error;
      return (data ?? []).map(mapDocument);
    },
  };
}

/**
 * Referencia de anclaje — POC de "blockchain pública" SIN wallet, SDK ni
 * red real de por medio (exactamente el mismo criterio que
 * createHeuristicToneAnalyzer antes de tener ANTHROPIC_API_KEY real: un
 * placeholder funcional para poder demostrar el ciclo completo
 * pendiente → anclado, no una integración real). Se deriva
 * determinísticamente de la raíz Merkle + un timestamp, con un formato que
 * se parece a una referencia de transacción on-chain. Reemplazar por una
 * integración real (ej. anclar la raíz en una red pública) es trabajo de
 * una etapa futura, fuera del alcance de esta Beta.
 */
function buildAnchorReference(merkleRoot: string): string {
  const timestamp = Date.now();
  const short = computeSha256Hex(new TextEncoder().encode(`${merkleRoot}:${timestamp}`)).slice(0, 16);
  return `poc-anchor:0x${short}:${timestamp}`;
}

function mapDocument(row: any): Document {
  return {
    id: row.id,
    familyId: row.family_id,
    uploadedByParentId: row.uploaded_by_parent_id,
    title: row.title,
    fileUrl: row.file_url,
    sha256Hex: row.sha256_hex,
    merkleRoot: row.merkle_root,
    anchorStatus: row.anchor_status,
    anchorReference: row.anchor_reference,
    createdAt: row.created_at,
  };
}
