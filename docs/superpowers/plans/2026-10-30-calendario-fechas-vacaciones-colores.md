# Calendario: Fechas importantes, Vacaciones y colores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features to `apps/web/src/app/calendario`: a new "Fechas importantes" section (date-range reminders, optionally linked to a child), turn "Lugares de encuentro" into "Vacaciones" (optional address/hotel/contacts/itinerary on each saved place, plus a "Ver en mapa" Google Maps link), and replace the relative "tú vs. el otro progenitor" calendar accent with a fixed color per parent and per child.

**Architecture:** Same layered monorepo already in place — new types/validation in `packages/core`, new repository methods on the existing `CustodyRepository` port (mock + Supabase implementations in `packages/api-client`), new Server Actions in `apps/web/src/app/calendario/actions.ts`, and UI changes in `apps/web/src/app/calendario/page.tsx` plus the two profile forms (`apps/web/src/app/perfil`). Three additive, idempotent SQL migrations.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), TypeScript, Zod, Supabase/Postgres, `node --test` + `tsx` for `packages/core` unit tests.

**Spec:** `docs/superpowers/specs/2026-10-29-calendario-fechas-vacaciones-colores-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0029_fechas_importantes.sql` | New `important_dates` table + RLS |
| `supabase/migrations/0030_vacaciones_en_lugares.sql` | Extra optional columns on `meeting_places` |
| `supabase/migrations/0031_colores_progenitor_hijo.sql` | `color` column on `profiles` and `children` |
| `packages/core/src/domain/entities.ts` | `ImportantDate` entity; `color` on `Parent`/`Child`; `MeetingPlace` grows 5 optional fields |
| `packages/core/src/domain/ports.ts` | `CustodyRepository` gains 3 methods, `createMeetingPlace` signature changes, `updateMeetingPlace` added |
| `packages/core/src/validation/schemas.ts` | `importantDateInputSchema`, `meetingPlaceInputSchema` extended, `color` added to `upsertProfileInputSchema`/`updateChildDetailsInputSchema` |
| `packages/core/src/validation/schemas.test.ts` | New test file — validates the schema changes above |
| `packages/api-client/src/custody/mockCustodyRepository.ts` | In-memory impl of the 3 new/changed `CustodyRepository` methods |
| `packages/api-client/src/custody/supabaseCustodyRepository.ts` | Supabase impl of the same |
| `packages/api-client/src/pairing/mockPairingRepository.ts` | `color` support on profile/child |
| `packages/api-client/src/pairing/supabasePairingRepository.ts` | `color` support on profile/child, incl. `listFamilyMembers` |
| `apps/web/src/app/calendario/actions.ts` | New actions: `createImportantDateAction`, `deleteImportantDateAction`, `updateMeetingPlaceAction`; `createMeetingPlaceAction` extended |
| `apps/web/src/app/calendario/page.tsx` | New "Fechas importantes" accordion + grid/day-detail rendering; "Lugares de encuentro" → "Vacaciones" |
| `apps/web/src/app/perfil/actions.ts` | `upsertProfileAction` carries `color` |
| `apps/web/src/app/perfil/SaveProfileForm.tsx` | Color picker for the current parent |
| `apps/web/src/app/perfil/hijo/[childId]/actions.ts` | `updateChildDetailsAction` carries `color` |
| `apps/web/src/app/perfil/hijo/[childId]/ChildDetailsForm.tsx` | Color picker for a child |
| `apps/web/src/components/icons.tsx` | New `FlagIcon` for the "Fechas importantes" accordion header |

A fixed 6-color palette is shared by both color pickers and defined once:

```ts
// packages/core/src/validation/colors.ts (new file)
export const PROFILE_COLORS = ["orange", "sky", "salmon", "success", "dawn", "danger"] as const;
export type ProfileColor = (typeof PROFILE_COLORS)[number];
```

(`purple` is excluded — already reserved for "Visita" in the calendar grid, per the spec.)

---

### Task 1: Migration — Fechas importantes

**Files:**
- Create: `supabase/migrations/0029_fechas_importantes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Fechas importantes (Calendario): rango de fecha sin hora, opcionalmente
-- ligado a un hijo — eventos recurrentes (cumpleaños, ciclo escolar) o
-- recordatorios libres que cualquiera de los dos progenitores agrega.
-- Mismo criterio de RLS que custody_visits/meeting_places (0024/0020): los
-- dos miembros de la familia leen/crean/borran, sin "dueño" individual.

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  title text not null,
  start_date date not null,
  end_date date not null,
  created_by_parent_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint important_dates_end_after_start check (end_date >= start_date)
);

alter table public.important_dates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'important_dates'
      and policyname = 'important_dates: miembros de la familia leen sus fechas'
  ) then
    create policy "important_dates: miembros de la familia leen sus fechas"
      on public.important_dates for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = important_dates.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'important_dates'
      and policyname = 'important_dates: miembros de la familia crean fechas'
  ) then
    create policy "important_dates: miembros de la familia crean fechas"
      on public.important_dates for insert with check (
        exists (
          select 1 from public.family_members m
          where m.family_id = important_dates.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'important_dates'
      and policyname = 'important_dates: miembros de la familia borran fechas'
  ) then
    create policy "important_dates: miembros de la familia borran fechas"
      on public.important_dates for delete using (
        exists (
          select 1 from public.family_members m
          where m.family_id = important_dates.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0029_fechas_importantes.sql
git commit -m "$(cat <<'EOF'
feat(db): tabla important_dates para Fechas importantes del Calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration — Vacaciones en Lugares de encuentro

**Files:**
- Create: `supabase/migrations/0030_vacaciones_en_lugares.sql`

- [ ] **Step 1: Write the migration**

```sql
-- "Lugares de encuentro" pasa a poder describir una vacación: cada lugar
-- guardado gana campos opcionales de dirección/hotel/contactos/itinerario.
-- No se toca el nombre de la tabla/entidad (meeting_places sigue siendo el
-- selector de ubicación de Convenio y Visitas) — ver spec, sección 2.

alter table public.meeting_places
  add column if not exists address text,
  add column if not exists hotel_check_in date,
  add column if not exists hotel_check_out date,
  add column if not exists contacts text,
  add column if not exists itinerary text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0030_vacaciones_en_lugares.sql
