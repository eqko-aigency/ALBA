alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists onboarding_name_confirmed_at timestamptz;
