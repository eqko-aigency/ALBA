-- La única policy de SELECT en profiles (0001) es "auth.uid() = id" — cada
-- quien solo puede leer su PROPIO perfil. Eso rompe en silencio cualquier
-- lugar donde se quiere mostrar el nombre del OTRO progenitor: el embed
-- `family_members.select("parent_id, profiles(full_name)")` (listFamilyMembers
-- en supabasePairingRepository.ts) nunca puede leer la fila de profiles del
-- otro miembro, así que el join vuelve null y cae al fallback "Progenitor" —
-- confirmado en producción: un progenitor real ya vinculado veía
-- "✓ Vinculado con Progenitor" en vez del nombre real de su pareja. Afecta
-- también al nombre mostrado en el Dashboard ("Próxima visita") y en
-- notificaciones, no solo al chip de vinculación.
--
-- Se agrega una policy adicional (no se reemplaza la existente — las
-- policies permisivas de un mismo comando se combinan con OR) que deja ver
-- el perfil de cualquiera que comparta una family_id con el caller.
-- Reutiliza is_family_member() (0004), ya security definer para evitar la
-- recursión de RLS que tuvo family_members — acá no hay riesgo de recursión
-- porque esta policy vive en profiles y solo consulta family_members, nunca
-- profiles de nuevo.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles: miembros de la misma familia se ven entre sí'
  ) then
    create policy "profiles: miembros de la misma familia se ven entre sí"
      on public.profiles for select
      using (
        exists (
          select 1 from public.family_members fm
          where fm.parent_id = profiles.id
            and public.is_family_member(fm.family_id)
        )
      );
  end if;
end $$;
