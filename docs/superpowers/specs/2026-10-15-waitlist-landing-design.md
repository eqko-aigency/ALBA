# Lista de espera en el landing

## Contexto

Pedido de la clienta: agregar una sección de lista de espera ("waitlist") al landing público de ALBA (`apps/web/src/app/page.tsx`) — un registro previo liviano (solo correo) para gente interesada, independiente del flujo de "Crear cuenta" que ya existe y sigue funcionando igual.

## Alcance

**Incluye:**
- Una sección nueva en el landing con un formulario de un solo campo (correo).
- Guardar cada correo en una tabla nueva de Supabase.
- Confirmación visual al enviar: "¡Listo! Serás de los primeros en saber cuando la app esté lista."
- Manejo amable de correos repetidos ("Ya estás en la lista — te avisaremos.") en vez de un error genérico.
- Comportamiento seguro en modo demo local (sin Supabase configurado): la acción responde éxito sin intentar guardar nada.

**No incluye (alcance deliberadamente acotado):**
- No reemplaza ni modifica "Crear cuenta" — ambos caminos coexisten en el landing.
- No manda ningún correo de confirmación automático (requeriría la misma configuración SMTP que ya dio problemas esta semana — queda fuera).
- No agrega ninguna pantalla dentro de ALBA para ver/exportar la lista — se revisa directo en el Table Editor de Supabase.
- No pide teléfono ni nombre, solo correo.
- No pasa por el patrón de repositorios (`PairingRepository`, etc.) que usa el resto de la app — ese patrón existe para datos atados a un progenitor ya logueado; esto es un formulario público y anónimo, sin sesión.

## Diseño

### 1. Tabla nueva en Supabase

Migración nueva (`0027_waitlist.sql`):

```sql
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'waitlist_signups'
      and policyname = 'waitlist_signups: cualquiera puede apuntarse'
  ) then
    create policy "waitlist_signups: cualquiera puede apuntarse"
      on public.waitlist_signups for insert
      with check (true);
  end if;
end $$;
```

Sin policy de `select` para `anon`/`authenticated` — nadie puede leer la lista desde el cliente, solo insertar. La única forma de verla es desde el dashboard de Supabase (Table Editor), con el `service_role` implícito ahí.

### 2. Validación

Nuevo schema en `packages/core/src/validation/schemas.ts`:

```ts
export const waitlistInputSchema = z.object({
  email: z.string().email(),
});
export type WaitlistInput = z.infer<typeof waitlistInputSchema>;
```

### 3. Server Action

Archivo nuevo `apps/web/src/app/waitlistActions.ts` (vive junto a `page.tsx`, no dentro de una carpeta de ruta porque no tiene una página propia):

```ts
"use server";

import { waitlistInputSchema } from "@alba/core";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/repository";

export async function joinWaitlistAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const parsed = waitlistInputSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Escribe un correo válido." };
  }

  // Sin Supabase configurado (dev local sin credenciales) no hay dónde
  // guardar — mismo criterio que uploadReceiptFile en repository.ts:
  // responde éxito sin persistir nada, para no romper el flujo de prueba.
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  // Cliente directo con el anon key, sin cookies ni sesión — a diferencia
  // de getRequestContext()/getAuthedSupabaseClient(), este formulario es
  // público y anónimo, no hay progenitor logueado al que atarlo.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await client.from("waitlist_signups").insert({ email: parsed.data.email });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya estás en la lista — te avisaremos." };
    }
    return { error: "No se pudo guardar tu correo. Intenta de nuevo." };
  }

  return { success: true };
}
```

### 4. Componente de UI

Client component nuevo `apps/web/src/app/WaitlistForm.tsx` (mismo criterio que `SignupForm.tsx`: estado local de pending/success/error):

- Un `<input type="email">` + botón "Unirme a la lista de espera".
- Línea de confianza debajo del formulario: "Nunca compartimos tu correo. Te escribimos solo cuando haya cupo disponible."
- Al enviar con éxito, el formulario se reemplaza por: **"¡Listo! Serás de los primeros en saber cuando la app esté lista."**
- Si el correo ya estaba registrado, se muestra el mensaje de error devuelto por la acción ("Ya estás en la lista — te avisaremos.") sin ocultar el formulario, para que puedan corregir si fue un typo.

### 5. Dónde vive en el landing

Nueva sección en `apps/web/src/app/page.tsx`, entre "Preguntas frecuentes" y el CTA final ("Empieza hoy") — visible sin competir con "Crear cuenta", que sigue siendo el CTA principal en header/hero/CTA final.

## Testing

- Verificación en vivo contra Supabase real: enviar un correo nuevo → confirmar que aparece la fila en `waitlist_signups` y que la UI muestra el mensaje de éxito.
- Reenviar el mismo correo → confirmar que se muestra "Ya estás en la lista — te avisaremos." y que NO se crea una segunda fila.
- Enviar un correo con formato inválido → confirmar que se muestra "Escribe un correo válido." sin tocar la base.
- Confirmar en modo demo local (sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`) que el formulario muestra éxito sin tronar, aunque no haya nada real guardado.
