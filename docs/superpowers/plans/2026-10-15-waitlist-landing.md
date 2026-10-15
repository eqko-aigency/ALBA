# Lista de espera en el landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new, separate page (`/lista-espera`) with an email-only waitlist signup form, storing each email in a new Supabase table. This page reuses the existing landing page's content sections but has NO "Crear cuenta" or "Iniciar sesión" links anywhere — the normal landing page (`/`) is untouched in appearance/behavior.

**Architecture:** A new Zod schema validates the email. A new, standalone Server Action (`joinWaitlistAction`) inserts directly into a new `waitlist_signups` table using a plain anon-key Supabase client (no session, no repository pattern — this form is public and anonymous). A new client component (`WaitlistForm`) renders the field/button and success/error states, following the exact same local-state pattern as `SignupForm.tsx`. The landing page's five content sections (pain points, features, how-it-works, trust, FAQ) are extracted from `apps/web/src/app/page.tsx` into shared components under `apps/web/src/components/landing/`, so both `/` and the new `/lista-espera` page render identical content without duplicating JSX. `/lista-espera` gets its own header/hero/footer (no account links) and ends with the waitlist form instead of a "Crear cuenta" CTA.

**Tech Stack:** Next.js 16 App Router (Server Actions), Zod, Supabase (Postgres + RLS), React Server/Client Components, Tailwind (existing utility classes only — no new design tokens).

> **Revision note (2026-10-15):** Tasks 1-4 below are unchanged from the original version of this plan (already executed: Task 1 is DONE as of this revision). Tasks 5-7 were rewritten — the original plan inserted the waitlist section directly into `page.tsx` alongside "Crear cuenta"; the client clarified she wants a fully separate page without those options instead.

---

### Task 1: Migration — `waitlist_signups` table — ✅ ALREADY DONE

**Files:**
- Create: `supabase/migrations/0027_waitlist.sql`

This task is already implemented and committed (commit `1d6e9c0` on `develop`, reviewed and approved). Nothing to do here. Kept in this plan only for the record:

```sql
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'waitlist_signups'
      and policyname = 'waitlist_signups: cualquiera puede apuntarse'
  ) then
    create policy "waitlist_signups: cualquiera puede apuntarse"
      on public.waitlist_signups for insert
      with check (true);
  end if;
end $$;
```

The user still needs to paste this into the Supabase SQL Editor and reply "ya corrí el SQL" before Task 7's merge to `main` — that confirmation has NOT happened yet as of this revision.

---

### Task 2: Validation schema

**Files:**
- Modify: `packages/core/src/validation/schemas.ts`

- [ ] **Step 1: Add the schema**

Append at the end of the file, after `verbalAgreementInputSchema`/`VerbalAgreementInput` (currently the last export, ending at line 201):

```ts

export const waitlistInputSchema = z.object({
  email: z.string().email(),
});
export type WaitlistInput = z.infer<typeof waitlistInputSchema>;
```

No separate export wiring is needed — `packages/core/src/index.ts` already does `export * from "./validation/schemas"`, so `waitlistInputSchema`/`WaitlistInput` become available from `@alba/core` automatically.

- [ ] **Step 2: Typecheck the package**

Run: `npm run typecheck --workspace=@alba/core`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/validation/schemas.ts
git commit -m "Add waitlistInputSchema for the landing waitlist form"
```

---

### Task 3: Server Action — `joinWaitlistAction`

**Files:**
- Create: `apps/web/src/app/waitlistActions.ts`

This file lives next to `page.tsx` directly inside `apps/web/src/app/` (not inside a route folder) because it's shared by both `/` in the future and `/lista-espera` — same reasoning as other top-level action files in this codebase.

- [ ] **Step 1: Write the Server Action**

```ts
"use server";

import { waitlistInputSchema } from "@alba/core";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/repository";

