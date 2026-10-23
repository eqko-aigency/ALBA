# Wizard de bienvenida y emparejamiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el "entra directo al dashboard" por un wizard guiado y obligatorio (nombre → modo de uso → hijos → invitar/WhatsApp), agregar una tarjeta de recordatorio de emparejamiento en el Dashboard, e invitar por correo además del código/link que ya existe.

**Architecture:** El wizard vive bajo `/onboarding/<paso>`, un paso por sub-ruta, reutilizando (moviéndolas, no reescribiéndolas) las piezas que ya existen hoy en `/registro` (agregar hijo, invitar) y en `/onboarding` (modo de uso). Un único helper (`nextOnboardingStep`) centraliza "a qué paso falta mandar al usuario" y se llama desde `/dashboard` — cada paso, al terminar (o al saltarse con "Hacerlo después"), redirige de vuelta a `/dashboard`, que vuelve a evaluar el helper y manda al siguiente paso pendiente o muestra el Dashboard normal. "Hacerlo después" en hijos/invitar se recuerda con una cookie de sesión (no hay columna nueva para esto), así que esa sesión no vuelve a interrumpir, pero una sesión nueva sí.

**Tech Stack:** Next.js 16 App Router (Server Actions, Server Components), Supabase (Postgres + RLS), Zod, API HTTP de Resend (sin SDK nuevo, un solo `fetch`).

---

### Task 1: Migración — columnas nuevas en `profiles`

**Files:**
- Create: `supabase/migrations/0028_wizard_bienvenida.sql`

- [ ] **Step 1: Escribir la migración**

```sql
alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists onboarding_name_confirmed_at timestamptz;
```

Ambas nullable. `whatsapp_number` es un placeholder de datos para la Fase 4 (WhatsApp modo unilateral, todavía sin diseñar) — sin validación de formato en esta fase. `onboarding_name_confirmed_at` marca que el progenitor ya pasó por el paso de confirmación de nombre del wizard (el nombre en sí ya existe desde el signup).

- [ ] **Step 2: Dar la SQL al usuario y esperar confirmación**

Este proyecto requiere que el usuario pegue el SQL de cada migración en el SQL Editor de Supabase manualmente y confirme con la frase literal "ya corrí el SQL" antes de mergear a `main` el commit que depende de esta tabla. Mostrarle el contenido exacto de `supabase/migrations/0028_wizard_bienvenida.sql`. Se puede seguir commiteando a `develop` sin esperar esa confirmación.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0028_wizard_bienvenida.sql
git commit -m "Add profiles.whatsapp_number and onboarding_name_confirmed_at columns"
```

---

### Task 2: Capa de dominio — entidad, puerto, schemas

**Files:**
- Modify: `packages/core/src/domain/entities.ts:4-11` (interfaz `Parent`)
- Modify: `packages/core/src/domain/ports.ts:46-75` (interfaz `PairingRepository`)
- Modify: `packages/core/src/validation/schemas.ts` (agregar al final)

- [ ] **Step 1: Agregar los dos campos nuevos a `Parent`**

En `packages/core/src/domain/entities.ts`, reemplazar:

```ts
export interface Parent {
  id: string;
  fullName: string;
  email: string;
  usageMode: UsageMode;
  /** Último momento en que el progenitor abrió /notificaciones — null = nunca. */
  lastNotificationsSeenAt: string | null;
}
```

por:

```ts
export interface Parent {
  id: string;
  fullName: string;
  email: string;
  usageMode: UsageMode;
  /** Último momento en que el progenitor abrió /notificaciones — null = nunca. */
  lastNotificationsSeenAt: string | null;
  /** Placeholder para la Fase 4 (WhatsApp modo unilateral) — null = no lo ha dado todavía. */
  whatsappNumber: string | null;
  /** Marca que ya pasó por el paso "¿así está bien tu nombre?" del wizard — null = nunca. */
  onboardingNameConfirmedAt: string | null;
}
```

- [ ] **Step 2: Agregar los dos métodos nuevos al puerto `PairingRepository`**

En `packages/core/src/domain/ports.ts`, después de la línea `setUsageMode(parentId: string, input: SetUsageModeInput): Promise<Parent>;` (línea 65), agregar:

```ts
  /** Wizard de bienvenida — confirma/corrige el nombre y marca el paso como visto. */
  confirmOnboardingName(parentId: string, input: ConfirmOnboardingNameInput): Promise<Parent>;
  /** Wizard de bienvenida (modo unilateral) — guarda el número de WhatsApp (placeholder de la Fase 4). */
  setWhatsappNumber(parentId: string, input: SetWhatsappNumberInput): Promise<Parent>;
```

Y agregar `ConfirmOnboardingNameInput` y `SetWhatsappNumberInput` al import de tipos que ya existe en la parte de arriba del archivo (línea 21-35):

```ts
import type {
  AcceptInvitationInput,
  ConfirmOnboardingNameInput,
  CreateThreadInput,
  ExpenseInput,
  PensionPaymentInput,
  PensionSettingsInput,
  RenameThreadInput,
  SendMessageInput,
  SetUsageModeInput,
  SetWhatsappNumberInput,
  UpdateChildDetailsInput,
  UpdateChildInput,
  UpsertProfileInput,
  VerbalAgreementInput,
  VisitInput,
} from "../validation/schemas";
```

- [ ] **Step 3: Agregar los schemas nuevos**

Al final de `packages/core/src/validation/schemas.ts` (después de `verbalAgreementInputSchema`/`VerbalAgreementInput`, el último export hoy), agregar:

```ts

export const confirmOnboardingNameInputSchema = z.object({
  fullName: z.string().min(2).max(120),
});
export type ConfirmOnboardingNameInput = z.infer<typeof confirmOnboardingNameInputSchema>;

