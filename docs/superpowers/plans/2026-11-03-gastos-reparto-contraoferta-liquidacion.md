# Gastos: reparto configurable, contraoferta y liquidar saldo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features to `apps/web/src/app/gastos`: a configurable expense-split percentage (replacing the hardcoded 50/50), a counter-offer flow on a pending expense (propose a different reimbursement amount, accept/reject), and a settle-balance flow (mirrors Pensión's register/confirm pattern) plus a CSV export of the monthly summary.

**Architecture:** Same layered monorepo already in place — new types/validation in `packages/core`, a new pure calculation function (`computeExpenseReimbursement`) shared by the balance calculation and the CSV export, new methods on the existing `ExpenseRepository` port (mock + Supabase implementations in `packages/api-client`), new Server Actions in `apps/web/src/app/gastos/actions.ts`, a new Route Handler for the CSV export, and UI changes in `apps/web/src/app/gastos/page.tsx`. Three additive, idempotent SQL migrations, two of which add `SECURITY DEFINER` functions (same pattern as `confirm_pension_payment()`) for "only the counterpart can resolve this" transitions.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions + Route Handlers), TypeScript, Zod, Supabase/Postgres, `node --test` + `tsx` for `packages/core` unit tests.

**Spec:** `docs/superpowers/specs/2026-11-03-gastos-reparto-contraoferta-liquidacion-design.md`

**Deviations from the spec document** (see also the Self-Review section at the end):
1. **Liquidar saldo is debtor-initiated, not creditor-initiated.** The spec's prose says "si el saldo es a favor del caller... botón 'Pedir reembolso'" (creditor registers), but the brainstorming session's actual approved answer to "¿Liquidar el saldo de gastos funciona igual que la Pensión?" was **"Sí, mismo patrón que Pensión"** — and Pensión is debtor-initiated (whoever owes marks "pagué", the other confirms). The spec's own SQL (`paid_by_parent_id = auth.uid()` INSERT policy) only works mechanically if the DEBTOR is the one registering — a creditor-initiated "pedir reembolso" would need `paid_by_parent_id` to name the *other* party, which the spec's own RLS policy does not allow. This plan implements the debtor-initiated flow (identical to Pensión, and to what was actually approved); the SQL in Task 3 is otherwise unchanged from the spec.
2. **`computeExpenseReimbursement` lives in `packages/core/src/expenses/expenseEngine.ts`**, not `packages/core/src/domain/expenseBalance.ts` as the spec sketched — matching the existing `packages/core/src/pension/pensionEngine.ts` convention (a pure-function "engine" module per feature, re-exported from `packages/core/src/index.ts`).
3. **`ExpenseSplit` and `ExpenseSettlement` both gain a `familyId` field** not present in the spec's entity sketch — matching `PensionSettings`/`PensionPayment`/`VerbalAgreement`, which are the closest precedents (family-level config/ledger entities) and all expose `familyId` on the public type.
4. **The CSV export's "period selector"** the spec describes doesn't exist in the Gastos tab today (only the Pensión tab has a month switcher) — adding one is out of scope here. The export link reuses the `period` value `GastosPage` already computes (defaults to the current month) without adding a month-switcher UI to the Gastos tab's expense list.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0034_reparto_gastos.sql` | New `family_expense_splits` table + RLS + `confirm_expense_split()` |
| `supabase/migrations/0035_contraoferta_gastos.sql` | 3 new columns on `expenses` + `resolve_expense_counter()` |
| `supabase/migrations/0036_liquidar_saldo_gastos.sql` | New `family_expense_settlements` table + RLS + `confirm_expense_settlement()` |
| `packages/core/src/domain/entities.ts` | `Expense` gains 3 fields; new `ExpenseSplit`, `ExpenseSettlement` |
| `packages/core/src/domain/ports.ts` | `ExpenseRepository` gains 9 methods |
| `packages/core/src/validation/schemas.ts` | `expenseSplitInputSchema`, `expenseCounterInputSchema`, `expenseSettlementInputSchema` |
| `packages/core/src/expenses/expenseEngine.ts` | New file — `computeExpenseReimbursement()` |
| `packages/core/src/expenses/expenseEngine.test.ts` | New test file |
| `packages/core/src/validation/schemas.test.ts` | 3 new test blocks for the new schemas |
| `packages/core/src/index.ts` | Export the new engine module |
| `packages/api-client/src/expenses/mockExpenseRepository.ts` | In-memory impl of the 9 new methods + `getBalance()` rewrite |
| `packages/api-client/src/expenses/supabaseExpenseRepository.ts` | Supabase impl of the same |
| `apps/web/src/app/gastos/actions.ts` | 7 new Server Actions |
| `apps/web/src/app/gastos/page.tsx` | Reparto card, settle-balance buttons, contraoferta UI, export link |
| `apps/web/src/app/gastos/export/route.ts` | New Route Handler — CSV download |

---

### Task 1: Migration — Reparto configurable

**Files:**
- Create: `supabase/migrations/0034_reparto_gastos.sql`

**Suggested model:** haiku (single self-contained SQL file, no ambiguity)

- [ ] **Step 1: Write the migration**

