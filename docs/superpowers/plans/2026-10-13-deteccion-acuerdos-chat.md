# Detección automática de acuerdos en el Chat (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando dos progenitores negocian algo en un hilo de Chat, ALBA detecta automáticamente (vía IA, después de cada mensaje) si la conversación reciente concluyó en un acuerdo, y ofrece registrarlo con un clic como un Acuerdo Verbal ya existente.

**Architecture:** Mismo molde que el Tone Meter ya shippeado — un puerto de dominio `AgreementDetector` con implementación real (Anthropic Haiku) y heurística (sin API key), orquestado desde `sendMessageAction` (no dentro del repositorio) después de guardar cada mensaje. El resultado se persiste en dos columnas nuevas de `chat_threads` (una sola sugerencia pendiente por hilo, siempre la más reciente) y se muestra como banner en el hilo; "Registrar" reusa `VerbalAgreementRepository.createVerbalAgreement` ya existente, sin lógica de escritura nueva.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres + RLS), `@anthropic-ai/sdk` (`claude-haiku-4-5-20251001`), TypeScript, Node's test runner nativo (`node --test` + `tsx`, ya usado en `packages/core`).

**Spec:** `docs/superpowers/specs/2026-10-13-deteccion-acuerdos-chat-design.md`

---

## Nota sobre testing en este plan

Este repo NO tiene una práctica establecida de tests unitarios para repositorios, Server Actions o los analizadores de IA — el Tone Meter (el feature gemelo de este, ya en producción) no tiene ningún archivo de test; toda esa capa se verifica con pruebas en vivo contra Supabase real (navegador), como documenta el propio spec en su sección "Testing". El único test existente en el monorepo (`packages/core/src/evidence/merkleEngine.test.ts`) cubre lógica criptográfica pura de alto riesgo, no I/O.

Este plan sigue esa misma convención: se agrega **un** test real (`node:test`) para el helper puro `extractJson` que se extrae en la Tarea 2 (es lógica sin I/O, compartida por dos analizadores, y vale la pena fijar su contrato con un test). El resto de las tareas se verifican con `npm run typecheck`, `npm run build`, y una verificación manual en vivo al final (Tarea 9) — igual que todo lo demás construido en este proyecto hasta ahora.

---

### Task 1: Tipos de dominio — puerto `AgreementDetector` y columna nueva en `ChatThread`

**Files:**
- Modify: `packages/core/src/domain/ports.ts`
- Modify: `packages/core/src/domain/entities.ts`

- [ ] **Step 1: Agregar el tipo de resultado y el puerto `AgreementDetector`**

En `packages/core/src/domain/ports.ts`, justo después de la definición de `ToneAnalyzer` (busca el bloque que termina en `export interface ToneAnalyzer {\n  analyze(body: string): Promise<ToneAnalysis>;\n}`), agrega:

```ts
export interface AgreementDetectionResult {
  isAgreement: boolean;
  /** Resumen en una frase, listo para precargar VerbalAgreementInput.description. null cuando isAgreement es false. */
  description: string | null;
}

/**
 * Detector de acuerdos del Chat (W-xx) — mismo criterio que ToneAnalyzer:
 * nunca corre en el cliente, la implementación real llama a Anthropic desde
 * el servidor. Recibe los últimos mensajes de un hilo (más antiguo primero)
 * para poder juzgar un intercambio completo, no un mensaje suelto.
 */
export interface AgreementDetector {
  detect(messages: { senderLabel: "Tú" | "El otro progenitor"; body: string }[]): Promise<AgreementDetectionResult>;
}
```

- [ ] **Step 2: Agregar `setAgreementSuggestion` a `ChatRepository`**

En el mismo archivo, dentro de `export interface ChatRepository { ... }`, inmediatamente después de la firma de `sealThread(parentId: string, threadId: string): Promise<ChatThread>;` (antes del `}` que cierra la interfaz), agrega:

```ts
  /**
   * Persiste (o limpia, pasando null) la sugerencia de acuerdo pendiente de
   * un hilo — siempre reemplaza la anterior, nunca acumula varias: el
   * estado guardado debe reflejar el análisis del ÚLTIMO mensaje del hilo.
   */
  setAgreementSuggestion(
    parentId: string,
    threadId: string,
    suggestion: { description: string; basedOnMessageId: string } | null
  ): Promise<ChatThread>;
```