export async function joinWaitlistAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const parsed = waitlistInputSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Escribe un correo válido." };
  }

  // Sin Supabase configurado (dev local sin credenciales) no hay dónde
  // guardar — mismo criterio que uploadReceiptFile en repository.ts:
  // responde éxito sin persistir nada, para no romper el flujo de prueba.
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  // Cliente directo con el anon key, sin cookies ni sesión — a diferencia
  // de getRequestContext()/getAuthedSupabaseClient(), este formulario es
  // público y anónimo, no hay progenitor logueado al que atarlo.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await client.from("waitlist_signups").insert({ email: parsed.data.email });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya estás en la lista — te avisaremos." };
    }
    return { error: "No se pudo guardar tu correo. Intenta de nuevo." };
  }

  return { success: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: no errors. (`isSupabaseConfigured` is already exported from `apps/web/src/lib/repository.ts:36`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/waitlistActions.ts
git commit -m "Add joinWaitlistAction server action for the landing waitlist"
```

---

### Task 4: UI component — `WaitlistForm`

**Files:**
- Create: `apps/web/src/app/WaitlistForm.tsx`

Same local-state pattern as `apps/web/src/app/crear-cuenta/SignupForm.tsx`: `"use client"`, a `pending` flag, an `error` string, and a `success` flag that swaps the form out for a confirmation message once true. Unlike `SignupForm`, a repeated-email error does NOT hide the form (so the user can fix a typo) — the spec calls this out explicitly.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { joinWaitlistAction } from "./waitlistActions";

export function WaitlistForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await joinWaitlistAction(formData);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setPending(false);
  }

  if (success) {
    return (
      <div className="mt-6 rounded-2xl border border-subtle bg-card p-6 text-sm font-medium text-ink shadow-ambient">
        ¡Listo! Serás de los primeros en saber cuando la app esté lista.
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="mt-6 flex w-full flex-col gap-3 rounded-2xl border border-subtle bg-card p-6 text-left shadow-ambient sm:flex-row sm:items-start sm:gap-2"
    >
      <div className="flex-1">
        <label className="sr-only" htmlFor="waitlist-email">
          Correo
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          className="w-full rounded-xl border border-subtle bg-card px-4 py-2.5 text-base text-ink transition-colors outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-ink-faint">
          Nunca compartimos tu correo. Te escribimos solo cuando haya cupo disponible.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-ink shadow-ambient transition-all hover:bg-orange-deep active:scale-[0.98] disabled:opacity-60 sm:mt-0"
      >
        {pending ? "Enviando…" : "Unirme a la lista de espera"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace=web`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/WaitlistForm.tsx
git commit -m "Add WaitlistForm client component"
```

---

### Task 5: Extract landing content sections into shared components

**Files:**
- Create: `apps/web/src/components/landing/PainPointsSection.tsx`
- Create: `apps/web/src/components/landing/FeaturesSection.tsx`
- Create: `apps/web/src/components/landing/HowItWorksSection.tsx`
- Create: `apps/web/src/components/landing/TrustSection.tsx`
- Create: `apps/web/src/components/landing/FaqSection.tsx`
- Modify: `apps/web/src/app/page.tsx` (remove the extracted data/JSX, import and use the new components instead)

This task must NOT change how `/` looks or behaves — it's a pure refactor to make the five content sections reusable by the new `/lista-espera` page in Task 6. Each extracted file keeps its own data array (only used by that one section) instead of having a shared constants file, since nothing outside that section needs that data.

- [ ] **Step 1: Create `PainPointsSection.tsx`**

```tsx
type PainPoint = { title: string; description: string };

const PAIN_POINTS: PainPoint[] = [
  {
    title: "Los mensajes suben de tono",
    description: "Una conversación sobre horarios termina siendo otra discusión más.",
  },
  {
    title: "Nadie se acuerda quién dijo qué",
    description: "Acuerdos de palabra, capturas de pantalla perdidas, versiones distintas de la misma conversación.",
  },
  {
    title: "Los gastos compartidos generan desconfianza",
    description: "¿Quién pagó qué, cuándo, y cuánto falta? Sin un registro claro, todo se vuelve un reclamo.",
  },
  {
    title: "Si hace falta mostrar algo, no hay con qué",
    description: "Ante un mediador o un juez, perseguir pantallazos no es lo mismo que tener un registro con respaldo.",
  },
];

export function PainPointsSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-16">
      <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        ¿Te suena familiar?
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PAIN_POINTS.map((point) => (
          <div key={point.title} className="rounded-2xl border border-subtle bg-card p-5 shadow-ambient">
            <p className="text-sm font-semibold text-ink">{point.title}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{point.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `FeaturesSection.tsx`**

```tsx
import type { ComponentType } from "react";
import { BovedaIcon, ChatIcon, ClockIcon, CalendarIcon, GastosIcon, NotesIcon } from "@/components/icons";

type Feature = {
  title: string;
  description: string;
  accent: string;
  Icon: ComponentType<{ className?: string }>;
};

const FEATURES: Feature[] = [
  {
    title: "Chat con tono cuidado",
    description:
      "Antes de enviar, ALBA revisa el tono del mensaje. Si detecta tensión u hostilidad, te avisa y te sugiere una versión más neutral — tú decides si la usas.",
    accent: "bg-salmon",
    Icon: ChatIcon,
  },
  {
    title: "Mensajes con respaldo",
    description:
      "Cada mensaje queda con su propia huella digital (SHA-256). Puedes sellar una conversación completa con una raíz Merkle, para que sirva como evidencia si alguna vez la necesitas.",
    accent: "bg-orange",
    Icon: ClockIcon,
  },
  {
    title: "Calendario de custodia y visitas",
    description:
      "Configura el convenio con slots recurrentes, confirma check-in y check-out de cada visita, y define los lugares de encuentro habituales.",
    accent: "bg-sky",
    Icon: CalendarIcon,
  },
  {
    title: "Gastos y pensión alimenticia",
    description:
      "Registra y aprueba gastos compartidos con balance 50/50 siempre a la vista, además del seguimiento de la pensión mensual fija y su historial.",
    accent: "bg-dawn",
    Icon: GastosIcon,
  },
  {
    title: "Bóveda de documentos",
    description:
      "Convenios, actas y evidencia protegidos con hash SHA-256 y anclaje por Merkle Tree, para verificar que nadie los alteró después de subirlos.",
    accent: "bg-purple",
    Icon: BovedaIcon,
  },
  {
    title: "Acuerdos verbales",
    description:
      "Deja constancia de lo que acordaron por teléfono o en persona. El otro progenitor confirma que lo recuerda igual, y queda registrado.",
    accent: "bg-sea",
    Icon: NotesIcon,
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Cómo ALBA ayuda</h2>
        <p className="mt-2 text-ink-soft">
          No es solo un calendario compartido — es un espacio pensado para bajar la tensión y dejar
          constancia de lo que importa.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ Icon, ...feature }) => (
          <div key={feature.title} className="rounded-3xl border border-subtle bg-card p-6 text-left shadow-ambient">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-ink ${feature.accent}`}>
              <Icon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-base font-semibold text-ink">{feature.title}</p>
            <p className="mt-2 text-sm text-ink-soft">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `HowItWorksSection.tsx`**

```tsx
import type { ComponentType } from "react";
import { CalendarIcon, UsageModeIcon, UserIcon } from "@/components/icons";

const STEPS: { title: string; description: string; Icon: ComponentType<{ className?: string }> }[] = [
  {
    title: "Crea tu cuenta",
    description: "En minutos. Agrega a tus hijos y cuenta tu situación — no necesitas nada más para empezar.",
    Icon: UserIcon,
  },
  {
    title: "Decide cómo la vas a usar",
    description:
      "Invita al otro progenitor para coordinarse juntos, o usa ALBA tú solo/a por ahora y suma a la otra persona después.",
    Icon: UsageModeIcon,
  },
  {
    title: "Organicen todo en un solo lugar",
    description: "Chat, calendario, gastos y documentos — con evidencia lista, por si alguna vez la necesitan.",
    Icon: CalendarIcon,
  },
];

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-16">
      <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">Cómo funciona</h2>
      <div className="mt-8 flex flex-col gap-4">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex items-start gap-4 rounded-2xl border border-subtle bg-card p-5 shadow-ambient">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange text-sm font-bold text-ink">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <step.Icon className="h-4 w-4 text-ink-soft" />
                {step.title}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `TrustSection.tsx`**

```tsx
import { BovedaIcon } from "@/components/icons";

export function TrustSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-16">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-sea to-sky p-7 shadow-elevated sm:p-10">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-ink">
          <BovedaIcon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Lo que se dice, queda registrado
        </h2>
        <p className="mt-3 text-sm text-ink/80 sm:text-base">
          Cada mensaje que envías genera su propia huella digital (un hash SHA-256) y puedes sellar una
          conversación completa calculando una raíz Merkle sobre todos sus mensajes — la misma lógica que
          usan los sistemas de verificación a prueba de alteraciones, para que se note si algo cambió después
          de que se dijo.
        </p>
        <p className="mt-3 text-sm text-ink/80 sm:text-base">
          Los documentos que subes a la Bóveda funcionan igual: hash y anclaje por Merkle Tree, para que
          tengas certeza de que el convenio o el comprobante que guardaste es el mismo que subiste el primer
          día.
        </p>
        <p className="mt-3 text-xs text-ink/70">
          Esto no sustituye la asesoría de un abogado, pero te da un registro mucho más sólido que una
          captura de pantalla si alguna vez necesitas mostrar algo a un mediador o un juez.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `FaqSection.tsx`**

```tsx
const FAQ: { question: string; answer: string }[] = [
  {
    question: "¿Necesito que el otro progenitor también use ALBA?",
    answer:
      "No. Al crear tu cuenta puedes elegir usarla tú solo/a para llevar tu propio registro, e invitar al otro progenitor cuando quieras. Si ambos se suman, pueden coordinarse juntos desde el primer día.",
  },
  {
    question: "¿Esto sirve como prueba legal?",
    answer:
      "ALBA te da un registro con respaldo técnico: hash SHA-256 por mensaje y documento, y sellado con raíz Merkle para que se note si algo fue alterado después. No sustituye la asesoría de un abogado, pero te da algo mucho más sólido que una captura de pantalla.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer: "Puedes crear tu cuenta y empezar a usar ALBA hoy mismo, sin costo.",
  },
  {
    question: "¿Qué pasa si seguimos discutiendo mucho?",
    answer:
      "Para eso está el aviso de tono antes de enviar un mensaje, y el registro de acuerdos verbales cuando algo se habla fuera del chat. ALBA no resuelve el conflicto por ustedes, pero evita que escale y deja constancia de lo que se acordó.",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto max-w-2xl px-6 pb-16">
      <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        Preguntas frecuentes
      </h2>
      <div className="mt-8 flex flex-col gap-3">
        {FAQ.map((item) => (
          <details
            key={item.question}
            className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink">
              {item.question}
              <span className="flex-shrink-0 text-ink-faint" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-2 text-sm text-ink-soft">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Rewrite `apps/web/src/app/page.tsx` to use the extracted components**

Replace the ENTIRE current contents of `apps/web/src/app/page.tsx` with:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FaqSection } from "@/components/landing/FaqSection";

/** Página de ventas pública (no autenticada) — reemplaza el splash mínimo
 * anterior. Sigue siendo un Server Component puro: ningún bloque de abajo
 * necesita estado de cliente (los FAQ usan <details>, igual que el resto
 * de la app — ver "Cambiar título del hilo" en chat/[threadId]/page.tsx). */
export const metadata: Metadata = {
  title: "ALBA — Coparentalidad sin que el conflicto se interponga",
  description:
    "Chat con tono cuidado, calendario de custodia, gastos claros y documentos con respaldo — todo en un solo lugar, con evidencia lista si alguna vez la necesitas.",
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-sand">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-salmon), var(--alba-orange))" }}
      />
      <div
        className="pointer-events-none absolute -right-28 top-6 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-sky), var(--alba-sea))" }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/">
            <Wordmark className="text-3xl" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ingresar" className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft">
              Iniciar sesión
            </Link>
            <Link
              href="/crear-cuenta"
              className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:bg-orange-deep"
            >
              Crear cuenta
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-16 pt-6 text-center sm:pt-12">
          <span className="rounded-full border border-subtle bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft shadow-ambient">
            Para familias que coparentan
          </span>
          <Wordmark className="mt-6 text-7xl sm:text-8xl" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Coparentalidad sin que el conflicto se interponga
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-soft sm:text-lg">
            Chat con tono cuidado, calendario de custodia, gastos claros y documentos con respaldo — todo en un
            solo lugar, para que lo que importa sea tus hijos, no la discusión.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/ingresar"
              className="rounded-full border-2 border-subtle bg-card px-6 py-3 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/crear-cuenta"
              className="rounded-full bg-orange px-6 py-3 text-sm font-semibold text-ink shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-orange-deep"
            >
              Crear cuenta →
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Gratis para crear tu cuenta. Puedes usarla aunque el otro progenitor no se una todavía.
          </p>
        </section>

        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <FaqSection />

        {/* CTA final */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-dawn to-orange p-8 text-center shadow-elevated sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Empieza hoy</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink/80 sm:text-base">
              Crea tu cuenta gratis, agrega a tus hijos y organiza todo en un solo lugar — a tu ritmo, aunque el
              otro progenitor todavía no se una.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/crear-cuenta"
                className="rounded-full bg-card px-6 py-3 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                Crear cuenta →
              </Link>
              <Link
                href="/ingresar"
                className="rounded-full border-2 border-ink/10 px-6 py-3 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mx-auto max-w-5xl border-t border-subtle px-6 py-10 text-center">
          <Wordmark className="text-2xl" />
          <p className="mt-2 text-sm text-ink-soft">Coparentalidad sin fricción.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-ink-soft">
            <Link href="/ingresar" className="underline">
              Iniciar sesión
            </Link>
            <Link href="/crear-cuenta" className="underline">
              Crear cuenta
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-faint">© {new Date().getFullYear()} ALBA</p>
        </footer>
      </div>
    </div>
  );
}
```

This is byte-for-byte the same rendered output as before (header/hero/CTA/footer text and classes unchanged) — only the five middle sections are now function calls to the extracted components instead of inline JSX, and the `PAIN_POINTS`/`FEATURES`/`STEPS`/`FAQ`/`Feature` type alias that used to live in this file are gone (moved into the new component files).

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck --workspace=web`
Expected: no errors.

Run: `npm run lint --workspace=web`
Expected: no errors.

- [ ] **Step 8: Visually diff `/` against before the refactor**

Start the dev server (`preview_start` name `"web"`), navigate to `/`, and visually confirm the page looks identical to before: same header with "Iniciar sesión"/"Crear cuenta", same hero, same six feature cards, same FAQ accordion, same final CTA and footer with both links. This is a pure refactor — any visual difference is a bug.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/landing/PainPointsSection.tsx apps/web/src/components/landing/FeaturesSection.tsx apps/web/src/components/landing/HowItWorksSection.tsx apps/web/src/components/landing/TrustSection.tsx apps/web/src/components/landing/FaqSection.tsx apps/web/src/app/page.tsx
git commit -m "Extract landing page content sections into shared components"
```

---

### Task 6: New page — `/lista-espera`

**Files:**
- Create: `apps/web/src/app/lista-espera/page.tsx`

This page reuses the five shared sections from Task 5 and the `WaitlistForm` from Task 4, but has its OWN header, hero, and footer — none of which contain a "Crear cuenta" or "Iniciar sesión" link anywhere. The hero's CTA button is replaced with an anchor link that scrolls down to the waitlist form (`#waitlist`), and the old "CTA final" section is replaced by the waitlist section itself.

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { WaitlistForm } from "../WaitlistForm";

export const metadata: Metadata = {
  title: "ALBA — Lista de espera",
  description:
    "Apúntate para ser de los primeros en usar ALBA, la app de coparentalidad sin que el conflicto se interponga.",
};

export default function ListaEspera() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-sand">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-salmon), var(--alba-orange))" }}
      />
      <div
        className="pointer-events-none absolute -right-28 top-6 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-sky), var(--alba-sea))" }}
      />

      <div className="relative z-10">
        {/* Header — sin links de cuenta, a propósito: esta página es solo para apuntarse a la lista de espera */}
        <header className="mx-auto flex max-w-5xl items-center justify-center px-6 py-5">
          <Link href="/">
            <Wordmark className="text-3xl" />
          </Link>
        </header>

        {/* Hero — mismo mensaje que el landing normal, pero el botón lleva al formulario de abajo en vez de a Crear cuenta/Iniciar sesión */}
        <section className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-16 pt-6 text-center sm:pt-12">
          <span className="rounded-full border border-subtle bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft shadow-ambient">
            Para familias que coparentan
          </span>
          <Wordmark className="mt-6 text-7xl sm:text-8xl" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Coparentalidad sin que el conflicto se interponga
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-soft sm:text-lg">
            Chat con tono cuidado, calendario de custodia, gastos claros y documentos con respaldo — todo en un
            solo lugar, para que lo que importa sea tus hijos, no la discusión.
          </p>
          <a
            href="#waitlist"
            className="mt-8 rounded-full bg-orange px-6 py-3 text-sm font-semibold text-ink shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-orange-deep"
          >
            Únete a la lista de espera ↓
          </a>
        </section>

        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <FaqSection />

        {/* Lista de espera — reemplaza el "CTA final" del landing normal */}
        <section id="waitlist" className="mx-auto max-w-2xl px-6 pb-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Sé de los primeros en usar ALBA
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-ink-soft">
            Déjanos tu correo y te avisamos en cuanto tengamos cupo disponible.
          </p>
          <WaitlistForm />
        </section>

        {/* Footer — sin links de cuenta, a propósito */}
        <footer className="mx-auto max-w-5xl border-t border-subtle px-6 py-10 text-center">
          <Wordmark className="text-2xl" />
          <p className="mt-2 text-sm text-ink-soft">Coparentalidad sin fricción.</p>
          <p className="mt-4 text-xs text-ink-faint">© {new Date().getFullYear()} ALBA</p>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck --workspace=web`
Expected: no errors.

Run: `npm run lint --workspace=web`
Expected: no errors.

- [ ] **Step 3: Grep for account-related links, to self-verify the "no crear cuenta / no iniciar sesión" requirement**

Run: `grep -n "crear-cuenta\|ingresar" apps/web/src/app/lista-espera/page.tsx`
Expected: no output (no matches) — this file must not link to `/crear-cuenta` or `/ingresar` anywhere.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/lista-espera/page.tsx
git commit -m "Add standalone /lista-espera waitlist page"
```

