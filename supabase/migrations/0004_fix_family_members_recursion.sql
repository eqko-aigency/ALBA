-- Corrige recursión infinita en la política de SELECT de family_members
-- (0001): la política se referenciaba a sí misma en una subconsulta, lo que
-- Postgres detecta como recursión infinita (42P17) apenas se evalúa,
-- independientemente de los datos. Se reemplaza por una función
-- security definer que, al correr con los privilegios del dueño de la
-- tabla, evita que la subconsulta interna vuelva a disparar RLS — mismo
-- patrón ya usado en link_creator_to_family() y accept_invitation().

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = target_family_id and parent_id = auth.uid()
  );
$$;

drop policy "family_members: miembros ven a los demás miembros de su familia" on public.family_members;

create policy "family_members: miembros ven a los demás miembros de su familia"
  on public.family_members for select using (
    parent_id = auth.uid()
    or public.is_family_member(family_id)
  );
