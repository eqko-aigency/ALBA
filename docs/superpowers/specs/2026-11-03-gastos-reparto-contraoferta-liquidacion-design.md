# Gastos: reparto configurable, contraoferta y liquidar saldo

## Contexto

Siguiendo el mismo criterio que se usó para partir la lista original de la clienta en sub-proyectos (Calendario / Gastos / Chat), este spec cubre **una parte** de la sección "Gastos y pensión" de su feedback del 19-oct — la que no depende de IA (visión/voz) y se puede construir con el mismo patrón ya probado en el resto de la app (propuesta/confirmación, como Acuerdos; pago/confirmación, como Pensión).

Quedan **fuera de este spec, para uno aparte más adelante**:
- Registrar un gasto por foto del ticket (OCR) o por voz/texto libre ("registra el dentista, $600") — es una feature de IA más grande (visión + lenguaje natural), distinta en forma y riesgo al resto.

Este spec cubre, de la nota original de la clienta:
1. **Reparto configurable** — hoy el balance es 50/50 fijo; pasa a ser un % acordado entre los dos progenitores.
2. **Contraoferta** al recibir un gasto — hoy "Aprobar"/"Rechazar" existen, "Contraoferta" no tiene ninguna UI (aunque el tipo `Expense.status` ya incluye `"countered"`).
3. **Liquidar saldo** — pedir el reembolso y marcarlo como pagado, mismo patrón que ya existe en Pensión.
4. **Resumen mensual exportable** — por hijo, en CSV.

## Qué NO incluye este spec (alcance deliberadamente acotado)

- **Reparto por categoría** — la clienta mencionó "por categoría" en su nota original, pero hoy `Expense` no tiene ningún campo de categoría y agregarlo infla mucho el alcance. Se define un único % general para todos los gastos; reparto-por-categoría queda como posible iteración futura si hace falta.
- **Resumen por categoría** — mismo motivo: el resumen exportable agrupa solo por hijo.
- **Negociación de ida y vuelta en la contraoferta** — una sola vuelta: el que recibe el gasto contraoferta una vez, el que pagó acepta o rechaza esa contraoferta. No hay una segunda contraoferta sobre la contraoferta.
- **Registrar un gasto con foto (OCR) o dictado por voz** — ver nota en Contexto, va en un spec aparte.
- **Exportar en PDF** — se eligió CSV (más útil para abrir en Excel o mandar a alguien que lleve las cuentas); un PDF imprimible queda descartado para este resumen (Chat ya tiene su propio export en PDF, con otro propósito: evidencia legal, no contabilidad).

## Diseño

### 1. Reparto configurable

Hoy `getBalance()` (`packages/api-client/src/expenses/{mock,supabase}ExpenseRepository.ts`) calcula `amountMxnOwedByCaller = (pagado_por_el_otro − pagado_por_mí) / 2` — un 50/50 fijo, sin forma de cambiarlo. Pasa a usar un % acordado entre los dos progenitores, con 50/50 como valor por defecto mientras no haya ningún acuerdo confirmado (nadie pierde el comportamiento actual).

**Entidad nueva** (`packages/core/src/domain/entities.ts`):

```ts
export interface ExpenseSplit {
  id: string;
  proposedByParentId: string;
  /** % (1-99) del total de gastos que cubre proposedByParentId. El otro progenitor cubre 100 - esto. */
  proposerSharePct: number;
  status: "pending" | "confirmed";
  confirmedByParentId: string | null;
  createdAt: string;
}
```

**Puerto** — se agrega a `ExpenseRepository` (`packages/core/src/domain/ports.ts`):

