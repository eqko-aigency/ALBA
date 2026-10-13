-- Mismo pedido que 0022 (Salud), extendido a Escuela y Notas especiales:
-- la clienta no quiere estar limitada a un único concepto fijo en ninguna
-- sección del perfil de hijo/a. "Contacto de la escuela" (un solo campo)
-- pasa a una lista de contactos escolares (rubro libre: Maestra, Dirección,
-- Psicóloga escolar...), y "Rutina de sueño"/"Otras notas" (dos campos
-- fijos) pasan a una lista de notas con etiqueta libre.
--
-- Igual que 0022: los datos existentes se migran a la lista nueva (no se
-- pierden) y las columnas viejas se eliminan después.

alter table public.children
  add column if not exists school_contacts jsonb not null default '[]'::jsonb,
  add column if not exists notes jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'children' and column_name = 'school_contact'
  ) then
    update public.children
    set school_contacts = jsonb_build_array(
      jsonb_build_object('role', 'Contacto escolar', 'name', school_contact, 'phone', '')
    )
    where school_contact is not null
      and length(trim(school_contact)) > 0
      and school_contacts = '[]'::jsonb;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'children' and column_name = 'sleep_routine'
  ) then
    update public.children
    set notes = notes || jsonb_build_array(jsonb_build_object('label', 'Rutina de sueño', 'text', sleep_routine))
    where sleep_routine is not null
      and length(trim(sleep_routine)) > 0;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'children' and column_name = 'special_notes'
  ) then
    update public.children
    set notes = notes || jsonb_build_array(jsonb_build_object('label', 'Notas', 'text', special_notes))
    where special_notes is not null
      and length(trim(special_notes)) > 0;
  end if;
end $$;

alter table public.children
  drop column if exists school_contact,
  drop column if exists sleep_routine,
  drop column if exists special_notes;
