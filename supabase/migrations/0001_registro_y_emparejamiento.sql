-- Registro, familias (vínculo entre progenitores) e hijos.
-- Corresponde a la Etapa 1 (Beta): "Registro y usuarios" de la cotización
-- formal, siguiendo el flujo de docs/design/ALBA-UI-REFERENCE.md — los
-- progenitores se emparejan primero como familia; los hijos se agregan
-- después, dentro de ese vínculo. Todas las tablas de datos (hijos, y más
-- adelante mensajes/gastos/eventos) se filtran por family_id, nunca por
-- progenitor individual.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Cada progenitor pertenece a lo más a una familia en la Beta (vínculo 1 a 1
-- entre los dos progenitores). El diseño permite más de dos filas por
-- family_id si en el futuro se soportan configuraciones distintas.
create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, parent_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.invitations enable row level security;

create policy "profiles: dueño lee su propio perfil"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: el usuario crea su propio perfil"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: dueño actualiza su propio perfil"
  on public.profiles for update using (auth.uid() = id);

create policy "families: miembros pueden ver su familia"
  on public.families for select using (
    exists (
      select 1 from public.family_members m
      where m.family_id = families.id and m.parent_id = auth.uid()
    )
  );
create policy "families: cualquier usuario autenticado puede crear una"
  on public.families for insert with check (created_by = auth.uid());

create policy "family_members: miembros ven a los demás miembros de su familia"
  on public.family_members for select using (
    parent_id = auth.uid()
    or family_id in (select family_id from public.family_members where parent_id = auth.uid())
  );

create policy "children: visibles para miembros de la familia"
  on public.children for select using (
    exists (
      select 1 from public.family_members m
      where m.family_id = children.family_id and m.parent_id = auth.uid()
    )
  );
create policy "children: miembros de la familia pueden agregar hijos"
  on public.children for insert with check (
    exists (
      select 1 from public.family_members m
      where m.family_id = children.family_id and m.parent_id = auth.uid()
    )
  );
create policy "children: miembros de la familia pueden actualizar"
  on public.children for update using (
    exists (
      select 1 from public.family_members m
      where m.family_id = children.family_id and m.parent_id = auth.uid()
    )
  );

create policy "invitations: miembros de la familia ven sus invitaciones"
  on public.invitations for select using (
    exists (
      select 1 from public.family_members m
      where m.family_id = invitations.family_id and m.parent_id = auth.uid()
    )
  );
create policy "invitations: miembros de la familia pueden invitar"
  on public.invitations for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.family_members m
      where m.family_id = invitations.family_id and m.parent_id = auth.uid()
    )
  );

-- El creador de una familia queda vinculado automáticamente como su primer miembro.
create or replace function public.link_creator_to_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_members (family_id, parent_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger on_family_created
  after insert on public.families
  for each row execute function public.link_creator_to_family();

-- Aceptar una invitación vincula al segundo progenitor a la familia. Corre
-- con privilegios elevados porque el invitado todavía no es miembro (y por
-- lo tanto ninguna política de RLS le daría acceso a la invitación).
create or replace function public.accept_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
begin
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