```ts
/** La propuesta pendiente más reciente si hay una; si no, el acuerdo confirmado más reciente; si no hay ninguno, null (= 50/50 por defecto). */
getExpenseSplit(parentId: string): Promise<ExpenseSplit | null>;
/** Falla si ya hay una propuesta pendiente para esta familia (ver migración, índice único parcial). */
proposeExpenseSplit(parentId: string, proposerSharePct: number): Promise<ExpenseSplit>;
confirmExpenseSplit(parentId: string, splitId: string): Promise<ExpenseSplit>;
/** Solo el que NO propuso puede rechazar una propuesta pendiente — borra la fila. */
rejectExpenseSplit(parentId: string, splitId: string): Promise<void>;
```

`ExpenseSplitInput` (`packages/core/src/validation/schemas.ts`):

```ts
export const expenseSplitInputSchema = z.object({
  proposerSharePct: z.number().int().min(1).max(99),
});
export type ExpenseSplitInput = z.infer<typeof expenseSplitInputSchema>;
```

**Migración nueva** `0034_reparto_gastos.sql`:

```sql
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
  -- confirm_expense_split() (SECURITY DEFINER), mismo criterio que
  -- confirm_pension_payment() en 0016_pension.sql.
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

**Fórmula de balance generalizada** — `getBalance()` deja de usar `/2` fijo y pasa a sumar, gasto por gasto, cuánto le corresponde cubrir a quien NO pagó, con la misma función `computeExpenseReimbursement()` que usa el export (sección 4 — se define ahí para no repetir el mismo cálculo en dos lugares, pero aplica también acá):

```ts
const confirmedSplit = (await getExpenseSplit(familyId))?.status === "confirmed" ? split : null;
const parentIds = { a: parentId, b: otherParentId };

let amountMxnOwedByCaller = 0;
for (const e of approvedExpenses) {
  const reimbursement = computeExpenseReimbursement(e, confirmedSplit, parentIds);
  if (e.paidByParentId === otherParentId) amountMxnOwedByCaller += reimbursement; // yo le debo mi parte
  else amountMxnOwedByCaller -= reimbursement; // el otro me debe su parte
}
```

Sin split confirmado y sin ninguna contraoferta aceptada, esto da exactamente lo mismo que la fórmula actual `(paidByOther − paidByCaller) / 2` — mismo resultado para toda familia que nunca configuró nada.

**UI** (`apps/web/src/app/gastos/page.tsx`): tarjeta nueva junto al balance.

- Sin split confirmado ni pendiente: "Reparto actual: 50/50 (predeterminado)" + botón "Proponer otro reparto" → formulario chico (input numérico 1-99, con label "Yo cubro ___%").
- Con una propuesta pendiente del otro progenitor: "[Nombre] propone cubrir 60% / vos 40%" + botones Aceptar / Rechazar.
- Con una propuesta pendiente propia: "Esperando que [Nombre] confirme tu propuesta (vos 60% / [Nombre] 40%)" — sin botones, solo informativo.
- Con un split confirmado: "Reparto actual: [Nombre A] 60% / [Nombre B] 40%" + botón "Proponer otro reparto" (reemplaza al anterior si se confirma uno nuevo).

### 2. Contraoferta

`Expense.status` ya incluye `"countered"` en el tipo y en el check constraint de la tabla (`0010_gastos.sql`), pero no hay ningún campo para guardar la contraoferta ni ninguna UI que la dispare.

**Entidad extendida** (`packages/core/src/domain/entities.ts`):

```ts
export interface Expense {
  // ...campos existentes...
  /** Monto que el progenitor que NO pagó ofrece cubrir (no el total del gasto) — null si nunca se contraofertó. */
  counterAmountMxn: number | null;
  counterComment: string | null;
  counteredByParentId: string | null;
}
```

Importante: `counterAmountMxn` es lo que el que **recibe** el gasto ofrece **cubrir** (su reembolso), no un monto alternativo para el gasto completo — así lo pidió la clienta ("cubrir solo una parte, con comentario").

**Puerto** — se agrega a `ExpenseRepository`:

```ts
/** Solo quien NO pagó, y solo si el gasto está "pending_approval". */
proposeExpenseCounter(parentId: string, expenseId: string, input: ExpenseCounterInput): Promise<Expense>;
/** Solo quien SÍ pagó, y solo si el gasto está "countered". accept=true → "approved" (usa counterAmountMxn para el balance); accept=false → "rejected". */
resolveExpenseCounter(parentId: string, expenseId: string, accept: boolean): Promise<Expense>;
```

`ExpenseCounterInput`:

```ts
export const expenseCounterInputSchema = z.object({
  counterAmountMxn: z.number().positive(),
  counterComment: z.string().min(3).max(280),
});
export type ExpenseCounterInput = z.infer<typeof expenseCounterInputSchema>;
```

**Migración nueva** `0035_contraoferta_gastos.sql`:

```sql
alter table public.expenses
  add column if not exists counter_amount_mxn numeric(12, 2) check (counter_amount_mxn is null or counter_amount_mxn > 0),
  add column if not exists counter_comment text,
  add column if not exists countered_by_parent_id uuid references public.profiles (id);

