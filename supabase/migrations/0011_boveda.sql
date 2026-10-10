-- Bóveda: "Documentos y acuerdos básicos" + "Evidencia digital — hash +
-- Merkle Tree + anclaje blockchain (POC)" de la cotización, combinados en
-- una sola sección. El hash SHA-256 se calcula en el servidor sobre los
-- bytes reales del archivo recién subido (packages/core/src/evidence/
-- merkleEngine.ts, computeSha256Hex) — nunca en el cliente (ver
-- README.md, "Reglas de arquitectura no negociables"). Un documento
-- cuelga de la FAMILIA (documents.family_id -> families.id), no de un
-- hijo ni solo del progenitor que lo subió — ambos progenitores deben
-- poder verlo, mismo criterio que custody_agreements en
-- 0009_calendario.sql.
--
-- Los documentos son evidencia: una vez subidos son INMUTABLES. A
-- diferencia de "expenses" (0010_gastos.sql), que sí tiene política de
-- UPDATE para aprobar/rechazar, acá deliberadamente NO hay política de
-- UPDATE ni DELETE sobre "documents" — ni siquiera quien subió el
-- documento puede modificarlo o borrarlo después. El "anclaje" (Merkle
-- Tree + referencia de blockchain POC) necesita tocar merkle_root/
-- anchor_status/anchor_reference igual, así que se resuelve con una
-- función SECURITY DEFINER acotada (anchor_pending_documents, al final de
-- este archivo) que solo puede escribir esas tres columnas — nunca
-- title/file_url/sha256_hex — y solo sobre documentos "pending" de la
-- familia del caller. Mismo criterio de SECURITY DEFINER que
-- get_or_create_my_family() en 0008_get_or_create_my_family_rpc.sql, que
-- fue el patrón de respaldo documentado para cuando un insert/update
-- directo choca con RLS 42501 pese a sesión válida.
--
-- El insert de "documents" en sí (subir un documento nuevo) SÍ sigue el
-- patrón normal de RLS (insert directo desde el cliente, como
-- children/invitations/chat/custody_events/expenses) — no hizo falta RPC
-- para eso; esa anomalía fue específica del insert en "families".
--
-- Idempotente de punta a punta (create table if not exists, políticas
-- guardadas con un chequeo contra pg_policies antes de crearlas, inserts
-- con "on conflict do nothing", create or replace function) — mismo
-- criterio que 0005/0006/0009/0010.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  uploaded_by_parent_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  file_url text not null,
  sha256_hex text not null,
  merkle_root text,
  anchor_status text not null default 'pending' check (anchor_status in ('pending', 'anchored')),
  anchor_reference text,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

do $$
begin
  -- Lectura: miembros de la familia (ambos progenitores ven todos los
  -- documentos de su familia, no solo los que ellos mismos subieron).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'documents: miembros de la familia leen los documentos'
  ) then
    create policy "documents: miembros de la familia leen los documentos"
      on public.documents for select using (
        exists (
          select 1 from public.family_members m
          where m.family_id = documents.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Creación: cualquier miembro de la familia puede subir un documento,
  -- siempre a nombre de sí mismo (uploaded_by_parent_id siempre es el
  -- caller, nunca se puede subir un documento "a nombre" del otro
  -- progenitor) — mismo criterio que paid_by_parent_id en expenses.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'documents: miembros de la familia suben documentos'
  ) then
    create policy "documents: miembros de la familia suben documentos"
      on public.documents for insert with check (
        uploaded_by_parent_id = auth.uid()
        and exists (
          select 1 from public.family_members m
          where m.family_id = documents.family_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Deliberadamente NO hay política de UPDATE ni DELETE — ver nota de
  -- inmutabilidad arriba. El anclaje usa anchor_pending_documents()
  -- (SECURITY DEFINER), no un UPDATE directo desde el cliente.
end $$;

-- Archivos de Bóveda vía Supabase Storage, bucket "documentos" (público,
-- mismo criterio que "comprobantes" en 0010_gastos.sql — necesario para
-- que el progenitor pueda ver/descargar el documento sin pasar por un
-- proxy firmado). A diferencia de "comprobantes", acá NO hay fallback de
-- URL manual en la UI: el archivo siempre se sube de verdad, porque el
-- hash SHA-256 se calcula sobre esos bytes server-side y no tiene sentido
-- sin el archivo real.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documentos: usuarios autenticados suben su documento'
  ) then
    create policy "documentos: usuarios autenticados suben su documento"
      on storage.objects for insert with check (
        bucket_id = 'documentos' and auth.uid() is not null
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documentos: lectura pública'
  ) then
    create policy "documentos: lectura pública"
      on storage.objects for select using (
        bucket_id = 'documentos'
      );
  end if;

  -- Sin política de UPDATE/DELETE sobre objetos del bucket "documentos" —
  -- mismo criterio de inmutabilidad que la tabla "documents".
end $$;

-- anchor_pending_documents(): POC de "anclaje" (Merkle Tree + referencia
-- de blockchain simulada) para TODOS los documentos "pending" de la
-- familia del caller. La raíz Merkle se calcula en código de aplicación
-- (packages/core/src/evidence/merkleEngine.ts, buildMerkleRoot) ANTES de
-- llamar a esta función — p_merkle_root y p_anchor_reference llegan ya
-- calculados; esta función SQL solo los persiste, nunca recalcula el
-- hash ella misma (sería lógica de negocio duplicada en dos lugares).
-- Es SECURITY DEFINER porque "documents" no tiene política de UPDATE
-- (inmutabilidad) — esta función es la ÚNICA puerta para tocar las
-- columnas de anclaje, y está acotada a las columnas de anclaje y a los
-- documentos "pending" de la familia de quien llama.
create or replace function public.anchor_pending_documents(
  p_merkle_root text,
  p_anchor_reference text
)
returns setof public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select family_id into v_family_id
  from public.family_members
  where parent_id = auth.uid();

  if v_family_id is null then
    return;
  end if;

  return query
    update public.documents
    set merkle_root = p_merkle_root,
        anchor_status = 'anchored',
        anchor_reference = p_anchor_reference
    where family_id = v_family_id
      and anchor_status = 'pending'
    returning *;
end;
$$;