- [ ] **Step 3: Agregar los dos campos nuevos a `ChatThread`**

En `packages/core/src/domain/entities.ts`, dentro de `export interface ChatThread { ... }`, después del campo `sealedMessageCount: number;` (antes del `}` que cierra la interfaz), agrega:

```ts
  /** Resumen de IA de un acuerdo detectado en los últimos mensajes — null si no hay ninguno pendiente. */
  pendingAgreementSuggestion: string | null;
  /** id del mensaje sobre el que se basó la última detección (o null). */
  pendingAgreementSuggestionBasedOn: string | null;
```

- [ ] **Step 4: Verificar que compila (va a fallar — esperado)**

Run: `npm run typecheck --workspace=@alba/core`
Expected: FAIL — `supabasePairingRepository.ts`, `mockChatRepository.ts`, etc. todavía no implementan `setAgreementSuggestion` ni devuelven los campos nuevos. Eso se arregla en las tareas 4 y 5; por ahora solo confirma que los tipos nuevos en sí no tienen errores de sintaxis.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/ports.ts packages/core/src/domain/entities.ts
git commit -m "feat(chat): add AgreementDetector port and ChatThread suggestion fields"
```

---

### Task 2: Helper compartido `extractJson` + test

**Files:**
- Create: `packages/api-client/src/tone/extractJson.ts`
- Create: `packages/api-client/src/tone/extractJson.test.ts`
- Modify: `packages/api-client/src/tone/anthropicToneAnalyzer.ts`

- [ ] **Step 1: Extraer el helper a su propio archivo**

Crea `packages/api-client/src/tone/extractJson.ts`:

```ts
/**
 * Haiku a veces envuelve el JSON en un bloque de markdown (```json ... ```)
 * pese a que el prompt pide "ÚNICAMENTE JSON" — sin esto, JSON.parse()
 * truena directo. Compartido entre anthropicToneAnalyzer y
 * anthropicAgreementDetector: ambos tienen exactamente el mismo problema.
 */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const braces = candidate.match(/\{[\s\S]*\}/);
  return braces ? braces[0] : candidate;
}
```

- [ ] **Step 2: Escribir el test**

Crea `packages/api-client/src/tone/extractJson.test.ts`:

```ts
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
```

- [ ] **Step 3: Correr el test y confirmar que pasa**

Run: `npm run test --workspace=@alba/api-client` (si el script `test` no existe todavía en ese package, usa directamente: `node --test --import tsx packages/api-client/src/tone/extractJson.test.ts` desde la raíz del repo)
Expected: 4 tests, todos PASS.

Si el comando falla con "Missing script: test" en `packages/api-client/package.json`, agrégalo primero (mismo que `packages/core/package.json`):

```json
"test": "node --test --import tsx ./src/**/*.test.ts"
```

- [ ] **Step 4: Usar el helper compartido en `anthropicToneAnalyzer.ts`**

En `packages/api-client/src/tone/anthropicToneAnalyzer.ts`, las primeras líneas hoy son:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ToneAnalyzer, ToneAnalysis, ToneLevel } from "@alba/core";

const SYSTEM_PROMPT = `Eres el Tone Meter de ALBA, una app de coparentalidad. Analizas UN mensaje que un progenitor está por enviar al otro y evalúas si su tono podría escalar el conflicto.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"level": "neutral" | "tenso" | "hostil", "suggestion": string | null}

- "neutral": el mensaje es informativo o cordial. suggestion debe ser null.
- "tenso": hay indirectas, sarcasmo o acumulación de quejas. suggestion es una reformulación más calmada, misma información, sin acusaciones.
- "hostil": hay insultos, amenazas o descalificaciones. suggestion es una reformulación que preserva la intención (ej. pedir algo, poner un límite) sin el lenguaje agresivo.

Nunca inventes hechos que no estén en el mensaje original. No agregues explicaciones fuera del JSON.`;

/**
 * Haiku a veces envuelve el JSON en un bloque de markdown (```json ... ```)
 * pese a que el prompt pide "ÚNICAMENTE JSON" — eso rompía JSON.parse()
 * directo y caía siempre al fallback de "neutral" en silencio, dejando
 * pasar mensajes hostiles sin aviso. Quita el fencing y se queda solo con
 * el primer bloque {...} del texto.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const braces = candidate.match(/\{[\s\S]*\}/);
  return braces ? braces[0] : candidate;
}
```

