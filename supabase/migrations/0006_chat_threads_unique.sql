-- Evita hilos duplicados (mismo topic + child_id dentro de la misma
-- familia) ante requests concurrentes. apps/web/.../chat/actions.ts hacía
-- un listThreads + chequeo en la app antes de crear, pero eso es
-- time-of-check-to-time-of-use: dos requests casi simultáneas pueden pasar
-- el chequeo antes de que cualquiera inserte. La garantía real tiene que
-- vivir en la base.
--
-- coalesce(child_id, '00000000-0000-0000-0000-000000000000') porque un
-- índice único normal trata cada NULL como distinto de los demás — sin
-- esto, "hilos generales" (child_id null) del mismo topic no quedarían
-- protegidos.

create unique index if not exists chat_threads_family_topic_child_unique
  on public.chat_threads (family_id, topic, coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid));