git commit -m "$(cat <<'EOF'
feat(db): columnas opcionales de Vacaciones en meeting_places

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migration — Colores de progenitor e hijo

**Files:**
- Create: `supabase/migrations/0031_colores_progenitor_hijo.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Color fijo por persona (Calendario) — reemplaza el acento relativo
-- "tú vs. el otro progenitor". null = todavía no eligió uno (ver spec,
-- sección 3, fallback).
alter table public.profiles add column if not exists color text;
alter table public.children add column if not exists color text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0031_colores_progenitor_hijo.sql
git commit -m "$(cat <<'EOF'
feat(db): columna color en profiles y children

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Core — entidades, esquemas de validación y tests

**Files:**
- Create: `packages/core/src/validation/colors.ts`
- Create: `packages/core/src/validation/schemas.test.ts`
- Modify: `packages/core/src/domain/entities.ts:4-15` (Parent), `:66-77` (Child), `:222-225` (MeetingPlace)
- Modify: `packages/core/src/validation/schemas.ts:16-19` (`upsertProfileInputSchema`), `:58-66` (`updateChildDetailsInputSchema`), `:148-151` (`meetingPlaceInputSchema`)

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/validation/schemas.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=packages/core`
Expected: FAIL — `importantDateInputSchema`, the new `MeetingPlaceInput` fields and `color` don't exist yet (TypeScript/import errors).

- [ ] **Step 3: Add the shared color palette**

```ts
// packages/core/src/validation/colors.ts
export const PROFILE_COLORS = ["orange", "sky", "salmon", "success", "dawn", "danger"] as const;
export type ProfileColor = (typeof PROFILE_COLORS)[number];
```

- [ ] **Step 4: Extend the entities**

In `packages/core/src/domain/entities.ts`, add `color` to `Parent` (after line 14, before closing brace) and to `Child` (after line 76):

```ts
export interface Parent {
  id: string;
  fullName: string;
  email: string;
  usageMode: UsageMode;
  lastNotificationsSeenAt: string | null;
  whatsappNumber: string | null;
  onboardingNameConfirmedAt: string | null;
  /** Color fijo elegido en Perfil (uno de PROFILE_COLORS) — null = todavía no eligió uno. */
  color: string | null;
}
```

```ts
export interface Child {
  id: string;
  familyId: string;
  fullName: string;
  birthDate: string;
  contacts: ChildContact[];
  healthProviders: ChildHealthProvider[];
  schoolName: string | null;
  schoolContacts: ChildSchoolContact[];
  allergies: string | null;
  notes: ChildNote[];
  /** Mismo criterio que Parent.color. */
  color: string | null;
}
```

Replace `MeetingPlace` (lines 222-225) with:

```ts
export interface MeetingPlace {
  id: string;
  name: string;
  /** Dirección libre, para el botón "Ver en mapa" — null si no se especificó. */
  address: string | null;
  /** "YYYY-MM-DD" — null si este lugar no es una vacación con hotel. */
  hotelCheckIn: string | null;
  hotelCheckOut: string | null;
  /** Texto libre — mismo criterio que Child.notes. */
  contacts: string | null;
  itinerary: string | null;
}
```

Add the new `ImportantDate` entity right after `MeetingPlace`:

```ts
export interface ImportantDate {
  id: string;
  title: string;
  /** null = recordatorio libre, no ligado a un hijo en particular. */
  childId: string | null;
  /** "YYYY-MM-DD", fecha local. */
  startDate: string;
  /** "YYYY-MM-DD", fecha local, >= startDate. Igual a startDate = evento de 1 día. */
  endDate: string;
  createdByParentId: string;
}
```

- [ ] **Step 5: Extend the schemas**

In `packages/core/src/validation/schemas.ts`, add the import and replace `upsertProfileInputSchema` (lines 16-19):

```ts
import { PROFILE_COLORS } from "./colors";
```

```ts
export const upsertProfileInputSchema = z.object({
  fullName: z.string().min(2).max(120),
  color: z.enum(PROFILE_COLORS).nullable(),
});
export type UpsertProfileInput = z.infer<typeof upsertProfileInputSchema>;
```

Replace `updateChildDetailsInputSchema` (lines 58-66) to add `color`:

```ts
export const updateChildDetailsInputSchema = z.object({
  contacts: z.array(childContactSchema).max(10),
  healthProviders: z.array(childHealthProviderSchema).max(10),
  schoolName: optionalNote(160),
  schoolContacts: z.array(childSchoolContactSchema).max(10),
  allergies: optionalNote(1000),
  notes: z.array(childNoteSchema).max(20),
  color: z.enum(PROFILE_COLORS).nullable(),
});
export type UpdateChildDetailsInput = z.infer<typeof updateChildDetailsInputSchema>;
```

Replace `meetingPlaceInputSchema` (lines 148-151):

```ts
/** "" del form se normaliza a null — mismo criterio que optionalNote. */
const optionalPlaceField = (max: number) =>
  z
    .union([z.string().max(max), z.literal("")])
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

const optionalPlaceDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
  .nullable()
  .transform((v) => (v ? v : null));

export const meetingPlaceInputSchema = z.object({
  name: z.string().min(2).max(80),
  address: optionalPlaceField(200),
  hotelCheckIn: optionalPlaceDate,
  hotelCheckOut: optionalPlaceDate,
  contacts: optionalPlaceField(500),
  itinerary: optionalPlaceField(2000),
});
export type MeetingPlaceInput = z.infer<typeof meetingPlaceInputSchema>;
```

Add the new `importantDateInputSchema` right after `meetingPlaceInputSchema`:

```ts
export const importantDateInputSchema = z
  .object({
    title: z.string().min(2).max(120),
    childId: z
      .union([z.string().uuid(), z.literal("")])
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "endDate debe ser >= startDate", path: ["endDate"] });
export type ImportantDateInput = z.infer<typeof importantDateInputSchema>;
```

- [ ] **Step 6: Export the new entity/schema from the package index**

