# Custodia: calendario/recordatorios asistidos por IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la sección `/mas/custodia` (3 pestañas: Calendario, Intercambios, Recordatorios) donde una IA propone horario de custodia y fechas importantes a partir de un documento de Bóveda + Acuerdos verbales confirmados, siempre con confirmación humana antes de persistir, sin tocar el editor manual de slots que ya existe en `/calendario`.

**Architecture:** Nuevo puerto `CustodyDocumentAnalyzer` (mismo patrón que `AgreementDetector`: heurístico en demo, Anthropic real server-side) + un método nuevo `DocumentRepository.getDocumentFileBytes` + campo `mimeType` en `Document`. La UI nueva vive en `apps/web/src/app/mas/custodia/`: Server Components para cada pestaña, con dos Client Components pequeños (`ScheduleAiAssistant`, `ReminderAiAssistant`) que llaman Server Actions directamente y guardan el resultado en estado local para la revisión antes de confirmar.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Zod, `@anthropic-ai/sdk` (ya instalado), Supabase (Postgres + Storage).

Spec de referencia: `docs/superpowers/specs/2026-11-04-custodia-ia-convenio-design.md`.

---

### Task 1: Campo `mimeType` en `Document` + migración

**Files:**
- Modify: `packages/core/src/domain/entities.ts`
- Modify: `packages/api-client/src/documents/mockDocumentRepository.ts`
- Modify: `packages/api-client/src/documents/supabaseDocumentRepository.ts`
- Create: `supabase/migrations/0038_mimetype_documentos.sql`

- [ ] **Step 1: Agregar el campo a la entidad**

En `packages/core/src/domain/entities.ts`, dentro de `export interface Document { ... }` (busca `fileUrl: string;`), agregar justo debajo:

```ts
  /** Tipo MIME al momento de subir — null para documentos subidos antes de este campo. Se usa para filtrar qué documentos puede leer la IA de Custodia (solo PDF/imagen). */
  mimeType: string | null;
```

- [ ] **Step 2: Migración**

Crear `supabase/migrations/0038_mimetype_documentos.sql`:

```sql
-- Guarda el mimeType que ya se recibía en uploadDocument (input.mimeType)
-- pero se descartaba después de subir el archivo — necesario para que el
-- selector de documentos de Custodia (W-xx) pueda filtrar PDF/imagen sin
-- adivinar por extensión del nombre de archivo. Documentos subidos antes
-- de esta migración quedan con mime_type null (se excluyen del selector,
-- sin romper nada en Bóveda, donde este campo no se usa).
alter table public.documents add column if not exists mime_type text;
```

- [ ] **Step 3: Guardar el campo en el mock**

En `packages/api-client/src/documents/mockDocumentRepository.ts`, dentro de `uploadDocument`, el objeto `document` agrega `mimeType: input.mimeType,` después de `title: input.title,`:

```ts
      const document: Document = {
        id: crypto.randomUUID(),
        familyId,
        uploadedByParentId: parentId,
        childId: input.childId,
        title: input.title,
        mimeType: input.mimeType,
        fileUrl: `demo://documentos/${familyId}/${Date.now()}-${input.fileName}`,
