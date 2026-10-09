-- Etiquetado por hijo en el chat: un hilo puede aplicar a un hijo
-- específico o ser general para la familia (child_id null).
--
-- No se agrega una política de RLS nueva porque children y chat_threads ya
-- están acotados por family_id — un hilo con child_id de otra familia no
-- pasaría igual la política de children (child.family_id != auth family),
-- solo quedaría inconsistente en filtrado desde la app. Aceptable para el
-- alcance de la Beta; si esto se vuelve crítico, agregar un trigger que
-- valide children.family_id = chat_threads.family_id al insertar/actualizar.

alter table public.chat_threads
  add column child_id uuid references public.children (id) on delete set null;
