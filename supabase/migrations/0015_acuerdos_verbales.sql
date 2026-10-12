-- Acuerdos verbales (W-xx) — pedido explícito de la clienta: registro
-- liviano de algo que los progenitores acordaron de palabra (teléfono, en
-- persona), sin archivo. Cuelga de la FAMILIA, mismo criterio que
-- "documents" (0011_boveda.sql) y "custody_agreements" (0009_calendario.sql).
--
-- Igual que "documents", es INMUTABLE una vez creado — solo vale como
-- registro si nadie puede editarlo después de que ya se acordó algo. La
-- única escritura posterior permitida es "confirmar" (el OTRO progenitor
-- deja constancia de que también lo recuerda así), nunca por quien lo
-- creó. Deliberadamente NO hay política de UPDATE directa — confirmar pasa
-- por confirm_verbal_agreement() (SECURITY DEFINER), mismo patrón que
-- anchor_pending_documents().

create table if not exists public.verbal_agreements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  created_by_parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  description text not null check (char_length(description) between 5 and 1000),
  agreed_at date not null,
  confirmed_by_parent_id uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.verbal_agreements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'verbal_agreements'
      and policyname = 'verbal_agreements: miembros de la familia leen los acuerdos'
  ) then
    create policy "verbal_agreements: miembros de la familia leen los acuerdos"
      on public.verbal_agreements for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = verbal_agreements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'verbal_agreements'
      and policyname = 'verbal_agreements: miembros de la familia registran acuerdos'
  ) then
    create policy "verbal_agreements: miembros de la familia registran acuerdos"
      on public.verbal_agreements for insert with check (
        created_by_parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = verbal_agreements.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Deliberadamente NO hay política de UPDATE ni DELETE — ver nota de
  -- inmutabilidad arriba.
end $$;

-- confirm_verbal_agreement(): única escritura posterior permitida.
-- Acotada a: el caller es miembro de la familia del acuerdo, el caller NO
-- es quien lo creó, y el acuerdo todavía no estaba confirmado — así nunca
-- se puede pisar una confirmación existente ni autoconfirmarse.
create or replace function public.confirm_verbal_agreement(p_agreement_id uuid)
returns public.verbal_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.verbal_agreements;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.verbal_agreements where id = p_agreement_id;

  if v_row is null then
    raise exception 'acuerdo no encontrado';
  end if;

  if not exists (
    select 1 from public.family_members m
    where m.family_id = v_row.family_id and m.parent_id = auth.uid()
  ) then
    raise exception 'no pertenece a esta familia';
  end if;

  if v_row.created_by_parent_id = auth.uid() then
    raise exception 'quien registró el acuerdo no puede confirmarlo';
  end if;

  if v_row.confirmed_at is not null then
    return v_row;
  end if;

  update public.verbal_agreements
  set confirmed_by_parent_id = auth.uid(),
      confirmed_at = now()
  where id = p_agreement_id
  returning * into v_row;

  return v_row;
end;
$$;
