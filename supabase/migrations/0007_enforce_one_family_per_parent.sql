-- 0001 documenta en un comentario que "cada progenitor pertenece a lo más
-- a una familia en la Beta", pero nada lo hacía cumplir: family_members
-- solo tenía primary key (family_id, parent_id), que no impide que el
-- mismo parent_id aparezca en más de una family_id. accept_invitation()
-- dejaba que alguien ya emparejado aceptara una segunda invitación y
-- quedara en dos familias a la vez.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'family_members_parent_id_unique') then
    alter table public.family_members add constraint family_members_parent_id_unique unique (parent_id);
  end if;
end $$;

-- Con el constraint de arriba, el "on conflict do nothing" original de
-- accept_invitation() también se dispararía ante ESTE conflicto (no solo
-- ante aceptar la misma invitación dos veces) — eso haría que la función
-- devolviera target_family_id como si el join hubiera funcionado, cuando
-- en realidad no se insertó nada y el progenitor se quedó en su familia
-- original. Se agrega un chequeo explícito para fallar fuerte en vez de
-- mentir en silencio.
create or replace function public.accept_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
begin
  if exists (select 1 from public.family_members where parent_id = auth.uid()) then
    raise exception 'ya perteneces a una familia';
  end if;

  select family_id into target_family_id
  from public.invitations
  where token = invitation_token
    and status = 'pending'
    and expires_at > now();

  if target_family_id is null then
    raise exception 'invitación inválida o expirada';
  end if;

  insert into public.family_members (family_id, parent_id)
  values (target_family_id, auth.uid())
  on conflict do nothing;

  update public.invitations
  set status = 'accepted'
  where token = invitation_token;

  return target_family_id;
end;
$$;
