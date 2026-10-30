-- Fechas importantes (Calendario): rango de fecha sin hora, opcionalmente
-- ligado a un hijo — eventos recurrentes (cumpleaños, ciclo escolar) o
-- recordatorios libres que cualquiera de los dos progenitores agrega.
-- Mismo criterio de RLS que custody_visits/meeting_places (0024/0020): los
-- dos miembros de la familia leen/crean/borran, sin "dueño" individual.

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  title text not null,
  start_date date not null,
  end_date date not null,
  created_by_parent_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint important_dates_end_after_start check (end_date >= start_date)
);

alter table public.important_dates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'important_dates'
      and policyname = 'important_dates: miembros de la familia leen sus fechas'
  ) then
    create policy "important_dates: miembros de la familia leen sus fechas"
      on public.important_dates for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = important_dates.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'important_dates'
      and policyname = 'important_dates: miembros de la familia crean fechas'
  ) then
    create policy "important_dates: miembros de la familia crean fechas"
      on public.important_dates for insert with check (
        created_by_parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = important_dates.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'important_dates'
      and policyname = 'important_dates: miembros de la familia borran fechas'
  ) then
    create policy "important_dates: miembros de la familia borran fechas"
      on public.important_dates for delete using (
        exists (
          select 1 from public.family_members m
          where m.family_id = important_dates.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;
