-- Gastos básicos con comprobantes + balance. Un gasto cuelga de un hijo
-- (expenses.child_id -> children.id), que a su vez cuelga de una familia —
-- misma cadena de joins que ya usa la política de "children" en
-- 0001_registro_y_emparejamiento.sql (y "custody_events" en
-- 0009_calendario.sql). El motor de balance 50/50 vive en
-- packages/api-client (supabaseExpenseRepository.getBalance) — esta
-- migración solo define el schema, RLS y el bucket de Storage.
--
-- La regla de negocio "el pagador no puede aprobar ni rechazar su propio
-- gasto" se aplica acá vía RLS (política de UPDATE) y de nuevo en la capa
-- de repositorio (defensa en profundidad, mismo criterio que updateChild
-- en supabasePairingRepository.ts).
--
-- Idempotente de punta a punta (create table if not exists, políticas
-- guardadas con un chequeo contra pg_policies antes de crearlas, inserts
-- con "on conflict do nothing") — mismo criterio que 0005/0006/0009.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  paid_by_parent_id uuid not null references public.profiles (id) on delete cascade,
  amount_mxn numeric(12, 2) not null check (amount_mxn > 0),
  description text not null,
  receipt_url text,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'countered')),
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

do $$
begin
  -- Lectura: miembros de la familia del hijo (ambos progenitores ven todos
  -- los gastos de sus hijos, no solo los que ellos mismos pagaron).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'expenses'
      and policyname = 'expenses: miembros de la familia leen los gastos'
  ) then
    create policy "expenses: miembros de la familia leen los gastos"
      on public.expenses for select using (
        exists (
          select 1 from public.children c
          join public.family_members m on m.family_id = c.family_id
          where c.id = expenses.child_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Creación: cualquier miembro de la familia puede registrar un gasto que
  -- pagó él mismo (paid_by_parent_id siempre es el caller, nunca se puede
  -- registrar un gasto "a nombre" del otro progenitor).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'expenses'
      and policyname = 'expenses: miembros de la familia registran gastos'
  ) then
    create policy "expenses: miembros de la familia registran gastos"
      on public.expenses for insert with check (
        paid_by_parent_id = auth.uid()
        and exists (
          select 1 from public.children c
          join public.family_members m on m.family_id = c.family_id
          where c.id = expenses.child_id and m.parent_id = auth.uid()
        )
      );
  end if;

  -- Actualización de status (aprobar/rechazar/contraproponer): solo el
  -- progenitor de la familia que NO pagó el gasto — nadie se autoaprueba.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'expenses'
      and policyname = 'expenses: el progenitor que no pagó aprueba o rechaza'
  ) then
    create policy "expenses: el progenitor que no pagó aprueba o rechaza"
      on public.expenses for update using (
        paid_by_parent_id <> auth.uid()
        and exists (
          select 1 from public.children c
          join public.family_members m on m.family_id = c.family_id
          where c.id = expenses.child_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;

-- Comprobantes (receiptUrl) vía Supabase Storage. Se crea el bucket acá
-- directamente por SQL (insert en storage.buckets) porque el rol con el
-- que corren las migraciones de este proyecto tiene permisos sobre esa
-- tabla; si en algún ambiente NO los tuviera, el camino alterno es crear
-- el bucket "comprobantes" manualmente desde el dashboard de Supabase
-- (Storage → New bucket → marcarlo público) — el insert de abajo es
-- "on conflict do nothing", así que de todas formas no falla si el bucket
-- ya existe por ese camino.
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

-- storage.objects RLS para el bucket "comprobantes": cualquier usuario
-- autenticado puede subir un archivo (no se restringe por familia dentro
-- del bucket — el gasto en sí, con su receipt_url, ya queda protegido por
-- la RLS de la tabla "expenses" de arriba; el archivo de Storage no es más
-- sensible que esa URL, que de todas formas es visible para ambos
-- progenitores de la familia en cuanto el gasto se crea). Lectura pública
-- porque el bucket se creó público (necesario para que <img>/<a> en el
-- cliente puedan mostrar el comprobante sin pasar por un proxy firmado).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'comprobantes: usuarios autenticados suben su comprobante'
  ) then
    create policy "comprobantes: usuarios autenticados suben su comprobante"
      on storage.objects for insert with check (
        bucket_id = 'comprobantes' and auth.uid() is not null
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'comprobantes: lectura pública'
  ) then
    create policy "comprobantes: lectura pública"
      on storage.objects for select using (
        bucket_id = 'comprobantes'
      );
  end if;
end $$;
