-- Guarda el mimeType que ya se recibía en uploadDocument (input.mimeType)
-- pero se descartaba después de subir el archivo — necesario para que el
-- selector de documentos de Custodia (W-xx) pueda filtrar PDF/imagen sin
-- adivinar por extensión del nombre de archivo. Documentos subidos antes
-- de esta migración quedan con mime_type null (se excluyen del selector,
-- sin romper nada en Bóveda, donde este campo no se usa).
alter table public.documents add column if not exists mime_type text;
