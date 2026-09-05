-- Registro de progenitores, hijos, y emparejamiento vía link de invitación.
-- Corresponde a la Etapa 1 (Beta): "Registro y usuarios" de la cotización formal.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Vínculo progenitor-hijo. Un hijo puede tener hasta dos progenitores vinculados;
-- se aplica en el flujo de aceptación de invitación, no aquí.
create table public.parent_child_links (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.parent_child_links enable row level security;
alter table public.invitations enable row level security;

create policy "profiles: dueño lee y actualiza su propio perfil"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: el usuario crea su propio perfil"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: dueño actualiza su propio perfil"
  on public.profiles for update using (auth.uid() = id);

create policy "children: visibles para progenitores vinculados"
  on public.children for select using (
    exists (
      select 1 from public.parent_child_links l
      where l.child_id = children.id and l.parent_id = auth.uid()
    )
  );
create policy "children: el creador puede insertar"
  on public.children for insert with check (created_by = auth.uid());

create policy "parent_child_links: cada progenitor ve sus propios vínculos"
  on public.parent_child_links for select using (parent_id = auth.uid());

create policy "invitations: el creador ve y administra sus invitaciones"
  on public.invitations for select using (created_by = auth.uid());
create policy "invitations: el creador crea invitaciones de sus hijos"
  on public.invitations for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.parent_child_links l
      where l.child_id = invitations.child_id and l.parent_id = auth.uid()
    )
  );

-- El primer progenitor (creador del hijo) queda vinculado automáticamente.
create or replace function public.link_creator_to_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.parent_child_links (parent_id, child_id)
  values (new.created_by, new.id);
  return new;
end;
$$;

create trigger on_child_created
  after insert on public.children
  for each row execute function public.link_creator_to_child();

-- Aceptar una invitación vincula al segundo progenitor. Corre con privilegios
-- elevados porque el invitado todavía no tiene ningún vínculo (y por lo tanto
-- ninguna política de RLS le daría acceso a la invitación ni al hijo).
create or replace function public.accept_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_child_id uuid;
begin
  select child_id into target_child_id
  from public.invitations
  where token = invitation_token
    and status = 'pending'
    and expires_at > now();

  if target_child_id is null then
    raise exception 'invitación inválida o expirada';
  end if;

  insert into public.parent_child_links (parent_id, child_id)
  values (auth.uid(), target_child_id)
  on conflict do nothing;

  update public.invitations
  set status = 'accepted'
  where token = invitation_token;

  return target_child_id;
end;
$$;