```sql
-- Reparto configurable (W-xx): el balance de Gastos pasa de un 50/50 fijo
-- a un % acordado entre los dos progenitores. Mismo patrón de
-- propuesta/confirmación que Acuerdos — un progenitor propone, el otro
-- acepta o rechaza. Mientras no haya ningún acuerdo confirmado, el
-- balance sigue usando 50/50 (ver computeExpenseReimbursement en
-- packages/core/src/expenses/expenseEngine.ts).
--
-- "Rechazar" una propuesta pendiente se modela como DELETE, no como un
-- tercer valor de status — no hay nada que conservar de una propuesta
-- rechazada (a diferencia de un gasto "rejected", que sí queda en el
-- historial de gastos).
--
-- Confirmar SÍ necesita su propia función SECURITY DEFINER
-- (confirm_expense_split, al final de este archivo) — mismo criterio que
-- confirm_pension_payment() en 0016_pension.sql: no hay política de
-- UPDATE directa, así que la única forma de pasar de 'pending' a
-- 'confirmed' es por acá, acotado a que el caller NO sea quien propuso.
--
-- Idempotente de punta a punta (create table if not exists, políticas
-- guardadas con un chequeo contra pg_policies antes de crearlas,
-- create or replace function) — mismo criterio que 0029-0033.

create table if not exists public.family_expense_splits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  proposed_by_parent_id uuid not null references public.profiles (id),
  proposer_share_pct int not null check (proposer_share_pct between 1 and 99),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  confirmed_by_parent_id uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- A lo más una propuesta pendiente por familia a la vez — evita que se
-- acumulen propuestas sin resolver mientras ya hay una en curso.
-- proposeExpenseSplit() en el repositorio debe fallar explícitamente si ya
-- hay una pendiente (no tragarse el error de este índice en silencio).
create unique index if not exists family_expense_splits_one_pending
  on public.family_expense_splits (family_id)
  where status = 'pending';

alter table public.family_expense_splits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_expense_splits'
      and policyname = 'family_expense_splits: miembros de la familia leen'
  ) then
    create policy "family_expense_splits: miembros de la familia leen"
      on public.family_expense_splits for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_splits.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_expense_splits'
      and policyname = 'family_expense_splits: miembros de la familia proponen'
  ) then
    create policy "family_expense_splits: miembros de la familia proponen"
      on public.family_expense_splits for insert with check (
        proposed_by_parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_splits.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Rechazar = borrar la propuesta pendiente. Solo quien NO la propuso.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_expense_splits'
      and policyname = 'family_expense_splits: el otro progenitor rechaza'
  ) then
    create policy "family_expense_splits: el otro progenitor rechaza"
      on public.family_expense_splits for delete using (
        status = 'pending'
        and proposed_by_parent_id <> auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_splits.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Deliberadamente NO hay política de UPDATE — confirmar pasa por
  -- confirm_expense_split() (SECURITY DEFINER), ver abajo.
end $$;

create or replace function public.confirm_expense_split(p_split_id uuid)
returns public.family_expense_splits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_expense_splits;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.family_expense_splits where id = p_split_id;

  if v_row is null then
    raise exception 'propuesta no encontrada';
  end if;

  if not exists (
    select 1 from public.family_members m
    where m.family_id = v_row.family_id and m.parent_id = auth.uid()
  ) then
    raise exception 'no pertenece a esta familia';
  end if;

  if v_row.proposed_by_parent_id = auth.uid() then
    raise exception 'quien propuso el reparto no puede confirmarlo';
  end if;

  if v_row.status <> 'pending' then
    return v_row;
  end if;

  update public.family_expense_splits
  set status = 'confirmed',
      confirmed_by_parent_id = auth.uid(),
      confirmed_at = now()
  where id = p_split_id
  returning * into v_row;

  return v_row;
end;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0034_reparto_gastos.sql
git commit -m "$(cat <<'EOF'
feat(db): tabla family_expense_splits para reparto configurable de gastos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration — Contraoferta

**Files:**
- Create: `supabase/migrations/0035_contraoferta_gastos.sql`

**Suggested model:** haiku (single self-contained SQL file, no ambiguity)

- [ ] **Step 1: Write the migration**

```sql
-- Contraoferta (W-xx): "Expense.status" ya incluía 'countered' desde
-- 0010_gastos.sql, pero no había ningún campo para guardar la contraoferta
-- ni forma de resolverla. counter_amount_mxn es lo que el progenitor que
-- NO pagó ofrece CUBRIR (su reembolso) — no un monto alternativo para el
-- gasto completo.
--
-- Proponer la contraoferta (status -> 'countered' + los 3 campos nuevos)
-- ya lo permite la política de UPDATE existente ("expenses: el progenitor
-- que no pagó aprueba o rechaza", 0010_gastos.sql) — esa política no
-- restringe qué columnas se pueden cambiar, solo que el caller no sea
-- paid_by_parent_id, así que no hace falta tocarla.
--
-- Resolver la contraoferta SÍ es nuevo: esa misma política EXCLUYE a quien
-- pagó (paid_by_parent_id <> auth.uid()), y es justo quien pagó el que
-- necesita aceptar o rechazar. Necesita su propia función SECURITY
-- DEFINER, mismo criterio que confirm_pension_payment() en
-- 0016_pension.sql.

alter table public.expenses
  add column if not exists counter_amount_mxn numeric(12, 2) check (counter_amount_mxn is null or counter_amount_mxn > 0),
  add column if not exists counter_comment text,
  add column if not exists countered_by_parent_id uuid references public.profiles (id);

create or replace function public.resolve_expense_counter(p_expense_id uuid, p_accept boolean)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.expenses;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.expenses where id = p_expense_id;

  if v_row is null then
    raise exception 'gasto no encontrado';
  end if;

  if v_row.paid_by_parent_id <> auth.uid() then
    raise exception 'solo quien pagó el gasto puede resolver la contraoferta';
  end if;

  if v_row.status <> 'countered' then
    raise exception 'este gasto no tiene una contraoferta pendiente';
  end if;

  update public.expenses
  set status = case when p_accept then 'approved' else 'rejected' end
  where id = p_expense_id
  returning * into v_row;

  return v_row;
end;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0035_contraoferta_gastos.sql
git commit -m "$(cat <<'EOF'
feat(db): columnas de contraoferta en expenses + resolve_expense_counter()

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migration — Liquidar saldo

**Files:**
- Create: `supabase/migrations/0036_liquidar_saldo_gastos.sql`

**Suggested model:** haiku (single self-contained SQL file, calco directo de 0016_pension.sql)

- [ ] **Step 1: Write the migration**

```sql
-- Liquidar saldo (W-xx): mismo patrón EXACTO que pension_payments +
-- confirm_pension_payment() (0016_pension.sql), aplicado al balance de
-- Gastos — quien debe marca "ya pagué" (paid_by_parent_id = quien debe),
-- el otro (a quien le deben) confirma que lo recibió. Deliberadamente NO
-- es "quien tiene saldo a favor pide el reembolso": ese flujo necesitaría
-- que paid_by_parent_id nombrara a la OTRA persona al registrar, lo cual
-- rompería la policy de INSERT de abajo (paid_by_parent_id = auth.uid()) —
-- y además no es lo que se aprobó ("mismo patrón que Pensión: quien debe
-- marca el pago, el otro lo confirma").
--
-- Una vez CONFIRMADA una liquidación, getBalance() solo cuenta gastos
-- aprobados con created_at posterior a confirmed_at — el historial de
-- gastos viejos no se borra, solo deja de sumar al balance en vivo (ver
-- computeExpenseReimbursement/getBalance en expenseEngine.ts y
-- {mock,supabase}ExpenseRepository.ts).

create table if not exists public.family_expense_settlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  paid_by_parent_id uuid not null references public.profiles (id),
  amount_mxn numeric(12, 2) not null check (amount_mxn > 0),
  created_at timestamptz not null default now(),
  confirmed_by_parent_id uuid references public.profiles (id),
  confirmed_at timestamptz
);

alter table public.family_expense_settlements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_expense_settlements'
      and policyname = 'family_expense_settlements: miembros de la familia leen'
  ) then
    create policy "family_expense_settlements: miembros de la familia leen"
      on public.family_expense_settlements for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_settlements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_expense_settlements'
      and policyname = 'family_expense_settlements: quien debe registra el pago'
  ) then
    create policy "family_expense_settlements: quien debe registra el pago"
      on public.family_expense_settlements for insert with check (
        paid_by_parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_settlements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Deliberadamente NO hay política de UPDATE — confirmar pasa por
  -- confirm_expense_settlement() (SECURITY DEFINER), ver abajo.
end $$;

create or replace function public.confirm_expense_settlement(p_settlement_id uuid)
returns public.family_expense_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_expense_settlements;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.family_expense_settlements where id = p_settlement_id;

  if v_row is null then
    raise exception 'liquidación no encontrada';
  end if;

  if not exists (
    select 1 from public.family_members m
    where m.family_id = v_row.family_id and m.parent_id = auth.uid()
  ) then
    raise exception 'no pertenece a esta familia';
  end if;

  if v_row.paid_by_parent_id = auth.uid() then
    raise exception 'quien registró el pago no puede confirmarlo';
  end if;

  if v_row.confirmed_at is not null then
    return v_row;
  end if;

  update public.family_expense_settlements
  set confirmed_by_parent_id = auth.uid(),
      confirmed_at = now()
  where id = p_settlement_id
  returning * into v_row;

  return v_row;
end;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0036_liquidar_saldo_gastos.sql
git commit -m "$(cat <<'EOF'
feat(db): tabla family_expense_settlements para liquidar saldo de gastos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Core — entidades, esquemas de validación, `computeExpenseReimbursement` y tests

**Files:**
- Modify: `packages/core/src/domain/entities.ts:134-157` (`Expense`, new `ExpenseSplit`/`ExpenseSettlement` right after `ExpenseBalance`)
- Modify: `packages/core/src/validation/schemas.ts:4-10` (after `expenseInputSchema`)
- Modify: `packages/core/src/validation/schemas.test.ts` (append 3 new test blocks)
- Create: `packages/core/src/expenses/expenseEngine.ts`
- Create: `packages/core/src/expenses/expenseEngine.test.ts`
- Modify: `packages/core/src/index.ts`

**Suggested model:** standard (touches entity/schema/engine design together — judgment calls on shape)

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/expenses/expenseEngine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExpenseReimbursement } from "./expenseEngine";

const PARENT_A = "11111111-1111-1111-1111-111111111111";
const PARENT_B = "22222222-2222-2222-2222-222222222222";

test("computeExpenseReimbursement sin split confirmado usa 50/50", () => {
  const expense = { amountMxn: 600, paidByParentId: PARENT_A, counterAmountMxn: null };
  const reimbursement = computeExpenseReimbursement(expense, null, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 300);
});

test("computeExpenseReimbursement con split confirmado asimétrico", () => {
  // PARENT_A propuso cubrir 60% → PARENT_B (quien no pagó este gasto) cubre 40%.
  const expense = { amountMxn: 1000, paidByParentId: PARENT_A, counterAmountMxn: null };
  const split = { proposerSharePct: 60, proposedByParentId: PARENT_A };
  const reimbursement = computeExpenseReimbursement(expense, split, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 400);
});

test("computeExpenseReimbursement con split confirmado, el proponente paga el gasto", () => {
  // PARENT_B pagó este gasto, así que el reembolso lo cubre PARENT_A (el
  // proponente, 60%) — no PARENT_B.
  const expense = { amountMxn: 1000, paidByParentId: PARENT_B, counterAmountMxn: null };
  const split = { proposerSharePct: 60, proposedByParentId: PARENT_A };
  const reimbursement = computeExpenseReimbursement(expense, split, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 600);
});

test("computeExpenseReimbursement con contraoferta aceptada ignora el % del split", () => {
  const expense = { amountMxn: 600, paidByParentId: PARENT_A, counterAmountMxn: 150 };
  const split = { proposerSharePct: 70, proposedByParentId: PARENT_A };
  const reimbursement = computeExpenseReimbursement(expense, split, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 150);
});
```

```ts
// packages/core/src/validation/schemas.test.ts — agregar al final del archivo existente
test("expenseSplitInputSchema acepta un % entre 1 y 99", () => {
  const input = expenseSplitInputSchema.parse({ proposerSharePct: 60 });
  assert.equal(input.proposerSharePct, 60);
});

test("expenseSplitInputSchema rechaza 0, 100 y no-enteros", () => {
  assert.throws(() => expenseSplitInputSchema.parse({ proposerSharePct: 0 }));
  assert.throws(() => expenseSplitInputSchema.parse({ proposerSharePct: 100 }));
  assert.throws(() => expenseSplitInputSchema.parse({ proposerSharePct: 50.5 }));
});

test("expenseCounterInputSchema rechaza monto negativo/cero y comentario corto", () => {
  assert.throws(() => expenseCounterInputSchema.parse({ counterAmountMxn: 0, counterComment: "No puedo" }));
  assert.throws(() => expenseCounterInputSchema.parse({ counterAmountMxn: 100, counterComment: "a" }));
});

test("expenseCounterInputSchema acepta un monto y comentario válidos", () => {
  const input = expenseCounterInputSchema.parse({ counterAmountMxn: 200, counterComment: "Solo puedo cubrir esto" });
  assert.equal(input.counterAmountMxn, 200);
});

test("expenseSettlementInputSchema rechaza monto negativo/cero", () => {
  assert.throws(() => expenseSettlementInputSchema.parse({ amountMxn: 0 }));
  assert.throws(() => expenseSettlementInputSchema.parse({ amountMxn: -50 }));
});
```

Also add the import at the top of `schemas.test.ts`:

```ts
import {
  expenseCounterInputSchema,
  expenseSettlementInputSchema,
  expenseSplitInputSchema,
  importantDateInputSchema,
  meetingPlaceInputSchema,
  updateChildDetailsInputSchema,
  upsertProfileInputSchema,
} from "./schemas";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=packages/core`
Expected: FAIL — `expenseEngine.ts` doesn't exist yet, `expenseSplitInputSchema`/`expenseCounterInputSchema`/`expenseSettlementInputSchema` don't exist yet (import/TypeScript errors).

- [ ] **Step 3: Extend the `Expense` entity and add `ExpenseSplit`/`ExpenseSettlement`**

In `packages/core/src/domain/entities.ts`, replace the `Expense` interface (lines 134-143):

```ts
export interface Expense {
  id: string;
  childId: string;
  paidByParentId: string;
  amountMxn: number;
  description: string;
  receiptUrl: string | null;
  status: "pending_approval" | "approved" | "rejected" | "countered";
  createdAt: string;
  /** Monto que el progenitor que NO pagó ofrece cubrir (su reembolso, no el total del gasto) — null si nunca se contraofertó. */
  counterAmountMxn: number | null;
  counterComment: string | null;
  counteredByParentId: string | null;
}
```

Right after the existing `ExpenseBalance` interface (after line 157), add:

```ts
/**
 * Reparto configurable de Gastos (W-xx) — reemplaza el 50/50 fijo.
 * proposerSharePct es el % que cubre proposedByParentId; el otro
 * progenitor cubre 100 - eso. Mismo patrón de propuesta/confirmación que
 * Acuerdos: una propuesta "pending" todavía no afecta el balance, solo
 * una "confirmed" sí (ver computeExpenseReimbursement en expenseEngine.ts).
 */
export interface ExpenseSplit {
  id: string;
  familyId: string;
  proposedByParentId: string;
  proposerSharePct: number;
  status: "pending" | "confirmed";
  confirmedByParentId: string | null;
  createdAt: string;
}

/**
 * Liquidar saldo de Gastos (W-xx) — mismo patrón que PensionPayment: quien
 * debe registra "ya pagué" (paidByParentId), el otro confirma que lo
 * recibió. Una vez confirmada, getBalance() deja de contar gastos
 * aprobados de antes de confirmedAt (ver 0036_liquidar_saldo_gastos.sql).
 */
export interface ExpenseSettlement {
  id: string;
  familyId: string;
  paidByParentId: string;
  amountMxn: number;
  createdAt: string;
  confirmedByParentId: string | null;
  confirmedAt: string | null;
}
```

- [ ] **Step 4: Add the new validation schemas**

In `packages/core/src/validation/schemas.ts`, right after `expenseInputSchema` (after line 10):

```ts
export const expenseSplitInputSchema = z.object({
  proposerSharePct: z.number().int().min(1).max(99),
});
export type ExpenseSplitInput = z.infer<typeof expenseSplitInputSchema>;

export const expenseCounterInputSchema = z.object({
  counterAmountMxn: z.number().positive(),
  counterComment: z.string().min(3).max(280),
});
export type ExpenseCounterInput = z.infer<typeof expenseCounterInputSchema>;

export const expenseSettlementInputSchema = z.object({
  amountMxn: z.number().positive(),
});
export type ExpenseSettlementInput = z.infer<typeof expenseSettlementInputSchema>;
```

- [ ] **Step 5: Write `computeExpenseReimbursement`**

```ts
// packages/core/src/expenses/expenseEngine.ts
import type { Expense } from "../domain/entities";

/**
 * Cuánto le corresponde cubrir (reembolsar) a quien NO pagó un gasto —
 * usada tanto por getBalance() como por el export CSV, para que el
 * balance en pantalla y lo exportado nunca queden desalineados.
 *
 * Si el gasto tiene una contraoferta aceptada (counterAmountMxn no nulo),
 * ese monto manda directo, sin importar el % del reparto. Si no, se
 * calcula con el % confirmado (o 50/50 si nunca se confirmó ninguno).
 *
 * parentIds identifica a los dos miembros de la familia, en cualquier
 * orden — no asume cuál es "el caller".
 */
export function computeExpenseReimbursement(
  expense: Pick<Expense, "amountMxn" | "paidByParentId" | "counterAmountMxn">,
  split: { proposerSharePct: number; proposedByParentId: string } | null,
  parentIds: { a: string; b: string }
): number {
  if (expense.counterAmountMxn !== null) return expense.counterAmountMxn;

  const nonPayerId = expense.paidByParentId === parentIds.a ? parentIds.b : parentIds.a;
  const proposerPct = split?.proposerSharePct ?? 50;
  // Sin split confirmado, el 50/50 es simétrico — da igual a quién se
  // trate como "proponente" acá, nunca se usa ese valor en el cálculo.
  const proposerId = split?.proposedByParentId ?? nonPayerId;
  const nonPayerPct = nonPayerId === proposerId ? proposerPct : 100 - proposerPct;

  return expense.amountMxn * (nonPayerPct / 100);
}
```

- [ ] **Step 6: Export the new entity/schema/engine from the package index**

In `packages/core/src/index.ts`, add a new line after `export * from "./pension/pensionEngine";`:

```ts
export * from "./expenses/expenseEngine";
```

`ExpenseSplit`/`ExpenseSettlement`/`ExpenseSplitInput`/`ExpenseCounterInput`/`ExpenseSettlementInput` are already covered by the existing `export * from "./domain/entities"` and `export * from "./validation/schemas"` wildcard exports — no change needed for those.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test --workspace=packages/core`
Expected: PASS — all new tests plus every pre-existing test in `packages/core`.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck --workspace=packages/core`
Expected: no errors in `packages/core` itself. (Running the ROOT `npm run typecheck` at this point will show errors in `packages/api-client` and `apps/web` — expected, fixed in Tasks 6-9. Don't run the root typecheck yet.)

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/domain/entities.ts packages/core/src/validation/schemas.ts packages/core/src/validation/schemas.test.ts packages/core/src/expenses/expenseEngine.ts packages/core/src/expenses/expenseEngine.test.ts packages/core/src/index.ts
git commit -m "$(cat <<'EOF'
feat(core): ExpenseSplit, ExpenseSettlement, contraoferta y computeExpenseReimbursement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Core — puerto `ExpenseRepository`

**Files:**
- Modify: `packages/core/src/domain/ports.ts:1-40` (imports), `:220-230` (`ExpenseRepository`)

**Suggested model:** haiku (mechanical interface extension, no design judgment — Task 4 already made every decision)

- [ ] **Step 1: Add the new types to the import blocks**

In `packages/core/src/domain/ports.ts`, add `ExpenseSettlement` and `ExpenseSplit` to the `entities` import (alphabetical, matching the existing style):

```ts
import type {
  Child,
  ChatThread,
  CustodyAgreement,
  CustodyEvent,
  CustodySlot,
  Document,
  Expense,
  ExpenseBalance,
  ExpenseSettlement,
  ExpenseSplit,
  Family,
  ImportantDate,
  Invitation,
  MeetingPlace,
  Message,
  Parent,
  PensionPayment,
  PensionSettings,
  ToneAnalysis,
  VerbalAgreement,
  Visit,
} from "./entities";
```

Add `ExpenseCounterInput`/`ExpenseSettlementInput`/`ExpenseSplitInput` to the `../validation/schemas` import (alphabetical):

```ts
import type {
  AcceptInvitationInput,
  ConfirmOnboardingNameInput,
  CreateThreadInput,
  ExpenseCounterInput,
  ExpenseInput,
  ExpenseSettlementInput,
  ExpenseSplitInput,
  ImportantDateInput,
  MeetingPlaceInput,
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

- [ ] **Step 2: Extend `ExpenseRepository`**

Replace the `ExpenseRepository` interface (lines 220-230) with:

```ts
export interface ExpenseRepository {
  listExpenses(parentId: string): Promise<Expense[]>;
  createExpense(parentId: string, input: ExpenseInput): Promise<Expense>;
  updateExpenseStatus(
    parentId: string,
    expenseId: string,
    status: "approved" | "rejected"
  ): Promise<Expense>;
  /**
   * Balance considerando el reparto confirmado (o 50/50 por defecto), las
   * contraofertas aceptadas, y neto de la última liquidación confirmada
   * (ver computeExpenseReimbursement en packages/core/src/expenses/expenseEngine.ts).
   */
  getBalance(parentId: string): Promise<ExpenseBalance>;

  /**
   * Reparto configurable (W-xx). La propuesta pendiente más reciente si
   * hay una; si no, el acuerdo confirmado más reciente; si no hay
   * ninguno, null (= 50/50 por defecto).
   */
  getExpenseSplit(parentId: string): Promise<ExpenseSplit | null>;
  /** Falla si ya hay una propuesta pendiente para esta familia. */
  proposeExpenseSplit(parentId: string, proposerSharePct: number): Promise<ExpenseSplit>;
  confirmExpenseSplit(parentId: string, splitId: string): Promise<ExpenseSplit>;
  /** Solo el que NO propuso puede rechazar una propuesta pendiente — borra la fila. */
  rejectExpenseSplit(parentId: string, splitId: string): Promise<void>;

  /**
   * Contraoferta (W-xx). Solo quien NO pagó puede proponerla, y solo si el
   * gasto está "pending_approval".
   */
  proposeExpenseCounter(parentId: string, expenseId: string, input: ExpenseCounterInput): Promise<Expense>;
  /**
   * Solo quien SÍ pagó puede resolverla, y solo si el gasto está
   * "countered". accept=true → "approved" (el balance usa counterAmountMxn);
   * accept=false → "rejected" (no cuenta para el balance).
   */
  resolveExpenseCounter(parentId: string, expenseId: string, accept: boolean): Promise<Expense>;

  /**
   * Liquidar saldo (W-xx). La más reciente — confirmada o no. null si
   * nunca se liquidó nada.
   */
  getLatestExpenseSettlement(parentId: string): Promise<ExpenseSettlement | null>;
  /** Solo quien debe (según getBalance) registra su propio pago — mismo criterio que registerPayment de Pensión. */
  registerExpenseSettlement(parentId: string, input: ExpenseSettlementInput): Promise<ExpenseSettlement>;
  /** Solo el otro progenitor (a quien le deben) confirma. */
  confirmExpenseSettlement(parentId: string, settlementId: string): Promise<ExpenseSettlement>;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=packages/core`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/domain/ports.ts
git commit -m "$(cat <<'EOF'
feat(core): extender ExpenseRepository con reparto, contraoferta y liquidación

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `packages/api-client` — mock repository

**Files:**
- Modify: `packages/api-client/src/expenses/mockExpenseRepository.ts` (full rewrite of the file body)

**Suggested model:** standard (getBalance rewrite needs care to exactly preserve the old-formula-equivalence; mechanical elsewhere)

- [ ] **Step 1: Replace the file**

```ts
// packages/api-client/src/expenses/mockExpenseRepository.ts
import {
  computeExpenseReimbursement,
  type Expense,
  type ExpenseCounterInput,
  type ExpenseRepository,
  type ExpenseSettlement,
  type ExpenseSettlementInput,
  type ExpenseSplit,
  type PairingRepository,
} from "@alba/core";

/**
 * Implementación en memoria de Gastos — mismo patrón que
 * mockCustodyRepository: depende de PairingRepository para resolver a qué
 * familia/hijos pertenece cada progenitor, así todos los repos mock
 * comparten la misma noción de "familia" sin duplicar ese estado.
 */
export function createMockExpenseRepository(pairingRepository: PairingRepository): ExpenseRepository {
  const expenses = new Map<string, Expense>();
  const splits = new Map<string, ExpenseSplit>();
  const settlements = new Map<string, ExpenseSettlement>();

  async function getFamilyChildIds(parentId: string): Promise<Set<string>> {
    const children = await pairingRepository.getMyChildren(parentId);
    return new Set(children.map((c) => c.id));
  }

  async function getFamilyId(parentId: string): Promise<string> {
    const family = await pairingRepository.getOrCreateMyFamily(parentId);
    return family.id;
  }

  return {
    async listExpenses(parentId) {
      const childIds = await getFamilyChildIds(parentId);
      return [...expenses.values()]
        .filter((e) => childIds.has(e.childId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async createExpense(parentId, input) {
      const expense: Expense = {
        id: crypto.randomUUID(),
        childId: input.childId,
        paidByParentId: parentId,
        amountMxn: input.amountMxn,
        description: input.description,
        receiptUrl: input.receiptUrl,
        status: "pending_approval",
        createdAt: new Date().toISOString(),
        counterAmountMxn: null,
        counterComment: null,
        counteredByParentId: null,
      };
      expenses.set(expense.id, expense);
      return expense;
    },

    async updateExpenseStatus(parentId, expenseId, status) {
      const expense = expenses.get(expenseId);
      if (!expense) throw new Error("gasto no encontrado");
      // Defensa en profundidad — misma regla que la política de UPDATE de
      // 0010_gastos.sql: el pagador no puede aprobar ni rechazar su propio
      // gasto.
      if (expense.paidByParentId === parentId) {
        throw new Error("no puedes aprobar o rechazar tu propio gasto");
      }
      expense.status = status;
      return expense;
    },

    async getBalance(parentId) {
      const childIds = await getFamilyChildIds(parentId);
      const familyMembers = await pairingRepository.listFamilyMembers(parentId);
      const otherParent = familyMembers.find((m) => m.id !== parentId) ?? null;
      if (!otherParent) return { otherParentId: null, amountMxnOwedByCaller: 0 };

      const familyId = await getFamilyId(parentId);

      const latestConfirmedSettlement = [...settlements.values()]
        .filter((s) => s.familyId === familyId && s.confirmedAt)
        .sort((a, b) => new Date(b.confirmedAt!).getTime() - new Date(a.confirmedAt!).getTime())[0];
      const cutoff = latestConfirmedSettlement?.confirmedAt ?? null;

      const confirmedSplitRow = [...splits.values()]
        .filter((s) => s.familyId === familyId && s.status === "confirmed")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const confirmedSplit = confirmedSplitRow
        ? { proposerSharePct: confirmedSplitRow.proposerSharePct, proposedByParentId: confirmedSplitRow.proposedByParentId }
        : null;

      const approved = [...expenses.values()].filter(
        (e) => childIds.has(e.childId) && e.status === "approved" && (!cutoff || e.createdAt > cutoff)
      );

      let amountMxnOwedByCaller = 0;
      for (const e of approved) {
        const reimbursement = computeExpenseReimbursement(e, confirmedSplit, { a: parentId, b: otherParent.id });
        if (e.paidByParentId === otherParent.id) amountMxnOwedByCaller += reimbursement;
        else amountMxnOwedByCaller -= reimbursement;
      }

      return { otherParentId: otherParent.id, amountMxnOwedByCaller };
    },

    async getExpenseSplit(parentId) {
      const familyId = await getFamilyId(parentId);
      const mine = [...splits.values()].filter((s) => s.familyId === familyId);
      const pending = mine.find((s) => s.status === "pending");
      if (pending) return pending;
      const confirmed = mine
        .filter((s) => s.status === "confirmed")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      return confirmed ?? null;
    },

    async proposeExpenseSplit(parentId, proposerSharePct) {
      const familyId = await getFamilyId(parentId);
      const alreadyPending = [...splits.values()].some((s) => s.familyId === familyId && s.status === "pending");
      if (alreadyPending) throw new Error("ya hay una propuesta de reparto pendiente");

      const split: ExpenseSplit = {
        id: crypto.randomUUID(),
        familyId,
        proposedByParentId: parentId,
        proposerSharePct,
        status: "pending",
        confirmedByParentId: null,
        createdAt: new Date().toISOString(),
      };
      splits.set(split.id, split);
      return split;
    },

    async confirmExpenseSplit(parentId, splitId) {
      const split = splits.get(splitId);
      if (!split) throw new Error("propuesta no encontrada");
      if (split.proposedByParentId === parentId) {
        throw new Error("quien propuso el reparto no puede confirmarlo");
      }
      if (split.status === "pending") {
        split.status = "confirmed";
        split.confirmedByParentId = parentId;
      }
      return split;
    },

    async rejectExpenseSplit(parentId, splitId) {
      const split = splits.get(splitId);
      if (!split) return;
      if (split.proposedByParentId === parentId) {
        throw new Error("quien propuso el reparto no puede rechazarlo");
      }
      if (split.status === "pending") splits.delete(splitId);
    },

    async proposeExpenseCounter(parentId, expenseId, input: ExpenseCounterInput) {
      const expense = expenses.get(expenseId);
      if (!expense) throw new Error("gasto no encontrado");
      if (expense.paidByParentId === parentId) {
        throw new Error("no puedes contraofertar tu propio gasto");
      }
      if (expense.status !== "pending_approval") {
        throw new Error("este gasto ya no está pendiente de aprobación");
      }
      expense.status = "countered";
      expense.counterAmountMxn = input.counterAmountMxn;
      expense.counterComment = input.counterComment;
      expense.counteredByParentId = parentId;
      return expense;
    },

    async resolveExpenseCounter(parentId, expenseId, accept) {
      const expense = expenses.get(expenseId);
      if (!expense) throw new Error("gasto no encontrado");
      if (expense.paidByParentId !== parentId) {
        throw new Error("solo quien pagó el gasto puede resolver la contraoferta");
      }
      if (expense.status !== "countered") {
        throw new Error("este gasto no tiene una contraoferta pendiente");
      }
      expense.status = accept ? "approved" : "rejected";
      return expense;
    },

    async getLatestExpenseSettlement(parentId) {
      const familyId = await getFamilyId(parentId);
      const mine = [...settlements.values()]
        .filter((s) => s.familyId === familyId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return mine[0] ?? null;
    },

    async registerExpenseSettlement(parentId, input: ExpenseSettlementInput) {
      const familyId = await getFamilyId(parentId);
      const settlement: ExpenseSettlement = {
        id: crypto.randomUUID(),
        familyId,
        paidByParentId: parentId,
        amountMxn: input.amountMxn,
        createdAt: new Date().toISOString(),
        confirmedByParentId: null,
        confirmedAt: null,
      };
      settlements.set(settlement.id, settlement);
      return settlement;
    },

    async confirmExpenseSettlement(parentId, settlementId) {
      const settlement = settlements.get(settlementId);
      if (!settlement) throw new Error("liquidación no encontrada");
      if (settlement.paidByParentId === parentId) {
        throw new Error("quien registró el pago no puede confirmarlo");
      }
      if (!settlement.confirmedAt) {
        settlement.confirmedByParentId = parentId;
        settlement.confirmedAt = new Date().toISOString();
      }
      return settlement;
    },
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=packages/api-client`
Expected: no errors in this file. (`supabaseExpenseRepository.ts` will fail — fixed in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/expenses/mockExpenseRepository.ts
git commit -m "$(cat <<'EOF'
feat(api-client): mock de reparto, contraoferta y liquidación de gastos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `packages/api-client` — Supabase repository

**Files:**
- Modify: `packages/api-client/src/expenses/supabaseExpenseRepository.ts` (full rewrite of the file body)

**Suggested model:** standard (getBalance rewrite + 2 RPC calls, needs care matching the mock's exact behavior)

- [ ] **Step 1: Replace the file**

```ts
// packages/api-client/src/expenses/supabaseExpenseRepository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeExpenseReimbursement,
  type Expense,
  type ExpenseCounterInput,
  type ExpenseRepository,
  type ExpenseSettlement,
  type ExpenseSettlementInput,
  type ExpenseSplit,
} from "@alba/core";
import { createFamilyIdResolver, type FamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabaseExpenseRepository(
  client: SupabaseClient,
  familyIdResolver?: FamilyIdResolver
): ExpenseRepository {
  const getMyFamilyId = familyIdResolver ?? createFamilyIdResolver(client);

  async function getFamilyChildIds(familyId: string): Promise<string[]> {
    const { data, error } = await client.from("children").select("id").eq("family_id", familyId);
    if (error) throw error;
    return (data ?? []).map((c: any) => c.id);
  }

  return {
    async listExpenses(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const childIds = await getFamilyChildIds(familyId);
      if (childIds.length === 0) return [];
      const { data, error } = await client
        .from("expenses")
        .select()
        .in("child_id", childIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapExpense);
    },

    async createExpense(parentId, input) {
      const { data, error } = await client
        .from("expenses")
        .insert({
          child_id: input.childId,
          paid_by_parent_id: parentId,
          amount_mxn: input.amountMxn,
          description: input.description,
          receipt_url: input.receiptUrl,
        })
        .select()
        .single();
      if (error) throw error;
      return mapExpense(data);
    },

    async updateExpenseStatus(parentId, expenseId, status) {
      const { data: existing, error: fetchError } = await client
        .from("expenses")
        .select("paid_by_parent_id")
        .eq("id", expenseId)
        .single();
      if (fetchError) throw fetchError;
      if (existing.paid_by_parent_id === parentId) {
        throw new Error("no puedes aprobar o rechazar tu propio gasto");
      }

      const { data, error } = await client
        .from("expenses")
        .update({ status })
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      return mapExpense(data);
    },

    async getBalance(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return { otherParentId: null, amountMxnOwedByCaller: 0 };

      const { data: members, error: membersError } = await client
        .from("family_members")
        .select("parent_id")
        .eq("family_id", familyId);
      if (membersError) throw membersError;
      const otherParentId: string | null =
        (members ?? []).map((m: any) => m.parent_id).find((id: string) => id !== parentId) ?? null;
      if (!otherParentId) return { otherParentId: null, amountMxnOwedByCaller: 0 };

      const childIds = await getFamilyChildIds(familyId);
      if (childIds.length === 0) return { otherParentId, amountMxnOwedByCaller: 0 };

      const { data: settlementRow, error: settlementError } = await client
        .from("family_expense_settlements")
        .select("confirmed_at")
        .eq("family_id", familyId)
        .not("confirmed_at", "is", null)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (settlementError) throw settlementError;
      const cutoff: string | null = settlementRow?.confirmed_at ?? null;

      const { data: splitRow, error: splitError } = await client
        .from("family_expense_splits")
        .select("proposer_share_pct, proposed_by_parent_id")
        .eq("family_id", familyId)
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (splitError) throw splitError;
      const confirmedSplit = splitRow
        ? { proposerSharePct: splitRow.proposer_share_pct, proposedByParentId: splitRow.proposed_by_parent_id }
        : null;

      let query = client
        .from("expenses")
        .select("paid_by_parent_id, amount_mxn, counter_amount_mxn")
        .in("child_id", childIds)
        .eq("status", "approved");
      if (cutoff) query = query.gt("created_at", cutoff);
      const { data: approved, error: expensesError } = await query;
      if (expensesError) throw expensesError;

      let amountMxnOwedByCaller = 0;
      for (const row of approved ?? []) {
        const expense = {
          amountMxn: Number(row.amount_mxn),
          paidByParentId: row.paid_by_parent_id,
          counterAmountMxn: row.counter_amount_mxn !== null ? Number(row.counter_amount_mxn) : null,
        };
        const reimbursement = computeExpenseReimbursement(expense, confirmedSplit, { a: parentId, b: otherParentId });
        if (expense.paidByParentId === otherParentId) amountMxnOwedByCaller += reimbursement;
        else amountMxnOwedByCaller -= reimbursement;
      }

      return { otherParentId, amountMxnOwedByCaller };
    },

    async getExpenseSplit(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;

      const { data: pending, error: pendingError } = await client
        .from("family_expense_splits")
        .select()
        .eq("family_id", familyId)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingError) throw pendingError;
      if (pending) return mapSplit(pending);

      const { data: confirmed, error: confirmedError } = await client
        .from("family_expense_splits")
        .select()
        .eq("family_id", familyId)
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (confirmedError) throw confirmedError;
      return confirmed ? mapSplit(confirmed) : null;
    },

    async proposeExpenseSplit(parentId, proposerSharePct) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) {
        throw new Error("No perteneces a ninguna familia todavía — empareja al otro progenitor desde tu Perfil.");
      }
      // A propósito NO se atrapa el 23505 (unique_violation) del índice
      // parcial "una pendiente a la vez" — el puerto dice explícitamente
      // "falla si ya hay una propuesta pendiente", a diferencia de
      // registerPayment en Pensión, que sí es idempotente.
      const { data, error } = await client
        .from("family_expense_splits")
        .insert({
          family_id: familyId,
          proposed_by_parent_id: parentId,
          proposer_share_pct: proposerSharePct,
        })
        .select()
        .single();
      if (error) throw error;
      return mapSplit(data);
    },

    async confirmExpenseSplit(_parentId, splitId) {
      // SECURITY DEFINER — ver confirm_expense_split() en
      // 0034_reparto_gastos.sql.
      const { data, error } = await client.rpc("confirm_expense_split", { p_split_id: splitId });
      if (error) throw error;
      return mapSplit(data);
    },

    async rejectExpenseSplit(_parentId, splitId) {
      const { error } = await client.from("family_expense_splits").delete().eq("id", splitId);
      if (error) throw error;
    },

    async proposeExpenseCounter(parentId, expenseId, input: ExpenseCounterInput) {
      const { data: existing, error: fetchError } = await client
        .from("expenses")
        .select("paid_by_parent_id, status")
        .eq("id", expenseId)
        .single();
      if (fetchError) throw fetchError;
      if (existing.paid_by_parent_id === parentId) {
        throw new Error("no puedes contraofertar tu propio gasto");
      }
      if (existing.status !== "pending_approval") {
        throw new Error("este gasto ya no está pendiente de aprobación");
      }

      const { data, error } = await client
        .from("expenses")
        .update({
          status: "countered",
          counter_amount_mxn: input.counterAmountMxn,
          counter_comment: input.counterComment,
          countered_by_parent_id: parentId,
        })
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      return mapExpense(data);
    },

    async resolveExpenseCounter(_parentId, expenseId, accept) {
      // SECURITY DEFINER — ver resolve_expense_counter() en
      // 0035_contraoferta_gastos.sql.
      const { data, error } = await client.rpc("resolve_expense_counter", {
        p_expense_id: expenseId,
        p_accept: accept,
      });
      if (error) throw error;
      return mapExpense(data);
    },

    async getLatestExpenseSettlement(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;
      const { data, error } = await client
        .from("family_expense_settlements")
        .select()
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapSettlement(data) : null;
    },

    async registerExpenseSettlement(parentId, input: ExpenseSettlementInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("family_expense_settlements")
        .insert({ family_id: familyId, paid_by_parent_id: parentId, amount_mxn: input.amountMxn })
        .select()
        .single();
      if (error) throw error;
      return mapSettlement(data);
    },

    async confirmExpenseSettlement(_parentId, settlementId) {
      // SECURITY DEFINER — ver confirm_expense_settlement() en
      // 0036_liquidar_saldo_gastos.sql.
      const { data, error } = await client.rpc("confirm_expense_settlement", {
        p_settlement_id: settlementId,
      });
      if (error) throw error;
      return mapSettlement(data);
    },
  };
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    childId: row.child_id,
    paidByParentId: row.paid_by_parent_id,
    amountMxn: Number(row.amount_mxn),
    description: row.description,
    receiptUrl: row.receipt_url,
    status: row.status,
    createdAt: row.created_at,
    counterAmountMxn: row.counter_amount_mxn !== null ? Number(row.counter_amount_mxn) : null,
    counterComment: row.counter_comment ?? null,
    counteredByParentId: row.countered_by_parent_id ?? null,
  };
}

function mapSplit(row: any): ExpenseSplit {
  return {
    id: row.id,
    familyId: row.family_id,
    proposedByParentId: row.proposed_by_parent_id,
    proposerSharePct: row.proposer_share_pct,
    status: row.status,
    confirmedByParentId: row.confirmed_by_parent_id ?? null,
    createdAt: row.created_at,
  };
}

function mapSettlement(row: any): ExpenseSettlement {
  return {
    id: row.id,
    familyId: row.family_id,
    paidByParentId: row.paid_by_parent_id,
    amountMxn: Number(row.amount_mxn),
    createdAt: row.created_at,
    confirmedByParentId: row.confirmed_by_parent_id ?? null,
    confirmedAt: row.confirmed_at ?? null,
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=packages/api-client`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/expenses/supabaseExpenseRepository.ts
git commit -m "$(cat <<'EOF'
feat(api-client): Supabase de reparto, contraoferta y liquidación de gastos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Server Actions

**Files:**
- Modify: `apps/web/src/app/gastos/actions.ts` (append 7 new actions, extend the import line)

**Suggested model:** standard (7 actions, needs to match notification-copy conventions already in the file)

- [ ] **Step 1: Extend the import and append the new actions**

Replace the import line at the top of `apps/web/src/app/gastos/actions.ts`:

```ts
import { expenseCounterInputSchema, expenseInputSchema, expenseSettlementInputSchema, expenseSplitInputSchema } from "@alba/core";
```

Append at the end of the file (after `updateExpenseStatusAction`):

```ts
export async function proposeExpenseSplitAction(formData: FormData) {
  const input = expenseSplitInputSchema.parse({
    proposerSharePct: Number(formData.get("proposerSharePct")),
  });
  const as = String(formData.get("as") ?? "");
  const { expenses, pairing, parentId } = await getRequestContext(as);
  await expenses.proposeExpenseSplit(parentId, input.proposerSharePct);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nueva propuesta de reparto de gastos",
    body: `Propone cubrir ${input.proposerSharePct}% de los gastos`,
    url: "/gastos",
  });
}

export async function confirmExpenseSplitAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const splitId = String(formData.get("splitId") ?? "");
  const { expenses, pairing, parentId } = await getRequestContext(as);
  await expenses.confirmExpenseSplit(parentId, splitId);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Reparto de gastos confirmado",
    body: "Ya pueden ver el nuevo reparto en Gastos",
    url: "/gastos",
  });
}

export async function rejectExpenseSplitAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const splitId = String(formData.get("splitId") ?? "");
  const { expenses, parentId } = await getRequestContext(as);
  await expenses.rejectExpenseSplit(parentId, splitId);
  revalidatePath("/gastos");
}

export async function proposeExpenseCounterAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const input = expenseCounterInputSchema.parse({
    counterAmountMxn: Number(formData.get("counterAmountMxn")),
    counterComment: formData.get("counterComment"),
  });

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const expense = await expenses.proposeExpenseCounter(parentId, expenseId, input);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Contraoferta en un gasto",
    body: `${expense.description} — ofrece cubrir ${MXN.format(input.counterAmountMxn)}`,
    url: "/gastos",
  });
}