Check `packages/core/src/index.ts` for how `VisitInput`/`Visit`/`MeetingPlace` are already re-exported, and add `ImportantDate`, `ImportantDateInput`, `PROFILE_COLORS`, `ProfileColor` alongside them using the same export style.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test --workspace=packages/core`
Expected: PASS — all tests in `schemas.test.ts` plus the pre-existing `merkleEngine.test.ts`.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck --workspace=packages/core`
Expected: no errors. (This will surface every other file across the monorepo that still expects the old `MeetingPlace`/`Parent`/`Child`/`UpsertProfileInput`/`UpdateChildDetailsInput` shapes — fixed in later tasks.)

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/validation/colors.ts packages/core/src/validation/schemas.ts packages/core/src/validation/schemas.test.ts packages/core/src/domain/entities.ts
git commit -m "$(cat <<'EOF'
feat(core): ImportantDate, Vacaciones en MeetingPlace y color por persona

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Core — puerto `CustodyRepository`

**Files:**
- Modify: `packages/core/src/domain/ports.ts:162-197`

- [ ] **Step 1: Add the import and the 3 new methods, and change `createMeetingPlace`**

At the top of `ports.ts`, add `ImportantDate` and `ImportantDateInput`/`MeetingPlaceInput` to the existing type-only imports (alongside `MeetingPlace`, `Visit`, `VisitInput`).

Replace the `createMeetingPlace`/`deleteMeetingPlace` lines (162-187 region) and append the 3 new methods at the end of the interface (before the closing `}` on line 197):

```ts
export interface CustodyRepository {
  getMyAgreement(parentId: string): Promise<CustodyAgreement>;
  upsertSlots(parentId: string, slots: CustodySlot[]): Promise<CustodyAgreement>;
  listEventsForWeek(parentId: string, weekStart: string): Promise<CustodyEvent[]>;
  listEventsForRange(parentId: string, start: string, end: string): Promise<CustodyEvent[]>;
  confirmCheckin(parentId: string, childId: string, scheduledAt: string): Promise<CustodyEvent>;
  confirmCheckout(parentId: string, childId: string, scheduledAt: string): Promise<CustodyEvent>;
  listMeetingPlaces(parentId: string): Promise<MeetingPlace[]>;
  createMeetingPlace(parentId: string, input: MeetingPlaceInput): Promise<MeetingPlace>;
  /** Vacaciones (W-xx) — editar un lugar ya creado (dirección/hotel/contactos/itinerario). */
  updateMeetingPlace(parentId: string, placeId: string, input: MeetingPlaceInput): Promise<MeetingPlace>;
  deleteMeetingPlace(parentId: string, placeId: string): Promise<void>;
  listVisitsForRange(parentId: string, start: string, end: string): Promise<Visit[]>;
  createVisit(parentId: string, input: VisitInput): Promise<Visit>;
  deleteVisit(parentId: string, visitId: string): Promise<void>;
  /**
   * Fechas importantes (W-xx) — rango de fecha sin hora, igual criterio de
   * familia que listVisitsForRange (start/end "YYYY-MM-DD", end exclusivo).
   */
  listImportantDatesForRange(parentId: string, start: string, end: string): Promise<ImportantDate[]>;
  createImportantDate(parentId: string, input: ImportantDateInput): Promise<ImportantDate>;
  deleteImportantDate(parentId: string, importantDateId: string): Promise<void>;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=packages/core`
