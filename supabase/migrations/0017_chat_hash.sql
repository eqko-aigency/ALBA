-- Hash por mensaje + sellado por conversación (W-xx) — pedido explícito de
-- la clienta: poder usar el chat como evidencia en juicio. Dos niveles:
--
-- 1) Cada mensaje lleva su propio SHA-256, calculado por la BASE DE DATOS
--    (columna GENERATED, no por la app) sobre id|thread_id|sender_id|body
--    — así el hash nunca depende de que el código de la app lo calcule
--    bien, y queda atado a un mensaje específico (su id, único e
--    inmutable), no solo al texto (dos mensajes con el mismo texto de
--    gente distinta dan hashes distintos). No se usa created_at acá: un
--    timestamptz no tiene una representación en texto "determinística"
--    para Postgres (depende de la zona horaria de la sesión), así que una
--    columna GENERATED que lo use revienta con "generation expression is
--    not immutable" (42P17) — el created_at del mensaje ya es una columna
--    propia, sin política de UPDATE/DELETE (igual que el resto de la
--    fila), así que no hace falta meterlo también dentro del hash para
--    que quede protegido contra alteraciones.
--
-- 2) Un hilo se puede "sellar" en cualquier momento: se calcula una raíz
--    Merkle (packages/core/src/evidence/merkleEngine.ts, mismo motor que
--    Bóveda) sobre los hashes de TODOS sus mensajes hasta ese momento, y se
--    guarda en chat_threads. Se puede volver a sellar más tarde para cubrir
--    mensajes nuevos — sealed_message_count dice cuántos mensajes cubre el
--    sello vigente, así la UI puede avisar "hay N mensajes nuevos sin
--    sellar" en vez de fingir que el sello sigue cubriendo todo.
--
-- Igual que documents/verbal_agreements/pension_payments, el sellado es
-- SECURITY DEFINER (seal_chat_thread) — es la única vía para tocar
-- merkle_root/anchor_reference/sealed_at/sealed_message_count. La policy
-- de UPDATE que ya tenía chat_threads (0013_chat_mejoras.sql, para
-- renombrar) sigue existiendo y en teoría permitiría tocar esas columnas
-- también por un update directo — RLS es por fila, no por columna, mismo
-- límite ya aceptado en el resto del proyecto (ver nota en
-- custody_slots/custody_events) — pero el repositorio de la app nunca las
-- toca por ahí, solo via rename (topic) o esta función.

create extension if not exists pgcrypto;

alter table public.messages
  add column if not exists sha256_hex text generated always as (
    encode(
      digest(id::text || '|' || thread_id::text || '|' || sender_id::text || '|' || body, 'sha256'),
      'hex'
    )
  ) stored;

alter table public.chat_threads
  add column if not exists merkle_root text,
  add column if not exists anchor_reference text,
  add column if not exists sealed_at timestamptz,
  add column if not exists sealed_message_count int not null default 0;

create or replace function public.seal_chat_thread(
  p_thread_id uuid,
  p_merkle_root text,
  p_anchor_reference text,
  p_message_count int
)
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.chat_threads;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.chat_threads where id = p_thread_id;
  if v_row is null then
    raise exception 'hilo no encontrado';
  end if;

  if not exists (
    select 1 from public.family_members m
    where m.family_id = v_row.family_id and m.parent_id = auth.uid()
  ) then
    raise exception 'no pertenece a esta familia';
  end if;

  update public.chat_threads
  set merkle_root = p_merkle_root,
      anchor_reference = p_anchor_reference,
      sealed_at = now(),
      sealed_message_count = p_message_count
  where id = p_thread_id
  returning * into v_row;

  return v_row;
end;
$$;
