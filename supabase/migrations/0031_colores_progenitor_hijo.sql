-- Color fijo por persona (Calendario) — reemplaza el acento relativo
-- "tú vs. el otro progenitor". null = todavía no eligió uno (ver spec,
-- sección 3, fallback).
alter table public.profiles add column if not exists color text;
alter table public.children add column if not exists color text;
