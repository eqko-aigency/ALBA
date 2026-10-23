# Wizard de bienvenida y emparejamiento visible

## Contexto

Fase 2 del feedback de la clienta ([Cambios 19-10-26](../../cambios/2026-10-19-cambios-191026.md), secciones 2 y 3). Hoy la usuaria entra directo al Dashboard tras crear su cuenta, sin que quede claro por dónde empezar, y el emparejamiento con el otro progenitor vive escondido en Perfil → "Vincular al otro progenitor".

Varias de las piezas que pide ya existen, sueltas:
- `/onboarding` ya pregunta "¿Cómo vas a usar ALBA?" (bilateral/unilateral) — el Dashboard ya redirige ahí cuando `profile.usageMode` es `null`.
- `/registro` ya hace "invitar al otro progenitor" (código + link, se genera solo) + "agregar hijo/a", y ya muestra "✓ Vinculado con {nombre}" cuando se acepta una invitación.
- El nombre completo ya se captura en el signup (`crear-cuenta`).

Este spec no construye estas piezas desde cero — las conecta en un wizard guiado y obligatorio, agrega una tarjeta de recordatorio en el Dashboard para quien ya pasó el wizard pero sigue sin emparejar, y agrega invitación por correo como canal nuevo.

## Alcance

**Incluye:**
- Wizard de 4 pasos obligatorio tras el signup: Nombre (confirmación) → Modo de uso → Hijos → Invitar (bilateral) o Número de WhatsApp (unilateral).
- Lógica de "a qué paso mandar" evaluada una vez por sesión nueva (no en cada navegación), para que "Hacerlo después" realmente deje avanzar durante esa sesión.
- Tarjeta no bloqueante en el Dashboard para quien ya pasó el wizard pero sigue sin emparejar — texto distinto para bilateral vs. unilateral.
- Invitación por correo (Resend API directo) como canal nuevo, además del código/link que ya existe — mismo link de invitación, no un dato nuevo que rastrear.
- Columna nueva `whatsapp_number` en `profiles`, recolectada en el paso de WhatsApp del wizard para modo unilateral.
- Nunca mostrar la ruta técnica `/registro` (ni ninguna otra) en texto visible a la usuaria.

**No incluye (alcance deliberadamente acotado):**
- La integración real de WhatsApp (recibir mensajes, número que ALBA provisiona, etc.) — eso es la Fase 4, con su propio brainstorming. Este wizard solo recolecta el número como dato para cuando esa fase se construya; el "cómo funciona de verdad" (de quién es el número, cómo llegan los mensajes a la app) se define ahí, no acá.
- Un tercer estado de invitación ("generada pero sin compartir" vs. "enviada") — se usan los dos estados que ya existen hoy (pendiente/aceptada), solo con mejor texto.
- Recordatorio persistente para "agregar hijos" fuera del wizard mismo (ver más abajo) — ya existe Perfil para agregarlos cuando quieran, una vez que salen del wizard.
- Rediseño visual de `/registro` como pantalla independiente — sus piezas (invitar, agregar hijo) se mueven dentro del wizard; la ruta `/registro` deja de ser el punto de entrada principal (ver Migración más abajo).

## Diseño

### 1. Estructura de rutas

El wizard vive bajo `/onboarding`, con un paso por sub-ruta:

- `/onboarding/nombre`
- `/onboarding/modo` (reemplaza el `/onboarding` actual de una sola pregunta)
- `/onboarding/hijos`
- `/onboarding/invitar` (si `usageMode === "bilateral"`)
- `/onboarding/whatsapp` (si `usageMode === "unilateral"`)

Cada paso es su propia página (Server Component que lee el estado actual + un form/Server Action para avanzar), siguiendo el patrón ya usado en el `/onboarding` actual. El formulario de "agregar hijo" y el bloque de "invitar" (código/link) que hoy viven en `/registro` se mueven a `/onboarding/hijos` y `/onboarding/invitar` respectivamente — no se reescriben, se reubican.

### 2. Lógica de "a qué paso mandar" (el gate)