Reemplázalas por:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ToneAnalyzer, ToneAnalysis, ToneLevel } from "@alba/core";
import { extractJson } from "./extractJson";

const SYSTEM_PROMPT = `Eres el Tone Meter de ALBA, una app de coparentalidad. Analizas UN mensaje que un progenitor está por enviar al otro y evalúas si su tono podría escalar el conflicto.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"level": "neutral" | "tenso" | "hostil", "suggestion": string | null}

- "neutral": el mensaje es informativo o cordial. suggestion debe ser null.
- "tenso": hay indirectas, sarcasmo o acumulación de quejas. suggestion es una reformulación más calmada, misma información, sin acusaciones.
- "hostil": hay insultos, amenazas o descalificaciones. suggestion es una reformulación que preserva la intención (ej. pedir algo, poner un límite) sin el lenguaje agresivo.

Nunca inventes hechos que no estén en el mensaje original. No agregues explicaciones fuera del JSON.`;
```

El resto del archivo (la función `createAnthropicToneAnalyzer` completa) queda exactamente igual — solo cambió el import y se borró la función `extractJson` local.

- [ ] **Step 5: Confirmar que el Tone Meter sigue compilando igual**

Run: `npm run typecheck --workspace=@alba/api-client`
Expected: Sin errores nuevos relacionados a `anthropicToneAnalyzer.ts` (los errores de `setAgreementSuggestion` de la Tarea 1 siguen ahí, esperado — se arreglan en la Tarea 4).

- [ ] **Step 6: Commit**

```bash
git add packages/api-client/src/tone/extractJson.ts packages/api-client/src/tone/extractJson.test.ts packages/api-client/src/tone/anthropicToneAnalyzer.ts packages/api-client/package.json
git commit -m "refactor(tone): extract extractJson helper, shared with the agreement detector"
```

---

### Task 3: Detector heurístico y detector real (Anthropic)

**Files:**
- Create: `packages/api-client/src/tone/heuristicAgreementDetector.ts`
- Create: `packages/api-client/src/tone/anthropicAgreementDetector.ts`
- Modify: `packages/api-client/src/tone/index.ts`

- [ ] **Step 1: Escribir el detector heurístico**

Crea `packages/api-client/src/tone/heuristicAgreementDetector.ts`:

```ts
import type { AgreementDetector, AgreementDetectionResult } from "@alba/core";

const CONFIRMATION_PATTERNS = [/\bva\b/i, /\bde\s+acuerdo\b/i, /\bconfirmado\b/i, /\bperfecto\b/i, /\bsale\b/i, /\bok(?:ay)?\b/i];
const QUESTION_PATTERN = /[¿?]/;

/**
 * Heurístico simple para construir y probar el flujo sin depender de una
 * API key de Anthropic — no es el análisis real, solo imita su forma de
 * salida. Mismo criterio que heuristicToneAnalyzer.ts: reemplazar por
 * AnthropicAgreementDetector en cuanto exista la key.
 */
export function createHeuristicAgreementDetector(): AgreementDetector {
  return {
    async detect(messages): Promise<AgreementDetectionResult> {
      if (messages.length < 2) return { isAgreement: false, description: null };

      const last = messages[messages.length - 1];
      const previous = messages[messages.length - 2];

      const lastConfirms = CONFIRMATION_PATTERNS.some((p) => p.test(last.body));
      const previousProposed = QUESTION_PATTERN.test(previous.body);

      if (lastConfirms && previousProposed) {
        return {
          isAgreement: true,
          description: `${previous.senderLabel === "Tú" ? "El otro progenitor" : "Tú"} propuso algo y ${last.senderLabel} lo confirmó: "${previous.body.replace(/[¿?]/g, "").trim()}"`,
        };
      }

      return { isAgreement: false, description: null };
    },
  };
}
```

- [ ] **Step 2: Escribir el detector real de Anthropic**

Crea `packages/api-client/src/tone/anthropicAgreementDetector.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { AgreementDetector, AgreementDetectionResult } from "@alba/core";
import { extractJson } from "./extractJson";

