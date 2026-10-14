-- Detección automática de acuerdos en el Chat (Fase 1, W-xx) — ver spec
-- docs/superpowers/specs/2026-10-13-deteccion-acuerdos-chat-design.md.
-- Guarda la sugerencia de acuerdo más reciente detectada en el hilo (una
-- sola a la vez, nunca varias acumuladas): cada mensaje nuevo sobreescribe
-- estas dos columnas, con null si el análisis más reciente dice que no hay
-- acuerdo. No hace falta tocar RLS — chat_threads ya tiene políticas de
-- select/update para miembros de la familia (0001/0017) que cubren
-- cualquier columna de la fila, no solo las que existían al crearlas.
alter table public.chat_threads
  add column if not exists pending_agreement_suggestion text,
  add column if not exists pending_agreement_suggestion_based_on uuid references public.messages (id) on delete set null;
