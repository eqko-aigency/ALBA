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

-- Índices de respaldo para las FK (mismo criterio aplicado en 0033 y en el
-- fix de la Tarea 1 de family_expense_splits).
create index if not exists idx_family_expense_settlements_family_id on public.family_expense_settlements (family_id);
create index if not exists idx_family_expense_settlements_paid_by_parent_id on public.family_expense_settlements (paid_by_parent_id);
create index if not exists idx_family_expense_settlements_confirmed_by_parent_id on public.family_expense_settlements (confirmed_by_parent_id);

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
          where m.family_id = family_expense_settlements.family_id and m.parent_id = (select auth.uid())
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
        paid_by_parent_id = (select auth.uid())
        and exists (
          select 1 from public.family_members m
          where m.family_id = family_expense_settlements.family_id and m.parent_id = (select auth.uid())
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
