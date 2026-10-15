# Lista de espera en el landing

## Contexto

Pedido de la clienta: una página **paralela** al landing público de ALBA, dedicada exclusivamente a una lista de espera ("waitlist") — un registro previo liviano (solo correo) para gente interesada. A diferencia del landing normal (`apps/web/src/app/page.tsx`, que sigue funcionando exactamente igual, con "Crear cuenta"/"Iniciar sesión"), esta página nueva **no ofrece la opción de crear cuenta ni de iniciar sesión** — es exclusivamente para apuntarse a la espera.

(Revisión 2026-10-15: el diseño original de este spec insertaba la sección de waitlist directamente en `page.tsx`, coexistiendo con "Crear cuenta". La clienta aclaró después que no era eso — quería una página aparte sin esas opciones. Esta versión del spec refleja esa corrección.)

## Alcance

**Incluye:**
- Una página nueva, en una ruta separada (`/lista-espera`), que reutiliza el contenido del landing (pain points, "Cómo ALBA ayuda", "Cómo funciona", "Confianza y evidencia", FAQ) pero **sin ningún link ni botón de "Crear cuenta" o "Iniciar sesión" en ninguna parte** (header, hero, footer) — en su lugar, el formulario de waitlist.
- Un formulario de un solo campo (correo).
- Guardar cada correo en una tabla nueva de Supabase.
- Confirmación visual al enviar: "¡Listo! Serás de los primeros en saber cuando la app esté lista."
- Manejo amable de correos repetidos ("Ya estás en la lista — te avisaremos.") en vez de un error genérico.
- Comportamiento seguro en modo demo local (sin Supabase configurado): la acción responde éxito sin intentar guardar nada.

**No incluye (alcance deliberadamente acotado):**
- No modifica `/` (el landing con "Crear cuenta"/"Iniciar sesión" normal) más allá de extraer sus secciones de contenido a componentes compartidos para poder reutilizarlas en `/lista-espera` sin duplicar el JSX — el landing normal se ve y funciona exactamente igual que hoy.
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

### 5. Dónde vive: página nueva y separada, `/lista-espera`

El contenido intermedio del landing (pain points, "Cómo ALBA ayuda", "Cómo funciona", "Confianza y evidencia", FAQ) se extrae de `apps/web/src/app/page.tsx` a componentes compartidos nuevos (ej. `apps/web/src/components/landing/*.tsx`), cada uno con su propio arreglo de datos ya existente (`PAIN_POINTS`, `FEATURES`, `STEPS`, `FAQ`) movido junto con su sección — así `/` los sigue usando tal cual (sin cambios visibles) y `/lista-espera` los reutiliza sin duplicar JSX.

`apps/web/src/app/lista-espera/page.tsx` (nuevo) se arma así:
- **Header propio**: solo el wordmark (enlazando a `/`), sin "Iniciar sesión" ni "Crear cuenta".
- **Hero propio**: mismo mensaje central que el landing normal, pero sin los botones "Iniciar sesión"/"Crear cuenta →" ni el footnote "Gratis para crear tu cuenta...". En su lugar, un enlace ancla hacia el formulario de waitlist más abajo.
- Las cinco secciones compartidas (pain points → FAQ), sin cambios.
- **Sección de waitlist** (en vez del "CTA final" del landing normal): el formulario de un campo, con la confirmación "¡Listo! Serás de los primeros en saber cuando la app esté lista."
- **Footer propio**: wordmark + tagline + copyright, sin links de "Iniciar sesión"/"Crear cuenta".

`/` (el landing normal) no cambia su apariencia ni comportamiento — solo su implementación interna pasa a usar los componentes compartidos.

## Testing

- Verificación en vivo contra Supabase real, en `/lista-espera`: enviar un correo nuevo → confirmar que aparece la fila en `waitlist_signups` y que la UI muestra el mensaje de éxito.
- Reenviar el mismo correo → confirmar que se muestra "Ya estás en la lista — te avisaremos." y que NO se crea una segunda fila.
- Enviar un correo con formato inválido → confirmar que se muestra "Escribe un correo válido." sin tocar la base.
- Confirmar en modo demo local (sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`) que el formulario muestra éxito sin tronar, aunque no haya nada real guardado.
- Confirmar que `/lista-espera` no tiene en ninguna parte un link a "Crear cuenta" ni a "Iniciar sesión".
- Confirmar que `/` se ve y funciona exactamente igual que antes del refactor (regresión visual/funcional del landing normal).
