-- Lugares de encuentro (W-xx): catálogo reutilizable por familia (ej. "Casa
-- de Progenitor A", "Parque", "Cine") que se puede asociar a un slot del
-- convenio de Calendario. Mismo patrón de RLS que custody_agreements/
-- custody_slots (0009_calendario.sql): ambos progenitores de la familia
-- leen/crean/borran, no hay "dueño" individual.
--
-- Idempotente de punta a punta (create table if not exists, add column if
-- not exists, políticas guardadas con un chequeo contra pg_policies antes
-- de crearlas) — mismo criterio que el resto de las migraciones.

create table if not exists public.meeting_places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- on delete set null (no cascade): si se borra un lugar que ya estaba
-- asignado a un slot, el slot sigue existiendo, solo pierde el lugar —
-- igual que remove de un contacto no borra al hijo.
alter table public.custody_slots
  add column if not exists place_id uuid references public.meeting_places (id) on delete set null;

alter table public.meeting_places enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meeting_places'
      and policyname = 'meeting_places: miembros de la familia leen sus lugares'
  ) then
    create policy "meeting_places: miembros de la familia leen sus lugares"
      on public.meeting_places for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = meeting_places.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meeting_places'
      and policyname = 'meeting_places: miembros de la familia crean lugares'
  ) then
    create policy "meeting_places: miembros de la familia crean lugares"
      on public.meeting_places for insert with check (
        exists (
          select 1 from public.family_members m
          where m.family_id = meeting_places.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meeting_places'
      and policyname = 'meeting_places: miembros de la familia borran lugares'
  ) then
    create policy "meeting_places: miembros de la familia borran lugares"
      on public.meeting_places for delete using (
        exists (
          select 1 from public.family_members m
          where m.family_id = meeting_places.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;
