-- Pensión (W-xx) — pago fijo mensual recurrente (ej. pensión alimenticia),
-- separado de "expenses" (0010_gastos.sql): un solo progenitor es el
-- pagador, el monto es fijo y cada mes es un registro de pago aparte, no
-- un ítem con aprobar/rechazar 50/50.
--
-- pension_settings es a nivel FAMILIA, mismo criterio que
-- custody_agreements (0009_calendario.sql) — ambos progenitores lo
-- configuran juntos, select/insert/update abiertos a cualquier miembro.
--
-- pension_payments es INMUTABLE una vez creado (mismo criterio que
-- documents/verbal_agreements) — un pago registrado no se edita ni se
-- borra. La única escritura posterior es "confirmar" (el progenitor que
-- NO pagó deja constancia de que lo recibió), vía
-- confirm_pension_payment() (SECURITY DEFINER), porque no hay policy de
-- UPDATE directa.

create table if not exists public.pension_settings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  payer_parent_id uuid not null references public.profiles (id),
  amount_mxn numeric(12,2) not null check (amount_mxn > 0),
  -- 1-28, no 1-31, para que el día exista en todos los meses (incluido febrero).
  due_day int not null check (due_day between 1 and 28),
  created_at timestamptz not null default now()
);

create unique index if not exists pension_settings_family_unique
  on public.pension_settings (family_id);

create table if not exists public.pension_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  amount_mxn numeric(12,2) not null check (amount_mxn > 0),
  paid_by_parent_id uuid not null references public.profiles (id),
  paid_at timestamptz not null default now(),
  confirmed_by_parent_id uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- A lo más un pago registrado por período por familia — evita duplicados
-- si dos requests de "Registrar pago" llegan casi a la vez.
create unique index if not exists pension_payments_family_period_unique
  on public.pension_payments (family_id, period);

alter table public.pension_settings enable row level security;
alter table public.pension_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pension_settings'
      and policyname = 'pension_settings: miembros de la familia leen su configuración'
  ) then
    create policy "pension_settings: miembros de la familia leen su configuración"
      on public.pension_settings for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = pension_settings.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pension_settings'
      and policyname = 'pension_settings: miembros de la familia la crean'
  ) then
    create policy "pension_settings: miembros de la familia la crean"
      on public.pension_settings for insert with check (
        exists (
          select 1 from public.family_members m
          where m.family_id = pension_settings.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pension_settings'
      and policyname = 'pension_settings: miembros de la familia la actualizan'
  ) then
    create policy "pension_settings: miembros de la familia la actualizan"
      on public.pension_settings for update using (
        exists (
          select 1 from public.family_members m
          where m.family_id = pension_settings.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pension_payments'
      and policyname = 'pension_payments: miembros de la familia leen los pagos'
  ) then
    create policy "pension_payments: miembros de la familia leen los pagos"
      on public.pension_payments for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = pension_payments.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pension_payments'
      and policyname = 'pension_payments: el pagador registra su propio pago'
  ) then
    create policy "pension_payments: el pagador registra su propio pago"
      on public.pension_payments for insert with check (
        paid_by_parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = pension_payments.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Deliberadamente NO hay política de UPDATE ni DELETE sobre
  -- pension_payments — ver nota de inmutabilidad arriba.
end $$;

-- confirm_pension_payment(): única escritura posterior permitida sobre un
-- pago. Acotada a: el caller es miembro de la familia del pago, el caller
-- NO es quien pagó, y el pago todavía no estaba confirmado.
create or replace function public.confirm_pension_payment(p_payment_id uuid)
returns public.pension_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pension_payments;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.pension_payments where id = p_payment_id;

  if v_row is null then
    raise exception 'pago no encontrado';
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

  update public.pension_payments
  set confirmed_by_parent_id = auth.uid(),
      confirmed_at = now()
  where id = p_payment_id
  returning * into v_row;

  return v_row;
end;
$$;
