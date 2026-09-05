# Supabase — ALBA

El proyecto de Supabase vive en la cuenta de la clienta (no en la de EQKO —
ver el anexo de costos operativos de la cotización). Pasos para conectarlo:

1. Crear el proyecto en https://supabase.com/dashboard (plan gratuito alcanza
   para la Beta, según el anexo de costos).
2. Aplicar las migraciones de `migrations/` en orden, vía el SQL Editor del
   dashboard o con `supabase db push` si se linkea el CLI localmente.
3. Copiar `Project URL` y `anon public key` (Settings → API) a
   `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. La `service_role key` **nunca** va en `.env.local` del cliente ni se
   comparte por chat — solo en variables de entorno server-side (Vercel /
   Edge Functions) el día que se necesite para el módulo de WhatsApp o el
   anclaje a blockchain.

## Migraciones

| Archivo | Contenido |
|---|---|
| `0001_registro_y_emparejamiento.sql` | `profiles`, `children`, `parent_child_links`, `invitations` + RLS + funciones de emparejamiento |
