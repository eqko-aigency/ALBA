-- "Salud" del hijo/a pasa de un campo fijo (terapeuta_nombre/teléfono) a
-- una lista libre de profesionales — pedido explícito de la clienta: poder
-- agregar Pediatra, Dentista, etc., no solo Terapeuta. Mismo patrón que
-- "contacts" (jsonb array), agregado en 0012_onboarding_y_hijo_detalle.sql.
--
-- Los datos existentes de therapist_name/therapist_phone se migran a la
-- nueva lista como un registro "Terapeuta" (no se pierden), y las columnas
-- viejas se eliminan después — ya no las usa ningún código.

alter table public.children
  add column if not exists health_providers jsonb not null default '[]'::jsonb;

-- Backfill con SQL dinámico, condicionado a que therapist_name todavía
-- exista — si esta migración ya corrió antes (la columna ya fue eliminada
-- más abajo), referenciarla directo en un UPDATE estático rompería la
-- idempotencia: el error sería de parseo (columna inexistente), no algo
-- que el "if not exists"/where guarde en runtime.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'children' and column_name = 'therapist_name'
  ) then
    update public.children
    set health_providers = jsonb_build_array(
      jsonb_build_object(
        'role', 'Terapeuta',
        'name', therapist_name,
        'phone', coalesce(therapist_phone, '')
      )
    )
    where therapist_name is not null
      and length(trim(therapist_name)) > 0
      and health_providers = '[]'::jsonb;
  end if;
end $$;

alter table public.children
  drop column if exists therapist_name,
  drop column if exists therapist_phone;