export async function resolveExpenseCounterAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const accept = formData.get("accept") === "true";

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const expense = await expenses.resolveExpenseCounter(parentId, expenseId, accept);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: accept ? "Contraoferta aceptada" : "Contraoferta rechazada",
    body: expense.description,
    url: "/gastos",
  });
}

export async function registerExpenseSettlementAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const input = expenseSettlementInputSchema.parse({ amountMxn: Number(formData.get("amountMxn")) });

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const settlement = await expenses.registerExpenseSettlement(parentId, input);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Pago de gastos registrado",
    body: `Marcó que te pagó ${MXN.format(settlement.amountMxn)}`,
    url: "/gastos",
  });
}

export async function confirmExpenseSettlementAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const settlementId = String(formData.get("settlementId") ?? "");

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const settlement = await expenses.confirmExpenseSettlement(parentId, settlementId);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Confirmaron tu pago de gastos",
    body: MXN.format(settlement.amountMxn),
    url: "/gastos",
  });
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: no new errors from this file (unrelated pre-existing errors in `apps/web/src/app/gastos/page.tsx`, if any at this point, are expected — fixed in Tasks 9-10).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/gastos/actions.ts
git commit -m "$(cat <<'EOF'
feat(web): Server Actions de reparto, contraoferta y liquidación de gastos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: UI — tarjeta de reparto y liquidar saldo

