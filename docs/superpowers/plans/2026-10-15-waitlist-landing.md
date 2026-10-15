# Lista de espera en el landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an email-only waitlist signup section to the public landing page (`apps/web/src/app/page.tsx`), storing each email in a new Supabase table, without touching the existing "Crear cuenta" flow.

**Architecture:** A new Zod schema validates the email. A new, standalone Server Action (`joinWaitlistAction`) inserts directly into a new `waitlist_signups` table using a plain anon-key Supabase client (no session, no repository pattern — this form is public and anonymous). A new client component (`WaitlistForm`) renders the field/button and success/error states, following the exact same local-state pattern as `SignupForm.tsx`. The section is inserted into `page.tsx` between "Preguntas frecuentes" and the final CTA.

**Tech Stack:** Next.js 16 App Router (Server Actions), Zod, Supabase (Postgres + RLS), React Server/Client Components, Tailwind (existing utility classes only — no new design tokens).

---

### Task 1: Migration — `waitlist_signups` table

**Files:**
- Create: `supabase/migrations/0027_waitlist.sql`

- [ ] **Step 1: Write the migration**

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

No `select` policy for `anon`/`authenticated` is added on purpose — nobody can read the list from the client, only insert. The list is reviewed directly in the Supabase Table Editor.

- [ ] **Step 2: Give the user the SQL to run manually**

This repo's workflow requires the user to paste migration SQL into the Supabase dashboard themselves (SQL Editor) — never run it programmatically. Show them the exact contents of `supabase/migrations/0027_waitlist.sql` and wait for them to reply literally **"ya corrí el SQL"** before any commit in this plan that depends on the table existing is merged to `main`. Committing to `develop` can proceed without waiting (same convention as migration 0026 earlier in this project).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0027_waitlist.sql
git commit -m "Add waitlist_signups table migration"
```

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

This file lives next to `page.tsx` directly inside `apps/web/src/app/` (not inside a route folder) because it has no page of its own — same reasoning as other top-level action files in this codebase.

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

### Task 5: Wire the section into the landing page

**Files:**
- Modify: `apps/web/src/app/page.tsx:1-19` (imports), `apps/web/src/app/page.tsx:287-309` (insertion point, between FAQ and CTA final)

- [ ] **Step 1: Add the import**

In `apps/web/src/app/page.tsx`, change the top import block (lines 1-14) from:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import {
  BovedaIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  GastosIcon,
  NotesIcon,
  UsageModeIcon,
  UserIcon,
} from "@/components/icons";
import type { ComponentType } from "react";
```

to:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { WaitlistForm } from "./WaitlistForm";
import {
  BovedaIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  GastosIcon,
  NotesIcon,
  UsageModeIcon,
  UserIcon,
} from "@/components/icons";
import type { ComponentType } from "react";
```

- [ ] **Step 2: Insert the waitlist section**

Still in `apps/web/src/app/page.tsx`, find the end of the FAQ section and the start of the CTA final section (currently lines 307-311):

```tsx
          </div>
        </section>

        {/* CTA final */}
```

Replace with (new section inserted between them):

```tsx
          </div>
        </section>

        {/* Lista de espera */}
        <section className="mx-auto max-w-2xl px-6 pb-16">
          <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            ¿Todavía no estás listo/a para crear tu cuenta?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">
            Déjanos tu correo y te avisamos en cuanto tengamos cupo disponible.
          </p>
          <WaitlistForm />
        </section>

        {/* CTA final */}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck --workspace=web`
Expected: no errors.

Run: `npm run lint --workspace=web`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "Insert waitlist section into the public landing page"
```

---

### Task 6: Push to `develop` and live-verify

This task is done inline by the orchestrator (not delegated to a subagent) — it needs the interactive browser and the migration-confirmation checkpoint from Task 1, Step 2.

**Files:** none (verification only).

- [ ] **Step 1: Confirm the migration checkpoint**

Before this task starts, confirm the user has replied **"ya corrí el SQL"** for `supabase/migrations/0027_waitlist.sql` (from Task 1, Step 2). If not yet confirmed, stop and wait — live verification against real Supabase needs the table to exist.

