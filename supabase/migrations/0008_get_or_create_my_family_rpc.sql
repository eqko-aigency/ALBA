-- get_or_create_my_family(): mueve la creación de "families" a una función
-- SECURITY DEFINER, igual que accept_invitation(). El insert directo desde
-- el cliente (createSupabasePairingRepository.getOrCreateMyFamily) venía
-- fallando en producción con 42501 / auth_user: null pese a que la sesión
-- se validaba correctamente vía getUser() — algo en cómo @supabase/ssr y
-- supabase-js propagan esa sesión a cada request de postgrest no estaba
-- siendo confiable dentro de un Server Component. Leer auth.uid() DENTRO
-- de la función, en vez de depender de que el INSERT del cliente llegue
-- con el Authorization header correcto, evita ese problema por completo.
create or replace function public.get_or_create_my_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_family_id uuid;
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select family_id into existing_family_id
  from public.family_members
  where parent_id = auth.uid();

  if existing_family_id is not null then
    return existing_family_id;
  end if;

  insert into public.families (created_by)
  values (auth.uid())
  returning id into new_family_id;

  return new_family_id;
end;
$$;