const SYSTEM_PROMPT = `Eres el detector de acuerdos de ALBA, una app de coparentalidad. Revisas los últimos mensajes de una conversación entre dos progenitores y decides si concluyeron en un acuerdo concreto (una fecha, hora, actividad, responsabilidad, etc.) que valdría la pena registrar formalmente.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"isAgreement": boolean, "description": string | null}

- "isAgreement": true SOLO si la conversación reciente concluye en algo concreto que ambos progenitores parecen aceptar. Una pregunta sin responder, o una propuesta que sigue en discusión, NO cuenta.
- "description": una sola frase en español, en tercera persona, resumiendo el acuerdo (ej. "Acuerdan que Eugenia va al pediatra el jueves a las 5pm"). null cuando isAgreement es false.
- Nunca inventes fechas, horas o nombres que no estén explícitos en los mensajes.`;

function formatConversation(messages: { senderLabel: "Tú" | "El otro progenitor"; body: string }[]): string {
  return messages.map((m) => `${m.senderLabel}: ${m.body}`).join("\n");
}

/**
 * Implementación real — nunca se llama desde el cliente (la API key no
 * puede vivir en un binario/bundle del navegador). Se instancia server-side
 * en apps/web/src/lib/repository.ts cuando existe ANTHROPIC_API_KEY, mismo
 * criterio que createAnthropicToneAnalyzer.
 */
export function createAnthropicAgreementDetector(apiKey: string): AgreementDetector {
  const client = new Anthropic({ apiKey });

  return {
    async detect(messages): Promise<AgreementDetectionResult> {
      if (messages.length === 0) return { isAgreement: false, description: null };

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: formatConversation(messages) }],
      });

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "{}";

      let parsed: { isAgreement?: boolean; description?: string | null };
      try {
        parsed = JSON.parse(extractJson(text));
      } catch (err) {
        // Fallar hacia "no es acuerdo" en vez de romper el envío del
        // mensaje por un error de parseo — mismo criterio que
        // anthropicToneAnalyzer. Se loguea fuerte porque significa que el
        // modelo devolvió algo no parseable.
        console.error("[anthropicAgreementDetector] respuesta no parseable como JSON", { text, err });
        return { isAgreement: false, description: null };
      }

      if (parsed.isAgreement === true && typeof parsed.description === "string" && parsed.description.trim().length > 0) {
        return { isAgreement: true, description: parsed.description.trim() };
      }
      return { isAgreement: false, description: null };
    },
  };
}
```

- [ ] **Step 3: Exportar ambos desde `index.ts`**

En `packages/api-client/src/tone/index.ts`, agrega las dos líneas nuevas (el archivo queda con 4 líneas en total):

```ts
export { createHeuristicToneAnalyzer } from "./heuristicToneAnalyzer";
export { createAnthropicToneAnalyzer } from "./anthropicToneAnalyzer";
export { createHeuristicAgreementDetector } from "./heuristicAgreementDetector";
export { createAnthropicAgreementDetector } from "./anthropicAgreementDetector";
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck --workspace=@alba/api-client`
Expected: Sin errores nuevos en los archivos de `tone/` (los errores restantes de `setAgreementSuggestion` en los repos de chat siguen pendientes — Tarea 4).

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/tone/heuristicAgreementDetector.ts packages/api-client/src/tone/anthropicAgreementDetector.ts packages/api-client/src/tone/index.ts
git commit -m "feat(chat): add heuristic and Anthropic agreement detectors"
```

---

### Task 4: Migración — columnas nuevas en `chat_threads`

**Files:**
- Create: `supabase/migrations/0026_sugerencia_acuerdo_en_chat.sql`

- [ ] **Step 1: Escribir la migración**

Crea `supabase/migrations/0026_sugerencia_acuerdo_en_chat.sql`:

```sql
-- Detección automática de acuerdos en el Chat (Fase 1, W-xx) — ver spec
-- docs/superpowers/specs/2026-10-13-deteccion-acuerdos-chat-design.md.
-- Guarda la sugerencia de acuerdo más reciente detectada en el hilo (una
-- sola a la vez, nunca varias acumuladas): cada mensaje nuevo sobreescribe
-- estas dos columnas, con null si el análisis más reciente dice que no hay
-- acuerdo. No hace falta tocar RLS — chat_threads ya tiene políticas de
-- select/update para miembros de la familia (0001/0017) que cubren
-- cualquier columna de la fila, no solo las que existían al crearlas.
alter table public.chat_threads
  add column if not exists pending_agreement_suggestion text,
  add column if not exists pending_agreement_suggestion_based_on uuid references public.messages (id) on delete set null;
```

