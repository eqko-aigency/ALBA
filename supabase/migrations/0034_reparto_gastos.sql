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

create index if not exists idx_family_expense_splits_family_id on public.family_expense_splits (family_id);
create index if not exists idx_family_expense_splits_proposed_by_parent_id on public.family_expense_splits (proposed_by_parent_id);
create index if not exists idx_family_expense_splits_confirmed_by_parent_id on public.family_expense_splits (confirmed_by_parent_id);

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
          where m.family_id = family_expense_splits.family_id and m.parent_id = (select auth.uid())
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
        proposed_by_parent_id = (select auth.uid())
        and exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_splits.family_id and m.parent_id = (select auth.uid())
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
        and proposed_by_parent_id <> (select auth.uid())
        and exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_splits.family_id and m.parent_id = (select auth.uid())
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
