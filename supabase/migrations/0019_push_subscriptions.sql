-- Push notifications reales (W-xx) — suscripción Web Push por dispositivo.
-- Cada fila es UN navegador/dispositivo donde un progenitor activó
-- notificaciones (puede tener varias: celular + compu). No cuelga de la
-- familia sino del progenitor — cada quien administra sus propios
-- dispositivos.
--
-- RLS acá solo cubre "ver/crear/borrar MIS propias suscripciones". Mandar
-- un push a el OTRO progenitor (que es el caso de uso real: notificarle a
-- Eugenia que Martín registró un gasto) necesita LEER la suscripción de
-- Eugenia desde el servidor de Martín — eso NINGUNA policy de RLS
-- razonable debería permitir desde el cliente. Por eso el envío
-- (apps/web/src/lib/push.ts, notifyFamilyMembers) usa el service_role key
-- de Supabase, que ignora RLS por completo, y nunca corre en el navegador.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions: cada quien ve sus propias suscripciones'
  ) then
    create policy "push_subscriptions: cada quien ve sus propias suscripciones"
      on public.push_subscriptions for select using (parent_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions: cada quien crea las suyas'
  ) then
    create policy "push_subscriptions: cada quien crea las suyas"
      on public.push_subscriptions for insert with check (parent_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions: cada quien borra las suyas'
  ) then
    create policy "push_subscriptions: cada quien borra las suyas"
      on public.push_subscriptions for delete using (parent_id = auth.uid());
  end if;
end $$;