**Files:**
- Modify: `apps/web/src/app/gastos/page.tsx:1-8` (imports), `:40-47` (data fetch), `:107-124` (balance section)

**Suggested model:** standard (UI judgment — several conditional branches, must match Mexican-Spanish copy conventions)

- [ ] **Step 1: Extend the imports**

Replace the import block at the top of `apps/web/src/app/gastos/page.tsx`:

```ts
import Link from "next/link";
import { periodKey, formatPeriodLabel, type Expense } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import {
  confirmExpenseSettlementAction,
  confirmExpenseSplitAction,
  createExpenseAction,
  proposeExpenseCounterAction,
  proposeExpenseSplitAction,
  registerExpenseSettlementAction,
  rejectExpenseSplitAction,
  resolveExpenseCounterAction,
  updateExpenseStatusAction,
} from "./actions";
import { PensionSection } from "./PensionSection";
import { SubmitButton } from "@/components/SubmitButton";
```

- [ ] **Step 2: Fetch the two new pieces of data**

Replace the `Promise.all` block (lines 40-47):

```ts
  const [expenseList, children, familyMembers, balance, pensionSettings, pensionPayments, expenseSplit, latestSettlement] =
    await Promise.all([
      expenses.listExpenses(parentId),
      pairing.getMyChildren(parentId),
      pairing.listFamilyMembers(parentId),
      expenses.getBalance(parentId),
      pension.getSettings(parentId),
      pension.listPayments(parentId),
      expenses.getExpenseSplit(parentId),
      expenses.getLatestExpenseSettlement(parentId),
    ]);
```