Expected: no new errors in `ports.ts` itself (the mock/Supabase implementers will fail typecheck until Tasks 6-7 — that's expected and fixed next).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/domain/ports.ts
git commit -m "$(cat <<'EOF'
feat(core): CustodyRepository gana Fechas importantes y updateMeetingPlace

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `packages/api-client` — mock repositories

**Files:**
- Modify: `packages/api-client/src/custody/mockCustodyRepository.ts`
- Modify: `packages/api-client/src/pairing/mockPairingRepository.ts`

- [ ] **Step 1: `mockCustodyRepository.ts` — add `ImportantDate` storage and methods, fix `createMeetingPlace`**

Add `ImportantDate` to the type import (line 1). Add a new map next to `placesByFamily`/`visitsByFamily` (after line 29):

```ts
const importantDatesByFamily = new Map<string, ImportantDate[]>();
```

Replace `createMeetingPlace` (lines 113-120) to take the full input instead of just `name`:

```ts
async createMeetingPlace(parentId, input) {
  const familyId = await getFamilyId(parentId);
  const place: MeetingPlace = { id: crypto.randomUUID(), ...input };
  const places = placesByFamily.get(familyId) ?? [];
  places.push(place);
  placesByFamily.set(familyId, places);
  return place;
},

async updateMeetingPlace(parentId, placeId, input) {
  const familyId = await getFamilyId(parentId);
  const places = placesByFamily.get(familyId) ?? [];
  const idx = places.findIndex((p) => p.id === placeId);
  if (idx === -1) throw new Error("lugar no encontrado");
  places[idx] = { ...places[idx], ...input };
  return places[idx];
},
```

Add the 3 new methods right after `deleteVisit` (before the closing `};` that ends the returned object, around line 153):

```ts
async listImportantDatesForRange(parentId, start, end) {
  const familyId = await getFamilyId(parentId);
  const dates = importantDatesByFamily.get(familyId) ?? [];
  // Se superpone con [start, end) si empieza antes de que termine el rango
  // Y termina en o después de que arranca el rango — mismo criterio que
  // listVisitsForRange pero sobre un rango, no una fecha puntual.
  return dates.filter((d) => d.startDate < end && d.endDate >= start);
},

async createImportantDate(parentId, input) {
  const familyId = await getFamilyId(parentId);
  const importantDate: ImportantDate = { id: crypto.randomUUID(), createdByParentId: parentId, ...input };
  const dates = importantDatesByFamily.get(familyId) ?? [];
  dates.push(importantDate);
  importantDatesByFamily.set(familyId, dates);
  return importantDate;
},

async deleteImportantDate(parentId, importantDateId) {
  const familyId = await getFamilyId(parentId);
  const dates = importantDatesByFamily.get(familyId) ?? [];
  importantDatesByFamily.set(
    familyId,
    dates.filter((d) => d.id !== importantDateId)
  );
},
```

- [ ] **Step 2: `mockPairingRepository.ts` — carry `color` through profile/child**

In `createChild` (around line 51-61), add `color: null` to the object literal alongside the other defaults.

In `upsertProfile` (around line 87-96), add `color: input.color` to the `profile` object literal, and in `updateChildDetails` nothing changes (it already does `Object.assign(child, input)`, and `input` now includes `color` from Task 4 — no code change needed there, but re-read the function to confirm `Object.assign` covers it before moving on).

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=packages/api-client`
Expected: no errors from these two files (Supabase repos still fail — fixed in Task 7).

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/custody/mockCustodyRepository.ts packages/api-client/src/pairing/mockPairingRepository.ts
git commit -m "$(cat <<'EOF'
feat(api-client): mock repos para Fechas importantes, Vacaciones y color

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `packages/api-client` — Supabase repositories

**Files:**
- Modify: `packages/api-client/src/custody/supabaseCustodyRepository.ts`
- Modify: `packages/api-client/src/pairing/supabasePairingRepository.ts`

- [ ] **Step 1: `supabaseCustodyRepository.ts` — `createMeetingPlace`/`updateMeetingPlace`/`mapPlace`**

Replace `createMeetingPlace` (lines 136-146):

```ts
async createMeetingPlace(parentId, input) {
  const familyId = await getMyFamilyId(parentId);
  if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
  const { data, error } = await client
    .from("meeting_places")
    .insert({
      family_id: familyId,
      name: input.name,
      address: input.address,
      hotel_check_in: input.hotelCheckIn,
      hotel_check_out: input.hotelCheckOut,
      contacts: input.contacts,
      itinerary: input.itinerary,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPlace(data);
},

async updateMeetingPlace(parentId, placeId, input) {
  const familyId = await getMyFamilyId(parentId);
  if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
  const { data, error } = await client
    .from("meeting_places")
    .update({
      name: input.name,
      address: input.address,
      hotel_check_in: input.hotelCheckIn,
      hotel_check_out: input.hotelCheckOut,
      contacts: input.contacts,
      itinerary: input.itinerary,
    })
    .eq("id", placeId)
    .eq("family_id", familyId)
    .select()
    .single();
  if (error) throw error;
  return mapPlace(data);
},
```

Replace `mapPlace` (lines 274-276):

```ts
function mapPlace(row: any): MeetingPlace {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    hotelCheckIn: row.hotel_check_in ?? null,
    hotelCheckOut: row.hotel_check_out ?? null,
    contacts: row.contacts ?? null,
    itinerary: row.itinerary ?? null,
  };
}
```

Add `ImportantDate` to the type import (line 2), and add the 3 new methods right after `deleteVisit` (before the closing `};` around line 198):

```ts
async listImportantDatesForRange(parentId, start, end) {
  const familyId = await getMyFamilyId(parentId);
  if (!familyId) return [];
  const { data, error } = await client
    .from("important_dates")
    .select()
    .eq("family_id", familyId)
    .lt("start_date", end)
    .gte("end_date", start);
  if (error) throw error;
  return (data ?? []).map(mapImportantDate);
},

async createImportantDate(parentId, input) {
  const familyId = await getMyFamilyId(parentId);
  if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
  const { data, error } = await client
    .from("important_dates")
    .insert({
      family_id: familyId,
      child_id: input.childId,
      title: input.title,
      start_date: input.startDate,
      end_date: input.endDate,
      created_by_parent_id: parentId,
    })
    .select()
    .single();
  if (error) throw error;
  return mapImportantDate(data);
},

async deleteImportantDate(parentId, importantDateId) {
  const familyId = await getMyFamilyId(parentId);
  if (!familyId) return;
  const { error } = await client.from("important_dates").delete().eq("id", importantDateId).eq("family_id", familyId);
  if (error) throw error;
},
```

Add `mapImportantDate` next to the other `map*` helpers (near `mapVisit`, around line 278):

```ts
function mapImportantDate(row: any): ImportantDate {
  return {
    id: row.id,
    title: row.title,
    childId: row.child_id,
    startDate: row.start_date,
    endDate: row.end_date,
    createdByParentId: row.created_by_parent_id,
  };
}
```

- [ ] **Step 2: `supabasePairingRepository.ts` — `color` on profile/child, incl. `listFamilyMembers`**

In `getProfile` (lines 99-113) and `upsertProfile` (lines 115-132), add `color: data.color ?? null` to the returned object, and in `upsertProfile`'s `.upsert(...)` call (line 118) add `color: input.color` to the upserted row.

In `mapChild` (lines 283-296), add `color: row.color ?? null,` to the returned object.

In `updateChildDetails` (lines 78-97), add `color: input.color,` to the `.update({...})` object (line 83-90 region).

In `listFamilyMembers` (lines 250-270), the embedded select only pulls `profiles(full_name)` — change it to also pull `color` so the UI can render the OTHER parent's fixed color, not just the caller's own:

```ts
const { data, error } = await client
  .from("family_members")
  .select("parent_id, profiles(full_name, color)")
  .eq("family_id", familyId);
if (error) throw error;
return (data ?? []).map((row: any) => ({
  id: row.parent_id,
  fullName: row.profiles?.full_name ?? "Progenitor",
  email: "",
  usageMode: null,
  lastNotificationsSeenAt: null,
  whatsappNumber: null,
  onboardingNameConfirmedAt: null,
  color: row.profiles?.color ?? null,
}));
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=packages/api-client`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/custody/supabaseCustodyRepository.ts packages/api-client/src/pairing/supabasePairingRepository.ts
git commit -m "$(cat <<'EOF'
feat(api-client): Supabase repos para Fechas importantes, Vacaciones y color

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Server Actions

**Files:**
- Modify: `apps/web/src/app/calendario/actions.ts`
- Modify: `apps/web/src/app/perfil/actions.ts`

- [ ] **Step 1: `calendario/actions.ts` — extend `createMeetingPlaceAction`, add `updateMeetingPlaceAction`, `createImportantDateAction`, `deleteImportantDateAction`**

Add `importantDateInputSchema` to the import on line 4. Replace `createMeetingPlaceAction` (lines 40-45):

```ts
export async function createMeetingPlaceAction(formData: FormData) {
  const input = meetingPlaceInputSchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    hotelCheckIn: formData.get("hotelCheckIn"),
    hotelCheckOut: formData.get("hotelCheckOut"),
    contacts: formData.get("contacts"),
    itinerary: formData.get("itinerary"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.createMeetingPlace(parentId, input);
  revalidatePath("/calendario");
}

export async function updateMeetingPlaceAction(formData: FormData) {
  const placeId = String(formData.get("placeId") ?? "");
  const input = meetingPlaceInputSchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    hotelCheckIn: formData.get("hotelCheckIn"),
    hotelCheckOut: formData.get("hotelCheckOut"),
    contacts: formData.get("contacts"),
    itinerary: formData.get("itinerary"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.updateMeetingPlace(parentId, placeId, input);
  revalidatePath("/calendario");
}
```

Add at the end of the file:

```ts
export async function createImportantDateAction(formData: FormData) {
  const input = importantDateInputSchema.parse({
    title: formData.get("title"),
    childId: formData.get("childId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.createImportantDate(parentId, input);
  revalidatePath("/calendario");
}

export async function deleteImportantDateAction(formData: FormData) {
  const importantDateId = String(formData.get("importantDateId") ?? "");
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.deleteImportantDate(parentId, importantDateId);
  revalidatePath("/calendario");
}
```

- [ ] **Step 2: `perfil/actions.ts` — `color` on `upsertProfileAction`, and `color` on `updateChildDetailsAction`**

Replace `upsertProfileAction` (lines 7-12):

```ts
export async function upsertProfileAction(formData: FormData) {
  const rawColor = String(formData.get("color") ?? "");
  const input = upsertProfileInputSchema.parse({
    fullName: formData.get("parentFullName"),
    color: rawColor === "" ? null : rawColor,
  });
  const { pairing, parentId } = await getRequestContext();
  await pairing.upsertProfile(parentId, input);
  revalidatePath("/perfil");
}
```

In `updateChildDetailsAction` (lines 53-68), add `color` to the parsed input:

```ts
export async function updateChildDetailsAction(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const rawColor = String(formData.get("color") ?? "");

  const input = updateChildDetailsInputSchema.parse({
    contacts: parseJsonArray(formData, "contactsJson"),
    healthProviders: parseJsonArray(formData, "healthProvidersJson"),
    schoolName: formData.get("schoolName"),
    schoolContacts: parseJsonArray(formData, "schoolContactsJson"),
    allergies: formData.get("allergies"),
    notes: parseJsonArray(formData, "notesJson"),
    color: rawColor === "" ? null : rawColor,
  });

  const { pairing, parentId } = await getRequestContext();
  await pairing.updateChildDetails(parentId, childId, input);
  revalidatePath(`/perfil/hijo/${childId}`);
}
```

- [ ] **Step 3: Run typecheck across the web app**

Run: `npm run typecheck --workspace=apps/web`
Expected: errors only in `calendario/page.tsx`, `perfil/page.tsx`, `SaveProfileForm.tsx`, `ChildDetailsForm.tsx` (not yet updated — fixed in Tasks 9-13). No errors in `actions.ts` files themselves.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/calendario/actions.ts apps/web/src/app/perfil/actions.ts
git commit -m "$(cat <<'EOF'
feat(web): Server Actions para Fechas importantes, Vacaciones y color

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: UI — accordion "Fechas importantes"

**Files:**
- Modify: `apps/web/src/components/icons.tsx` (add `FlagIcon`)
- Modify: `apps/web/src/app/calendario/page.tsx`

- [ ] **Step 1: Add `FlagIcon`**

In `icons.tsx`, following the exact style of `StarIcon`/`PinIcon` (same `common` spread, same prop shape), add:

```tsx
export function FlagIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M6 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6 4h10l-2.2 3.5L16 11H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Fetch important dates + import the new action/icon in `calendario/page.tsx`**

In the import block (lines 1-17), add `FlagIcon` to the `icons` import and `createImportantDateAction`, `deleteImportantDateAction` to the `./actions` import.

In the `Promise.all` (lines 161-168), add a 7th call:

```ts
const [agreement, children, familyMembers, events, meetingPlaces, visits, importantDates] = await Promise.all([
  custody.getMyAgreement(parentId),
  pairing.getMyChildren(parentId),
  pairing.listFamilyMembers(parentId),
  custody.listEventsForRange(parentId, rangeStart, rangeEnd),
  custody.listMeetingPlaces(parentId),
  custody.listVisitsForRange(parentId, rangeStart, rangeEnd),
  custody.listImportantDatesForRange(parentId, rangeStart, rangeEnd),
]);
```

After `const selectedVisits = visits.filter((v) => v.date === selectedDayKey);` (line 205), add:

```ts
const selectedImportantDates = importantDates.filter((d) => d.startDate <= selectedDayKey && d.endDate >= selectedDayKey);
```

- [ ] **Step 3: Add the day-cell marker**

Inside the day-cell loop (lines 273-310), after the `dayVisits` line (279), add:

```ts
const dayImportantDates = importantDates.filter((d) => d.startDate <= dayKey && d.endDate >= dayKey);
```

In the marker row (lines 301-308), add a third marker after the two existing `<span>` dots:

```tsx
<span className="flex items-center gap-0.5">
  <span className={`h-1.5 w-1.5 rounded-full ${hasIssue ? "bg-danger" : daySlots.length > 0 ? "bg-success" : "bg-transparent"}`} />
  <span className={`h-1.5 w-1.5 rounded-full ${dayVisits.length > 0 ? "bg-purple" : "bg-transparent"}`} />
  <span
    className={`h-1.5 w-1.5 rotate-45 ${dayImportantDates.length > 0 ? "bg-orange-deep" : "bg-transparent"}`}
    aria-hidden="true"
  />
</span>
```

- [ ] **Step 4: Render `selectedImportantDates` in the day-detail panel**

After the `selectedVisits` block closes (after line 474, still inside the `<div className="mt-6 rounded-2xl border border-orange ...">` panel), add:

```tsx
{selectedImportantDates.length > 0 && (
  <ul className="mt-3 flex flex-col gap-2">
    {selectedImportantDates.map((d) => (
      <li key={d.id} className="rounded-xl border border-orange-deep/30 bg-dawn/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-ink">
            <span className="rounded-full bg-orange-deep/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
              Fecha importante
            </span>{" "}
            {d.title}
            {d.childId && <> — {childName(d.childId)}</>}
          </span>
        </div>
        {d.startDate !== d.endDate && (
          <p className="mt-1 text-xs text-ink-soft">
            {formatDay(parseDateKeyLocal(d.startDate))} – {formatDay(parseDateKeyLocal(d.endDate))}
          </p>
        )}
        <form action={deleteImportantDateAction} className="mt-2">
          <input type="hidden" name="as" value={as ?? ""} />
          <input type="hidden" name="importantDateId" value={d.id} />
          <button type="submit" className="text-xs font-medium text-danger underline">
            Quitar
          </button>
        </form>
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 5: Add the accordion**

Right after the "Visitas" `</details>` closes (after line 699, before the "Lugares de encuentro" `<details>` block), add:

```tsx
<details className="group border-t border-subtle">
  <AccordionHeader label="Fechas importantes" accent="bg-sea" Icon={FlagIcon} />
  <div className="border-t border-subtle px-4 pb-5 pt-4">
    <p className="text-xs text-ink-soft">
      Cumpleaños, ciclo escolar, o cualquier recordatorio — puede durar 1 día, una semana o un mes.
    </p>

    {importantDates.length > 0 && (
      <ul className="mt-3 flex flex-col gap-2">
        {importantDates
          .slice()
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-md bg-sand px-3 py-2 text-base text-ink"
            >
              <span>
                {formatDay(parseDateKeyLocal(d.startDate))}
                {d.startDate !== d.endDate && ` – ${formatDay(parseDateKeyLocal(d.endDate))}`} · {d.title}
                {d.childId && ` · ${childName(d.childId)}`}
              </span>
              <form action={deleteImportantDateAction}>
                <input type="hidden" name="as" value={as ?? ""} />
                <input type="hidden" name="importantDateId" value={d.id} />
                <button type="submit" className="shrink-0 text-xs font-medium text-danger underline">
                  Quitar
                </button>
              </form>
            </li>
          ))}
      </ul>
    )}

    <form action={createImportantDateAction} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="as" value={as ?? ""} />
      <input
        name="title"
        autoComplete="off"
        required
        minLength={2}
        maxLength={120}
        placeholder="Ej. Cumpleaños de Juan, Inicio de ciclo escolar..."
        className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
      />
      <select name="childId" className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink">
        <option value="">Sin hijo específico</option>
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
          </option>
        ))}
      </select>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
          <input type="date" name="startDate" required defaultValue={selectedDayKey} className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink" />
        </div>
        <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
          <input type="date" name="endDate" required defaultValue={selectedDayKey} className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink" />
        </div>
      </div>
      <SubmitButton pendingText="Agregando…" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
        Agregar fecha importante
      </SubmitButton>
    </form>
  </div>
</details>
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: no errors related to `importantDates`/`FlagIcon`/the new actions (errors remain for "Lugares de encuentro"/color — fixed next tasks).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/icons.tsx apps/web/src/app/calendario/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): sección Fechas importantes en Calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: UI — "Lugares de encuentro" → "Vacaciones"

