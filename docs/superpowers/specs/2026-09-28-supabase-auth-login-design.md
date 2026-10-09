# Login real con Supabase Auth — Diseño

**Fecha:** 2026-09-28
**Estado:** Aprobado para implementación

## Problema

`getCurrentParentId()` (`apps/web/src/lib/repository.ts`) lanza un error sin
manejar cuando no hay sesión de Supabase activa. Hoy no existe ninguna
pantalla de login, ningún `middleware.ts` que refresque la sesión, ni un
error boundary — así que, con el proyecto real de Supabase ya conectado
(`.env.local` con `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`), cualquier visita
no autenticada a `/registro`, `/perfil`, `/invitacion/[token]`, `/chat` o
`/chat/[threadId]` revienta con un error 500 sin manejar.

## Alcance

**Incluido:**
- Registro e inicio de sesión con email + contraseña.
- Confirmación de email obligatoria antes de poder entrar.
- Middleware que protege las rutas de la app y refresca la sesión.
- Trigger en base de datos para crear el `profile` al registrarse.
- Cierre de sesión.
- Error boundary como red de seguridad final.

**Explícitamente fuera de alcance (para después, fast-follow):**
- Passkeys / Face ID / WebAuthn.
- Recuperar contraseña ("olvidé mi contraseña").
- Deploy a Vercel y configuración de su URL de redirect en Supabase (el
  blueprint en `docs/design/ALBA-UI-REFERENCE.md:20` ya lo contempla como
  destino final, pero no bloquea este trabajo).
- Rate limiting / CAPTCHA adicional más allá de lo que Supabase Auth trae
  por defecto.

## Impacto en el modo demo

Ninguno funcional: el middleware y las páginas nuevas solo actúan cuando
`isSupabaseConfigured` es `true`. `demoSession.ts` y el flujo `?as=b` no se
tocan.

**Nota operativa:** como `.env.local` ya tiene credenciales reales de
Supabase cargadas, el modo demo deja de ser el camino activo en desarrollo
local mientras ese archivo exista con esos valores. Para volver a probar el
modo demo habría que quitar temporalmente esas dos variables.

## Arquitectura

### Rutas nuevas

| Ruta | Tipo | Función |
|---|---|---|
| `/ingresar` | page + Server Action | Formulario de inicio de sesión |
| `/crear-cuenta` | page + Server Action | Formulario de registro (nombre, email, contraseña) |
| `/auth/confirm` | Route Handler (GET) | Recibe el link del correo de confirmación, canjea el token por una sesión, redirige a `/registro` |

Convención de nombres en español, igual que el resto de la app
(`registro`, `perfil`, `invitacion`, `chat`).

### `middleware.ts` (nuevo, raíz de `apps/web`)

Sigue el patrón oficial de `@supabase/ssr` para Next.js App Router:

1. Si `!isSupabaseConfigured`, pasa de largo sin tocar nada (modo demo intacto).
2. Si está configurado: crea un cliente de Supabase atado a las cookies de
   la request/response de middleware (lee y escribe cookies directamente,
   a diferencia del cliente de Server Component que solo puede leer).
3. Llama a `supabase.auth.getUser()` — esto refresca el access token si
   está por vencer y reescribe la cookie de sesión. Esto es justo lo que
   el comentario en `supabaseServerClient.ts` (línea 25-28) ya anticipaba
   como pendiente.
4. Si no hay usuario y la ruta es protegida (`/registro`, `/perfil`,
   `/chat`, `/chat/*`) → redirige a `/ingresar`.
5. Si hay usuario y la ruta es `/ingresar` o `/crear-cuenta` → redirige a
   `/registro` (no tiene sentido mostrarle el login a quien ya tiene sesión).

**`/invitacion/[token]` queda fuera de esta lista a propósito.** Es el link
que le llega a un progenitor que puede no tener cuenta todavía — tiene que
poder ver la invitación sin sesión, igual que hoy. El botón "Aceptar
invitación" sigue llamando a `acceptInvitationAction`, que internamente
necesita `getCurrentParentId()`; si no hay sesión, ese `throw` ahora lo
atrapa el error boundary nuevo (ver más abajo) en vez de tronar feo, con un
mensaje tipo "necesitas iniciar sesión para aceptar esta invitación" y un
link a `/ingresar`. Preservar el token a través del signup para que quede
un flujo de un solo paso (registrarse → volver automáticamente a aceptar)
es una mejora real pero queda fuera de este alcance — se puede agregar
después pasando el token como `?redirect=` a `/crear-cuenta`.