- [ ] **Step 3: Compute the derived display values**

Right after the existing `const asQuery = as === "b" ? "&as=b" : "";` line (around line 57), add:

```ts
  // Reparto: % confirmado que me toca a mí, derivado del % del proponente.
  const myConfirmedPct =
    expenseSplit?.status === "confirmed"
      ? expenseSplit.proposedByParentId === parentId
        ? expenseSplit.proposerSharePct
        : 100 - expenseSplit.proposerSharePct
      : null;
  const otherConfirmedPct = myConfirmedPct !== null ? 100 - myConfirmedPct : null;
  const splitPendingFromOther = expenseSplit?.status === "pending" && expenseSplit.proposedByParentId !== parentId;
  const splitPendingFromMe = expenseSplit?.status === "pending" && expenseSplit.proposedByParentId === parentId;

  // Liquidar saldo: mismo patrón que Pensión — quien debe marca "pagué",
  // el otro confirma. owedRounded > 0 significa que yo debo.
  const pendingSettlement = latestSettlement && !latestSettlement.confirmedAt ? latestSettlement : null;
  const iCanSettleDebt = owedRounded > 0 && !pendingSettlement;
  const iRegisteredPendingSettlement = pendingSettlement?.paidByParentId === parentId;
  const iCanConfirmSettlement = pendingSettlement !== null && pendingSettlement.paidByParentId !== parentId;
```