---

### Task 7: Push to `develop`, live-verify, and merge

This task is done inline by the orchestrator (not delegated to a subagent) — it needs the interactive browser and the migration-confirmation checkpoint from Task 1.

**Files:** none (verification only).

- [ ] **Step 1: Confirm the migration checkpoint**

Before this task starts, confirm the user has replied **"ya corrí el SQL"** for `supabase/migrations/0027_waitlist.sql` (from Task 1). If not yet confirmed, stop and wait — live verification against real Supabase needs the table to exist.

- [ ] **Step 2: Push `develop`**

```bash
git push origin develop
```

- [ ] **Step 3: Start the real (non-demo) dev server**

Use `preview_start` with name `"web"` — the variant pointing at real Supabase credentials in `.env.local`, not the blank-env demo-mode variant.

- [ ] **Step 4: Live-verify `/` is unchanged**

Navigate to `/`. Confirm it still shows "Iniciar sesión"/"Crear cuenta" in header, hero, CTA final, and footer — same as before Task 5's refactor. No waitlist form should appear on `/`.

- [ ] **Step 5: Live-verify `/lista-espera` — new email**

Navigate to `/lista-espera`. Confirm there is NO "Crear cuenta" or "Iniciar sesión" link anywhere on the page. Click the hero's "Únete a la lista de espera ↓" link and confirm it scrolls to the waitlist form. Enter a real-domain throwaway email (not `@example.com` — reserved/refused by some providers) and submit.