**Files:**
- Modify: `apps/web/src/app/calendario/page.tsx:701-744`

- [ ] **Step 1: Import `updateMeetingPlaceAction`**

Add it to the `./actions` import block (alongside `createMeetingPlaceAction`, `deleteMeetingPlaceAction`).

- [ ] **Step 2: Rename and extend the accordion**

Replace the whole `<details>...</details>` block for "Lugares de encuentro" (lines 701-744) with:

```tsx
<details className="group border-t border-subtle">
  <AccordionHeader label="Vacaciones" accent="bg-dawn" Icon={PinIcon} />
  <div className="border-t border-subtle px-4 pb-5 pt-4">
    <p className="text-xs text-ink-soft">
      Casa de cada progenitor, parque, cine, o un viaje con hotel — los que agregues aquí aparecen al crear un slot o una visita.
    </p>

    {meetingPlaces.length > 0 && (
      <ul className="mt-3 flex flex-col gap-2">
        {meetingPlaces.map((place) => (
          <li key={place.id} className="rounded-md bg-sand px-3 py-2 text-base text-ink">
            <div className="flex items-center justify-between gap-2">
              <span>📍 {place.name}</span>
              <form action={deleteMeetingPlaceAction}>
                <input type="hidden" name="as" value={as ?? ""} />
                <input type="hidden" name="placeId" value={place.id} />
                <button type="submit" className="shrink-0 text-xs font-medium text-danger underline">
                  Quitar
                </button>
              </form>
            </div>
            {place.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dawn bg-dawn/40 px-3 py-1 text-xs font-semibold text-ink"
              >
                📍 Ver en mapa
              </a>
            )}
            {(place.hotelCheckIn || place.hotelCheckOut) && (
              <p className="mt-1 text-xs text-ink-soft">
                Hotel: {place.hotelCheckIn ?? "?"} – {place.hotelCheckOut ?? "?"}
              </p>
            )}
            {place.contacts && <p className="mt-1 text-xs text-ink-soft">Contactos: {place.contacts}</p>}
            {place.itinerary && <p className="mt-1 text-xs text-ink-soft">Itinerario: {place.itinerary}</p>}

            <details className="mt-2 [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer text-xs font-medium text-ink-soft">Editar</summary>
              <form action={updateMeetingPlaceAction} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="as" value={as ?? ""} />
                <input type="hidden" name="placeId" value={place.id} />
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={place.name}
                  className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                />
                <input
                  name="address"
                  placeholder="Dirección (opcional)"
                  defaultValue={place.address ?? ""}
                  className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
                    <input
                      type="date"
                      name="hotelCheckIn"
                      defaultValue={place.hotelCheckIn ?? ""}
                      className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
                    />
                  </div>
                  <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
                    <input
                      type="date"
                      name="hotelCheckOut"
                      defaultValue={place.hotelCheckOut ?? ""}
                      className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
                    />
                  </div>
                </div>
                <textarea
                  name="contacts"
                  rows={2}
                  placeholder="Contactos (opcional)"
                  defaultValue={place.contacts ?? ""}
                  className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                />
                <textarea
                  name="itinerary"
                  rows={3}
                  placeholder="Itinerario (opcional)"
                  defaultValue={place.itinerary ?? ""}
                  className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                />
                <button type="submit" className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink">
                  Guardar cambios
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    )}

    <form action={createMeetingPlaceAction} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="as" value={as ?? ""} />
      <input
        name="name"
        autoComplete="off"
        required
        minLength={2}
        maxLength={80}
        placeholder="Ej. Casa de Progenitor A, Hotel Playa Sol..."
        className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
      />
      <input
        name="address"
        placeholder="Dirección (opcional)"
        className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
      />
      <SubmitButton pendingText="Agregando…" className="self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
        Agregar
      </SubmitButton>
    </form>
  </div>
</details>
```