(This goes AFTER `owedRounded` is computed, which already exists a few lines above.)

- [ ] **Step 4: Replace the balance section, adding settlement buttons and a reparto card right after it**

Replace the existing balance `<section>` (lines 107-124) with:

```tsx
      <section className="mt-6 rounded-xl border border-subtle bg-card p-5 text-center shadow-ambient">
        {!otherParentName ? (
          <p className="text-sm text-ink-soft">
            Empareja al otro progenitor desde tu Perfil para poder calcular el balance de gastos.
          </p>
        ) : owedRounded > 0 ? (
          <p className="text-lg font-semibold text-ink">
            Le debes a {otherParentName} <span className="text-danger">{MXN.format(owedRounded)}</span>
          </p>
        ) : owedRounded < 0 ? (
          <p className="text-lg font-semibold text-ink">
            {otherParentName} te debe <span className="text-success">{MXN.format(Math.abs(owedRounded))}</span>
          </p>
        ) : (
          <p className="text-lg font-semibold text-ink">Están a mano ✓</p>
        )}
        <p className="mt-1 text-xs text-ink-soft">Calculado sobre gastos aprobados — ver el reparto abajo.</p>

        {iCanSettleDebt && (
          <form action={registerExpenseSettlementAction} className="mt-3">
            <input type="hidden" name="as" value={as ?? ""} />
            <input type="hidden" name="amountMxn" value={owedRounded} />
            <SubmitButton pendingText="Registrando…" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
              Marcar como pagado
            </SubmitButton>
          </form>
        )}
        {iRegisteredPendingSettlement && (
          <p className="mt-2 text-xs text-ink-soft">
            Marcaste que pagaste {MXN.format(pendingSettlement!.amountMxn)} — esperando que {otherParentName} lo confirme.
          </p>
        )}
        {iCanConfirmSettlement && (
          <form action={confirmExpenseSettlementAction} className="mt-3">
            <input type="hidden" name="as" value={as ?? ""} />
            <input type="hidden" name="settlementId" value={pendingSettlement!.id} />
            <SubmitButton pendingText="Confirmando…" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
              Confirmar que recibí el pago
            </SubmitButton>
          </form>
        )}
      </section>

      {otherParentName && (
        <section className="mt-4 rounded-xl border border-subtle bg-card p-4 shadow-ambient">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Reparto de gastos</p>

          {splitPendingFromOther ? (
            <>
              <p className="mt-1 text-sm text-ink">
                {otherParentName} propone cubrir {expenseSplit!.proposerSharePct}% / tú {100 - expenseSplit!.proposerSharePct}%
              </p>
              <div className="mt-3 flex gap-2">
                <form action={confirmExpenseSplitAction}>
                  <input type="hidden" name="as" value={as ?? ""} />
                  <input type="hidden" name="splitId" value={expenseSplit!.id} />
                  <SubmitButton pendingText="Aceptando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                    Aceptar
                  </SubmitButton>
                </form>
                <form action={rejectExpenseSplitAction}>
                  <input type="hidden" name="as" value={as ?? ""} />
                  <input type="hidden" name="splitId" value={expenseSplit!.id} />
                  <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                    Rechazar
                  </SubmitButton>
                </form>
              </div>
            </>
          ) : splitPendingFromMe ? (
            <p className="mt-1 text-sm text-ink-soft">
              Esperando que {otherParentName} confirme tu propuesta (tú {expenseSplit!.proposerSharePct}% / {otherParentName} {100 - expenseSplit!.proposerSharePct}%)
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink">
                {myConfirmedPct !== null
                  ? `Reparto actual: tú ${myConfirmedPct}% / ${otherParentName} ${otherConfirmedPct}%`
                  : "Reparto actual: 50/50 (predeterminado)"}
              </p>
              <details className="mt-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer text-xs font-semibold text-ink underline">Proponer otro reparto</summary>
                <form action={proposeExpenseSplitAction} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="as" value={as ?? ""} />
                  <label className="text-xs font-medium text-ink-soft">
                    Yo cubro ___% (el otro progenitor cubre el resto)
                    <input
                      type="number"
                      name="proposerSharePct"
                      min="1"
                      max="99"
                      required
                      defaultValue={50}
                      className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                    />
                  </label>
                  <SubmitButton pendingText="Proponiendo…" className="self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
                    Proponer
                  </SubmitButton>
                </form>
              </details>
            </>
          )}
        </section>
      )}
```

