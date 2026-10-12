-- Onboarding (W-xx): modo de uso elegido por el progenitor al entrar por
-- primera vez — determina si se lo manda a emparejar (bilateral) o directo
-- al dashboard (unilateral). Nullable: null = todavía no eligió.
alter table public.profiles
  add column if not exists usage_mode text check (usage_mode in ('unilateral', 'bilateral'));

-- Perfil de hijo extendido (W-xx) — pedido explícito de la clienta: contactos,
-- terapeuta, escuela, alergias y notas especiales (ej. "duerme con el conejo
-- azul", rutina de sueño). Todas nullable/con default vacío porque son datos
-- opcionales que se van completando con el tiempo, no en el alta inicial.
-- RLS: no hace falta policy nueva — las políticas de 0001 son por fila
-- (dueño de la familia), no por columna, así que ya cubren estos campos.
alter table public.children
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists therapist_name text,
  add column if not exists therapist_phone text,
  add column if not exists school_name text,
  add column if not exists school_contact text,
  add column if not exists allergies text,
  add column if not exists special_notes text,
  add column if not exists sleep_routine text;
