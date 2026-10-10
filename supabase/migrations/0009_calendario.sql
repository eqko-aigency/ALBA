-- Calendario compartido y confirmación de eventos de custodia (check-in /
-- check-out). El convenio (custody_agreements) es a nivel FAMILIA — varios
-- hijos pueden compartir el mismo convenio; cada slot (custody_slots) carga
-- su propio child_id y parent_id. El motor de cumplimiento 100%
-- determinístico que compara eventos contra el convenio vive en
-- packages/core/src/compliance/complianceEngine.ts — esta migración solo
-- define el schema y las políticas de RLS, nunca lógica de negocio.
--
-- Idempotente de punta a punta (create table if not exists, índices únicos
-- "if not exists", políticas guardadas con un chequeo contra pg_policies
-- antes de crearlas) — mismo criterio que corrigió 0005/0006 para
-- migraciones no-idempotentes.

create table if not exists public.custody_agreements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  tolerance_minutes integer not null default 15,
  created_at timestamptz not null default now()
);

create table if not exists public.custody_slots (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.custody_agreements (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  -- 0 = domingo ... 6 = sábado (mismo criterio que CustodySlot.weekday en
  -- packages/core/src/domain/entities.ts).
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null
);

create table if not exists public.custody_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('checkin', 'checkout')),
  scheduled_at timestamptz not null,
  confirmed_at timestamptz,
  location jsonb,
  created_at timestamptz not null default now()
);

-- Un convenio por familia en la Beta — un solo calendario compartido, no
-- uno por progenitor.
create unique index if not exists custody_agreements_family_unique
  on public.custody_agreements (family_id);

-- Soporta el upsert de confirmCheckin/confirmCheckout (un progenitor
-- confirma a lo más una vez el mismo check-in/check-out programado).
create unique index if not exists custody_events_unique_slot_instance
  on public.custody_events (child_id, parent_id, type, scheduled_at);

alter table public.custody_agreements enable row level security;
alter table public.custody_slots enable row level security;
alter table public.custody_events enable row level security;

-- custody_agreements: lectura y escritura para miembros de la familia
-- (ambos progenitores definen el convenio juntos).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_agreements'
      and policyname = 'custody_agreements: miembros de la familia leen su convenio'
  ) then
    create policy "custody_agreements: miembros de la familia leen su convenio"
      on public.custody_agreements for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = custody_agreements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_agreements'
      and policyname = 'custody_agreements: miembros de la familia crean su convenio'
  ) then
    create policy "custody_agreements: miembros de la familia crean su convenio"
      on public.custody_agreements for insert with check (
        exists (
          select 1 from public.family_members m
          where m.family_id = custody_agreements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_agreements'
      and policyname = 'custody_agreements: miembros de la familia actualizan su convenio'
  ) then
    create policy "custody_agreements: miembros de la familia actualizan su convenio"
      on public.custody_agreements for update using (
        exists (
          select 1 from public.family_members m
          where m.family_id = custody_agreements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;

-- custody_slots: lectura y escritura para miembros de la familia del hijo —
-- se llega a la familia vía el convenio (agreement_id -> family_id), igual
-- que "messages" llega a su familia vía chat_threads en 0002_chat.sql.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_slots'
      and policyname = 'custody_slots: miembros de la familia leen los slots'
  ) then
    create policy "custody_slots: miembros de la familia leen los slots"
      on public.custody_slots for select using (
        exists (
          select 1 from public.custody_agreements a
          join public.family_members m on m.family_id = a.family_id
          where a.id = custody_slots.agreement_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_slots'
      and policyname = 'custody_slots: miembros de la familia crean slots'
  ) then
    create policy "custody_slots: miembros de la familia crean slots"
      on public.custody_slots for insert with check (
        exists (
          select 1 from public.custody_agreements a
          join public.family_members m on m.family_id = a.family_id
          where a.id = custody_slots.agreement_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_slots'
      and policyname = 'custody_slots: miembros de la familia borran slots'
  ) then
    create policy "custody_slots: miembros de la familia borran slots"
      on public.custody_slots for delete using (
        exists (
          select 1 from public.custody_agreements a
          join public.family_members m on m.family_id = a.family_id
          where a.id = custody_slots.agreement_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;

-- custody_events: lectura para miembros de la familia del hijo; escritura
-- (insert/update, para el upsert de confirmar) solo para el parent_id dueño
-- del evento — cada progenitor confirma su propio check-in/check-out,
-- nunca el del otro.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_events'
      and policyname = 'custody_events: miembros de la familia leen eventos'
  ) then
    create policy "custody_events: miembros de la familia leen eventos"
      on public.custody_events for select using (
        exists (
          select 1 from public.children c
          join public.family_members m on m.family_id = c.family_id
          where c.id = custody_events.child_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_events'
      and policyname = 'custody_events: el progenitor dueño confirma su propio evento'
  ) then
    create policy "custody_events: el progenitor dueño confirma su propio evento"
      on public.custody_events for insert with check (parent_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_events'
      and policyname = 'custody_events: el progenitor dueño actualiza su propio evento'
  ) then
    create policy "custody_events: el progenitor dueño actualiza su propio evento"
      on public.custody_events for update using (parent_id = auth.uid());
  end if;
end $$;