- [ ] **Step 2: No se corre nada en este paso** — esta migración se le entrega al usuario para que la pegue en el SQL Editor de Supabase manualmente, siguiendo el flujo de este proyecto (nunca se aplican migraciones directo desde el agente). El merge a `main` espera la confirmación explícita "ya corrí el SQL" antes de continuar con el resto de las tareas que dependen de estas columnas en producción — pero el desarrollo/verificación en local puede seguir de inmediato porque el código de las tareas siguientes solo necesita que la migración exista como archivo, no que ya esté aplicada en remoto.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0026_sugerencia_acuerdo_en_chat.sql
git commit -m "feat(chat): add migration for pending agreement suggestion columns"
```

---

### Task 5: Implementar `setAgreementSuggestion` en ambos repositorios de chat

**Files:**
- Modify: `packages/api-client/src/chat/mockChatRepository.ts`
- Modify: `packages/api-client/src/chat/supabaseChatRepository.ts`

- [ ] **Step 1: `mockChatRepository.ts` — agregar los dos campos al crear un hilo**

En `packages/api-client/src/chat/mockChatRepository.ts`, dentro de `createThread`, el objeto `thread` que se arma (busca `sealedMessageCount: 0,` seguido de `};`) debe quedar así — agrega las dos líneas nuevas antes del `};`:

```ts
      const thread: ChatThread = {
        id: crypto.randomUUID(),
        familyId: family.id,
        topic: input.topic,
        childId: input.childId,
        createdAt: new Date().toISOString(),
        merkleRoot: null,
        anchorReference: null,
        sealedAt: null,
        sealedMessageCount: 0,
        pendingAgreementSuggestion: null,
        pendingAgreementSuggestionBasedOn: null,
      };
```

- [ ] **Step 2: `mockChatRepository.ts` — implementar `setAgreementSuggestion`**

En el mismo archivo, agrega este método al objeto devuelto, justo después de `sealThread` (antes del `};` final que cierra el `return { ... }`):

```ts
    async setAgreementSuggestion(parentId, threadId, suggestion) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      const thread = threads.get(threadId);
      if (!thread || thread.familyId !== family.id) throw new Error("hilo no encontrado");
      thread.pendingAgreementSuggestion = suggestion?.description ?? null;
      thread.pendingAgreementSuggestionBasedOn = suggestion?.basedOnMessageId ?? null;
      return thread;
    },
```

- [ ] **Step 3: `supabaseChatRepository.ts` — mapear las dos columnas nuevas**

En `packages/api-client/src/chat/supabaseChatRepository.ts`, dentro de `function mapThread(row: any): ChatThread { ... }`, agrega las dos líneas antes del `};` de cierre:

```ts
function mapThread(row: any): ChatThread {
  return {
    id: row.id,
    familyId: row.family_id,
    topic: row.topic,
    childId: row.child_id,
    createdAt: row.created_at,
    merkleRoot: row.merkle_root ?? null,
    anchorReference: row.anchor_reference ?? null,
    sealedAt: row.sealed_at ?? null,
    sealedMessageCount: row.sealed_message_count ?? 0,
    pendingAgreementSuggestion: row.pending_agreement_suggestion ?? null,
    pendingAgreementSuggestionBasedOn: row.pending_agreement_suggestion_based_on ?? null,
  };
}
```

- [ ] **Step 4: `supabaseChatRepository.ts` — implementar `setAgreementSuggestion`**

En el mismo archivo, agrega este método al objeto devuelto en `createSupabaseChatRepository`, justo después de `sealThread` (antes del `};` que cierra el `return { ... }`, que viene justo antes del `}` que cierra la función `createSupabaseChatRepository`):

```ts
    async setAgreementSuggestion(parentId, threadId, suggestion) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");

      const { data: thread, error: threadError } = await client
        .from("chat_threads")
        .select("family_id")
        .eq("id", threadId)
        .maybeSingle();
      if (threadError) throw threadError;
      if (!thread || thread.family_id !== familyId) throw new Error("hilo no encontrado");

      const { data, error } = await client
        .from("chat_threads")
        .update({
          pending_agreement_suggestion: suggestion?.description ?? null,
          pending_agreement_suggestion_based_on: suggestion?.basedOnMessageId ?? null,
        })
        .eq("id", threadId)
        .select()
        .single();
      if (error) throw error;
      return mapThread(data);
    },
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run typecheck --workspace=@alba/api-client`
Expected: Sin errores. (Si siguen apareciendo errores sobre `setAgreementSuggentation`/campos faltantes en algún otro archivo que no sea de `chat/`, revisa que no haya otra implementación de `ChatRepository` en el repo — no debería haber ninguna más).

- [ ] **Step 6: Verificar el monorepo completo**

Run: `npm run typecheck` (desde la raíz)
Expected: Los 3 workspaces (`web`, `@alba/api-client`, `@alba/core`) compilan sin errores.

- [ ] **Step 7: Commit**

```bash
git add packages/api-client/src/chat/mockChatRepository.ts packages/api-client/src/chat/supabaseChatRepository.ts
git commit -m "feat(chat): implement setAgreementSuggestion in mock and Supabase repositories"
```

---

### Task 6: Registrar `agreementDetector` en `apps/web/src/lib/repository.ts`

**Files:**
- Modify: `apps/web/src/lib/repository.ts`

- [ ] **Step 1: Importar los dos factories nuevos**

En `apps/web/src/lib/repository.ts`, las líneas 1-30 hoy son:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createAnthropicToneAnalyzer,
  createFamilyIdResolver,
  createHeuristicToneAnalyzer,
  createMockChatRepository,
  createMockCustodyRepository,
  createMockDocumentRepository,
  createMockExpenseRepository,
  createMockPairingRepository,
  createMockPensionRepository,
  createMockVerbalAgreementRepository,
  createSupabaseChatRepository,
  createSupabaseCustodyRepository,
  createSupabaseDocumentRepository,
  createSupabaseExpenseRepository,
  createSupabasePairingRepository,
  createSupabasePensionRepository,
  createSupabaseVerbalAgreementRepository,
} from "@alba/api-client";
import type {
  ChatRepository,
  CustodyRepository,
  DocumentRepository,
  ExpenseRepository,
  PairingRepository,
  PensionRepository,
  ToneAnalyzer,
  VerbalAgreementRepository,
} from "@alba/core";
```