Hoy el Dashboard redirige a `/onboarding` si `usageMode` es `null`, chequeado en cada carga del Dashboard. Esto se extiende a los demás pasos, pero **el chequeo completo del wizard corre una sola vez por sesión nueva**, no en cada navegación dentro de la misma sesión — así es como "Hacerlo después" tiene efecto real: te deja usar el resto de la app por el resto de esa sesión, aunque el paso siga "incompleto".

Implementación: un flag de sesión (ej. una cookie liviana `onboarding_checked`, puesta la primera vez que el gate corre después de iniciar sesión, con la misma duración que la sesión de Supabase) evita que el gate se re-evalúe en cada navegación. Al iniciar sesión de nuevo (nueva sesión), el flag no existe todavía y el gate vuelve a correr.

Orden de evaluación (el primer paso incompleto gana):
1. ¿`profile.onboarding_name_confirmed_at` es `null`? (el nombre en sí ya existe desde el signup, pero el paso de confirmación necesita su propio registro de "ya lo vi" — ver "Cambios de datos") → `/onboarding/nombre`
2. ¿`usageMode` es `null`? → `/onboarding/modo`
3. ¿Esta familia no tiene ningún hijo? → `/onboarding/hijos`
4. Si bilateral y no hay `otherParent` → `/onboarding/invitar`. Si unilateral y `whatsapp_number` es `null` → `/onboarding/whatsapp`
5. Si todo lo anterior está resuelto → Dashboard normal

Para el paso 1 (nombre), como el dato siempre existe (viene del signup) pero el paso es de *confirmación*, se necesita un flag aparte de que ya se vio — ver "Cambios de datos" abajo (`onboarding_name_confirmed_at`).

### 3. Los pasos, uno por uno

**Nombre** (`/onboarding/nombre`) — "Hola, {fullName} — ¿así está bien?" con un input editable precargado y un botón "Continuar". Guarda el nombre (si cambió) y marca `onboarding_name_confirmed_at = now()`. Obligatorio, un solo toque para continuar sin cambiar nada.

**Modo de uso** (`/onboarding/modo`) — contenido idéntico al `/onboarding` actual (las dos tarjetas bilateral/unilateral). Obligatorio.

**Hijos** (`/onboarding/hijos`) — el formulario de "Agregar hijo/a" que ya existe en `/registro`, más un botón secundario "Hacerlo después" que navega directo al siguiente paso sin agregar nada. Si ya hay al menos un hijo en la familia, este paso no se muestra. **Importante:** "Hacerlo después" NO marca el paso como completo de forma permanente — si en la siguiente sesión la familia todavía no tiene ningún hijo, el gate vuelve a mandar acá. No hay recordatorio de esto fuera del wizard (a diferencia del emparejamiento) porque Perfil ya es un lugar obvio para agregar hijos en cualquier momento.

**Invitar** (`/onboarding/invitar`, solo bilateral) — el bloque de código/link que ya existe en `/registro` (se genera solo si no hay invitación activa), más un campo de correo nuevo con botón "Mandar invitación por correo" (ver sección 5), más un botón secundario "Hacerlo después". Si ya hay `otherParent` (emparejado), este paso no se muestra — directo a Dashboard.

**WhatsApp** (`/onboarding/whatsapp`, solo unilateral) — un input de teléfono con copy explicando: "Déjanos tu número de WhatsApp — en cuanto esta función esté lista, el otro progenitor podrá escribir ahí y los mensajes llegarán a tu ALBA." Sin botón "Hacerlo después" (es un solo campo, obligatorio para avanzar). Guarda en `profiles.whatsapp_number`.

### 4. Tarjeta en Dashboard

Para quien ya completó el wizard (pasó por todos los pasos obligatorios o los saltó) pero sigue sin `otherParent`:

```
┌─────────────────────────────────────────┐
│  Invita a Sofía para empezar a compartir │   (bilateral)
│  [Invitar ahora →]                       │
└─────────────────────────────────────────┘
```
```
┌─────────────────────────────────────────┐
│  ¿Quieres invitar al otro progenitor?    │   (unilateral)
│  [Invitar →]                             │
└─────────────────────────────────────────┘
```