```

- [ ] **Step 4: Guardar el campo en Supabase**

En `packages/api-client/src/documents/supabaseDocumentRepository.ts`:

En el `insert` de `uploadDocument`, agregar `mime_type: input.mimeType,` junto a `title: input.title,`:

```ts
        .insert({
          family_id: familyId,
          uploaded_by_parent_id: parentId,
          child_id: input.childId,
          title: input.title,
          mime_type: input.mimeType,
          file_url: publicUrlData.publicUrl,
```

En `mapDocument(row)`, agregar `mimeType: row.mime_type ?? null,` después de `title: row.title,`:

```ts
function mapDocument(row: any): Document {
  return {
    id: row.id,
    familyId: row.family_id,
    uploadedByParentId: row.uploaded_by_parent_id,
    childId: row.child_id ?? null,
    title: row.title,
    mimeType: row.mime_type ?? null,
    fileUrl: row.file_url,
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: 0 errores (el único consumidor hoy de `Document` que arma el objeto completo son estos dos repos, ya cubiertos).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/entities.ts packages/api-client/src/documents/mockDocumentRepository.ts packages/api-client/src/documents/supabaseDocumentRepository.ts supabase/migrations/0038_mimetype_documentos.sql
git commit -m "feat(core): agregar mimeType a Document"
```

---

### Task 2: `DocumentRepository.getDocumentFileBytes`

**Files:**
- Modify: `packages/core/src/domain/ports.ts`
- Modify: `packages/api-client/src/documents/mockDocumentRepository.ts`
- Modify: `packages/api-client/src/documents/supabaseDocumentRepository.ts`

- [ ] **Step 1: Agregar el método al puerto**

En `packages/core/src/domain/ports.ts`, dentro de `export interface DocumentRepository { ... }`, después de `getDocument(...)`:

```ts
  /**
   * Bytes crudos de un documento ya subido — Document solo guarda fileUrl,
   * no hay forma hoy de releer el archivo. Se agrega para Custodia (W-xx),
   * que necesita mandarle el documento a la IA. Devuelve null si el
   * documento no existe/no es de la familia del caller, o si no tiene
   * mimeType guardado (subido antes de la migración 0038).
   */
  getDocumentFileBytes(parentId: string, documentId: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
```

- [ ] **Step 2: Implementación mock**

En `packages/api-client/src/documents/mockDocumentRepository.ts`:

Agregar un `Map` nuevo junto a `documents` (arriba de `return {`):

```ts
  const fileBytesByDocumentId = new Map<string, Uint8Array>();
```

En `uploadDocument`, antes de `documents.set(document.id, document);`, guardar los bytes:

```ts
      fileBytesByDocumentId.set(document.id, input.fileBytes);
      documents.set(document.id, document);
```

Agregar el método nuevo al objeto devuelto, después de `getDocument`:

```ts
    async getDocumentFileBytes(parentId, documentId) {
      const familyId = await getFamilyId(parentId);
      const document = documents.get(documentId);
      if (!document || document.familyId !== familyId || !document.mimeType) return null;
      const bytes = fileBytesByDocumentId.get(documentId);
      if (!bytes) return null;
      return { bytes, mimeType: document.mimeType };
    },
```

- [ ] **Step 3: Implementación Supabase**

En `packages/api-client/src/documents/supabaseDocumentRepository.ts`, agregar después de `getDocument`:

```ts
    async getDocumentFileBytes(parentId, documentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;
      const { data, error } = await client
        .from("documents")
        .select()
        .eq("id", documentId)
        .eq("family_id", familyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const document = mapDocument(data);
      if (!document.mimeType) return null;

      const response = await fetch(document.fileUrl);
      if (!response.ok) {
        throw new Error(`No se pudo descargar el documento (${response.status})`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, mimeType: document.mimeType };
    },
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/ports.ts packages/api-client/src/documents/mockDocumentRepository.ts packages/api-client/src/documents/supabaseDocumentRepository.ts
git commit -m "feat(api-client): agregar getDocumentFileBytes a DocumentRepository"
```

---

### Task 3: Puerto `CustodyDocumentAnalyzer`

**Files:**
- Modify: `packages/core/src/domain/ports.ts`

- [ ] **Step 1: Agregar los tipos y la interfaz**

En `packages/core/src/domain/ports.ts`, al final del archivo (después de `VerbalAgreementRepository`):

```ts
export interface CustodyScheduleProposalSlot {
  childId: string;
  parentId: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface ReminderProposalItem {
  title: string;
  /** null = no ligado a un hijo en particular, mismo criterio que ImportantDate.childId */
  childId: string | null;
  startDate: string;
  endDate: string;
}

/**
 * Analiza el convenio de custodia (documento PDF/imagen + Acuerdos
 * verbales confirmados) para PROPONER horario de custodia y/o fechas
 * importantes — nunca escribe directamente, la UI exige confirmación
 * humana antes de persistir (mismo criterio que AgreementDetector y
 * ToneAnalyzer: la IA nunca es la última palabra sobre un dato que se
 * vuelve parte del convenio/calendario real). Implementación real
 * instanciada server-side en apps/web/src/lib/repository.ts, nunca en el
 * cliente — misma razón que AgreementDetector (la API key no puede vivir
 * en un bundle de navegador).
 *
 * children/familyMembers se pasan para que el prompt pueda mapear nombres
 * propios mencionados en el documento ("Eugenia", "papá") a los
 * childId/parentId reales de la familia — sin esto la IA no tiene forma
 * de saber a qué id se refiere cada nombre.
 */
export interface CustodyDocumentAnalyzer {
  proposeSchedule(input: {
    documentBytes: Uint8Array;
    mimeType: string;
    verbalAgreements: VerbalAgreement[];
    children: Child[];
    familyMembers: Parent[];
  }): Promise<{ slots: CustodyScheduleProposalSlot[] }>;

  proposeReminders(input: {
    documentBytes: Uint8Array;
    mimeType: string;
    verbalAgreements: VerbalAgreement[];
    children: Child[];
  }): Promise<{ reminders: ReminderProposalItem[] }>;
}
```

(`VerbalAgreement`, `Child`, `Parent` ya están importados arriba del archivo — no hace falta agregar imports.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errores (interfaz nueva sin implementaciones todavía no rompe nada).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/domain/ports.ts
git commit -m "feat(core): agregar puerto CustodyDocumentAnalyzer"
```

---

### Task 4: Implementación heurística (demo mode) + test

**Files:**
- Create: `packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.ts`
- Create: `packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.test.ts`
- Modify: `packages/api-client/src/tone/index.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.test.ts`:

```ts
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -w packages/api-client`
Expected: FAIL — `Cannot find module './heuristicCustodyDocumentAnalyzer'`

- [ ] **Step 3: Implementar**

Crear `packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.ts`:

```ts
import type { CustodyDocumentAnalyzer } from "@alba/core";

/**
 * Heurístico para probar el flujo sin ANTHROPIC_API_KEY — IGNORA por
 * completo el contenido del documento (no hay forma de "leerlo" sin una
 * API real) y devuelve una propuesta fija de ejemplo usando los primeros
 * hijo(s)/progenitores de la familia. Mismo criterio que
 * heuristicAgreementDetector.ts: imita la FORMA de la salida real, no el
 * análisis. Se reemplaza por createAnthropicCustodyDocumentAnalyzer en
 * cuanto exista la key.
 */
export function createHeuristicCustodyDocumentAnalyzer(): CustodyDocumentAnalyzer {
  return {
    async proposeSchedule({ children, familyMembers }) {
      if (children.length === 0 || familyMembers.length === 0) return { slots: [] };
      const child = children[0];
      const [parentA, parentB] = familyMembers;

      return {
        slots: [
          { childId: child.id, parentId: parentA.id, weekday: 1, startTime: "08:00", endTime: "18:00" },
          { childId: child.id, parentId: parentA.id, weekday: 3, startTime: "08:00", endTime: "18:00" },
          { childId: child.id, parentId: (parentB ?? parentA).id, weekday: 5, startTime: "08:00", endTime: "18:00" },
        ],
      };
    },

    async proposeReminders({ children }) {
      if (children.length === 0) return { reminders: [] };
      const child = children[0];
      const today = new Date();
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);
      const toDateKey = (d: Date) => d.toISOString().slice(0, 10);

      return {
        reminders: [
          {
            title: `Entrega de útiles escolares de ${child.fullName} (ejemplo detectado)`,
            childId: child.id,
            startDate: toDateKey(in30Days),
            endDate: toDateKey(in30Days),
          },
        ],
      };
    },
  };
}
```

- [ ] **Step 4: Correr el test de nuevo**

Run: `npm test -w packages/api-client`
Expected: PASS — 3 tests.

- [ ] **Step 5: Exportar desde el índice**

En `packages/api-client/src/tone/index.ts`, agregar:

```ts
export { createHeuristicCustodyDocumentAnalyzer } from "./heuristicCustodyDocumentAnalyzer";
```

- [ ] **Step 6: Commit**

```bash
git add packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.ts packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.test.ts packages/api-client/src/tone/index.ts
git commit -m "feat(api-client): heurístico de CustodyDocumentAnalyzer para modo demo"
```

---

### Task 5: Implementación real con Anthropic

**Files:**
- Create: `packages/api-client/src/tone/anthropicCustodyDocumentAnalyzer.ts`
- Modify: `packages/api-client/src/tone/index.ts`

- [ ] **Step 1: Implementar**

Crear `packages/api-client/src/tone/anthropicCustodyDocumentAnalyzer.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Child, CustodyDocumentAnalyzer, Parent, VerbalAgreement } from "@alba/core";
import { extractJson } from "./extractJson";

// Sonnet (no Haiku, a diferencia del resto de la app) — esta tarea lee un
// documento real (PDF/foto de un convenio legal) y extrae una estructura
// de varios campos, no solo clasifica un mensaje corto; en pruebas
// informales Sonnet interpreta documentos escaneados/PDFs con mucha más
// consistencia que Haiku. Si en producción Haiku resulta suficiente, se
// puede bajar el costo cambiando solo esta constante.
const MODEL = "claude-sonnet-4-5-20250929";

function buildDocumentBlock(bytes: Uint8Array, mimeType: string) {
  const data = Buffer.from(bytes).toString("base64");
  if (mimeType === "application/pdf") {
    return { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } };
  }
  // Claude solo acepta estos 4 media_type de imagen — mimeType ya viene
  // filtrado a "image/*" por el selector de documentos en Custodia, pero
  // se castea explícito porque el tipo del SDK es un union cerrado.
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data },
  };
}

function formatVerbalAgreements(agreements: VerbalAgreement[]): string {
  if (agreements.length === 0) return "(sin acuerdos verbales confirmados)";
  return agreements.map((a) => `- [${a.agreedAt}] ${a.description}`).join("\n");
}

function formatPeople(children: Child[], familyMembers: Parent[]): string {
  const childLines = children.map((c) => `  - childId="${c.id}" → ${c.fullName}`).join("\n");
  const parentLines = familyMembers.map((p) => `  - parentId="${p.id}" → ${p.fullName}`).join("\n");
  return `Hijos:\n${childLines || "  (ninguno)"}\nProgenitores:\n${parentLines || "  (ninguno)"}`;
}

const SCHEDULE_SYSTEM_PROMPT = `Eres el asistente de Custodia de ALBA, una app de coparentalidad. Te dan un documento (convenio de custodia, PDF o foto) y, opcionalmente, acuerdos verbales ya confirmados por ambos progenitores. Tu tarea es proponer el horario semanal RECURRENTE de custodia (quién tiene a cada hijo, qué día de la semana, de qué hora a qué hora).

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"slots": [{"childId": string, "parentId": string, "weekday": number, "startTime": "HH:MM", "endTime": "HH:MM"}]}

- "weekday": 0 = domingo ... 6 = sábado.
- "childId"/"parentId" DEBEN ser exactamente uno de los ids listados abajo — nunca inventes un id ni uses un nombre en su lugar.
- Si el documento no describe un horario recurrente claro, o si no podés mapear con confianza un día a un progenitor/hijo de la lista, devolvé {"slots": []} — nunca inventes un horario que no esté explícito.
- No repitas el mismo childId+parentId+weekday dos veces.`;

const REMINDERS_SYSTEM_PROMPT = `Eres el asistente de Custodia de ALBA, una app de coparentalidad. Te dan un documento (convenio de custodia, PDF o foto) y, opcionalmente, acuerdos verbales ya confirmados por ambos progenitores. Tu tarea es proponer "recordatorios": fechas puntuales o rangos de fecha relevantes (entregas, inicios/fines de ciclo escolar, vacaciones, cumpleaños, plazos) — NO horario recurrente semanal (eso es otra tarea).

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"reminders": [{"title": string, "childId": string | null, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}]}

- "title": 2 a 120 caracteres, en español, describe el recordatorio (ej. "Entrega de útiles escolares").
- "childId": uno de los ids listados abajo, o null si no aplica a un hijo en particular.
- "endDate" siempre >= "startDate". Si es un evento de 1 día, startDate = endDate.
- Si el documento no menciona ninguna fecha reconocible, devolvé {"reminders": []} — nunca inventes una fecha que no esté explícita.`;

/**
 * Implementación real — nunca se llama desde el cliente (la API key no
 * puede vivir en un binario/bundle del navegador). Se instancia
 * server-side en apps/web/src/lib/repository.ts cuando existe
 * ANTHROPIC_API_KEY, mismo criterio que createAnthropicAgreementDetector.
 */
export function createAnthropicCustodyDocumentAnalyzer(apiKey: string): CustodyDocumentAnalyzer {
  const client = new Anthropic({ apiKey });

  return {
    async proposeSchedule({ documentBytes, mimeType, verbalAgreements, children, familyMembers }) {
      if (children.length === 0 || familyMembers.length === 0) return { slots: [] };

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SCHEDULE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              buildDocumentBlock(documentBytes, mimeType),
              {
                type: "text",
                text: `${formatPeople(children, familyMembers)}\n\nAcuerdos verbales confirmados:\n${formatVerbalAgreements(verbalAgreements)}`,
              },
            ],
          },
        ],
      });

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "{}";

      try {
        const parsed = JSON.parse(extractJson(text)) as { slots?: unknown };
        if (!Array.isArray(parsed.slots)) return { slots: [] };
        return { slots: parsed.slots as CustodyDocumentAnalyzer extends { proposeSchedule: (i: any) => Promise<infer R> } ? R["slots"] : never };
      } catch (err) {
        console.error("[anthropicCustodyDocumentAnalyzer] proposeSchedule: respuesta no parseable", { text, err });
        return { slots: [] };
      }
    },

    async proposeReminders({ documentBytes, mimeType, verbalAgreements, children }) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: REMINDERS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              buildDocumentBlock(documentBytes, mimeType),
              {
                type: "text",
                text: `${formatPeople(children, [])}\n\nAcuerdos verbales confirmados:\n${formatVerbalAgreements(verbalAgreements)}`,
              },
            ],
          },
        ],
      });

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "{}";

      try {
        const parsed = JSON.parse(extractJson(text)) as { reminders?: unknown };
        if (!Array.isArray(parsed.reminders)) return { reminders: [] };
        return { reminders: parsed.reminders as CustodyDocumentAnalyzer extends { proposeReminders: (i: any) => Promise<infer R> } ? R["reminders"] : never };
      } catch (err) {
        console.error("[anthropicCustodyDocumentAnalyzer] proposeReminders: respuesta no parseable", { text, err });
        return { reminders: [] };
      }
    },
  };
}
```

Nota para quien implemente: el cast con `extends ... infer R` es solo para evitar `as any` crudo; si al correr `npm run typecheck` da problemas de tipos en esa línea, reemplazar por `as { slots: CustodyScheduleProposalSlot[] }` / `as { reminders: ReminderProposalItem[] }` importando esos dos tipos desde `@alba/core` — es una simplificación válida, el objetivo es no perder la validación de que el campo es un array (ya chequeada arriba con `Array.isArray`).

- [ ] **Step 2: Exportar desde el índice**

En `packages/api-client/src/tone/index.ts`, agregar:

```ts
export { createAnthropicCustodyDocumentAnalyzer } from "./anthropicCustodyDocumentAnalyzer";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errores (ajustar el cast señalado arriba si hace falta).

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/tone/anthropicCustodyDocumentAnalyzer.ts packages/api-client/src/tone/index.ts
git commit -m "feat(api-client): implementación real de CustodyDocumentAnalyzer con Anthropic"
```

---

### Task 6: Wiring en `apps/web/src/lib/repository.ts`

**Files:**
- Modify: `apps/web/src/lib/repository.ts`

- [ ] **Step 1: Importar las fábricas nuevas**

En el bloque de imports desde `@alba/api-client`, agregar `createAnthropicCustodyDocumentAnalyzer` y `createHeuristicCustodyDocumentAnalyzer` (orden alfabético, junto a los otros `createAnthropic*`/`createHeuristic*`).

En el bloque de imports `type` desde `@alba/core`, agregar `CustodyDocumentAnalyzer`.

- [ ] **Step 2: Agregar el singleton**

Al final del archivo, después del bloque de `agreementDetector`:

```ts
const globalForCustodyAi = globalThis as unknown as { custodyDocumentAnalyzer?: CustodyDocumentAnalyzer };
globalForCustodyAi.custodyDocumentAnalyzer ??= isAnthropicConfigured
  ? createAnthropicCustodyDocumentAnalyzer(process.env.ANTHROPIC_API_KEY!)
  : createHeuristicCustodyDocumentAnalyzer();

export const custodyDocumentAnalyzer: CustodyDocumentAnalyzer = globalForCustodyAi.custodyDocumentAnalyzer;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/repository.ts
git commit -m "feat(web): wiring de custodyDocumentAnalyzer"
```

---

### Task 7: Habilitar la tarjeta "Custodia" en `/mas`

**Files:**
- Modify: `apps/web/src/app/mas/page.tsx`

- [ ] **Step 1: Cambiar la tarjeta de `disabled` a `href`**

En `apps/web/src/app/mas/page.tsx`, reemplazar:

```tsx
        <FeatureCard
          label="Custodia"
          iconBgClass="bg-purple"
          disabled
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7l-3 3 3 3M17 7l3 3-3 3M4 10h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
```

por:

```tsx
        <FeatureCard
          href={`/mas/custodia${asQuery}`}
          label="Custodia"
          iconBgClass="bg-purple"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7l-3 3 3 3M17 7l3 3-3 3M4 10h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
```

(El icono de flechas se deja igual — ya existe y combina con el resto de `/mas`.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errores (el link apunta a una ruta que se crea en el Task 8 — Next.js no valida rutas en build de typecheck, pero si se corre `npm run build` antes del Task 8 fallaría; no es necesario correr build todavía).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/mas/page.tsx
git commit -m "feat(web): habilitar tarjeta Custodia en /mas"
```

---

### Task 8: Scaffold de `/mas/custodia` + Server Actions

**Files:**
- Create: `apps/web/src/app/mas/custodia/actions.ts`
- Create: `apps/web/src/app/mas/custodia/page.tsx`

- [ ] **Step 1: Server Actions**

Crear `apps/web/src/app/mas/custodia/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { custodySlotInputSchema, importantDateInputSchema } from "@alba/core";
import type { CustodyScheduleProposalSlot, ReminderProposalItem } from "@alba/core";
import { custodyDocumentAnalyzer, getRequestContext } from "@/lib/repository";

/** Acuerdos verbales considerados por la IA — solo los ya confirmados por
 * ambos progenitores, nunca propuestas sin confirmar (ver spec). */
async function getConfirmedVerbalAgreements(
  verbalAgreements: Awaited<ReturnType<typeof getRequestContext>>["verbalAgreements"],
  parentId: string
) {
  const all = await verbalAgreements.listVerbalAgreements(parentId);
  return all.filter((a) => a.confirmedAt !== null);
}

export async function proposeScheduleAction(
  documentId: string,
  as?: string
): Promise<{ slots: CustodyScheduleProposalSlot[] } | { error: string }> {
  const { documents, pairing, verbalAgreements, parentId } = await getRequestContext(as);
  const fileData = await documents.getDocumentFileBytes(parentId, documentId);
  if (!fileData) return { error: "No se pudo leer el documento elegido." };

  const [confirmedAgreements, kids, familyMembers] = await Promise.all([
    getConfirmedVerbalAgreements(verbalAgreements, parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);

  return custodyDocumentAnalyzer.proposeSchedule({
    documentBytes: fileData.bytes,
    mimeType: fileData.mimeType,
    verbalAgreements: confirmedAgreements,
    children: kids,
    familyMembers,
  });
}

export async function confirmScheduleProposalAction(
  slots: CustodyScheduleProposalSlot[],
  as?: string
): Promise<{ error: string } | { success: true }> {
  if (slots.length === 0) return { error: "No seleccionaste ningún horario." };

  const { custody, parentId } = await getRequestContext(as);
  let validated;
  try {
    validated = slots.map((s) => custodySlotInputSchema.parse({ ...s, placeId: null }));
  } catch {
    return { error: "Alguno de los horarios quedó con un dato inválido — revisa los campos y vuelve a intentar." };
  }

  const agreement = await custody.getMyAgreement(parentId);
  await custody.upsertSlots(parentId, [...agreement.slots, ...validated]);
  revalidatePath("/mas/custodia");
  return { success: true };
}

export async function proposeRemindersAction(
  documentId: string,
  as?: string
): Promise<{ reminders: ReminderProposalItem[] } | { error: string }> {
  const { documents, verbalAgreements, pairing, parentId } = await getRequestContext(as);
  const fileData = await documents.getDocumentFileBytes(parentId, documentId);
  if (!fileData) return { error: "No se pudo leer el documento elegido." };

  const [confirmedAgreements, kids] = await Promise.all([
    getConfirmedVerbalAgreements(verbalAgreements, parentId),
    pairing.getMyChildren(parentId),
  ]);

  return custodyDocumentAnalyzer.proposeReminders({
    documentBytes: fileData.bytes,
    mimeType: fileData.mimeType,
    verbalAgreements: confirmedAgreements,
    children: kids,
  });
}

export async function confirmReminderProposalAction(
  reminders: ReminderProposalItem[],
  as?: string
): Promise<{ error: string } | { success: true }> {
  if (reminders.length === 0) return { error: "No seleccionaste ningún recordatorio." };

  const { custody, parentId } = await getRequestContext(as);
  let validated;
  try {
    validated = reminders.map((r) => importantDateInputSchema.parse(r));
  } catch {
    return { error: "Alguno de los recordatorios quedó con un dato inválido — revisa los campos y vuelve a intentar." };
  }

  for (const reminder of validated) {
    await custody.createImportantDate(parentId, reminder);
  }
  revalidatePath("/mas/custodia");
  return { success: true };
}
```

- [ ] **Step 2: Página con las 3 pestañas**

Crear `apps/web/src/app/mas/custodia/page.tsx`:

```tsx
import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { CalendarioTab } from "./CalendarioTab";
import { IntercambiosTab } from "./IntercambiosTab";
import { RecordatoriosTab } from "./RecordatoriosTab";

type CustodiaTab = "calendario" | "intercambios" | "recordatorios";

function tabHref(tab: CustodiaTab, as?: string): string {
  const params = new URLSearchParams({ tab });
  if (as === "b") params.set("as", "b");
  return `/mas/custodia?${params.toString()}`;
}

const TABS: { key: CustodiaTab; label: string }[] = [
  { key: "calendario", label: "Calendario" },
  { key: "intercambios", label: "Intercambios" },
  { key: "recordatorios", label: "Recordatorios" },
];

export default async function CustodiaPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; tab?: string }>;
}) {
  const { as, tab: rawTab } = await searchParams;
  const tab: CustodiaTab = rawTab === "intercambios" || rawTab === "recordatorios" ? rawTab : "calendario";
  const { pairing, custody, documents, parentId } = await getRequestContext(as);

  const [profile, kids, familyMembers, agreement, docs] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    custody.getMyAgreement(parentId),
    documents.listDocuments(parentId),
  ]);

  const analyzableDocuments = docs.filter((d) => d.mimeType === "application/pdf" || (d.mimeType?.startsWith("image/") ?? false));
  const asQuery = as === "b" ? "?as=b" : "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {isDemoMode && (
        <p className="mb-6 mt-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/mas/custodia" : "/mas/custodia?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <Link href={`/mas${asQuery}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Más
      </Link>

      <h1 className="text-xl font-extrabold text-ink">Custodia</h1>

      <nav className="mt-4 flex gap-1 rounded-2xl bg-sand p-1">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={tabHref(key, as)}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors ${
              tab === key ? "bg-ink text-white" : "text-ink-soft"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "calendario" && (
          <CalendarioTab
            as={as}
            parentId={parentId}
            agreement={agreement}
            kids={kids}
            familyMembers={familyMembers}
            analyzableDocuments={analyzableDocuments}
          />
        )}
        {tab === "intercambios" && (
          <IntercambiosTab as={as} parentId={parentId} agreement={agreement} kids={kids} familyMembers={familyMembers} custody={custody} />
        )}
        {tab === "recordatorios" && (
          <RecordatoriosTab
            as={as}
            parentId={parentId}
            kids={kids}
            analyzableDocuments={analyzableDocuments}
            custody={custody}
          />
        )}
      </div>

      <AppNav active="Más" />
    </div>
  );
}
```

(Este archivo no compila todavía — `CalendarioTab`/`IntercambiosTab`/`RecordatoriosTab` se crean en los próximos 3 tasks. Es esperado, no correr typecheck todavía.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/mas/custodia/actions.ts apps/web/src/app/mas/custodia/page.tsx
git commit -m "feat(web): scaffold de /mas/custodia (actions + page)"
```

---

### Task 9: Pestaña Calendario (`CalendarioTab` + `ScheduleAiAssistant`)

**Files:**
- Create: `apps/web/src/app/mas/custodia/CalendarioTab.tsx`
- Create: `apps/web/src/app/mas/custodia/ScheduleAiAssistant.tsx`

- [ ] **Step 1: Client Component del asistente**

Crear `apps/web/src/app/mas/custodia/ScheduleAiAssistant.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { CustodyScheduleProposalSlot } from "@alba/core";
import { confirmScheduleProposalAction, proposeScheduleAction } from "./actions";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type ProposedSlot = CustodyScheduleProposalSlot & { checked: boolean };

export function ScheduleAiAssistant({
  as,
  parentId,
  kids,
  familyMembers,
  analyzableDocuments,
}: {
  as?: string;
  parentId: string;
  kids: { id: string; fullName: string }[];
  familyMembers: { id: string; fullName: string }[];
  analyzableDocuments: { id: string; title: string }[];
}) {
  const [documentId, setDocumentId] = useState(analyzableDocuments[0]?.id ?? "");
  const [proposal, setProposal] = useState<ProposedSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (analyzableDocuments.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Todavía no tienes un PDF o foto en Bóveda.{" "}
        <a href={`/boveda${as === "b" ? "?as=b" : ""}`} className="font-semibold text-salmon underline">
          Sube tu convenio ahí primero
        </a>
        .
      </p>
    );
  }

  if (done) {
    return <p className="text-sm font-semibold text-success">✓ Horarios agregados a tu convenio.</p>;
  }

  function runAnalysis() {
    setError(null);
    startTransition(async () => {
      const result = await proposeScheduleAction(documentId, as);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.slots.length === 0) {
        setError(
          "No pudimos detectar un horario de custodia en este documento — puedes intentar con otro o crear los horarios a mano en Calendario."
        );
        return;
      }
      setProposal(result.slots.map((s) => ({ ...s, checked: true })));
    });
  }

  function toggleSlot(idx: number) {
    setProposal((prev) => prev && prev.map((s, i) => (i === idx ? { ...s, checked: !s.checked } : s)));
  }

  function updateSlot(idx: number, patch: Partial<CustodyScheduleProposalSlot>) {
    setProposal((prev) => prev && prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function confirm() {
    if (!proposal) return;
    const chosen = proposal.filter((s) => s.checked).map(({ checked, ...slot }) => slot);
    setError(null);
    startTransition(async () => {
      const result = await confirmScheduleProposalAction(chosen, as);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (!proposal) {
    return (
      <div className="flex flex-col gap-2">
        <select
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        >
          {analyzableDocuments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isPending}
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Analizando…" : "Configurar con IA"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">Revisa lo que detectamos antes de agregarlo a tu convenio:</p>
      <ul className="flex flex-col gap-2">
        {proposal.map((slot, idx) => (
          <li key={idx} className="rounded-xl border border-subtle bg-sand px-3 py-2.5">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={slot.checked} onChange={() => toggleSlot(idx)} className="mt-1.5" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <select
                    value={slot.childId}
                    onChange={(e) => updateSlot(idx, { childId: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  >
                    {kids.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={slot.parentId}
                    onChange={(e) => updateSlot(idx, { parentId: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  >
                    {familyMembers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === parentId ? "Tú" : p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <select
                    value={slot.weekday}
                    onChange={(e) => updateSlot(idx, { weekday: Number(e.target.value) })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  >
                    {WEEKDAY_LABELS.map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={isPending || proposal.every((s) => !s.checked)}
        className="rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Agregar a mi convenio"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Server Component de la pestaña**

Crear `apps/web/src/app/mas/custodia/CalendarioTab.tsx`:

```tsx
import type { Child, CustodyAgreement, Document, Parent } from "@alba/core";
import { ScheduleAiAssistant } from "./ScheduleAiAssistant";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function CalendarioTab({
  as,
  parentId,
  agreement,
  kids,
  familyMembers,
  analyzableDocuments,
}: {
  as?: string;
  parentId: string;
  agreement: CustodyAgreement;
  kids: Child[];
  familyMembers: Parent[];
  analyzableDocuments: Document[];
}) {
  const childName = (id: string) => kids.find((c) => c.id === id)?.fullName ?? "—";
  const parentName = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "—");
  const assistantProps = { as, parentId, kids, familyMembers, analyzableDocuments: analyzableDocuments.map((d) => ({ id: d.id, title: d.title })) };

  if (agreement.slots.length === 0) {
    return (
      <div className="rounded-2xl border border-subtle bg-card p-6 text-center shadow-ambient">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mx-auto text-ink-faint">
          <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="mt-3 text-base font-bold text-ink">Aún no has configurado la custodia</p>
        <p className="mt-1 text-sm text-ink-soft">Crea el calendario de custodia con ayuda de la IA.</p>
        <div className="mt-4 text-left">
          <ScheduleAiAssistant {...assistantProps} />
        </div>
      </div>
    );
  }

  const byChild = new Map<string, CustodyAgreement["slots"]>();
  for (const slot of agreement.slots) {
    const list = byChild.get(slot.childId) ?? [];
    list.push(slot);
    byChild.set(slot.childId, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byChild.entries()].map(([childId, slots]) => (
        <div key={childId} className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <p className="text-sm font-bold text-ink">Esta semana con {childName(childId)}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {[...slots]
              .sort((a, b) => a.weekday - b.weekday)
              .map((slot, idx) => (
                <li key={idx} className="text-sm text-ink-soft">
                  {WEEKDAY_LABELS[slot.weekday]} {slot.startTime}–{slot.endTime} con{" "}
                  <strong className="text-ink">{parentName(slot.parentId)}</strong>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <details className="group rounded-2xl border border-subtle bg-card px-4 py-3 shadow-ambient">
        <summary className="cursor-pointer text-xs font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
          Volver a analizar con IA →
        </summary>
        <div className="mt-3">
          <ScheduleAiAssistant {...assistantProps} />
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/mas/custodia/CalendarioTab.tsx apps/web/src/app/mas/custodia/ScheduleAiAssistant.tsx
git commit -m "feat(web): pestaña Calendario de Custodia (resumen + asistente IA)"
```

---

### Task 10: Pestaña Intercambios

**Files:**
- Create: `apps/web/src/app/mas/custodia/IntercambiosTab.tsx`

- [ ] **Step 1: Implementar**

Crear `apps/web/src/app/mas/custodia/IntercambiosTab.tsx`:

```tsx
import type { Child, CustodyAgreement, CustodyRepository, Parent } from "@alba/core";
import { findComplianceIssues } from "@alba/core";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmCheckinAction, confirmCheckoutAction } from "@/app/calendario/actions";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const r = new Date(date);
  r.setHours(h ?? 0, m ?? 0, 0, 0);
  return r;
}

export async function IntercambiosTab({
  as,
  parentId,
  agreement,
  kids,
  familyMembers,
  custody,
}: {
  as?: string;
  parentId: string;
  agreement: CustodyAgreement;
  kids: Child[];
  familyMembers: Parent[];
  custody: CustodyRepository;
}) {
  if (agreement.slots.length === 0) {
    return (
      <div className="rounded-2xl border border-subtle bg-card p-6 text-center shadow-ambient">
        <p className="text-sm text-ink-soft">Para ver los intercambios, primero activa un convenio de custodia.</p>
        <a
          href={`/mas/custodia?tab=calendario${as === "b" ? "&as=b" : ""}`}
          className="mt-3 inline-block rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink"
        >
          Ir a Calendario
        </a>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = addDays(today, -7);
  const rangeEnd = addDays(today, 8); // exclusivo: hoy + 7 días adelante

  const [events, places] = await Promise.all([
    custody.listEventsForRange(parentId, isoDateLocal(rangeStart), isoDateLocal(rangeEnd)),
    custody.listMeetingPlaces(parentId),
  ]);

  const childName = (id: string) => kids.find((c) => c.id === id)?.fullName ?? "—";
  const parentName = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "—");
  const placeName = (id: string | null) => (id ? (places.find((p) => p.id === id)?.name ?? null) : null);

  const now = new Date();
  type UpcomingItem = { day: Date; slot: CustodyAgreement["slots"][number]; scheduledIn: Date; scheduledOut: Date };
  const upcoming: UpcomingItem[] = [];
  for (let i = 0; i < 8; i++) {
    const day = addDays(today, i);
    const weekday = day.getDay();
    for (const slot of agreement.slots) {
      if (slot.weekday !== weekday) continue;
      const scheduledIn = combineDateAndTime(day, slot.startTime);
      const scheduledOut = combineDateAndTime(day, slot.endTime);
      if (scheduledOut >= now) upcoming.push({ day, slot, scheduledIn, scheduledOut });
    }
  }
  upcoming.sort((a, b) => a.scheduledIn.getTime() - b.scheduledIn.getTime());

  type HistoryItem = { day: Date; issues: ReturnType<typeof findComplianceIssues> };
  const history: HistoryItem[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, -i);
    if (!agreement.slots.some((s) => s.weekday === day.getDay())) continue;
    history.push({ day, issues: findComplianceIssues(agreement, events, day) });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink">Próximos intercambios</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay intercambios programados en los próximos 7 días.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map(({ day, slot, scheduledIn, scheduledOut }, idx) => {
              const checkinEvent = events.find(
                (e) =>
                  e.type === "checkin" &&
                  e.childId === slot.childId &&
                  e.parentId === slot.parentId &&
                  e.scheduledAt === scheduledIn.toISOString()
              );
              const checkoutEvent = events.find(
                (e) =>
                  e.type === "checkout" &&
                  e.childId === slot.childId &&
                  e.parentId === slot.parentId &&
                  e.scheduledAt === scheduledOut.toISOString()
              );
              const isMySlotToday = isoDateLocal(day) === isoDateLocal(today) && slot.parentId === parentId;
              return (
                <li key={idx} className="rounded-xl border border-subtle bg-card px-3.5 py-3 shadow-ambient">
                  <span className="text-sm text-ink">
                    {WEEKDAY_LABELS[day.getDay()]} {slot.startTime}–{slot.endTime} · {childName(slot.childId)} con{" "}
                    <strong>{parentName(slot.parentId)}</strong>
                  </span>
                  {placeName(slot.placeId) && <p className="mt-1 text-xs text-ink-soft">📍 {placeName(slot.placeId)}</p>}
                  {isMySlotToday && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {checkinEvent?.confirmedAt ? (
                        <span className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">✓ Check-in confirmado</span>
                      ) : (
                        <form action={confirmCheckinAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="childId" value={slot.childId} />
                          <input type="hidden" name="scheduledAt" value={scheduledIn.toISOString()} />
                          <SubmitButton pendingText="Confirmando…" className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-ink">
                            Confirmar check-in
                          </SubmitButton>
                        </form>
                      )}
                      {checkoutEvent?.confirmedAt ? (
                        <span className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">✓ Check-out confirmado</span>
                      ) : (
                        <form action={confirmCheckoutAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="childId" value={slot.childId} />
                          <input type="hidden" name="scheduledAt" value={scheduledOut.toISOString()} />
                          <SubmitButton
                            pendingText="Confirmando…"
                            className="rounded-full border border-subtle bg-card px-3 py-1.5 text-xs font-medium text-ink"
                          >
                            Confirmar check-out
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink">Historial</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay intercambios pasados que mostrar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map(({ day, issues }) => (
              <li key={isoDateLocal(day)} className="rounded-xl border border-subtle bg-card px-3.5 py-3 shadow-ambient">
                <p className="text-sm font-semibold text-ink">
                  {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}/{day.getMonth() + 1}
                </p>
                {issues.length === 0 ? (
                  <p className="mt-1 text-xs font-medium text-success">✓ A tiempo</p>
                ) : (
                  issues.map((issue, idx) => (
                    <p
                      key={idx}
                      className={`mt-1 text-xs font-semibold ${issue.type === "late_checkin" ? "text-orange-deep" : "text-danger"}`}
                    >
                      {childName(issue.childId)} ·{" "}
                      {issue.type === "missed_checkin" && "Sin confirmar"}
                      {issue.type === "late_checkin" && `Tardío (${issue.minutesLate} min)`}
                    </p>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/mas/custodia/IntercambiosTab.tsx
git commit -m "feat(web): pestaña Intercambios de Custodia (próximos + historial)"
```

---

### Task 11: Pestaña Recordatorios (`RecordatoriosTab` + `ReminderAiAssistant`)

**Files:**
- Create: `apps/web/src/app/mas/custodia/ReminderAiAssistant.tsx`
- Create: `apps/web/src/app/mas/custodia/RecordatoriosTab.tsx`

- [ ] **Step 1: Client Component del asistente**

Crear `apps/web/src/app/mas/custodia/ReminderAiAssistant.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { ReminderProposalItem } from "@alba/core";
import { confirmReminderProposalAction, proposeRemindersAction } from "./actions";

type ProposedReminder = ReminderProposalItem & { checked: boolean };

export function ReminderAiAssistant({
  as,
  kids,
  analyzableDocuments,
}: {
  as?: string;
  kids: { id: string; fullName: string }[];
  analyzableDocuments: { id: string; title: string }[];
}) {
  const [documentId, setDocumentId] = useState(analyzableDocuments[0]?.id ?? "");
  const [proposal, setProposal] = useState<ProposedReminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (analyzableDocuments.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        ¿Todavía no has subido ningún documento?{" "}
        <a href={`/boveda${as === "b" ? "?as=b" : ""}`} className="font-semibold text-salmon underline">
          Sube tu convenio en Bóveda
        </a>
        .
      </p>
    );
  }

  if (done) {
    return <p className="text-sm font-semibold text-success">✓ Recordatorios agregados.</p>;
  }

  function runAnalysis() {
    setError(null);
    startTransition(async () => {
      const result = await proposeRemindersAction(documentId, as);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.reminders.length === 0) {
        setError("No pudimos detectar fechas en este documento — puedes intentar con otro.");
        return;
      }
      setProposal(result.reminders.map((r) => ({ ...r, checked: true })));
    });
  }

  function toggleReminder(idx: number) {
    setProposal((prev) => prev && prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));
  }

  function updateReminder(idx: number, patch: Partial<ReminderProposalItem>) {
    setProposal((prev) => prev && prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function confirm() {
    if (!proposal) return;
    const chosen = proposal.filter((r) => r.checked).map(({ checked, ...reminder }) => reminder);
    setError(null);
    startTransition(async () => {
      const result = await confirmReminderProposalAction(chosen, as);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (!proposal) {
    return (
      <div className="flex flex-col gap-2">
        <select
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        >
          {analyzableDocuments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isPending}
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Analizando…" : "Analizar mis documentos"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">Revisa lo que detectamos antes de agregarlo:</p>
      <ul className="flex flex-col gap-2">
        {proposal.map((reminder, idx) => (
          <li key={idx} className="rounded-xl border border-subtle bg-sand px-3 py-2.5">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={reminder.checked} onChange={() => toggleReminder(idx)} className="mt-1.5" />
              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  value={reminder.title}
                  onChange={(e) => updateReminder(idx, { title: e.target.value })}
                  className="rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                />
                <select
                  value={reminder.childId ?? ""}
                  onChange={(e) => updateReminder(idx, { childId: e.target.value === "" ? null : e.target.value })}
                  className="rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">Sin hijo específico</option>
                  {kids.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <input
                    type="date"
                    value={reminder.startDate}
                    onChange={(e) => updateReminder(idx, { startDate: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                  <input
                    type="date"
                    value={reminder.endDate}
                    onChange={(e) => updateReminder(idx, { endDate: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={isPending || proposal.every((r) => !r.checked)}
        className="rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Agregar recordatorios"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Server Component de la pestaña (incluye listado de recordatorios ya creados)**

Crear `apps/web/src/app/mas/custodia/RecordatoriosTab.tsx`:

```tsx
import type { Child, CustodyRepository } from "@alba/core";
import { BellIcon } from "@/components/icons";
import { deleteImportantDateAction } from "@/app/calendario/actions";
import { ReminderAiAssistant } from "./ReminderAiAssistant";

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKeyLocal(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export async function RecordatoriosTab({
  as,
  parentId,
  kids,
  analyzableDocuments,
  custody,
}: {
  as?: string;
  parentId: string;
  kids: Child[];
  analyzableDocuments: { id: string; title: string }[];
  custody: CustodyRepository;
}) {
  const today = new Date();
  const start = isoDateLocal(today);
  const end = isoDateLocal(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));
  const reminders = await custody.listImportantDatesForRange(parentId, start, end);

  const childName = (id: string | null) => (id ? kids.find((c) => c.id === id)?.fullName ?? null : null);

  return (
    <div className="flex flex-col gap-5">
      {reminders.length === 0 ? (
        <div className="rounded-2xl border border-subtle bg-card p-6 text-center shadow-ambient">
          <BellIcon className="mx-auto h-10 w-10 text-ink-faint" />
          <p className="mt-3 text-base font-bold text-ink">Aún no hay recordatorios</p>
          <p className="mt-1 text-sm text-ink-soft">Analiza tu convenio para detectar obligaciones, fechas y avisos.</p>
          <div className="mt-4 text-left">
            <ReminderAiAssistant as={as} kids={kids} analyzableDocuments={analyzableDocuments} />
          </div>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {reminders
              .slice()
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-subtle bg-card px-3.5 py-2.5 shadow-ambient">
                  <span className="text-sm text-ink">
                    {formatDay(parseDateKeyLocal(d.startDate))}
                    {d.startDate !== d.endDate && ` – ${formatDay(parseDateKeyLocal(d.endDate))}`} · {d.title}
                    {childName(d.childId) && ` · ${childName(d.childId)}`}
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
          <details className="group rounded-2xl border border-subtle bg-card px-4 py-3 shadow-ambient">
            <summary className="cursor-pointer text-xs font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
              Volver a analizar →
            </summary>
            <div className="mt-3">
              <ReminderAiAssistant as={as} kids={kids} analyzableDocuments={analyzableDocuments} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck de todo el feature**

Run: `npm run typecheck`
Expected: 0 errores (ahora `CalendarioTab`/`IntercambiosTab`/`RecordatoriosTab` ya existen, así que `page.tsx` del Task 8 también compila).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/mas/custodia/ReminderAiAssistant.tsx apps/web/src/app/mas/custodia/RecordatoriosTab.tsx
git commit -m "feat(web): pestaña Recordatorios de Custodia (asistente IA + listado)"
```

---

### Task 12: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Test suite completa**

Run: `npm test`
Expected: todos los tests pasan, incluidos los 3 nuevos de `heuristicCustodyDocumentAnalyzer.test.ts`.

- [ ] **Step 2: Typecheck completo**

Run: `npm run typecheck`
Expected: 0 errores en todo el monorepo.

- [ ] **Step 3: QA manual en navegador (modo demo, sin `ANTHROPIC_API_KEY`)**

Con el preview local corriendo:

1. Subir un PDF o imagen cualquiera a `/boveda`.
2. Ir a `/mas` → confirmar que la tarjeta "Custodia" ya no dice "Próximamente" y navega a `/mas/custodia`.
3. Pestaña **Calendario**: confirmar que muestra el estado vacío, que el selector lista el documento recién subido, correr "Configurar con IA" y confirmar que aparece la propuesta fija del heurístico (3 slots) con checkboxes tildados.
4. Destildar un slot, editar el horario de otro, tocar "Agregar a mi convenio" — confirmar que redirige a la vista resumen ("Esta semana con...") mostrando solo los slots tildados.
5. Ir a `/calendario` y confirmar que el accordion "Convenio — slots de custodia" (editor manual) también muestra esos mismos slots nuevos — prueba de que no se reemplazó nada, se sumó.
6. Volver a `/mas/custodia?tab=intercambios` — confirmar que ya no está bloqueada (hay convenio activo) y que aparece al menos un intercambio en "Próximos".
7. Pestaña **Recordatorios**: correr "Analizar mis documentos", confirmar que aparece 1 recordatorio de ejemplo, confirmarlo, y que después aparece listado.
8. Ir a `/calendario`, abrir el accordion "Fechas importantes" y confirmar que el recordatorio recién agregado aparece ahí también (mismo dato, misma entidad `ImportantDate`).

- [ ] **Step 4: Confirmar con el usuario**

No hay commit en este task — es solo verificación. Si algo falla, volver al task correspondiente y corregir antes de dar por terminado el plan.

---

## Notas para quien ejecute este plan

- El modelo exacto usado en `anthropicCustodyDocumentAnalyzer.ts` (Sonnet) es una decisión tomada en el plan, no en el spec — si en pruebas con documentos reales resulta demasiado caro o lento, está aislado en una sola constante (`MODEL`) fácil de cambiar a Haiku.
- Ningún task de este plan modifica `/calendario` — se verifica explícitamente en el Step 3 del Task 12 (QA manual) que el editor manual sigue intacto y que ambos caminos conviven.
- `CustodyScheduleProposalSlot`/`ReminderProposalItem` no son inputs validados con Zod por sí mismos — la validación real ocurre en `confirmScheduleProposalAction`/`confirmReminderProposalAction` (Task 8), reusando los schemas que ya protegen el editor manual (`custodySlotInputSchema`/`importantDateInputSchema`). Esto es intencional: un dato que viene de una IA se valida con la MISMA regla que un dato que viene de un humano, sin una ruta especial más permisiva.