Reemplázalas por:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createAnthropicAgreementDetector,
  createAnthropicToneAnalyzer,
  createFamilyIdResolver,
  createHeuristicAgreementDetector,
  createHeuristicToneAnalyzer,
  createMockChatRepository,
  createMockCustodyRepository,
  createMockDocumentRepository,
  createMockExpenseRepository,
  createMockPairingRepository,
  createMockPensionRepository,
  createMockVerbalAgreementRepository,
  createSupabaseChatRepository,
  createSupabaseCustodyRepository,
  createSupabaseDocumentRepository,
  createSupabaseExpenseRepository,
  createSupabasePairingRepository,
  createSupabasePensionRepository,
  createSupabaseVerbalAgreementRepository,
} from "@alba/api-client";
import type {
  AgreementDetector,
  ChatRepository,
  CustodyRepository,
  DocumentRepository,
  ExpenseRepository,
  PairingRepository,
  PensionRepository,
  ToneAnalyzer,
  VerbalAgreementRepository,
} from "@alba/core";
```

- [ ] **Step 2: Registrar el singleton `agreementDetector`**

Busca este bloque, al final del archivo (ya existente):

```ts
const globalForTone = globalThis as unknown as { toneAnalyzer?: ToneAnalyzer };
globalForTone.toneAnalyzer ??= isAnthropicConfigured
  ? createAnthropicToneAnalyzer(process.env.ANTHROPIC_API_KEY!)
  : createHeuristicToneAnalyzer();

export const toneAnalyzer: ToneAnalyzer = globalForTone.toneAnalyzer;
```

Justo después (mismo archivo, mismo nivel), agrega:

```ts
const globalForAgreement = globalThis as unknown as { agreementDetector?: AgreementDetector };
globalForAgreement.agreementDetector ??= isAnthropicConfigured
  ? createAnthropicAgreementDetector(process.env.ANTHROPIC_API_KEY!)
  : createHeuristicAgreementDetector();

export const agreementDetector: AgreementDetector = globalForAgreement.agreementDetector;
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run typecheck --workspace=web`
Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/repository.ts
git commit -m "feat(chat): wire up agreementDetector singleton in repository.ts"
```

---

### Task 7: Orquestar la detección en `sendMessageAction` + acciones de confirmar/ignorar

**Files:**
- Modify: `apps/web/src/app/chat/[threadId]/actions.ts`

- [ ] **Step 1: Importar lo necesario**