export const setWhatsappNumberInputSchema = z.object({
  whatsappNumber: z.string().min(7).max(20),
});
export type SetWhatsappNumberInput = z.infer<typeof setWhatsappNumberInputSchema>;

export const sendInvitationEmailInputSchema = z.object({
  email: z.string().email(),
});
export type SendInvitationEmailInput = z.infer<typeof sendInvitationEmailInputSchema>;
```

No hace falta tocar `packages/core/src/index.ts` — ya hace `export *` de los tres archivos modificados.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace=@alba/core`
Expected: errores en `packages/api-client` (todavía no implementa los métodos nuevos del puerto) — eso es esperado, se arregla en las Tasks 3 y 4. El paquete `@alba/core` en sí debe typechequear limpio.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/entities.ts packages/core/src/domain/ports.ts packages/core/src/validation/schemas.ts
git commit -m "Add whatsappNumber/onboardingNameConfirmedAt to Parent and the wizard's new port methods"
```

---

### Task 3: Repositorio mock — implementar los métodos nuevos

**Files:**
- Modify: `packages/api-client/src/pairing/mockPairingRepository.ts`

- [ ] **Step 1: Leer el archivo actual**

Antes de editar, leer `packages/api-client/src/pairing/mockPairingRepository.ts` completo para ver el patrón exacto que usa `setUsageMode` (mismo molde a seguir) y cómo mapea los campos de `Parent` en el objeto en memoria.

- [ ] **Step 2: Agregar `whatsappNumber`/`onboardingNameConfirmedAt` al objeto en memoria de cada progenitor**

Dondequiera que el mock inicialice un `Parent` (el objeto en memoria que representa un progenitor), agregar `whatsappNumber: null` y `onboardingNameConfirmedAt: null` a sus valores iniciales — mismo criterio que los demás campos opcionales ya inicializados en `null`.

- [ ] **Step 3: Implementar `confirmOnboardingName` y `setWhatsappNumber`**

Siguiendo el molde exacto de `setUsageMode` en el mismo archivo (buscar la función `setUsageMode(parentId, input)` ya existente y copiar su estructura), agregar:

```ts
    async confirmOnboardingName(parentId, input) {
      const parent = getOrCreateParent(parentId);
      parent.fullName = input.fullName;
      parent.onboardingNameConfirmedAt = new Date().toISOString();
      return { ...parent };
    },
    async setWhatsappNumber(parentId, input) {
      const parent = getOrCreateParent(parentId);
      parent.whatsappNumber = input.whatsappNumber;
      return { ...parent };
    },
```

(Ajustar `getOrCreateParent`/el nombre real de la función helper que el archivo ya usa para obtener/crear el registro en memoria de un progenitor — usar el mismo que usa `setUsageMode`, no inventar uno nuevo.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace=@alba/api-client`
Expected: sigue habiendo error en `supabasePairingRepository.ts` (Task 4 todavía no hecha) — esperado. Sin errores en `mockPairingRepository.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/pairing/mockPairingRepository.ts
git commit -m "Implement confirmOnboardingName/setWhatsappNumber in the mock pairing repository"
```

---

### Task 4: Repositorio Supabase — implementar los métodos nuevos

**Files:**
- Modify: `packages/api-client/src/pairing/supabasePairingRepository.ts`

- [ ] **Step 1: Leer el archivo actual**

Leer `packages/api-client/src/pairing/supabasePairingRepository.ts` completo para ver el patrón exacto de `setUsageMode` (update a `profiles` + devolver el `Parent` mapeado) y la función que mapea una fila de `profiles` a `Parent` (probablemente algo como `mapProfile`/`mapParent`).

- [ ] **Step 2: Agregar los dos campos nuevos al mapeo de fila→`Parent`**

Dondequiera que el archivo mapee una fila de `profiles` a un objeto `Parent` (los `select` ya existentes necesitan incluir las columnas nuevas `whatsapp_number`/`onboarding_name_confirmed_at` si el `select` es explícito por columna, o ya vienen solas si es `select("*")`), agregar al objeto resultante:

```ts
    whatsappNumber: row.whatsapp_number,
    onboardingNameConfirmedAt: row.onboarding_name_confirmed_at,
```

- [ ] **Step 3: Implementar `confirmOnboardingName` y `setWhatsappNumber`**

Siguiendo el molde exacto de `setUsageMode` (un `update` a `profiles` filtrado por `id` = parentId, devolviendo la fila actualizada mapeada):

```ts
    async confirmOnboardingName(parentId, input) {
      const { data, error } = await client
        .from("profiles")
        .update({ full_name: input.fullName, onboarding_name_confirmed_at: new Date().toISOString() })
        .eq("id", parentId)
        .select()
        .single();
      if (error) throw error;
      return mapProfile(data);
    },
    async setWhatsappNumber(parentId, input) {
      const { data, error } = await client
        .from("profiles")
        .update({ whatsapp_number: input.whatsappNumber })
        .eq("id", parentId)
        .select()
        .single();
      if (error) throw error;
      return mapProfile(data);
    },
```