- [ ] **Step 2 (duplicate step number intentional — the file-wide typecheck comes after all 3 UI tasks are done together, see Task 10/11): continue to Task 10**

---

### Task 10: UI — contraoferta en la lista de gastos

**Files:**
- Modify: `apps/web/src/app/gastos/page.tsx:162-181` (the `canDecide` block, plus a new `status === "countered"` block right after it)

**Suggested model:** standard (3-button UX + conditional disclosure, same care level as Task 9)

- [ ] **Step 1: Replace the `canDecide` block and add the "countered" display block**

Inside the `expenseList.map(...)` body, replace this block:

```tsx
                {canDecide && (
                  <div className="mt-3 flex gap-2">
                    <form action={updateExpenseStatusAction}>
                      <input type="hidden" name="as" value={as ?? ""} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <input type="hidden" name="status" value="approved" />
                      <SubmitButton pendingText="Aprobando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                        Aprobar
                      </SubmitButton>
                    </form>
                    <form action={updateExpenseStatusAction}>
                      <input type="hidden" name="as" value={as ?? ""} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                        Rechazar
                      </SubmitButton>
                    </form>
                  </div>
                )}
```

with:

```tsx
                {canDecide && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <form action={updateExpenseStatusAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input type="hidden" name="status" value="approved" />
                        <SubmitButton pendingText="Aprobando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                          Aprobar
                        </SubmitButton>
                      </form>
                      <form action={updateExpenseStatusAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                          Rechazar
                        </SubmitButton>
                      </form>
                    </div>
                    <details className="[&_summary::-webkit-details-marker]:hidden">
                      <summary className="cursor-pointer text-xs font-medium text-ink-soft underline">Contraoferta</summary>
                      <form action={proposeExpenseCounterAction} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input
                          type="number"
                          name="counterAmountMxn"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Monto que puedes cubrir"
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
                        />
                        <textarea
                          name="counterComment"
                          required
                          minLength={3}
                          maxLength={280}
                          rows={2}
                          placeholder="¿Por qué?"
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
                        />
                        <SubmitButton pendingText="Enviando…" className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink">
                          Mandar contraoferta
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                )}

                {expense.status === "countered" && (
                  <div className="mt-3 rounded-md border border-purple/30 bg-purple/10 p-3">
                    <p className="text-sm text-ink">
                      {parentName(expense.counteredByParentId!)} ofrece cubrir {MXN.format(expense.counterAmountMxn!)}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">"{expense.counterComment}"</p>
                    {expense.paidByParentId === parentId && (
                      <div className="mt-2 flex gap-2">
                        <form action={resolveExpenseCounterAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <input type="hidden" name="accept" value="true" />
                          <SubmitButton pendingText="Aceptando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                            Aceptar contraoferta
                          </SubmitButton>
                        </form>
                        <form action={resolveExpenseCounterAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <input type="hidden" name="accept" value="false" />
                          <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                            Rechazar contraoferta
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </div>
                )}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: no errors (Tasks 9 and 10 together complete every reference the page makes to the new repository methods and actions). If there are still errors, re-check that every new import from Task 9 Step 1 is actually used.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/gastos/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): UI de reparto configurable, contraoferta y liquidar saldo en Gastos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: CSV export

**Files:**
- Create: `apps/web/src/app/gastos/export/route.ts`
- Modify: `apps/web/src/app/gastos/page.tsx` (add the export link near the top of the Gastos tab content)

**Suggested model:** standard (new Route Handler pattern in this codebase — only one precedent to follow, `auth/confirm/route.ts`, which is a different shape)

- [ ] **Step 1: Write the Route Handler**

```ts
// apps/web/src/app/gastos/export/route.ts
import type { NextRequest } from "next/server";
import { computeExpenseReimbursement } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const as = request.nextUrl.searchParams.get("as") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "";
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return new Response("period inválido", { status: 400 });
  }

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const [expenseList, children, familyMembers, split] = await Promise.all([
    expenses.listExpenses(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    expenses.getExpenseSplit(parentId),
  ]);
  const otherParent = familyMembers.find((p) => p.id !== parentId) ?? null;
  const confirmedSplit = split?.status === "confirmed" ? split : null;

  const childName = (id: string) => children.find((c) => c.id === id)?.fullName ?? "Hijo/a";
  const parentName = (id: string) =>
    id === parentId ? "Yo" : (familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor");

  const rows = expenseList.filter((e) => e.status === "approved" && e.createdAt.startsWith(period));

  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["Fecha,Hijo,Descripción,Monto,Pagó,Reembolso"];
  for (const e of rows) {
    const reimbursement = otherParent
      ? computeExpenseReimbursement(e, confirmedSplit, { a: parentId, b: otherParent.id })
      : 0;
    lines.push(
      [
        e.createdAt.slice(0, 10),
        csvEscape(childName(e.childId)),
        csvEscape(e.description),
        e.amountMxn.toFixed(2),
        csvEscape(parentName(e.paidByParentId)),
        reimbursement.toFixed(2),
      ].join(",")
    );
  }

  lines.push("");
  lines.push("Totales por hijo");
  const totalsByChild = new Map<string, number>();
  for (const e of rows) {
    totalsByChild.set(e.childId, (totalsByChild.get(e.childId) ?? 0) + e.amountMxn);
  }
  for (const [childId, total] of totalsByChild) {
    lines.push(`${csvEscape(childName(childId))},,,,,${total.toFixed(2)}`);
  }

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-${period}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Add the export link to the Gastos tab**

In `apps/web/src/app/gastos/page.tsx`, the component already computes `period` near the top (used today only by the Pensión tab's prev/next links — see the `period` variable derived from `searchParams`). Add the import for `formatPeriodLabel` (already imported for `periodKey` — extend that same import line from Task 9 Step 1, which already added it) and add this link right after the `<h1>`/intro `<p>` of the `tab === "gastos"` branch (just before the balance `<section>`):

```tsx
          <a
            href={`/gastos/export?period=${period}${asQuery}`}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline"
          >
            Exportar CSV de {formatPeriodLabel(period)}
          </a>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck` (root, all workspaces)
Expected: no errors anywhere in the monorepo.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/gastos/export/route.ts apps/web/src/app/gastos/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): exportar resumen mensual de gastos en CSV

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Verificación manual completa (modo demo)

**Files:** none (manual QA pass, no code changes expected — if something breaks, fix it here with a new small commit, don't amend an earlier task's commit)

**Suggested model:** standard (requires judgment to notice UX issues, not just following a script)

- [ ] **Step 1: Start the dev server in demo mode**

Run: `npm run dev --workspace=apps/web` (no Supabase env vars configured locally → demo mode, mock repositories). Confirm the yellow "Modo de prueba local" banner shows on `/gastos`.

- [ ] **Step 2: Reparto configurable**

As Progenitor A (`/gastos`), under "Reparto de gastos", propose 70% ("Yo cubro 70%"). Confirm the card now says "Esperando que [B] confirme tu propuesta". Switch to Progenitor B (`?as=b`), confirm the card shows "[A] propone cubrir 70% / tú 30%" with Aceptar/Rechazar. Click Aceptar. Confirm both A and B now see "Reparto actual: tú X% / [otro] Y%" with the correct numbers from each one's own perspective.

- [ ] **Step 3: Balance uses the new split**

Register a gasto of $1000 as Progenitor A (child selector requires at least one child — add one from Perfil first if needed). Approve it as Progenitor B. Confirm the balance now shows B owes A $300 (30% of $1000, matching the 70/30 split from Step 2) — NOT $500 (the old 50/50).

- [ ] **Step 4: Contraoferta**

Register a second gasto of $600 as Progenitor A. As Progenitor B, open "Contraoferta" on it, offer to cover $100 with a comment, submit. Confirm the gasto now shows status "Contrapropuesta" with the offered amount and comment visible to both. As Progenitor A, confirm the "Aceptar contraoferta"/"Rechazar contraoferta" buttons appear (only to A, the payer) — click Aceptar. Confirm the gasto status becomes "Aprobado" and the balance updates using $100 (not the split %) for this specific gasto.

- [ ] **Step 5: Liquidar saldo**

Whichever progenitor currently owes money (check the balance card), click "Marcar como pagado". Confirm that progenitor now sees "Marcaste que pagaste $X — esperando que [otro] lo confirme" and the button disappears. Switch to the other progenitor, confirm they see "Confirmar que recibí el pago" — click it. Confirm the balance resets to "Están a mano ✓". Register one more small gasto and approve it — confirm it's reflected in the new balance (proving the settlement cutoff didn't also hide future gastos).

- [ ] **Step 6: Exportar CSV**

Click "Exportar CSV de [mes actual]" on the Gastos tab. Confirm a `.csv` file downloads, opens cleanly in a spreadsheet app, shows the approved gastos from Steps 3-5 with the correct reimbursement column, and ends with a "Totales por hijo" section with the right sums.

- [ ] **Step 7: Regression check — Pensión still works**

Switch to the Pensión tab, confirm it still loads and the existing register/confirm payment flow is untouched by this plan's changes.

- [ ] **Step 8: Final full-repo check**

Run: `npm run typecheck` (root, all workspaces)
Run: `npm run test --workspace=packages/core`
Expected: both PASS with zero errors/failures.

- [ ] **Step 9: Commit (only if Steps 2-7 required fixes)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(web): ajustes encontrados en verificación manual de reparto/contraoferta/liquidación

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage** — every section of the spec has a task:
- "Reparto configurable" → Tasks 1 (migration), 4 (entity/schema/engine), 5 (port), 6-7 (repos), 8 (actions), 9 (UI), 12 (verify).
- "Contraoferta" → Tasks 2, 4, 5, 6-7, 8, 10, 12.
- "Liquidar saldo" → Tasks 3, 4, 5, 6-7, 8, 9, 12 — implemented debtor-initiated (see "Deviations" at the top) to match what was actually approved and to keep the RLS INSERT policy mechanically correct.
- "Resumen mensual exportable (CSV)" → Tasks 4 (`computeExpenseReimbursement`), 11, 12.
- Migration order matches the spec's "Migraciones, en orden" section (0034 → 0035 → 0036).

**2. Placeholder scan** — no "TBD"/"add validation"/"similar to Task N" left; every step has literal code or an exact command.

**3. Type consistency** — `ExpenseSplit`/`ExpenseSettlement` field names (`familyId`, `proposedByParentId`, `proposerSharePct`, `status`, `confirmedByParentId`, `paidByParentId`, `amountMxn`, `confirmedAt`) and `Expense`'s 3 new fields (`counterAmountMxn`, `counterComment`, `counteredByParentId`) are identical across Task 4 (entities), Task 5 (port), Task 6 (mock), Task 7 (Supabase + its `map*` functions), Task 8 (actions), Tasks 9-10 (UI), Task 11 (export). `computeExpenseReimbursement`'s signature (`expense`, `split`, `parentIds: {a, b}`) is defined once in Task 4 and called identically (same argument shapes) in Task 6's `getBalance`, Task 7's `getBalance`, and Task 11's export handler.

**Known risk, flagged for whoever executes Task 9/10:** this plan assumes `apps/web/src/app/gastos/page.tsx`'s line numbers (`1-8`, `40-47`, `57`, `107-124`, `162-181`) match exactly what was read while planning (the full file, 257 lines, as of the spec's commit). If an earlier task in a *different* plan touched this file in between, re-read it before editing and locate the blocks by their literal content (shown in full in Tasks 9-10) rather than trusting the line numbers blindly.

**Known risk, flagged for whoever executes Task 9:** Step 4's balance-section replacement and the new reparto `<section>` both use the `!` non-null assertion on `expenseSplit`/`pendingSettlement` inside branches already gated by a truthiness check on those same variables (e.g. `splitPendingFromOther` is only true when `expenseSplit` exists) — this is safe but relies on the gating conditions in Step 3 staying exactly as written; don't reorder the JSX branches without re-checking the assertions still hold.

---

**Plan complete and saved to `docs/superpowers/plans/2026-11-03-gastos-reparto-contraoferta-liquidacion.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
