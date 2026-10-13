-- Notificaciones (W-xx) — feed de actividad reciente dentro de la app
-- (no son push notifications del sistema operativo, eso es infraestructura
-- aparte). El feed en sí NO se guarda en una tabla propia: se arma al
-- vuelo (apps/web/src/lib/notifications.ts) juntando eventos que YA tienen
-- timestamp confiable en sus tablas (gastos, pagos de pensión,
-- documentos, acuerdos verbales, check-ins/check-outs). Lo único nuevo acá
-- es dónde guardar "hasta qué momento ya viste tus notificaciones", para
-- poder marcar cuáles son nuevas sin una tabla de lectura por notificación.
alter table public.profiles
  add column if not exists last_notifications_seen_at timestamptz;
