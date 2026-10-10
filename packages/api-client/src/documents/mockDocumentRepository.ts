import { buildMerkleRoot, computeSha256Hex } from "@alba/core";
import type { Document, DocumentRepository, PairingRepository } from "@alba/core";

/**
 * Implementación en memoria de Bóveda — mismo patrón que
 * mockExpenseRepository/mockCustodyRepository: depende de
 * PairingRepository para resolver a qué familia pertenece cada
 * progenitor. No hay Storage real en modo demo, así que fileUrl es una
 * referencia simulada (nunca un archivo descargable de verdad) — el hash
 * SHA-256 sí se calcula de verdad (computeSha256Hex es puro, no depende de
 * Storage), que es lo que importa para probar el ciclo completo
 * pendiente → anclado sin Supabase real.
 */
export function createMockDocumentRepository(pairingRepository: PairingRepository): DocumentRepository {
  const documents = new Map<string, Document>();

  async function getFamilyId(parentId: string): Promise<string> {
    const family = await pairingRepository.getOrCreateMyFamily(parentId);
    return family.id;
  }

  function buildAnchorReference(merkleRoot: string): string {
    const timestamp = Date.now();
    const short = computeSha256Hex(new TextEncoder().encode(`${merkleRoot}:${timestamp}`)).slice(0, 16);
    return `poc-anchor:0x${short}:${timestamp}`;
  }

  return {
    async listDocuments(parentId) {
      const familyId = await getFamilyId(parentId);
      return [...documents.values()]
        .filter((d) => d.familyId === familyId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async getDocument(parentId, documentId) {
      const familyId = await getFamilyId(parentId);
      const document = documents.get(documentId);
      return document && document.familyId === familyId ? document : null;
    },

    async uploadDocument(parentId, input) {
      const familyId = await getFamilyId(parentId);
      const sha256Hex = computeSha256Hex(input.fileBytes);
      const document: Document = {
        id: crypto.randomUUID(),
        familyId,
        uploadedByParentId: parentId,
        title: input.title,
        // Sin Storage real en modo demo — referencia simulada, nunca un
        // archivo descargable de verdad (ver comentario arriba).
        fileUrl: `demo://documentos/${familyId}/${Date.now()}-${input.fileName}`,
        sha256Hex,
        merkleRoot: null,
        anchorStatus: "pending",
        anchorReference: null,
        createdAt: new Date().toISOString(),
      };
      documents.set(document.id, document);
      return document;
    },

    async anchorPendingDocuments(parentId) {
      const familyId = await getFamilyId(parentId);
      const pending = [...documents.values()].filter(
        (d) => d.familyId === familyId && d.anchorStatus === "pending"
      );
      if (pending.length === 0) return [];

      const merkleRoot = buildMerkleRoot(pending.map((d) => d.sha256Hex));
      const anchorReference = buildAnchorReference(merkleRoot);

      for (const document of pending) {
        document.merkleRoot = merkleRoot;
        document.anchorStatus = "anchored";
        document.anchorReference = anchorReference;
      }
      return pending;
    },
  };
}