(Usar el nombre real de la función de mapeo fila→`Parent` que el archivo ya tiene — `mapProfile` es un placeholder del nombre real, confirmarlo al leer el archivo en el Step 1.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace=@alba/api-client`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/pairing/supabasePairingRepository.ts
git commit -m "Implement confirmOnboardingName/setWhatsappNumber in the Supabase pairing repository"
```

---

### Task 5: Helper del gate + reconexión del Dashboard

**Files:**
- Create: `apps/web/src/lib/onboardingGate.ts`
- Modify: `apps/web/src/app/dashboard/page.tsx:60-93`

- [ ] **Step 1: Escribir el helper**

```ts
import { cookies } from "next/headers";
import type { Parent } from "@alba/core";

export type OnboardingStep = "nombre" | "modo" | "hijos" | "invitar" | "whatsapp";

/**
 * Único lugar que decide "a qué paso del wizard falta mandar a este
 * progenitor" — cada paso, al terminar o al saltarse con "Hacerlo después",
 * redirige de vuelta a /dashboard, que vuelve a llamar esto y manda al
 * siguiente paso pendiente (o deja pasar, si ya no falta nada).
 *
 * "Hacerlo después" en hijos/invitar se recuerda con una cookie de SESIÓN
 * (sin maxAge — el navegador la borra sola al cerrarse del todo), no con una
 * columna en la base: esos dos pasos no son permanentemente opcionales,
 * vuelven a aparecer en una sesión nueva si siguen sin resolverse. Nombre,
 * modo de uso y WhatsApp no tienen "después" — si faltan, siempre redirigen,
 * igual que ya hacía antes el chequeo de usageMode en dashboard/page.tsx.
 */
export async function nextOnboardingStep(args: {
  profile: Parent | null;
  hasChildren: boolean;
  otherParent: Parent | null;
}): Promise<OnboardingStep | null> {
  const { profile, hasChildren, otherParent } = args;

  if (!profile?.onboardingNameConfirmedAt) return "nombre";
  if (!profile.usageMode) return "modo";

  const cookieStore = await cookies();
  const skipped = (cookieStore.get("onboarding_skip")?.value ?? "").split(",");

  if (!hasChildren && !skipped.includes("hijos")) return "hijos";
  if (profile.usageMode === "bilateral" && !otherParent && !skipped.includes("invitar")) return "invitar";
  if (profile.usageMode === "unilateral" && !profile.whatsappNumber) return "whatsapp";

  return null;
}

/** Usado por el botón "Hacerlo después" de hijos/invitar — ver nextOnboardingStep. */
export async function skipOnboardingStepForSession(step: "hijos" | "invitar"): Promise<void> {
  const cookieStore = await cookies();
  const current = (cookieStore.get("onboarding_skip")?.value ?? "").split(",").filter(Boolean);
  if (!current.includes(step)) current.push(step);
  cookieStore.set("onboarding_skip", current.join(","), { path: "/" });
}
```

- [ ] **Step 2: Reconectar el Dashboard**

En `apps/web/src/app/dashboard/page.tsx`, reemplazar (líneas 60-93 actuales):

```ts
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, chat, custody, expenses, documents, verbalAgreements, pension, parentId } = await getRequestContext(as);

  // getOrCreateMyFamily y getProfile no dependen una de la otra — antes se
  // esperaban en serie (2 vueltas de red completas) antes de siquiera llegar
  // al Promise.all grande de abajo. En paralelo, el dashboard completo pasa
  // de 3 "oleadas" secuenciales de red a 2.
  const [, profile] = await Promise.all([pairing.getOrCreateMyFamily(parentId), pairing.getProfile(parentId)]);

  // Pedido explícito de la clienta: la primera vez, preguntar si la app la
  // van a usar los dos progenitores o solo uno, antes de mostrar el resto.
  // Se revisa ANTES de pedir el resto del dashboard para no gastar esas
  // queries en un usuario que de todos modos va a ser redirigido.
  if (!profile?.usageMode) {
    redirect(as === "b" ? "/onboarding?as=b" : "/onboarding");
  }
```

por:

```ts
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, chat, custody, expenses, documents, verbalAgreements, pension, parentId } = await getRequestContext(as);

  // getOrCreateMyFamily/getProfile/getMyChildren/listFamilyMembers no dependen
  // una de otra — en paralelo, y ANTES del Promise.all grande de abajo, para
  // no gastar esas queries en un usuario que de todos modos va a ser
  // redirigido al wizard. children/familyMembers quedan ya resueltos acá, así
  // que el Promise.all grande más abajo deja de pedirlos de nuevo (Step 3).
  const [, profile, children, familyMembers] = await Promise.all([
    pairing.getOrCreateMyFamily(parentId),
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);

  const otherParent = familyMembers.find((m) => m.id !== parentId) ?? null;
  const pendingStep = await nextOnboardingStep({ profile, hasChildren: children.length > 0, otherParent });
  if (pendingStep) {
    redirect(as === "b" ? `/onboarding/${pendingStep}?as=b` : `/onboarding/${pendingStep}`);
  }
```

Agregar el import al inicio del archivo (junto a los demás imports de `@/lib/...`):

```ts
import { nextOnboardingStep } from "@/lib/onboardingGate";
```

- [ ] **Step 3: Quitar el fetch duplicado de `children`/`familyMembers` del Promise.all grande**

Más abajo en el mismo archivo, encontrar el Promise.all grande que empieza así (alrededor de la línea 90 original):

```ts
  const [children, familyMembers, threads, agreement, monthEvents, balance, expenseList, documentList, agreements, pensionPayments, recentMessages] =
    await Promise.all([
      pairing.getMyChildren(parentId),
      pairing.listFamilyMembers(parentId),
      chat.listThreads(parentId),
```

Reemplazar por (quitando `children`/`familyMembers` de la destructuración y sus dos llamadas del array — ya están resueltos arriba):

```ts
  const [threads, agreement, monthEvents, balance, expenseList, documentList, agreements, pensionPayments, recentMessages] =
    await Promise.all([
      chat.listThreads(parentId),
```

El resto de ese Promise.all (`custody.getMyAgreement`, `custody.listEventsForRange`, etc.) no cambia — solo se corrieron los dos primeros elementos.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores. Si el typecheck marca `children`/`familyMembers` como no usados en algún lugar inesperado, es señal de que el Step 3 quitó una variable que SÍ se usaba después con ese nombre — en ese caso, revisar el resto del archivo y conservar las referencias (no borrar su uso en el JSX, solo su fetch duplicado).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/onboardingGate.ts apps/web/src/app/dashboard/page.tsx
git commit -m "Add the onboarding gate helper and wire it into the Dashboard"
```

---

### Task 6: Paso 1 — Nombre

**Files:**
- Create: `apps/web/src/app/onboarding/nombre/page.tsx`
- Create: `apps/web/src/app/onboarding/nombre/actions.ts`

- [ ] **Step 1: Server Action**

```ts
"use server";

import { redirect } from "next/navigation";
import { confirmOnboardingNameInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function confirmOnboardingNameAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const input = confirmOnboardingNameInputSchema.parse({ fullName: formData.get("fullName") });
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.confirmOnboardingName(parentId, input);
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
```

- [ ] **Step 2: Página**

```tsx
import { Wordmark } from "@/components/Wordmark";
import { getRequestContext } from "@/lib/repository";
import { confirmOnboardingNameAction } from "./actions";

export default async function OnboardingNombrePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const profile = await pairing.getProfile(parentId);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
        Hola — ¿así está bien tu nombre?
      </h1>
      <p className="mt-2 text-ink-soft">Lo vamos a usar para que el otro progenitor sepa quién eres.</p>

      <form action={confirmOnboardingNameAction} className="mt-8 flex w-full flex-col gap-3">
        <input type="hidden" name="as" value={as ?? ""} />
        <input
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          defaultValue={profile?.fullName ?? ""}
          className="w-full rounded-xl border border-subtle bg-card px-4 py-3 text-base text-ink"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-orange px-4 py-3 text-sm font-semibold text-ink shadow-ambient"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/nombre
git commit -m "Add onboarding step: confirm name"
```

---

### Task 7: Paso 2 — Modo de uso (mover el `/onboarding` actual)

**Files:**
- Create: `apps/web/src/app/onboarding/modo/page.tsx`
- Create: `apps/web/src/app/onboarding/modo/actions.ts`
- Modify: `apps/web/src/app/onboarding/page.tsx` (queda como redirect de compatibilidad)
- Delete: `apps/web/src/app/onboarding/actions.ts` (su contenido se mueve a `modo/actions.ts`)

- [ ] **Step 1: Crear `modo/actions.ts`**

Contenido idéntico al `apps/web/src/app/onboarding/actions.ts` actual, pero el redirect ya no decide entre `/registro`/`/dashboard` — siempre vuelve a `/dashboard`, que ahora decide el siguiente paso (Task 5):

```ts
"use server";

import { redirect } from "next/navigation";
import { setUsageModeInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function setUsageModeAction(formData: FormData) {
  const input = setUsageModeInputSchema.parse({ usageMode: formData.get("usageMode") });
  const as = String(formData.get("as") ?? "");
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.setUsageMode(parentId, input);
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
```

- [ ] **Step 2: Crear `modo/page.tsx`**

Contenido idéntico al `apps/web/src/app/onboarding/page.tsx` actual (las dos tarjetas bilateral/unilateral), solo actualizando el import de la acción:

```tsx
import { Wordmark } from "@/components/Wordmark";
import { setUsageModeAction } from "./actions";

export default async function OnboardingModoPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">¿Cómo vas a usar ALBA?</h1>
      <p className="mt-2 text-ink-soft">Esto nos ayuda a mostrarte la app como te sirve mejor.</p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <form action={setUsageModeAction}>
          <input type="hidden" name="as" value={as ?? ""} />
          <input type="hidden" name="usageMode" value="bilateral" />
          <button
            type="submit"
            className="w-full rounded-2xl border border-subtle bg-card p-5 text-left shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <p className="text-sm font-semibold text-ink">Los dos progenitores</p>
            <p className="mt-1 text-xs text-ink-soft">
              Yo y el otro progenitor vamos a coordinarnos juntos en la app.
            </p>
          </button>
        </form>

        <form action={setUsageModeAction}>
          <input type="hidden" name="as" value={as ?? ""} />
          <input type="hidden" name="usageMode" value="unilateral" />
          <button
            type="submit"
            className="w-full rounded-2xl border border-subtle bg-card p-5 text-left shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <p className="text-sm font-semibold text-ink">Solo yo, por ahora</p>
            <p className="mt-1 text-xs text-ink-soft">
              Voy a usarla yo sola/solo para llevar el registro — puedo invitar al otro progenitor después.
            </p>
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar `onboarding/page.tsx` por un redirect de compatibilidad**

```tsx
import { redirect } from "next/navigation";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  redirect(as ? `/onboarding/modo?as=${as}` : "/onboarding/modo");
}
```

- [ ] **Step 4: Borrar `onboarding/actions.ts`**

```bash
git rm apps/web/src/app/onboarding/actions.ts
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/onboarding
git commit -m "Move the usage-mode step to /onboarding/modo, /onboarding becomes a redirect"
```

---

### Task 8: Paso 3 — Hijos (mover el formulario de `/registro`)

**Files:**
- Create: `apps/web/src/app/onboarding/hijos/page.tsx`
- Create: `apps/web/src/app/onboarding/hijos/actions.ts`

- [ ] **Step 1: Server Action**

```ts
"use server";

import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/repository";
import { skipOnboardingStepForSession } from "@/lib/onboardingGate";

export async function createChildAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const fullName = String(formData.get("childFullName") ?? "").trim();
  const birthDate = String(formData.get("childBirthDate") ?? "");

  if (fullName.length < 2 || !birthDate) {
    throw new Error("Nombre y fecha de nacimiento son requeridos");
  }

  const { pairing, parentId } = await getRequestContext(as);
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.createChild(parentId, { fullName, birthDate });
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}

export async function skipChildrenStepAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  await skipOnboardingStepForSession("hijos");
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
```

Nota: a diferencia del `createChildAction` original en `registro/actions.ts` (que dejaba a la usuaria en la misma pantalla con `revalidatePath`, porque ahí se podían agregar varios hijos seguidos sin salir), acá redirige a `/dashboard` después de cada hijo agregado — el wizard avanza en cuanto hay al menos un hijo (ver `nextOnboardingStep`, Task 5). Si la usuaria quiere agregar un segundo hijo de una vez, lo hace después desde Perfil — no es parte de este paso del wizard.

- [ ] **Step 2: Página**

```tsx
import { Wordmark } from "@/components/Wordmark";
import { createChildAction, skipChildrenStepAction } from "./actions";

export default async function OnboardingHijosPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Agrega a tus hijos</h1>
      <p className="mt-2 text-ink-soft">Nombre y fecha de nacimiento — el resto se llena después, en Perfil.</p>

      <form action={createChildAction} className="mt-8 flex w-full flex-col gap-3 text-left">
        <input type="hidden" name="as" value={as ?? ""} />
        <label className="text-sm font-medium text-ink">
          Nombre completo
          <input
            name="childFullName"
            autoComplete="off"
            required
            minLength={2}
            className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
          />
        </label>
        <label className="text-sm font-medium text-ink">
          Fecha de nacimiento
          <div className="mt-1 w-full overflow-hidden rounded-md border border-subtle bg-card">
            <input
              name="childBirthDate"
              type="date"
              autoComplete="off"
              required
              className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
            />
          </div>
        </label>
        <button type="submit" className="mt-1 rounded-full bg-salmon px-4 py-3 text-sm font-semibold text-ink">
          Agregar hijo/a
        </button>
      </form>

      <form action={skipChildrenStepAction} className="mt-3">
        <input type="hidden" name="as" value={as ?? ""} />
        <button type="submit" className="text-sm font-medium text-ink-soft underline">
          Hacerlo después
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/hijos
git commit -m "Add onboarding step: children"
```

---

### Task 9: Paso 4 (bilateral) — Invitar (mover el bloque de `/registro`)

**Files:**
- Create: `apps/web/src/components/CopyInvitationLink.tsx` (movido de `apps/web/src/app/registro/CopyInvitationLink.tsx`)
- Create: `apps/web/src/app/onboarding/invitar/page.tsx`
- Create: `apps/web/src/app/onboarding/invitar/actions.ts`

- [ ] **Step 1: Mover `CopyInvitationLink` a `components/`**

```bash
git mv apps/web/src/app/registro/CopyInvitationLink.tsx apps/web/src/components/CopyInvitationLink.tsx
```

El contenido del archivo no cambia (es un componente genérico que solo recibe `url`, no depende de nada específico de `/registro`).

- [ ] **Step 2: Server Action**

```ts
"use server";

import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/repository";
import { skipOnboardingStepForSession } from "@/lib/onboardingGate";

export async function skipInviteStepAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  await skipOnboardingStepForSession("invitar");
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
```

(El envío por correo tiene su propia Server Action, agregada en la Task 10 — este archivo se amplía ahí.)

- [ ] **Step 3: Página**

```tsx
import { Wordmark } from "@/components/Wordmark";
import { getRequestContext } from "@/lib/repository";
import { CopyInvitationLink } from "@/components/CopyInvitationLink";
import { skipInviteStepAction } from "./actions";
import { sendInvitationEmailAction } from "./emailActions";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

/** Código corto legible derivado del token — estilo W-03 (ej. ALBA-9842-XN23). */
function formatInvitationCode(token: string): string {
  const compact = token.replace(/-/g, "").toUpperCase();
  return `ALBA-${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

export default async function OnboardingInvitarPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; emailError?: string; emailSent?: string }>;
}) {
  const { as, emailError, emailSent } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);

  await pairing.getOrCreateMyFamily(parentId);
  let activeInvitations = (await pairing.listPendingInvitations(parentId)).filter(
    (inv) => new Date(inv.expiresAt) > new Date()
  );
  if (activeInvitations.length === 0) {
    const created = await pairing.createInvitation(parentId);
    activeInvitations = [created];
  }
  const invitation = activeInvitations[0]!;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Invita al otro progenitor</h1>
      <p className="mt-2 text-ink-soft">Mándale este link, o su correo, para que se vincule contigo.</p>

      <div className="mt-8 w-full rounded-md bg-sea px-4 py-3 text-left">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Código de vinculación</p>
        <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-ink">
          {formatInvitationCode(invitation.token)}
        </p>
        <p className="mt-3 text-xs text-ink-faint">O comparte el enlace protegido:</p>
        <CopyInvitationLink url={`${siteUrl}/invitacion/${invitation.token}`} />
      </div>

      <form action={sendInvitationEmailAction} className="mt-6 flex w-full flex-col gap-2 text-left">
        <input type="hidden" name="as" value={as ?? ""} />
        <label className="text-sm font-medium text-ink">
          O mándaselo por correo
          <input
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="correo@ejemplo.com"
            className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
          />
        </label>
        {emailError && <p className="text-sm text-danger">{emailError}</p>}
        {emailSent && <p className="text-sm font-medium text-success">✓ Correo enviado</p>}
        <button type="submit" className="mt-1 rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-ink">
          Mandar invitación por correo
        </button>
      </form>

      <form action={skipInviteStepAction} className="mt-6">
        <input type="hidden" name="as" value={as ?? ""} />
        <button type="submit" className="text-sm font-medium text-ink-soft underline">
          Hacerlo después
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: error en el import de `./emailActions` (no existe todavía — se crea en la Task 10). Es esperado en este punto; se resuelve en la siguiente tarea. No commitear todavía esta tarea sola si el typecheck falla por esto — seguir directo a la Task 10 antes de commitear ambas juntas, o completar primero la Task 10 y volver.

- [ ] **Step 5: Commit**

Commitear junto con la Task 10 (ver el Step de commit de esa tarea) — este paso depende de `emailActions.ts`, que se crea ahí.

---

### Task 10: Invitación por correo (Resend)

**Files:**
- Create: `apps/web/src/app/onboarding/invitar/emailActions.ts`

- [ ] **Step 1: Escribir la Server Action**

```ts
"use server";

import { redirect } from "next/navigation";
import { sendInvitationEmailInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

const isResendConfigured = Boolean(process.env.RESEND_API_KEY);

/**
 * Llama directo al API HTTP de Resend (sin el SDK `resend` como dependencia
 * nueva — un solo fetch alcanza) porque el envío de correos de Supabase Auth
 * (usado para confirmar cuenta) solo manda SUS propios correos, no uno
 * personalizado a cualquier dirección. No se guarda ningún registro de "se
 * mandó este correo" — es solo una forma más de entregar el mismo
 * link/código que ya existe; el estado de la invitación (pendiente/
 * aceptada) no cambia por este canal.
 *
 * Sin RESEND_API_KEY configurada (dev local), no falla — responde como si
 * hubiera mandado, mismo criterio que isSupabaseConfigured en otras partes
 * del proyecto. Bloqueante para producción: necesita la key real.
 */
export async function sendInvitationEmailAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const parsed = sendInvitationEmailInputSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(buildRedirect(as, { emailError: "Escribe un correo válido." }));
  }

  const { pairing, parentId } = await getRequestContext(as);
  await pairing.getOrCreateMyFamily(parentId);
  const profile = await pairing.getProfile(parentId);

  let activeInvitations = (await pairing.listPendingInvitations(parentId)).filter(
    (inv) => new Date(inv.expiresAt) > new Date()
  );
  if (activeInvitations.length === 0) {
    activeInvitations = [await pairing.createInvitation(parentId)];
  }
  const invitation = activeInvitations[0]!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const invitationUrl = `${siteUrl}/invitacion/${invitation.token}`;

  if (isResendConfigured) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA <invitaciones@alba.app>",
        to: [parsed.data!.email],
        subject: `${profile?.fullName ?? "Alguien"} te invitó a coordinarse en ALBA`,
        html: `<p>${profile?.fullName ?? "Alguien"} te invitó a coparentar juntos en ALBA.</p><p><a href="${invitationUrl}">Aceptar invitación</a></p>`,
      }),
    });
    if (!response.ok) {
      redirect(buildRedirect(as, { emailError: "No se pudo mandar el correo. Intenta de nuevo o comparte el link directo." }));
    }
  }

  redirect(buildRedirect(as, { emailSent: "1" }));
}

function buildRedirect(as: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  if (as) search.set("as", as);
  return `/onboarding/invitar?${search.toString()}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores (resuelve también el error pendiente de la Task 9).

- [ ] **Step 3: Verificación en modo heurístico (sin `RESEND_API_KEY`)**

Arrancar el servidor (`preview_start` nombre `"web"`), loguearse con una cuenta de prueba en modo bilateral sin emparejar, llegar a `/onboarding/invitar`, escribir un correo y mandar. Esperado: redirige con `emailSent=1`, muestra "✓ Correo enviado" — sin tronar, aunque no haya `RESEND_API_KEY` configurada (no se manda nada de verdad, mismo criterio que otras integraciones de este proyecto en modo sin key).

- [ ] **Step 4: Commit (junto con la Task 9)**

```bash
git add apps/web/src/components/CopyInvitationLink.tsx apps/web/src/app/onboarding/invitar apps/web/src/app/registro/CopyInvitationLink.tsx
git commit -m "Add onboarding step: invite the other parent (code/link + email via Resend)"
```

---

### Task 11: Paso 4 (unilateral) — WhatsApp (placeholder)

**Files:**
- Create: `apps/web/src/app/onboarding/whatsapp/page.tsx`
- Create: `apps/web/src/app/onboarding/whatsapp/actions.ts`

- [ ] **Step 1: Server Action**

```ts
"use server";

import { redirect } from "next/navigation";
import { setWhatsappNumberInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function setWhatsappNumberAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const input = setWhatsappNumberInputSchema.parse({ whatsappNumber: formData.get("whatsappNumber") });
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.setWhatsappNumber(parentId, input);
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
```

- [ ] **Step 2: Página**

```tsx
import { Wordmark } from "@/components/Wordmark";
import { setWhatsappNumberAction } from "./actions";

export default async function OnboardingWhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Tu número de WhatsApp</h1>
      <p className="mt-2 text-ink-soft">
        Déjanos tu número — en cuanto esta función esté lista, el otro progenitor podrá escribir ahí y los
        mensajes llegarán a tu ALBA.
      </p>

      <form action={setWhatsappNumberAction} className="mt-8 flex w-full flex-col gap-3">
        <input type="hidden" name="as" value={as ?? ""} />
        <input
          name="whatsappNumber"
          type="tel"
          autoComplete="tel"
          required
          minLength={7}
          placeholder="55 1234 5678"
          className="w-full rounded-xl border border-subtle bg-card px-4 py-3 text-base text-ink"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-orange px-4 py-3 text-sm font-semibold text-ink shadow-ambient"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/whatsapp
git commit -m "Add onboarding step: WhatsApp number placeholder (unilateral mode)"
```

---

### Task 12: Tarjeta de emparejamiento pendiente en el Dashboard

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Leer el JSX actual del Dashboard**

Leer `apps/web/src/app/dashboard/page.tsx` completo (ya se tienen las líneas 1-100 de tareas anteriores) para encontrar el punto exacto, justo después del header/antes de la tarjeta "Próxima visita" (alrededor de donde empieza el `return (...)` del componente), donde insertar el banner.

- [ ] **Step 2: Insertar el banner**

Justo antes de la sección "Próxima visita — hero card" (el comentario `{/* Próxima visita — hero card */}` ya visto en este archivo), insertar:

```tsx
{!otherParent && (
  <Link
    href={`/onboarding/invitar${as ? `?as=${as}` : ""}`}
    className="mt-6 block rounded-2xl border border-subtle bg-card p-4 shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
  >
    <p className="text-sm font-semibold text-ink">
      {profile?.usageMode === "bilateral"
        ? `Invita a ${otherParent ?? "el otro progenitor"} para empezar a compartir`
        : "¿Quieres invitar al otro progenitor?"}
    </p>
    <p className="mt-1 text-xs text-ink-soft">Invitar ahora →</p>
  </Link>
)}
```

Nota: `otherParent` ya quedó resuelto en la Task 5 (`const otherParent = familyMembers.find((m) => m.id !== parentId) ?? null;`), así que esta sección solo lo reutiliza — no hace ningún fetch nuevo. El texto de arriba usa `otherParent` como boolean-check (`!otherParent`) y el literal `"el otro progenitor"` como fallback de nombre (no hay un nombre que mostrar todavía si nunca se generó invitación, ya que `otherParent` en sí sería `null` en ese caso — el fallback cubre exactamente ese caso).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "Add non-blocking pairing reminder card to the Dashboard"
```

---

### Task 13: Limpieza — `/registro` de compatibilidad, link de Perfil, borrar lo que sobra

**Files:**
- Modify: `apps/web/src/app/registro/page.tsx` (reemplazar por redirect)
- Delete: `apps/web/src/app/registro/actions.ts`
- Modify: `apps/web/src/app/perfil/page.tsx:79` (link "Vincular al otro progenitor")
- Modify: `apps/web/src/app/perfil/page.tsx:10` (import de `setUsageModeAction`)

- [ ] **Step 1: Reemplazar `/registro` por un redirect de compatibilidad**

Spec (sección 8): la ruta se mantiene por si hay links viejos compartidos, pero ya no es el punto de entrada. Reemplazar TODO el contenido de `apps/web/src/app/registro/page.tsx` por:

```tsx
import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/repository";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const familyMembers = await pairing.listFamilyMembers(parentId);
  const isPaired = familyMembers.some((m) => m.id !== parentId);

  redirect(isPaired ? "/perfil" : `/onboarding/invitar${as ? `?as=${as}` : ""}`);
}
```

- [ ] **Step 2: Borrar `registro/actions.ts`**

Su único export (`createChildAction`) ya se movió a `onboarding/hijos/actions.ts` en la Task 8.

```bash
git rm apps/web/src/app/registro/actions.ts
```

- [ ] **Step 3: Actualizar el link en Perfil**

En `apps/web/src/app/perfil/page.tsx`, cambiar (línea 79):

```tsx
href="/registro"
```

por:

```tsx
href="/onboarding/invitar"
```

Y actualizar el import de la línea 10, de:

```ts
import { setUsageModeAction } from "@/app/onboarding/actions";
```

a:

```ts
import { setUsageModeAction } from "@/app/onboarding/modo/actions";
```

(La acción `setUsageModeAction` sigue existiendo, solo cambió de archivo en la Task 7 — este import tenía que actualizarse ahí, se hace ahora para no dejarlo roto entre tareas.)

- [ ] **Step 4: Typecheck y lint**

Run: `npm run typecheck --workspace=web`
Expected: sin errores.

Run: `npm run lint --workspace=web`
Expected: mismos 10 errores/1 warning preexistentes y ajenos a este plan (`PushToggle.tsx`, `CopyInvitationLink.tsx` — este último ya se movió en la Task 9, confirmar que el error preexistente de `set-state-in-effect` lo sigue teniendo en su nueva ubicación, `components/CopyInvitationLink.tsx`, no es nuevo — `lib/push.ts`, `chat/[threadId]/page.tsx`). Ninguno en los archivos tocados por este plan.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/registro/page.tsx apps/web/src/app/perfil/page.tsx
git commit -m "Point /registro and the Perfil link to the new wizard, remove the old registro actions"
```

---

### Task 14: Verificación en vivo end-to-end y merge

Esta tarea la hace el orquestador directo (no un subagente) — necesita el navegador interactivo y el checkpoint de confirmación de la migración.

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Confirmar el checkpoint de la migración**

Confirmar que el usuario ya respondió "ya corrí el SQL" para `supabase/migrations/0028_wizard_bienvenida.sql` (Task 1). Si no, esperar antes de seguir.

- [ ] **Step 2: Push a `develop`**

```bash
git push origin develop
```

- [ ] **Step 3: Arrancar el servidor real**

`preview_start` con nombre `"web"` (con `.env.local` real, no demo).

- [ ] **Step 4: Crear una cuenta de prueba nueva y recorrer el wizard completo (modo bilateral)**

Crear un usuario de prueba real (via `auth.admin.createUser` con `SUPABASE_SERVICE_ROLE_KEY`, en un script `.mjs` temporal en `apps/web/.tmp-*.mjs`, borrado inmediatamente después de correrlo — mismo criterio que otras verificaciones de este proyecto). Loguearse y confirmar:
- Cae en `/onboarding/nombre` con el nombre del signup precargado → "Continuar".
- Cae en `/onboarding/modo` → elegir "Los dos progenitores".
- Cae en `/onboarding/hijos` → probar "Hacerlo después" (sin agregar ningún hijo).
- Cae en `/onboarding/invitar` → confirmar que el código/link aparece, mandar un correo de prueba (sin `RESEND_API_KEY`, confirmar que no truena y muestra "✓ Correo enviado") → "Hacerlo después".
- Llega al Dashboard con la tarjeta "Invita a el otro progenitor para empezar a compartir" visible.

- [ ] **Step 5: Cerrar sesión y volver a entrar — confirmar que "hijos" insiste, "invitar" no (dentro de la misma sesión de navegador) hasta cerrar el navegador**

Sin cerrar el navegador (misma pestaña/sesión de cookies), recargar `/dashboard`: confirmar que NO vuelve a mandar a `/onboarding/hijos` ni a `/onboarding/invitar` (la cookie de sesión los recuerda como saltados). Esto confirma que "Hacerlo después" efectivamente deja pasar el resto de esa sesión.

- [ ] **Step 6: Crear una segunda cuenta de prueba en modo unilateral**

Repetir el wizard eligiendo "Solo yo, por ahora" en el paso de modo — confirmar que después de hijos cae en `/onboarding/whatsapp`, pedir un número, confirmar que llega al Dashboard con la tarjeta "¿Quieres invitar al otro progenitor?" (texto distinto al bilateral).

- [ ] **Step 7: Confirmar que `/` (landing) y el resto de la app no cambiaron**

Navegar a `/` y confirmar que sigue igual (este plan no la toca). Navegar a `/registro` directamente con una de las cuentas de prueba sin emparejar — confirmar que redirige a `/onboarding/invitar`.

- [ ] **Step 8: Grep final de "/registro" en copy visible**

```bash
grep -rn "/registro" apps/web/src --include="*.tsx"
```

Expected: ningún resultado en texto JSX visible a la usuaria (comentarios de código sí pueden mencionarlo). Si aparece algo nuevo introducido por este plan, corregirlo antes de mergear.

- [ ] **Step 9: Limpiar las cuentas de prueba**

Borrar las familias que crearon las cuentas de prueba (cascada limpia family_members/children/invitations) y después las cuentas de auth — mismo patrón ya usado varias veces en este proyecto.

- [ ] **Step 10: Merge a `main`**

Solo después de que los Steps 4-8 pasen y el checkpoint de migración esté confirmado:

```bash
git checkout main
git merge develop --ff-only
git push origin main
git checkout develop
```

---

## Self-Review Notes

**Cobertura del spec:**
- Wizard de 4 pasos obligatorio → Tasks 6-11.
- Gate "una vez por sesión" para hijos/invitar vía cookie, siempre-obligatorio para nombre/modo/whatsapp → Task 5 (`nextOnboardingStep`), reconciliado con el comportamiento real ya existente en `dashboard/page.tsx` (el chequeo de `usageMode` YA redirige en cada carga, no por sesión — por eso solo hijos/invitar usan la cookie, no los cinco pasos).
- Tarjeta en Dashboard, texto distinto bilateral/unilateral → Task 12.
- Invitación por correo vía Resend, sin nuevo estado en `invitations` → Tasks 9-10.
- Columna `whatsapp_number` → Tasks 1, 2, 3, 4, 11.
- Columna `onboarding_name_confirmed_at` → Tasks 1, 2, 3, 4, 6.
- Nunca mostrar `/registro` → Task 13 (link de Perfil, `/registro` mismo se vuelve redirect) + grep de verificación en Task 14.
- Migración de `/registro` (sección 8 del spec) → Task 13.

**Fuera de alcance, encontrado durante la investigación (no se toca en este plan):** varias pantallas (`gastos/PensionSection.tsx`, `gastos/page.tsx` ×2, `calendario/page.tsx` ×2) mencionan literalmente "(en /registro)" en texto visible a la usuaria — mismo problema de "ruta técnica expuesta" que esta Fase 2 busca evitar, pero en páginas no relacionadas con el wizard. Vale la pena una tarea aparte, chica, para limpiarlas (ya no tiene sentido decir "(en /registro)" de todos modos, dado que esa ruta ahora redirige).

**Placeholder scan:** sin "TBD"/"TODO" — cada paso tiene código completo.

**Consistencia de tipos:** `confirmOnboardingNameInputSchema`/`ConfirmOnboardingNameInput`, `setWhatsappNumberInputSchema`/`SetWhatsappNumberInput`, `sendInvitationEmailInputSchema`/`SendInvitationEmailInput` se definen en la Task 2 y se usan con el mismo nombre en las Tasks 6, 11 y 10 respectivamente. `pairing.confirmOnboardingName`/`pairing.setWhatsappNumber` se definen en el puerto (Task 2), se implementan igual en mock (Task 3) y Supabase (Task 4), y se llaman con la misma firma en las Server Actions (Tasks 6, 11). `nextOnboardingStep`/`skipOnboardingStepForSession` se definen en la Task 5 y se importan con esos mismos nombres en las Tasks 8 y 9. `otherParent`/`profile`/`children` calculados en la Task 5 dentro de `dashboard/page.tsx` se reutilizan tal cual en la Task 12 sin volver a declararlos.