(The create form stays short on purpose — name + address only; hotel dates/contacts/itinerario are filled in later via "Editar", once the place is created. This matches the spec: "no se obliga a llenar nada nuevo".)

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: no errors related to `meetingPlaces`/`updateMeetingPlaceAction`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/calendario/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): Lugares de encuentro pasa a ser Vacaciones, con mapa y hotel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: UI — color picker del progenitor en Perfil

**Files:**
- Modify: `apps/web/src/app/perfil/SaveProfileForm.tsx`
- Modify: `apps/web/src/app/perfil/page.tsx:51`

- [ ] **Step 1: Add the picker to `SaveProfileForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { PROFILE_COLORS } from "@alba/core";
import { upsertProfileAction } from "./actions";

const COLOR_SWATCH: Record<string, string> = {
  orange: "bg-orange",
  sky: "bg-sky",
  salmon: "bg-salmon",
  success: "bg-success",
  dawn: "bg-dawn",
  danger: "bg-danger",
};

export function SaveProfileForm({
  initialFullName,
  initialColor,
}: {
  initialFullName: string;
  initialColor: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [color, setColor] = useState<string | null>(initialColor);

  async function handleSubmit(formData: FormData) {
    formData.set("color", color ?? "");
    setPending(true);
    setSaved(false);
    await upsertProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  return (
    <form action={handleSubmit} onChange={() => setSaved(false)} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <input
          name="parentFullName"
          autoComplete="off"
          required
          minLength={2}
          defaultValue={initialFullName}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-ink">Tu color en el Calendario</p>
        <div className="mt-2 flex gap-2">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Elegir color ${c}`}
              onClick={() => {
                setColor(c);
                setSaved(false);
              }}
              className={`h-8 w-8 rounded-full ${COLOR_SWATCH[c]} ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {saved && <span className="text-sm font-medium text-success">✓ Guardado</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Pass `initialColor` from `perfil/page.tsx`**

Replace line 51:

```tsx
<SaveProfileForm initialFullName={profile?.fullName ?? ""} initialColor={profile?.color ?? null} />
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: no errors in these two files.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/perfil/SaveProfileForm.tsx apps/web/src/app/perfil/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): selector de color fijo del progenitor en Perfil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: UI — color picker del hijo