En `apps/web/src/app/chat/[threadId]/actions.ts`, el bloque de imports actual es:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { analyzeToneInputSchema, renameThreadInputSchema, sendMessageInputSchema, type ToneAnalysis } from "@alba/core";
import { getRequestContext, toneAnalyzer, uploadChatPhoto } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";
```

Reemplázalo por:

```ts
"use server";

import { revalidatePath } from "next/cache";
import {
  analyzeToneInputSchema,
  renameThreadInputSchema,
  sendMessageInputSchema,
  verbalAgreementInputSchema,
  type ToneAnalysis,
} from "@alba/core";
import { agreementDetector, getRequestContext, toneAnalyzer, uploadChatPhoto } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 2: Correr la detección después de enviar el mensaje**

En el mismo archivo, la función `sendMessageAction` termina así hoy:

```ts
  const { chat, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.sendMessage(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo mensaje",
    body: body.slice(0, 120),
    url: `/chat/${input.threadId}`,
  });
}
```

Reemplaza ese bloque completo por:

```ts
  const { chat, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.sendMessage(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo mensaje",
    body: body.slice(0, 120),
    url: `/chat/${input.threadId}`,
  });

  // Se corre DESPUÉS de notificar (nunca bloquea el envío del mensaje ni la
  // notificación) — si falla, se loguea y el envío del mensaje sigue siendo
  // exitoso para quien escribió. Los últimos 8 mensajes alcanzan para la
  // mayoría de los intercambios tipo propuesta → confirmación.
  try {
    const recentMessages = await chat.listMessages(parentId, input.threadId);
    const lastEight = recentMessages.slice(-8);
    const detectorInput = lastEight.map((m) => ({
      senderLabel: (m.senderId === parentId ? "Tú" : "El otro progenitor") as "Tú" | "El otro progenitor",
      body: m.body,
    }));
    const result = await agreementDetector.detect(detectorInput);
    const lastMessage = lastEight[lastEight.length - 1];
    await chat.setAgreementSuggestion(
      parentId,
      input.threadId,
      result.isAgreement && result.description && lastMessage
        ? { description: result.description, basedOnMessageId: lastMessage.id }
        : null
    );
    revalidatePath(`/chat/${input.threadId}`);
  } catch (err) {
    console.error("[sendMessageAction] detección de acuerdo falló, el mensaje ya se envió igual", err);
  }
}
```

- [ ] **Step 3: Agregar las acciones de confirmar e ignorar**

Al final del archivo (después de `sealThreadAction`), agrega:

```ts
export async function confirmAgreementSuggestionAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const { chat, verbalAgreements, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));

  const threads = await chat.listThreads(parentId);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread || !thread.pendingAgreementSuggestion) return;

  const input = verbalAgreementInputSchema.parse({
    childId: thread.childId ?? "",
    description: thread.pendingAgreementSuggestion,
    agreedAt: todayLocal(),
  });
  const agreement = await verbalAgreements.createVerbalAgreement(parentId, input);
  await chat.setAgreementSuggestion(parentId, threadId, null);
  revalidatePath(`/chat/${threadId}`);
  revalidatePath("/boveda/acuerdos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo acuerdo verbal registrado",
    body: agreement.description.slice(0, 120),
    url: "/boveda/acuerdos",
  });
}

export async function dismissAgreementSuggestionAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const { chat, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.setAgreementSuggestion(parentId, threadId, null);
  revalidatePath(`/chat/${threadId}`);
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck --workspace=web`
Expected: Sin errores.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/chat/[threadId]/actions.ts"
git commit -m "feat(chat): run agreement detection after sending a message, add confirm/dismiss actions"
```

---

### Task 8: Banner en el hilo de chat

**Files:**
- Modify: `apps/web/src/app/chat/[threadId]/page.tsx`

- [ ] **Step 1: Importar las acciones nuevas**

En `apps/web/src/app/chat/[threadId]/page.tsx`, la línea de import de acciones hoy es:

```ts
import { renameThreadAction, sealThreadAction } from "./actions";
```

Reemplázala por:

```ts
import { confirmAgreementSuggestionAction, dismissAgreementSuggestionAction, renameThreadAction, sealThreadAction } from "./actions";
```

- [ ] **Step 2: Agregar el banner, antes del composer**

Busca este bloque (el banner de modo demo, justo antes de la lista de mensajes):

```tsx
      {isDemoMode && (
        <p className="mx-4 mt-3 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — escribiendo como Progenitor {as === "b" ? "B" : "A"}.
        </p>
      )}