Expected: the form is replaced by "¡Listo! Serás de los primeros en saber cuando la app esté lista." Confirm a new row exists in `waitlist_signups` (via a one-off `.mjs` script in `apps/web/.tmp-*.mjs` using the `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, deleted immediately after running, same convention as prior Supabase verifications this project) or ask the user to check the Supabase Table Editor.

- [ ] **Step 6: Live-verify — duplicate email**

Reload `/lista-espera`, submit the SAME email again.

Expected: error text "Ya estás en la lista — te avisaremos." shown, form still visible (not replaced), and no second row created.

- [ ] **Step 7: Live-verify — invalid email**

Reload `/lista-espera`. The native `<input type="email">` HTML5 validation blocks an obviously malformed submission before the action even runs (the field has `required` + `type="email"`). To exercise the server-side Zod validation path directly, bypass the browser's HTML5 check (e.g. call the action directly via devtools console, or temporarily remove `type="email"` in a throwaway edit, test, then revert).

Expected server response if reached: `{ error: "Escribe un correo válido." }`, no row created.

- [ ] **Step 8: Live-verify — demo mode doesn't crash**

Stop the "web" server. Start `preview_start` with the blank-env demo-mode variant (no `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`). Navigate to `/lista-espera`, submit any syntactically valid email.

Expected: success message shown ("¡Listo!..."), no crash, nothing persisted (there's no real Supabase to persist to).

- [ ] **Step 9: Restart the real dev server**

Stop the demo-mode server, restart `preview_start` with name `"web"` (real credentials) so the working environment is back to normal for any follow-up work.

- [ ] **Step 10: Merge to `main`**

Only after all of Steps 4-8 pass AND the migration-confirmation from Step 1 is satisfied:

```bash
git checkout main
git merge develop --ff-only
git push origin main
git checkout develop
```

---

## Self-Review Notes

**Spec coverage (updated spec, 2026-10-15 revision):**
- Separate page at `/lista-espera`, reusing landing content minus account links → Tasks 5 (extraction) + 6 (new page).
- `/` unchanged in appearance/behavior → Task 5 Step 8 (visual diff) + Task 7 Step 4 (live re-verify).
- No "Crear cuenta"/"Iniciar sesión" anywhere on `/lista-espera` → Task 6 Step 3 (grep self-check) + Task 7 Step 5 (live re-verify).
- Single-field (email) form → Task 4 (unchanged from original plan).
- New Supabase table → Task 1 (already done).
- Success copy "¡Listo! Serás de los primeros en saber cuando la app esté lista." → Task 4, exact string (unchanged).
- Friendly duplicate-email handling → Task 3 (`error.code === "23505"`) + Task 4 (shown without hiding form) + Task 7 Step 6 verifies.
- Safe demo-mode behavior → Task 3 (`isSupabaseConfigured` check) + Task 7 Step 8 verifies.
- No confirmation email → not implemented anywhere in this plan, matches spec's explicit exclusion.
- No in-app admin screen → not implemented, matches spec's explicit exclusion.
- Email only, no phone/name → `waitlistInputSchema`/table/form all single-field.
- Bypasses the repository pattern → Task 3 uses a raw `createClient` call, no `PairingRepository`-style abstraction, matching the spec's explicit rationale.

**Placeholder scan:** none found — every step has literal code/SQL/commands.

**Type consistency:** `WaitlistInput`/`waitlistInputSchema` names match between Task 2 (definition) and Task 3 (import `{ waitlistInputSchema }` from `@alba/core`). `joinWaitlistAction` name matches between Task 3 (definition) and Task 4 (import). Return shape `{ error: string } | { success: true }` is used identically in both. `WaitlistForm` export name matches between Task 4 (definition) and Task 6 (import `{ WaitlistForm } from "../WaitlistForm"`). Section component names (`PainPointsSection`, `FeaturesSection`, `HowItWorksSection`, `TrustSection`, `FaqSection`) match exactly between Task 5 (definitions) and both Task 5 Step 6 (`/` usage) and Task 6 Step 1 (`/lista-espera` usage).