- [ ] **Step 2: Push `develop`**

```bash
git push origin develop
```

- [ ] **Step 3: Start the real (non-demo) dev server**

Use `preview_start` with name `"web"` — the variant pointing at real Supabase credentials in `.env.local`, not the blank-env demo-mode variant. Navigate to `/` (the landing page).

- [ ] **Step 4: Live-verify — new email**

Scroll to the new waitlist section. Enter a real-domain throwaway email (not `@example.com` — Resend/Supabase may reject reserved test domains in other flows, and in general use a plausible real-looking domain) and submit.

Expected: the form is replaced by "¡Listo! Serás de los primeros en saber cuando la app esté lista." Confirm a new row exists in `waitlist_signups` (via a one-off `.mjs` script in `apps/web/.tmp-*.mjs` using the `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, deleted immediately after running, same convention as prior Supabase verifications this project) or ask the user to check the Supabase Table Editor.

- [ ] **Step 5: Live-verify — duplicate email**

Reload `/`, submit the SAME email again.

Expected: error text "Ya estás en la lista — te avisaremos." shown, form still visible (not replaced), and no second row created.

- [ ] **Step 6: Live-verify — invalid email**

Reload `/`, submit something with no `@` (e.g. "nope").

Expected: the native `<input type="email">` HTML5 validation blocks submission before the action even runs (since the field has `required` + `type="email"`). To actually exercise the server-side Zod validation path, bypass the browser's HTML5 check — e.g. submit via the browser devtools console calling the action directly, or temporarily remove `type="email"` in a throwaway edit, test, then revert. Expected server response if reached: `{ error: "Escribe un correo válido." }`, no row created.

- [ ] **Step 7: Live-verify — demo mode doesn't crash**

Stop the "web" server. Start `preview_start` with the blank-env demo-mode variant (no `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`). Navigate to `/`, submit any syntactically valid email.

Expected: success message shown ("¡Listo!..."), no crash, nothing persisted (there's no real Supabase to persist to).

- [ ] **Step 8: Restart the real dev server**

Stop the demo-mode server, restart `preview_start` with name `"web"` (real credentials) so the working environment is back to normal for any follow-up work.

- [ ] **Step 9: Merge to `main`**

Only after all of Steps 4-7 pass AND the migration-confirmation from Step 1 is satisfied:

```bash
git checkout main
git merge develop --ff-only
git push origin main
git checkout develop
```

---

## Self-Review Notes

**Spec coverage:**
- Single-field (email) form coexisting with "Crear cuenta" → Task 5 inserts a new section, doesn't touch the header/hero/CTA "Crear cuenta" links.
- New Supabase table → Task 1.
- Success copy "¡Listo! Serás de los primeros en saber cuando la app esté lista." → Task 4, exact string.
- Friendly duplicate-email handling → Task 3 (`error.code === "23505"`) + Task 4 (shown without hiding form) + Task 6 Step 5 verifies.
- Safe demo-mode behavior → Task 3 (`isSupabaseConfigured` check) + Task 6 Step 7 verifies.
- No changes to "Crear cuenta" → confirmed, Task 5's diff only touches imports + inserts a new section between FAQ and CTA.
- No confirmation email → not implemented anywhere in this plan, matches spec's explicit exclusion.
- No in-app admin screen → not implemented, matches spec's explicit exclusion.
- Email only, no phone/name → `waitlistInputSchema`/table/form all single-field.
- Bypasses the repository pattern → Task 3 uses a raw `createClient` call, no `PairingRepository`-style abstraction, matching the spec's explicit rationale.

**Placeholder scan:** none found — every step has literal code/SQL/commands.

**Type consistency:** `WaitlistInput`/`waitlistInputSchema` names match between Task 2 (definition) and Task 3 (import `{ waitlistInputSchema }` from `@alba/core`). `joinWaitlistAction` name matches between Task 3 (definition) and Task 4 (import). Return shape `{ error: string } | { success: true }` is used identically in both.