Con el middleware de por medio, el `throw` dentro de `getCurrentParentId()`
en la práctica casi nunca debería dispararse en una página real — queda
como red de seguridad para cualquier ruta o Server Action que el matcher
del middleware no cubra.

### Trigger de base de datos (migración `0005`)

Hoy no existe ningún trigger que cree la fila en `profiles` cuando alguien
se registra en `auth.users` — hay que agregarlo, con el mismo patrón
`security definer` que ya usan `link_creator_to_family()` y
`accept_invitation()` en `0001_registro_y_emparejamiento.sql`:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

El `full_name` viaja en `options.data` del `signUp()` desde el formulario
de `/crear-cuenta`, y Supabase lo guarda en `raw_user_meta_data`.

### Server Actions

**`/crear-cuenta/actions.ts` → `signupAction(formData)`**
1. Valida: nombre ≥ 2 caracteres, contraseña ≥ 8 caracteres, contraseña y
   confirmación coinciden.
2. `client.auth.signUp({ email, password, options: { data: { full_name },
   emailRedirectTo: <origin>/auth/confirm } })`.
3. Como la confirmación de email es obligatoria, esto NO deja sesión
   activa — la página muestra "revisa tu correo para confirmar tu cuenta"
   en vez de redirigir.
4. Errores de Supabase (email ya registrado, contraseña débil) se
   traducen a español y se devuelven al formulario vía `useActionState`.

**`/ingresar/actions.ts` → `loginAction(formData)`**
1. `client.auth.signInWithPassword({ email, password })`.
2. Éxito → `redirect('/registro')`.
3. Error (credenciales inválidas, email no confirmado) → mensaje en
   español devuelto al formulario.

**`/auth/confirm/route.ts`**
1. Lee `token_hash` y `type` de la query string (formato del link que
   genera la plantilla "Confirm signup" de Supabase:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).
2. `client.auth.verifyOtp({ type, token_hash })`.
3. Éxito → redirige a `/registro` (ya con sesión activa).
4. Error (link vencido/inválido) → redirige a `/ingresar` con un mensaje.

**Cierre de sesión**: una Server Action `logoutAction()` (ubicación:
`apps/web/src/lib/authActions.ts` o junto a `AppNav`) que llama a
`client.auth.signOut()` y redirige a `/ingresar`. Se expone como botón
"Cerrar sesión" en `AppNav` (`apps/web/src/components/AppNav.tsx`).

**Nota de configuración manual (no es código):** en el dashboard de
Supabase (Authentication → Email Templates → "Confirm signup") hay que
verificar que la URL del template use `{{ .SiteURL }}/auth/confirm?token_hash={{
.TokenHash }}&type=email` — el valor por defecto en proyectos nuevos puede
apuntar distinto. También hay que confirmar en Authentication → URL
Configuration que `http://localhost:3000` esté en la lista de Redirect URLs
permitidas. Esto se lo indico al usuario como paso a correr él mismo
(no tengo acceso admin a este proyecto vía MCP).

### Error boundary

`apps/web/src/app/error.tsx` (nuevo) — última red de seguridad a nivel de
toda la app: si algo lanza un error no manejado (incluido el `throw` de
`getCurrentParentId()` en un caso que el middleware no cubra), muestra una
pantalla simple "Algo salió mal — inicia sesión de nuevo" con un link a
`/ingresar`, en vez del error genérico de Next.js.

## Flujo completo

```
Visitante sin sesión → /registro
  → middleware detecta !user → redirige a /ingresar
  → clic en "Crear cuenta" → /crear-cuenta
  → llena formulario → signupAction() → "revisa tu correo"
  → clic en el link del correo → /auth/confirm?token_hash=...&type=email
  → verifyOtp() → sesión activa → redirige a /registro
  → (trigger ya creó su fila en profiles)
  → usa la app normalmente
  → "Cerrar sesión" en AppNav → logoutAction() → /ingresar
```

## Testing / verificación manual

- Registro con email nuevo → ver pantalla "revisa tu correo".
- Confirmar por el link real del correo → cae en `/registro` con sesión activa.
- Verificar que se creó la fila en `profiles` (vía API REST, como ya
  hicimos para las migraciones anteriores).
- Cerrar sesión → intentar entrar directo a `/registro` → redirige a `/ingresar`.
- Intentar iniciar sesión con contraseña incorrecta → mensaje de error en español.
- Confirmar que el modo demo NO se ve afectado (revisar que
  `isDemoMode`/`?as=b` sigan sin tocarse en el código, ya que no se puede
  probar en vivo sin desconectar las variables de entorno reales).
