-- Lugares de encuentro: falta la política de UPDATE sobre meeting_places.
-- 0020_lugares_encuentro.sql creó políticas de select, insert y delete, pero
-- no de update. Con RLS activo (anon-key), un .update() sobre esta tabla
-- matchea cero filas y falla en silencio. Esta migración agrega la política
-- que faltaba, con el mismo criterio de familia que el resto de la tabla
-- (cualquier miembro de la familia puede editar sus lugares).
--
-- Idempotente — mismo patrón de chequeo contra pg_policies que 0020.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meeting_places'
      and policyname = 'meeting_places: miembros de la familia actualizan lugares'
  ) then
    create policy "meeting_places: miembros de la familia actualizan lugares"
      on public.meeting_places for update using (
        exists (
          select 1 from public.family_members m
          where m.family_id = meeting_places.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;
