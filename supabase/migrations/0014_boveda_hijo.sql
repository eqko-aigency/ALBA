-- Bóveda: categorizar documento por hijo (W-xx) — pedido explícito de la
-- clienta. Nullable: un documento puede seguir siendo "de la familia"
-- (ej. convenio general) sin un hijo específico asociado. Se fija al
-- subir el documento — no hace falta política de UPDATE nueva, los
-- documentos siguen siendo inmutables (ver 0011_boveda.sql).
alter table public.documents
  add column if not exists child_id uuid references public.children (id) on delete set null;
