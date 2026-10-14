import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "./extractJson";

test("extractJson devuelve el texto tal cual si ya es JSON puro", () => {
  assert.equal(extractJson('{"a":1}'), '{"a":1}');
});

test("extractJson quita el fencing de markdown ```json ... ```", () => {
  const wrapped = '```json\n{"a":1}\n```';
  assert.equal(extractJson(wrapped), '{"a":1}');
});

test("extractJson quita el fencing de markdown ``` ... ``` sin la palabra json", () => {
  const wrapped = '```\n{"a":1}\n```';
  assert.equal(extractJson(wrapped), '{"a":1}');
});

test("extractJson se queda con el primer bloque {...} si hay texto alrededor sin fencing", () => {
  assert.equal(extractJson('Aquí está: {"a":1} gracias'), '{"a":1}');
});
