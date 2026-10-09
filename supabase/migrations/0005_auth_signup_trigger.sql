-- Crea automáticamente la fila en profiles cuando alguien se registra en
-- auth.users — hoy no existe ningún trigger para esto. Security definer
-- porque el usuario recién creado todavía no tiene permisos vía RLS sobre
-- public.profiles (mismo patrón que link_creator_to_family() y
-- accept_invitation() en 0001_registro_y_emparejamiento.sql).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

-- drop + create en vez de "create trigger" solo: create trigger no es
-- idempotente (a diferencia de create or replace function) y esta
-- migración se corrió parcialmente antes, dejando el trigger ya creado.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
