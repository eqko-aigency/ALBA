-- Chat: hilos por tema y mensajes, filtrados por family_id (nunca por
-- progenitor individual), según docs/design/ALBA-UI-REFERENCE.md.
-- El Tone Meter y el hash de evidencia son features separadas — no viven
-- en este schema todavía.

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  topic text not null check (char_length(topic) between 2 and 60),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.chat_threads enable row level security;
alter table public.messages enable row level security;

create policy "chat_threads: miembros de la familia ven sus hilos"
  on public.chat_threads for select using (
    exists (
      select 1 from public.family_members m
      where m.family_id = chat_threads.family_id and m.parent_id = auth.uid()
    )
  );
create policy "chat_threads: miembros de la familia crean hilos"
  on public.chat_threads for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.family_members m
      where m.family_id = chat_threads.family_id and m.parent_id = auth.uid()
    )
  );

-- messages no guarda family_id directamente — se llega a él vía el hilo,
-- que sí lo tiene. Evita duplicar la columna y mantenerla sincronizada.
create policy "messages: miembros de la familia leen sus mensajes"
  on public.messages for select using (
    exists (
      select 1 from public.chat_threads t
      join public.family_members m on m.family_id = t.family_id
      where t.id = messages.thread_id and m.parent_id = auth.uid()
    )
  );
create policy "messages: miembros de la familia envían mensajes"
  on public.messages for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_threads t
      join public.family_members m on m.family_id = t.family_id
      where t.id = messages.thread_id and m.parent_id = auth.uid()
    )
  );