**Files:**
- Modify: `apps/web/src/app/perfil/hijo/[childId]/ChildDetailsForm.tsx`
- Modify: `apps/web/src/app/perfil/hijo/[childId]/page.tsx`

- [ ] **Step 1: Read `perfil/hijo/[childId]/page.tsx` first**

Before editing, read the file to find exactly where it builds the `initial` prop passed to `ChildDetailsForm` (mirrors the shape at `ChildDetailsForm.tsx:37-44`) — add `color: child.color` there.

- [ ] **Step 2: Extend `ChildDetailsForm.tsx`**

Add `color: string | null` to the `initial` prop type (lines 37-44), add `const [color, setColor] = useState<string | null>(initial.color);` next to the other `useState` calls (around line 49), and reuse the exact same color-swatch UI block and `COLOR_SWATCH` map from Task 11 (define `COLOR_SWATCH` once in `ChildDetailsForm.tsx` the same way, importing `PROFILE_COLORS` from `@alba/core`).

Find the `<form action={...}>` that submits via `updateChildDetailsAction` (search this file for `action={updateChildDetailsAction}`) and, right before its submit button, insert the same color-swatch block as Task 11's Step 1, setting `color`/`setColor` instead of a new local pair. In the submit handler (wherever this file currently does `formData.set(...)` for the JSON fields, or right before calling the action), add `formData.set("color", color ?? "")`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: PASS with zero errors across the whole web app — this is the last task touching code that typecheck was flagging since Task 4, Step 8.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/perfil/hijo/\[childId\]/ChildDetailsForm.tsx apps/web/src/app/perfil/hijo/\[childId\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): selector de color fijo del hijo en su perfil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: UI — franja de color en el grid y avatar fijo en el día seleccionado

**Files:**
- Modify: `apps/web/src/app/calendario/page.tsx`

- [ ] **Step 1: Resolve a color token per parent/child**

Near the top of the component body (after `parentName`/`placeName` are defined, around line 173), add two lookup helpers:

```ts
const COLOR_CLASS: Record<string, string> = {
  orange: "bg-orange",
  sky: "bg-sky",
  salmon: "bg-salmon",
  success: "bg-success",
  dawn: "bg-dawn",
  danger: "bg-danger",
};

const parentColorClass = (id: string): string | null => {
  const p = id === parentId ? profile : familyMembers.find((m) => m.id === id);
  return p?.color ? COLOR_CLASS[p.color] ?? null : null;
};
const childColorClass = (id: string): string | null => {
  const c = children.find((ch) => ch.id === id);
  return c?.color ? COLOR_CLASS[c.color] ?? null : null;
};
```

This needs `profile` (the caller's own `Parent`, for their own color when they're not necessarily in `familyMembers` depending on pairing state) — add `pairing.getProfile(parentId)` to the existing `Promise.all` (Task 9, Step 2) as an 8th entry, named `profile`.

- [ ] **Step 2: Day-cell bottom stripe**

In the day-cell `<Link>` (lines 283-310), the cell currently has no footer stripe. Add one, computing which parents/children have something that day:

```tsx
const dayParentIds = [...new Set([...daySlots.map((s) => s.parentId), ...dayVisits.map((v) => v.parentId)])];
const dayChildIds = [
  ...new Set([...daySlots.map((s) => s.childId), ...dayVisits.map((v) => v.childId), ...dayImportantDates.filter((d) => d.childId).map((d) => d.childId!)]),
];
```

(Place this right after the `dayImportantDates` line from Task 9, Step 3, inside the same `.map((d) => {` callback.)

Then, inside the cell markup, after the dots `<span>` row, add:

