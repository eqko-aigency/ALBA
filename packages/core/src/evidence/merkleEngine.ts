import { createHash } from "node:crypto";

/**
 * Motor 100% determinístico de evidencia digital (hash SHA-256 + Merkle
 * Tree) — mismo criterio que complianceEngine.ts: funciones puras, sin
 * efectos secundarios, sin IA. Según README.md ("Reglas de arquitectura no
 * negociables"), el hash evidenciario SIEMPRE se calcula en el servidor,
 * con timestamp del servidor, en el momento del evento — el cliente nunca
 * calcula ni recalcula un hash, solo muestra el estado (pendiente/anclado).
 *
 * Usa node:crypto (síncrono) en vez de la Web Crypto API (crypto.subtle,
 * asíncrona) para poder exponer la firma síncrona `(bytes) => string` que
 * necesita el Server Action de subida (apps/web/src/app/boveda/actions.ts).
 * Esto ata, por ahora, este archivo al runtime de Node — aceptable porque
 * hoy packages/core solo lo consume apps/web (Next.js corre Server Actions
 * en Node, no en el cliente ni en Edge). Si en Etapa 2 (apps/mobile, React
 * Native) este motor necesita corer ahí también, esta función es el único
 * lugar que habría que adaptar a una variante async con Web Crypto.
 */

export function computeSha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Raíz de un Merkle Tree estándar sobre una lista de hashes SHA-256 (hex).
 * Combina de a pares con sha256(concat(a, b)) nivel por nivel; si un nivel
 * tiene un número impar de nodos, duplica el último antes de combinar (ver
 * tests en merkleEngine.test.ts / reporte de verificación de la feature
 * Bóveda). La concatenación se hace sobre los BYTES crudos de cada hash
 * (decodificados de hex), no sobre el texto hex — es el criterio estándar
 * de Merkle Tree (ej. Bitcoin) y el único que mantiene el árbol binario
 * "de verdad" a nivel bytes.
 */
export function buildMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) {
    throw new Error("buildMerkleRoot requiere al menos una hoja");
  }

  let level = leafHashes;
  while (level.length > 1) {
    const last = level[level.length - 1] as string;
    const evenLevel = level.length % 2 === 0 ? level : [...level, last];
    const next: string[] = [];
    for (let i = 0; i < evenLevel.length; i += 2) {
      next.push(hashPair(evenLevel[i] as string, evenLevel[i + 1] as string));
    }
    level = next;
  }

  return level[0] as string;
}

function hashPair(aHex: string, bHex: string): string {
  const combined = Buffer.concat([Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex")]);
  return createHash("sha256").update(combined).digest("hex");
}
