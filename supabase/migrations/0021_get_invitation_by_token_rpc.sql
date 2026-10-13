-- getInvitationByToken (usado por /invitacion/[token], la página pública
-- que ve un progenitor invitado) corría como un SELECT directo sujeto a
-- RLS ("invitations: miembros de la familia ven sus invitaciones", en
-- 0001_registro_y_emparejamiento.sql) — política que exige ya ser miembro
-- de esa familia. Un progenitor invitado que todavía no tiene cuenta (el
-- caso normal: justo a quien va dirigido el link) nunca pasa esa política,
-- así que la página siempre mostraba "Invitación no encontrada" aunque el
-- link fuera válido — RLS filtraba la fila a cero resultados antes de que
-- la página pudiera siquiera revisar el token.
--
-- Mismo patrón que accept_invitation (0001): una función SECURITY DEFINER
-- hace el lookup por token EXACTO con privilegios elevados, sin abrir una
-- política de SELECT pública sobre toda la tabla (que expondría el listado
-- completo de invitaciones/tokens de todas las familias a cualquiera).
create or replace function public.get_invitation_by_token(invitation_token uuid)
returns table (
  id uuid,
  token uuid,
  family_id uuid,
  created_by uuid,
  status text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.token, i.family_id, i.created_by, i.status, i.expires_at
  from public.invitations i
  where i.token = invitation_token;
$$;