-- Proponer la contraoferta (status -> 'countered' + los 3 campos de
-- arriba) ya lo permite la política de UPDATE existente ("el progenitor
-- que no pagó aprueba o rechaza", 0010_gastos.sql) — no cambia ninguna
-- columna fuera de lo que esa política ya autoriza. Resolver la
-- contraoferta SÍ es nuevo: hoy esa misma política EXCLUYE a quien pagó
-- (paid_by_parent_id <> auth.uid()), así que necesita su propia función
-- SECURITY DEFINER, mismo criterio que confirm_pension_payment().

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

**Balance** — un gasto `approved` con `counterAmountMxn` no nulo usa ese monto directo como el reembolso debido por quien no pagó, en vez de calcularlo con el % del reparto — esto ya lo resuelve `computeExpenseReimbursement()` (ver sección 4), que revisa `counterAmountMxn` primero antes de aplicar el % del split.

**UI** (`apps/web/src/app/gastos/page.tsx`): el bloque `canDecide` (hoy Aprobar/Rechazar) gana un tercer botón "Contraoferta" que despliega un formulario inline (monto + comentario). Un gasto `status === "countered"` donde `expense.paidByParentId === parentId` (soy quien pagó) muestra la contraoferta recibida ("[Nombre] ofrece cubrir $200 — '[comentario]'") con botones Aceptar contraoferta / Rechazar contraoferta. Para quien la propuso, mientras está pendiente, se ve solo informativo (sin botones).

### 3. Liquidar saldo

Mismo patrón exacto que Pensión (`pension_payments` + `confirm_pension_payment()`), aplicado al balance de Gastos.

**Entidad nueva**:

```ts
export interface ExpenseSettlement {
  id: string;
  paidByParentId: string;
  amountMxn: number;
  createdAt: string;
  confirmedByParentId: string | null;
  confirmedAt: string | null;
}
```

**Puerto**:

```ts
/** La más reciente — confirmada o no. null si nunca se liquidó nada. */
getLatestExpenseSettlement(parentId: string): Promise<ExpenseSettlement | null>;
registerExpenseSettlement(parentId: string, input: { amountMxn: number }): Promise<ExpenseSettlement>;
confirmExpenseSettlement(parentId: string, settlementId: string): Promise<ExpenseSettlement>;
```

**Migración nueva** `0036_liquidar_saldo_gastos.sql` — calco directo de `pension_payments`/`confirm_pension_payment()`:

```sql
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
  -- confirm_expense_settlement() (SECURITY DEFINER).
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

**Balance** — `getBalance()` solo suma gastos `approved` con `createdAt` posterior al `confirmedAt` de la última liquidación confirmada (si existe ninguna, cuenta todo el historial, igual que hoy).

**UI**: en la tarjeta de balance de Gastos — si el saldo es a favor del caller y no hay liquidación pendiente, botón "Pedir reembolso" (registra una liquidación por el monto exacto del balance actual). Si hay una liquidación pendiente de confirmar y el caller es quien debe confirmar (no quien la registró), botón "Confirmar que pagué" → "Confirmar que me pagaron" según corresponda. Mientras está pendiente de confirmar, se muestra "Pediste el reembolso de $X — esperando confirmación" (o el equivalente si el otro lo registró).

### 4. Resumen mensual exportable (CSV)

**`packages/core` gana una función compartida** `computeExpenseReimbursement(expense, split)` (usada tanto por `getBalance()` como por el export, para que nunca queden desalineados):

```ts
// packages/core/src/domain/expenseBalance.ts
export function computeExpenseReimbursement(
  expense: Pick<Expense, "amountMxn" | "paidByParentId" | "counterAmountMxn">,
  split: { proposerSharePct: number; proposedByParentId: string } | null,
  parentIds: { a: string; b: string } // los dos miembros de la familia, cualquier orden
): number {
  if (expense.counterAmountMxn !== null) return expense.counterAmountMxn;
  const nonPayerId = expense.paidByParentId === parentIds.a ? parentIds.b : parentIds.a;
  const proposerPct = split?.proposerSharePct ?? 50;
  const proposerId = split?.proposedByParentId ?? nonPayerId; // sin split, da igual: 50/50 simétrico
  const nonPayerPct = nonPayerId === proposerId ? proposerPct : 100 - proposerPct;
  return expense.amountMxn * (nonPayerPct / 100);
}
```

**Nuevo Route Handler** `apps/web/src/app/gastos/export/route.ts` — `GET /gastos/export?period=2026-11&as=...`:

```ts
import { NextRequest } from "next/server";
import { computeExpenseReimbursement } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const as = searchParams.get("as") ?? "";
  const period = searchParams.get("period") ?? "";
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

  const rows = expenseList.filter(
    (e) => e.status === "approved" && e.createdAt.startsWith(period)
  );

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

`getBalance()` (sección 1) debe reescribirse para usar esta misma `computeExpenseReimbursement()` por cada gasto aprobado, en vez de su propia fórmula agregada — así el balance en pantalla y el CSV exportado siempre coinciden.

**UI**: botón "Exportar CSV" junto al selector de período en la pestaña Gastos — un `<a href="/gastos/export?period=...&as=...">` normal (no necesita ser un form ni JS, el navegador descarga solo por el header `Content-Disposition`).

## Migraciones, en orden

1. `0034_reparto_gastos.sql`
2. `0035_contraoferta_gastos.sql`
3. `0036_liquidar_saldo_gastos.sql`

## Testing

- `packages/core`: tests de validación para `expenseSplitInputSchema` (rechaza 0, 100, negativos, no-enteros) y `expenseCounterInputSchema` (rechaza monto negativo/cero, comentario corto). Tests unitarios de `computeExpenseReimbursement()` cubriendo: sin split (50/50, debe dar igual que la fórmula vieja), con split confirmado asimétrico, y con `counterAmountMxn` presente (debe ignorar el % del split y usar ese monto directo).
- `apps/web`: `mockExpenseRepository.ts` necesita las 9 funciones nuevas (`getExpenseSplit`, `proposeExpenseSplit`, `confirmExpenseSplit`, `rejectExpenseSplit`, `proposeExpenseCounter`, `resolveExpenseCounter`, `getLatestExpenseSettlement`, `registerExpenseSettlement`, `confirmExpenseSettlement`) para poder probar todo en modo demo sin Supabase real.
- Verificación manual en navegador (preview local, modo demo, cambiando entre Progenitor A/B): proponer un reparto 70/30 desde A, confirmarlo desde B, ver que el balance cambia acorde; registrar un gasto desde A, contraofertarlo desde B, aceptarlo desde A, confirmar que el balance usa el monto contraofertado y no el 50/50 ni el % del split; pedir reembolso desde quien tiene saldo a favor, confirmar desde el otro, ver que el balance vuelve a $0 y que un gasto nuevo después de eso sí vuelve a sumar; exportar el CSV del mes y confirmar que abre bien en una hoja de cálculo con los totales correctos.
