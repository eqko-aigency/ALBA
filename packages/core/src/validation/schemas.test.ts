import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importantDateInputSchema,
  meetingPlaceInputSchema,
  updateChildDetailsInputSchema,
  upsertProfileInputSchema,
} from "./schemas";

test("importantDateInputSchema acepta un rango válido de 1 día", () => {
  const input = importantDateInputSchema.parse({
    title: "Cumpleaños de Juan",
    childId: "11111111-1111-1111-1111-111111111111",
    startDate: "2026-11-02",
    endDate: "2026-11-02",
  });
  assert.equal(input.startDate, "2026-11-02");
  assert.equal(input.endDate, "2026-11-02");
});

test("importantDateInputSchema acepta childId vacío como recordatorio libre (null)", () => {
  const input = importantDateInputSchema.parse({
    title: "Revisión del convenio",
    childId: "",
    startDate: "2026-11-02",
    endDate: "2026-11-09",
  });
  assert.equal(input.childId, null);
});

test("importantDateInputSchema rechaza endDate antes de startDate", () => {
  assert.throws(() =>
    importantDateInputSchema.parse({
      title: "Vacaciones escolares",
      childId: "",
      startDate: "2026-12-10",
      endDate: "2026-12-01",
    })
  );
});

test("importantDateInputSchema rechaza un título fuera de rango", () => {
  assert.throws(() =>
    importantDateInputSchema.parse({
      title: "A",
      childId: "",
      startDate: "2026-11-02",
      endDate: "2026-11-02",
    })
  );
});

test("meetingPlaceInputSchema sigue aceptando solo el nombre (campos nuevos opcionales)", () => {
  const input = meetingPlaceInputSchema.parse({ name: "Casa de Progenitor A" });
  assert.equal(input.name, "Casa de Progenitor A");
  assert.equal(input.address, null);
  assert.equal(input.hotelCheckIn, null);
  assert.equal(input.hotelCheckOut, null);
  assert.equal(input.contacts, null);
  assert.equal(input.itinerary, null);
});

test("meetingPlaceInputSchema acepta los campos de vacación completos", () => {
  const input = meetingPlaceInputSchema.parse({
    name: "Hotel Playa Sol",
    address: "Av. Costera 123, Acapulco",
    hotelCheckIn: "2026-12-20",
    hotelCheckOut: "2026-12-27",
    contacts: "Recepción: 744-123-4567",
    itinerary: "Día 1: llegada. Día 2: playa.",
  });
  assert.equal(input.address, "Av. Costera 123, Acapulco");
  assert.equal(input.hotelCheckIn, "2026-12-20");
});

test("upsertProfileInputSchema acepta color null (todavía no eligió uno)", () => {
  const input = upsertProfileInputSchema.parse({ fullName: "Ana Pérez", color: null });
  assert.equal(input.color, null);
});

test("upsertProfileInputSchema acepta un color de la paleta fija", () => {
  const input = upsertProfileInputSchema.parse({ fullName: "Ana Pérez", color: "sky" });
  assert.equal(input.color, "sky");
});

test("upsertProfileInputSchema rechaza un color fuera de la paleta fija", () => {
  assert.throws(() => upsertProfileInputSchema.parse({ fullName: "Ana Pérez", color: "fucsia" }));
});

test("updateChildDetailsInputSchema acepta un color de la paleta fija", () => {
  const input = updateChildDetailsInputSchema.parse({
    contacts: [],
    healthProviders: [],
    schoolName: null,
    schoolContacts: [],
    allergies: null,
    notes: [],
    color: "salmon",
  });
  assert.equal(input.color, "salmon");
});
