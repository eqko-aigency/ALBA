-- Avatares ilustrados (selección propia, spec rediseño shell visual,
-- sección 7) y modales "Así funciona" vistos por sección (sección 5).
-- Ambas aditivas, mismo criterio que 0031 (color: columna simple sin
-- check constraint en SQL — se valida en la capa Zod con AVATAR_KEYS).
-- No hace falta tocar RLS: las políticas de UPDATE de profiles/children
-- ya cubren "el dueño actualiza su propia fila", sin restringir columnas.

alter table public.profiles add column if not exists avatar_key text;
alter table public.children add column if not exists avatar_key text;
alter table public.profiles add column if not exists seen_intros jsonb not null default '[]'::jsonb;
