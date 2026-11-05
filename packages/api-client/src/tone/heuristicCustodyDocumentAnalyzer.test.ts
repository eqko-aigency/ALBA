import { test } from "node:test";
import assert from "node:assert/strict";
import { createHeuristicCustodyDocumentAnalyzer } from "./heuristicCustodyDocumentAnalyzer";

const CHILD_A = { id: "11111111-1111-1111-1111-111111111111", fullName: "Eugenia" } as any;
const PARENT_A = { id: "22222222-2222-2222-2222-222222222222", fullName: "Progenitor A" } as any;
const PARENT_B = { id: "33333333-3333-3333-3333-333333333333", fullName: "Progenitor B" } as any;

test("proposeSchedule devuelve slots usando el primer hijo y los dos primeros progenitores", async () => {
  const analyzer = createHeuristicCustodyDocumentAnalyzer();
  const result = await analyzer.proposeSchedule({
    documentBytes: new Uint8Array([1, 2, 3]),
    mimeType: "application/pdf",
    verbalAgreements: [],
    children: [CHILD_A],
    familyMembers: [PARENT_A, PARENT_B],
  });
  assert.ok(result.slots.length > 0);
  assert.equal(result.slots[0].childId, CHILD_A.id);
});

test("proposeSchedule devuelve vacío sin hijos", async () => {
  const analyzer = createHeuristicCustodyDocumentAnalyzer();
  const result = await analyzer.proposeSchedule({
    documentBytes: new Uint8Array([1, 2, 3]),
    mimeType: "application/pdf",
    verbalAgreements: [],
    children: [],
    familyMembers: [PARENT_A, PARENT_B],
  });
  assert.deepEqual(result.slots, []);
});

test("proposeReminders devuelve un recordatorio de ejemplo con el primer hijo", async () => {
  const analyzer = createHeuristicCustodyDocumentAnalyzer();
  const result = await analyzer.proposeReminders({
    documentBytes: new Uint8Array([1, 2, 3]),
    mimeType: "application/pdf",
    verbalAgreements: [],
    children: [CHILD_A],
  });
  assert.ok(result.reminders.length > 0);
  assert.ok(result.reminders[0].startDate <= result.reminders[0].endDate);
});
