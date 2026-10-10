import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildMerkleRoot, computeSha256Hex } from "./merkleEngine";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function hashPairHex(a: string, b: string): string {
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from(a, "hex"), Buffer.from(b, "hex")]))
    .digest("hex");
}

test("computeSha256Hex calcula el sha256 estándar de los bytes recibidos", () => {
  const bytes = new TextEncoder().encode("hello");
  assert.equal(computeSha256Hex(bytes), sha256("hello"));
});

test("buildMerkleRoot con 1 hoja: la raíz es esa misma hoja", () => {
  const a = sha256("doc-a");
  assert.equal(buildMerkleRoot([a]), a);
});

test("buildMerkleRoot con 2 hojas: sha256(concat(a, b))", () => {
  const a = sha256("doc-a");
  const b = sha256("doc-b");
  assert.equal(buildMerkleRoot([a, b]), hashPairHex(a, b));
});

test("buildMerkleRoot con número impar de hojas (3): duplica la última antes de combinar", () => {
  const a = sha256("doc-a");
  const b = sha256("doc-b");
  const c = sha256("doc-c");
  // nivel 1 = [hash(a,b), hash(c,c)] (c se duplica); raíz = hash(nivel1[0], nivel1[1])
  const expected = hashPairHex(hashPairHex(a, b), hashPairHex(c, c));
  assert.equal(buildMerkleRoot([a, b, c]), expected);
});
