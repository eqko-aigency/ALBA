create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'waitlist_signups'
      and policyname = 'waitlist_signups: cualquiera puede apuntarse'
  ) then
    create policy "waitlist_signups: cualquiera puede apuntarse"
      on public.waitlist_signups for insert
      with check (true);
  end if;
end $$;
