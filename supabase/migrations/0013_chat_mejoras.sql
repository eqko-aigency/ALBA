-- Chat: renombrar hilos, categorías libres y fotos (W-xx) — pedidos
-- explícitos de la clienta.

-- chat_threads nunca tuvo policy de UPDATE — hasta ahora el topic solo se
-- fijaba al crear el hilo y no se podía tocar después.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_threads'
      and policyname = 'chat_threads: miembros de la familia renombran sus hilos'
  ) then
    create policy "chat_threads: miembros de la familia renombran sus hilos"
      on public.chat_threads for update using (
        exists (
          select 1 from public.family_members m
          where m.family_id = chat_threads.family_id and m.parent_id = auth.uid()
        )
      );
  end if;
end $$;

-- Fotos en chat — columna nullable, no rompe mensajes existentes.
alter table public.messages
  add column if not exists attachment_url text;

insert into storage.buckets (id, name, public)
values ('chat-fotos', 'chat-fotos', true)
on conflict (id) do nothing;

-- Mismo criterio que "comprobantes" (0010_gastos.sql): cualquier usuario
-- autenticado puede subir, lectura pública porque el bucket es público y
-- <img> en el cliente necesita mostrarlo sin pasar por una URL firmada.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'chat-fotos: usuarios autenticados suben su foto'
  ) then
    create policy "chat-fotos: usuarios autenticados suben su foto"
      on storage.objects for insert with check (
        bucket_id = 'chat-fotos' and auth.uid() is not null
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'chat-fotos: lectura pública'
  ) then
    create policy "chat-fotos: lectura pública"
      on storage.objects for select using (
        bucket_id = 'chat-fotos'
      );
  end if;
end $$;