```

Justo después de ese bloque (todavía antes del `<div className="flex flex-1 flex-col gap-2 px-4 pt-4 ...">` que envuelve los mensajes), agrega:

```tsx
      {thread?.pendingAgreementSuggestion && (
        <div className="mx-4 mt-3 rounded-xl border border-purple/30 bg-purple/10 p-4">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-purple">
            <span aria-hidden="true">✦</span> ALBA sugiere
          </p>
          <p className="mt-2 text-sm text-ink">{thread.pendingAgreementSuggestion}</p>
          <div className="mt-3 flex gap-2">
            <form action={confirmAgreementSuggestionAction} className="flex-1">
              <input type="hidden" name="as" value={as ?? ""} />
              <input type="hidden" name="threadId" value={threadId} />
              <button type="submit" className="w-full rounded-full bg-purple px-3 py-2 text-sm font-semibold text-ink">
                Registrar como acuerdo
              </button>
            </form>
            <form action={dismissAgreementSuggestionAction} className="flex-1">
              <input type="hidden" name="as" value={as ?? ""} />
              <input type="hidden" name="threadId" value={threadId} />
              <button type="submit" className="w-full rounded-full border border-purple/40 bg-card px-3 py-2 text-sm font-medium text-ink">
                Ignorar
              </button>
            </form>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run typecheck --workspace=web`
Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/chat/[threadId]/page.tsx"
git commit -m "feat(chat): show agreement suggestion banner in the thread view"
```

---

### Task 9: Build completo + verificación en vivo

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build completo**

Run: `npm run build --workspace=web`
Expected: Build exitoso, sin errores de tipos ni de compilación.

- [ ] **Step 2: Correr los tests del monorepo**

Run: `npm run test --workspace=@alba/core` y `npm run test --workspace=@alba/api-client`
Expected: Todos los tests existentes (`merkleEngine.test.ts`, `extractJson.test.ts`) siguen en PASS.

- [ ] **Step 3: Confirmar que la migración 0026 ya está corrida**

Esta tarea depende de que el usuario haya pegado el SQL de la Tarea 4 en Supabase y confirmado "ya corrí el SQL" — sin eso, `setAgreementSuggestion` va a fallar en producción/en una prueba contra Supabase real con "column does not exist". Si todavía no se confirmó, pausar acá y pedírselo antes de seguir con la verificación en vivo.

- [ ] **Step 4: Verificación en vivo (navegador, Supabase real, no mock)**

1. Iniciar sesión como dos progenitores ya emparejados (o usar modo demo local con `?as=b` si se prueba contra la base mock).
2. Abrir un hilo de chat compartido.
3. Mandar como Progenitor A: "¿el jueves a las 5 llevas a Eugenia al pediatra?"
4. Mandar como Progenitor B: "sí, va"
5. Recargar el hilo (o esperar el `revalidatePath` automático) y confirmar que aparece el banner "✦ ALBA sugiere" con un resumen razonable del acuerdo.
6. Click en "Registrar como acuerdo" → confirmar que el banner desaparece y que la fila aparece en `/boveda/acuerdos` con el `childId` correcto (heredado del hilo) y fecha de hoy.
7. Repetir el intercambio en otro hilo, pero esta vez click en "Ignorar" → confirmar que el banner desaparece y que NO se creó ninguna fila en `/boveda/acuerdos`.
8. Mandar un mensaje más que claramente NO es un acuerdo (ej. "ok gracias") después de un acuerdo ya detectado y sin resolver → confirmar que el banner se limpia solo (ya no debe mostrar la sugerencia vieja).

- [ ] **Step 5: Verificación en modo heurístico (sin `ANTHROPIC_API_KEY`)**

Arranca el server local con `ANTHROPIC_API_KEY=` vacío (fuerza `isAnthropicConfigured` a `false`, igual patrón que se usó para probar el Tone Meter heurístico): repetir el intercambio "¿el jueves a las 5...?" → "sí, va" del Step 4 y confirmar que el flujo completo (banner, Registrar, Ignorar) no truena, aunque la detección sea más tosca que con el modelo real.

- [ ] **Step 6: Reportar al usuario el SQL pendiente de la Tarea 4 (si aún no se corrió) y esperar confirmación antes de mergear `develop` → `main`**, siguiendo el flujo de este proyecto (nunca mergear a `main` con una migración sin confirmar).