```tsx
{(dayParentIds.length > 0 || dayChildIds.length > 0) && (
  <span className="flex h-1 w-8 overflow-hidden rounded-full">
    <span className="flex flex-1">
      {dayParentIds.map((pid) => (
        <span key={pid} className={`flex-1 ${parentColorClass(pid) ?? "bg-ink-faint/40"}`} />
      ))}
    </span>
    <span className="flex flex-1">
      {dayChildIds.map((cid) => (
        <span key={cid} className={`flex-1 ${childColorClass(cid) ?? "bg-ink-faint/40"}`} />
      ))}
    </span>
  </span>
)}
```

- [ ] **Step 3: Fixed-color avatar in the day-detail panel**

In the slots list (around line 352), replace:

```ts
const accent = parentAccent(slot.parentId === parentId);
```

with:

```ts
const accent = parentAccent(slot.parentId === parentId);
const fixedParentColor = parentColorClass(slot.parentId);
const fixedChildColor = childColorClass(slot.childId);
```

And in the avatar `<span>` (around line 359-363), fall back to the fixed color when set:

```tsx
<span
  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink ${fixedParentColor ?? accent.avatar}`}
>
  {parentDisplayName.charAt(0).toUpperCase()}
</span>
```

Right after the child name in the same line (around line 364, `{childName(slot.childId)} con <strong>{parentDisplayName}</strong>`), add a small dot when the child has a fixed color:

```tsx
{childName(slot.childId)}
{fixedChildColor && <span className={`inline-block h-2 w-2 rounded-full ${fixedChildColor}`} aria-hidden="true" />}
{" "}con <strong>{parentDisplayName}</strong>
```

Repeat the same two changes (`fixedParentColor`/`fixedChildColor` lookup + avatar fallback + child dot) in the Visitas block of the day-detail panel (around lines 436-453), which has the same `accent`/avatar/child-name structure.

- [ ] **Step 4: Manual check in dev server**

Run: `npm run dev --workspace=apps/web`, open `/calendario` in demo mode, pick colors for both demo parents and a child via `/perfil` and `/perfil/hijo/[id]` first, then confirm the grid stripe and the day-detail avatars reflect them.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/calendario/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): franja de color por progenitor/hijo en el grid de Calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Verificación manual completa (modo demo)

**Files:** none (manual QA pass, no code changes expected — if something breaks, fix it here and amend the relevant earlier task's commit is NOT allowed; make a new small fix commit instead)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev --workspace=apps/web`
Expected: starts with no Supabase env vars configured, so it runs in demo mode (`isDemoMode`, mock repositories) — confirm the yellow "Modo de prueba local" banner shows on `/calendario`.

- [ ] **Step 2: Fechas importantes**

In `/calendario`, open "Fechas importantes", create one titled "Cumpleaños de prueba" with a 7-day range (e.g. today → +6 days) and no child. Confirm: it appears in the accordion list; the amber diamond marker shows on all 7 days in the month grid; selecting any of those 7 days shows it in the day-detail panel with a working "Quitar" button.

**Step 3: Vacaciones**

Open "Vacaciones" (was "Lugares de encuentro"), create a place named "Hotel de prueba" with an address. Confirm the "Ver en mapa" link appears and opens Google Maps with that address in a new tab. Open "Editar" on it, fill hotel check-in/check-out + contacts + itinerary, save, and confirm all four show on the list item.

**Step 4: Colores**

Go to `/perfil`, pick a color for Progenitor A (e.g. "sky"). Switch to Progenitor B (`?as=b`), pick a different color (e.g. "salmon") in their own `/perfil`. Open a child's page under `/perfil/hijo/[id]` and pick a child color (e.g. "success"). Go back to `/calendario`, confirm: the bottom stripe on days with custody slots/visits shows the two chosen colors (not the old relative orange/sky), and the day-detail panel avatar/child-dot match.

- [ ] **Step 5: Regression check — Convenio and Visitas still work**

Create a custody slot and a visit using an existing "Vacaciones" place as their location (the `placeId` selector). Confirm both still save and display correctly — this exercises the part of the spec that explicitly must NOT break (`createMeetingPlace`'s signature change, `MeetingPlace` growing fields).

- [ ] **Step 6: Final full-repo check**

Run: `npm run typecheck` (root, all workspaces)
Run: `npm run test --workspace=packages/core`
Expected: both PASS with zero errors/failures.

- [ ] **Step 7: Commit (only if Step 2-5 required fixes)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(web): ajustes encontrados en verificación manual de Calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage** — every section of the spec has a task:
- "Fechas importantes" → Tasks 1, 4 (entity/schema), 5-8 (port/repos/actions), 9 (UI), 14 (verify).
- "Lugares de encuentro → Vacaciones" (incl. "Ver en mapa") → Tasks 2, 4, 5-8, 10, 14.
- "Color fijo por progenitor e hijo" (incl. the grid stripe and the day-detail avatar) → Tasks 3, 4, 6-8 (incl. the `listFamilyMembers` fix, easy to miss), 11, 12, 13, 14.
- Migration order matches the spec's "Migraciones, en orden" section (0029 → 0030 → 0031).

**2. Placeholder scan** — no "TBD"/"add validation"/"similar to Task N" left; every step has literal code or an exact command. Task 12's Step 1 ("read the file first") is not a placeholder — it is a required research step because this plan was not able to read that one file during planning (listed as a risk below), and it tells the engineer exactly what to look for and what to add.

**3. Type consistency** — `ImportantDateInput`/`ImportantDate`/`MeetingPlaceInput`/`MeetingPlace` field names (`childId`, `startDate`, `endDate`, `address`, `hotelCheckIn`, `hotelCheckOut`, `contacts`, `itinerary`) are identical across Tasks 4 (schema+entity), 6 (mock repo), 7 (Supabase repo), 8 (action), 9-10 (UI). `PROFILE_COLORS`/`ProfileColor`/`COLOR_CLASS` are defined once (Task 4) and reused as-is in Tasks 11, 12, 13 — not redefined with different casing or values.

**Known risk, flagged for whoever executes Task 12:** this plan was written without reading `apps/web/src/app/perfil/hijo/[childId]/page.tsx` or the rest of `ChildDetailsForm.tsx` (only its first ~90 lines were available while planning) — Task 12 Step 1 explicitly requires reading both in full before editing, so the exact prop-building code and the exact submit path for `color` are confirmed against the real file instead of guessed.

---

**Plan complete and saved to `docs/superpowers/plans/2026-10-30-calendario-fechas-vacaciones-colores.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
