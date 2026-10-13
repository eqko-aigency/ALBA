-- Visitas puntuales (W-xx): pedido explícito de la clienta — agregar algo
-- como "ir al cine" el domingo 18 lo estaba marcando como custodia
-- recurrente TODOS los domingos, porque el único concepto que existía era
-- custody_slots (patrón semanal: weekday + hora, 0009_calendario.sql).
-- custody_visits vive en una FECHA EXACTA (visit_date), nunca se repite —
-- son dos conceptos distintos tanto en el llenado como en el calendario.
--
-- Mismo patrón de RLS que custody_slots: miembros de la familia leen/crean/
-- borran. family_id va directo en la fila (a diferencia de custody_events,
-- que llega a su familia vía child_id) porque acá no hace falta: una visita
-- no tiene convenio "dueño" al que colgarse, es independiente.

create table if not exists public.custody_visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  visit_date date not null,
  start_time time not null,
  end_time time not null,
  place_id uuid references public.meeting_places (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.custody_visits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_visits'
      and policyname = 'custody_visits: miembros de la familia leen sus visitas'
  ) then
    create policy "custody_visits: miembros de la familia leen sus visitas"
      on public.custody_visits for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = custody_visits.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_visits'
      and policyname = 'custody_visits: miembros de la familia crean visitas'
  ) then
    create policy "custody_visits: miembros de la familia crean visitas"
      on public.custody_visits for insert with check (
        parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = custody_visits.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custody_visits'
      and policyname = 'custody_visits: miembros de la familia borran visitas'
  ) then
    create policy "custody_visits: miembros de la familia borran visitas"
      on public.custody_visits for delete using (
        exists (
          select 1 from public.family_members m
          where m.family_id = custody_visits.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;