Si no hay nombre del otro progenitor disponible (nunca se generó invitación todavía), usa "el otro progenitor" en vez de un nombre. El botón lleva a `/onboarding/invitar` (reutiliza la misma pantalla, no una nueva). El banner no bloquea nada del resto del Dashboard y desaparece en cuanto `otherParent` existe.

### 5. Invitación por correo

Nueva Server Action `sendInvitationEmailAction(email: string)`, que:
1. Genera (o reutiliza, si ya hay una activa) la invitación igual que hoy (`pairing.createInvitation`).
2. Llama directo a la API HTTP de Resend (`https://api.resend.com/emails`, con `fetch` y el header `Authorization: Bearer ${RESEND_API_KEY}` — sin agregar el SDK `resend` como dependencia nueva, ya que un solo `fetch` basta) con un template simple en texto/HTML: "{fullName} te invitó a coordinarse en ALBA — [Aceptar invitación]({siteUrl}/invitacion/{token})".
3. Si `RESEND_API_KEY` no está configurada (dev local), la acción no falla — responde éxito sin mandar nada de verdad, mismo criterio que `isSupabaseConfigured` en otras partes del proyecto.

No se guarda ningún registro de "se mandó este correo" — es solo una forma más de entregar el mismo link/código que ya existe. El estado de la invitación (pendiente/aceptada) no cambia por este canal.

**Bloqueante para implementación:** esta pieza necesita `RESEND_API_KEY` configurada (nueva, separada del SMTP que usa Supabase Auth). El código se construye completo; el botón de "mandar por correo" puede implementarse y probarse en modo heurístico-éxito-sin-enviar hasta tener la key real, igual que se hizo con `ANTHROPIC_API_KEY` para Tone Meter.

### 6. Estados de invitación (sin cambios de modelo)

Se usan los dos estados que ya existen en la tabla `invitations` (`pending`/`accepted`), solo con texto más claro en la UI:
- `pending` → "Esperando respuesta" (cubre tanto "generé el código" como "mandé el correo" — no se distingue cuál).
- `accepted` → "✓ Vinculado con {nombre}" (ya existe tal cual en `/registro` hoy).

### 7. Cambios de datos

Migración nueva:

```sql
alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists onboarding_name_confirmed_at timestamptz;
```

- `whatsapp_number`: nullable, placeholder para la Fase 4 (WhatsApp modo unilateral). Sin validación de formato en esta fase — eso se define cuando se construya la integración real.
- `onboarding_name_confirmed_at`: nullable, marca que el usuario ya pasó por el paso de confirmación de nombre del wizard (el nombre en sí ya existe desde el signup — este campo es solo el "ya vi esta pantalla").

### 8. Migración de `/registro`

`/registro` deja de ser el punto de entrada principal — sus dos bloques (invitar, agregar hijo) ahora viven en `/onboarding/invitar` y `/onboarding/hijos`. La ruta `/registro` se mantiene por compatibilidad (por si hay links viejos compartidos) pero redirige a `/onboarding/invitar` si el usuario todavía no está emparejado, o a `/perfil` si ya lo está. El link "Vincular al otro progenitor" en Perfil se actualiza para apuntar a `/onboarding/invitar` en vez de `/registro`.

## Testing

- Verificación en vivo con una cuenta nueva: signup → wizard completo paso a paso (incluyendo "Hacerlo después" en hijos e invitar) → Dashboard con la tarjeta de emparejamiento visible.
- Cerrar sesión a la mitad del wizard (ej. después de modo de uso) y volver a entrar — confirmar que retoma en el siguiente paso pendiente, no desde cero.
- Confirmar que "Hacerlo después" en hijos deja pasar esa sesión, pero una sesión nueva (logout/login) vuelve a mandar a ese paso si la familia sigue sin hijos.
- Confirmar que el banner del Dashboard muestra el texto correcto según bilateral/unilateral, y que desaparece al aceptar una invitación.
- Probar el envío de correo con `RESEND_API_KEY` real (cuando esté disponible) contra una cuenta de prueba real — confirmar que el link funciona igual que el código/link manual.
- Confirmar que `/registro` redirige correctamente según el estado de emparejamiento del usuario.
- Grep de `/registro` en todo el código visible a la usuaria (copy, mensajes de error) para confirmar que no quedó ninguna mención de la ruta técnica.
