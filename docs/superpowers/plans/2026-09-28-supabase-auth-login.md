# Login real con Supabase Auth — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el crash sin manejar de `getCurrentParentId()` en modo real por un flujo de login funcional (email + contraseña, confirmación de email obligatoria) que deja la app usable de punta a punta contra el proyecto de Supabase ya conectado.

**Architecture:** `proxy.ts` (el reemplazo de `middleware.ts` en Next.js 16) refresca la sesión y redirige a `/ingresar` a quien no tenga sesión en rutas protegidas. Dos páginas nuevas (`/ingresar`, `/crear-cuenta`) con Server Actions llaman a Supabase Auth. Un Route Handler (`/auth/confirm`) canjea el link del correo por una sesión. Un trigger de base de datos crea la fila en `profiles` al registrarse. Un `error.tsx` raíz atrapa cualquier error no cubierto por el proxy (incluido el `throw` de `getCurrentParentId()` en `/invitacion/[token]`, que queda fuera de las rutas protegidas a propósito).

**Tech Stack:** Next.js 16 (App Router, Server Actions, `proxy.ts`), `@supabase/ssr` 0.5.2, `@supabase/supabase-js` 2.115.0, Zod 4 (API `.string().email()`, compatible con la v3 que declara `packages/core/package.json`), React 19.

**Nota sobre verificación:** este repo no tiene ningún test runner configurado (`npm run test` no hace nada — ningún workspace define un script `test`) ni archivos de test existentes. Cada tarea de este plan se verifica con `npm run typecheck`, `npm run build`, y pasos manuales de navegador/`curl` — el mismo patrón que ya se usó para verificar el resto de la app en esta sesión. No se introduce un framework de testing nuevo.

---

## Task 1: Variable de entorno para la URL del sitio + trigger de perfil en la base de datos

**Files:**
- Modify: `apps/web/.env.local` (agregar una línea, no tocar las dos que ya existen)
- Create: `supabase/migrations/0005_auth_signup_trigger.sql`

- [ ] **Step 1: Agregar `NEXT_PUBLIC_SITE_URL` a `.env.local`**

Abre `apps/web/.env.local` (ya tiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y agrega una línea al final:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Esta variable es la que se usa para construir el link de confirmación de email (`emailRedirectTo`). Cuando exista un deploy de Vercel, cambiar este valor es lo único que hay que tocar — no hay que volver a este código.

- [ ] **Step 2: Escribir la migración del trigger**

Crea `supabase/migrations/0005_auth_signup_trigger.sql`:

```sql
-- Crea automáticamente la fila en profiles cuando alguien se registra en
-- auth.users — hoy no existe ningún trigger para esto. Security definer
-- porque el usuario recién creado todavía no tiene permisos vía RLS sobre
-- public.profiles (mismo patrón que link_creator_to_family() y
-- accept_invitation() en 0001_registro_y_emparejamiento.sql).

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

- [ ] **Step 3: Correr la migración**

Esta migración toca `auth.users` (fuera del schema `public`), así que no se puede aplicar vía REST/PostgREST como hicimos con las anteriores — necesita correrse en el SQL Editor de Supabase, igual que la migración 0004.

Copia el contenido completo del archivo y pégalo en `https://supabase.com/dashboard/project/zedfvmmjscshaznlvqyc/sql/new`, luego dale a **Run**.

Verificar que no haya errores en el resultado (debe decir "Success. No rows returned").

- [ ] **Step 4: Commit**

```bash
git add apps/web/.env.local supabase/migrations/0005_auth_signup_trigger.sql
git commit -m "feat(auth): add profile-creation trigger and site URL env var"
```

(Nota: `.env.local` está gitignoreado — este `git add` no debería agregar nada; si el commit queda vacío de ese archivo, es esperado. Si `git status` muestra que sí se agregó, verificar el `.gitignore` antes de seguir.)

---

## Task 2: Esquemas de validación para login y registro

**Files:**
- Modify: `packages/core/src/validation/schemas.ts`

- [ ] **Step 1: Agregar los esquemas**

Al final de `packages/core/src/validation/schemas.ts` (después de `custodyEventInputSchema`), agregar:

```ts
export const signUpInputSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});
export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const signInInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof signInInputSchema>;
```

(`password.max(72)` porque bcrypt, que Supabase Auth usa internamente, trunca silenciosamente contraseñas más largas — evita que alguien crea una contraseña de 100 caracteres que después no puede volver a escribir igual.)

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck --workspace=packages/core`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/validation/schemas.ts
git commit -m "feat(core): add signUp/signIn validation schemas"
```

---

## Task 3: `proxy.ts` — refresco de sesión y protección de rutas

**Contexto importante:** en Next.js 16, `middleware.ts` está **deprecado** y renombrado a `proxy.ts` (la función también se renombra: `middleware` → `proxy`). El archivo va en la raíz de `apps/web`, al mismo nivel que `src/`. Fuente: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

**Files:**
- Create: `apps/web/proxy.ts`

- [ ] **Step 1: Escribir `proxy.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/registro", "/perfil", "/chat"];
const AUTH_PAGES = ["/ingresar", "/crear-cuenta"];

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/registro", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Notas sobre este código:
- `/invitacion/*` a propósito NO está en `PROTECTED_PREFIXES` (ver diseño: tiene que poder verse sin sesión).
- El patrón `setAll` que reescribe `response` es el oficial de `@supabase/ssr` para proxy/middleware — a diferencia de `supabaseServerClient.ts` (que solo lee cookies), acá el proxy necesita escribir tanto en el `request` como en el `response` para que el token refrescado llegue tanto al resto de la cadena de esta misma request como al navegador.
- `supabase.auth.getUser()` (no `getSession()`) porque valida el token contra el servidor de Supabase en vez de solo leerlo del JWT local — mismo criterio que ya se usa en `getCurrentParentId()`.

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck --workspace=apps/web`
Expected: sin errores.

- [ ] **Step 3: Verificación manual — redirect a /ingresar**

Arranca el dev server (`preview_start` con el nombre `web` del `.claude/launch.json`, o `npm run dev --workspace=apps/web`), y en el navegador (en una ventana/perfil sin sesión, o borrando cookies primero) visita `http://localhost:3000/registro`.

Expected: redirige a `http://localhost:3000/ingresar` (la página todavía no existe — vas a ver un 404 de Next.js en `/ingresar`, eso es esperado en este paso, confirma solo que el redirect ocurrió).

- [ ] **Step 4: Commit**

```bash
git add apps/web/proxy.ts
git commit -m "feat(auth): add proxy for session refresh and route protection"
```

---

## Task 4: Error boundary raíz

**Files:**
- Create: `apps/web/src/app/error.tsx`

- [ ] **Step 1: Escribir el error boundary**

```tsx
"use client";

import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center bg-sand">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Algo salió mal</h1>
      <p className="text-sm text-ink-soft">
        {error.message === "No hay sesión activa — inicia sesión para continuar."
          ? "Necesitas iniciar sesión para ver esto."
          : "Ocurrió un error inesperado. Intenta de nuevo o inicia sesión otra vez."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={retry}
          className="rounded-full border border-subtle bg-card px-4 py-2 text-sm font-medium text-ink"
        >
          Reintentar
        </button>
        <Link href="/ingresar" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
```

Se compara el mensaje exacto del `throw` en `getCurrentParentId()` (`apps/web/src/lib/repository.ts`) para mostrar un mensaje específico en ese caso; cualquier otro error cae en el mensaje genérico.

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck --workspace=apps/web`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/error.tsx
git commit -m "feat(auth): add root error boundary for unhandled session errors"
```

---

## Task 5: Página y acción de inicio de sesión (`/ingresar`)

**Files:**
- Create: `apps/web/src/app/ingresar/actions.ts`
- Create: `apps/web/src/app/ingresar/LoginForm.tsx`
- Create: `apps/web/src/app/ingresar/page.tsx`

- [ ] **Step 1: Escribir la Server Action**

```ts
// apps/web/src/app/ingresar/actions.ts
"use server";

import { redirect } from "next/navigation";
import { signInInputSchema } from "@alba/core";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const parsed = signInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Ingresa un email y una contraseña válidos." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message === "Email not confirmed") {
      return { error: "Todavía no confirmaste tu email — revisa tu bandeja de entrada." };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/registro");
}
```

- [ ] **Step 2: Escribir el Client Component del formulario**

Sigue el mismo patrón que `apps/web/src/app/chat/[threadId]/MessageComposer.tsx` (Client Component con `useState`, llamando la Server Action directamente en vez de `useActionState`, para mantener consistencia con el resto del código).

```tsx
// apps/web/src/app/ingresar/LoginForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
    }
    setPending(false);
  }

  return (
    <form action={handleSubmit} className="mt-6 flex flex-col gap-3 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
      <label className="text-sm font-medium text-ink">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
      <Link href="/crear-cuenta" className="text-sm font-medium text-purple underline">
        ¿No tienes cuenta? Crea una
      </Link>
    </form>
  );
}
```

- [ ] **Step 3: Escribir la página**

```tsx
// apps/web/src/app/ingresar/page.tsx
import { LoginForm } from "./LoginForm";

export default function IngresarPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 bg-sand">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
      <p className="mt-2 text-ink-soft">Entra a tu cuenta de ALBA.</p>
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck --workspace=apps/web`
Expected: sin errores.

- [ ] **Step 5: Verificación manual — página carga**

Con el dev server corriendo, visita `http://localhost:3000/ingresar`.

Expected: se ve el formulario de "Iniciar sesión" con campos de email y contraseña (todavía no hay ninguna cuenta creada, así que intentar ingresar debe mostrar "Email o contraseña incorrectos." — confirma que el error se muestra en la UI, no como crash).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/ingresar
git commit -m "feat(auth): add /ingresar login page"
```

---

## Task 6: Página y acción de registro (`/crear-cuenta`)

**Files:**
- Create: `apps/web/src/app/crear-cuenta/actions.ts`
- Create: `apps/web/src/app/crear-cuenta/SignupForm.tsx`
- Create: `apps/web/src/app/crear-cuenta/page.tsx`

- [ ] **Step 1: Escribir la Server Action**

```ts
// apps/web/src/app/crear-cuenta/actions.ts
"use server";

import { signUpInputSchema } from "@alba/core";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function signupAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const parsed = signUpInputSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password,
  });

  if (!parsed.success) {
    return { error: "Revisa los datos: nombre, email y contraseña (mínimo 8 caracteres)." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  if (error) {
    if (error.message.includes("already registered") || error.message.includes("already exists")) {
      return { error: "Ya existe una cuenta con ese email." };
    }
    return { error: "No se pudo crear la cuenta. Intenta de nuevo." };
  }

  return { success: true };
}
```

- [ ] **Step 2: Escribir el Client Component del formulario**

```tsx
// apps/web/src/app/crear-cuenta/SignupForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signupAction } from "./actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await signupAction(formData);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setPending(false);
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <p className="text-sm text-ink">
          Revisa tu correo y haz clic en el link de confirmación para activar tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-6 flex flex-col gap-3 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <input
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Confirmar contraseña
        <input
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      <Link href="/ingresar" className="text-sm font-medium text-purple underline">
        ¿Ya tienes cuenta? Inicia sesión
      </Link>
    </form>
  );
}
```

- [ ] **Step 3: Escribir la página**

```tsx
// apps/web/src/app/crear-cuenta/page.tsx
import { SignupForm } from "./SignupForm";

export default function CrearCuentaPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 bg-sand">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Crear cuenta</h1>
      <p className="mt-2 text-ink-soft">Registrate para empezar a usar ALBA.</p>
      <SignupForm />
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck --workspace=apps/web`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/crear-cuenta
git commit -m "feat(auth): add /crear-cuenta signup page"
```

---

## Task 7: Route Handler de confirmación de email (`/auth/confirm`)

**Files:**
- Create: `apps/web/src/app/auth/confirm/route.ts`

- [ ] **Step 1: Escribir el Route Handler**

```ts
// apps/web/src/app/auth/confirm/route.ts
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    redirect("/ingresar?error=link_invalido");
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    redirect("/ingresar?error=link_vencido");
  }

  redirect("/registro");
}
```

`cookies()` (usado dentro de `createSupabaseServerClient()`) sí puede escribir en un Route Handler — a diferencia de un Server Component, así que la sesión que resulta de `verifyOtp()` se guarda correctamente.

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck --workspace=apps/web`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/auth/confirm/route.ts
git commit -m "feat(auth): add email confirmation route handler"
```

---

## Task 8: Cierre de sesión

**Files:**
- Create: `apps/web/src/lib/authActions.ts`
- Modify: `apps/web/src/components/AppNav.tsx`

- [ ] **Step 1: Escribir la acción de logout**

```ts
// apps/web/src/lib/authActions.ts
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabaseServerClient";

export async function logoutAction() {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/ingresar");
}
```

- [ ] **Step 2: Agregar el botón a `AppNav`**

Archivo actual (`apps/web/src/components/AppNav.tsx`):

```tsx
import Link from "next/link";

const items = [
  { href: "/chat", label: "Acuerdo", enabled: true },
  { href: "#", label: "Calendario", enabled: false },
  { href: "#", label: "Gastos", enabled: false },
  { href: "#", label: "Bóveda", enabled: false },
] as const;

export function AppNav({ active }: { active: "Acuerdo" | "Calendario" | "Gastos" | "Bóveda" }) {
  return (
    <nav className="flex gap-1 rounded-full bg-ink p-1">
      {items.map((item) =>
        item.enabled ? (
          <Link
            key={item.label}
            href={item.href}
            className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold ${
              active === item.label ? "bg-orange text-ink" : "text-sand"
            }`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            className="flex-1 rounded-full px-3 py-2 text-center text-xs font-medium text-sand/40"
          >
            {item.label}
          </span>
        )
      )}
    </nav>
  );
}
```

Reemplazar completo por:

```tsx
import Link from "next/link";
import { logoutAction } from "@/lib/authActions";

const items = [
  { href: "/chat", label: "Acuerdo", enabled: true },
  { href: "#", label: "Calendario", enabled: false },
  { href: "#", label: "Gastos", enabled: false },
  { href: "#", label: "Bóveda", enabled: false },
] as const;

export function AppNav({ active }: { active: "Acuerdo" | "Calendario" | "Gastos" | "Bóveda" }) {
  return (
    <div className="flex items-center gap-2">
      <nav className="flex flex-1 gap-1 rounded-full bg-ink p-1">
        {items.map((item) =>
          item.enabled ? (
            <Link
              key={item.label}
              href={item.href}
              className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold ${
                active === item.label ? "bg-orange text-ink" : "text-sand"
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className="flex-1 rounded-full px-3 py-2 text-center text-xs font-medium text-sand/40"
            >
              {item.label}
            </span>
          )
        )}
      </nav>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-full border border-subtle px-3 py-2 text-xs font-medium text-ink-soft"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
```

`AppNav` sigue siendo un Server Component (no necesita `"use client"`) — un `<form action={serverAction}>` funciona directo en un Server Component, es el patrón que ya usan `registro/page.tsx` y `perfil/page.tsx` para sus formularios.

- [ ] **Step 3: Verificar que compila**

Run: `npm run typecheck --workspace=apps/web`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/authActions.ts apps/web/src/components/AppNav.tsx
git commit -m "feat(auth): add logout action and wire it into AppNav"
```

---

## Task 9: Configuración manual en Supabase + verificación end-to-end

Esta tarea no es código — son pasos que el usuario tiene que correr él mismo (no hay acceso admin a este proyecto de Supabase vía MCP en esta sesión), más la verificación completa del flujo.

- [ ] **Step 1: Revisar la plantilla de email de confirmación**

En `https://supabase.com/dashboard/project/zedfvmmjscshaznlvqyc/auth/templates`, abrir "Confirm signup" y confirmar que el link use:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Si dice otra cosa (por ejemplo `{{ .ConfirmationURL }}` apuntando directo al endpoint de Supabase), reemplazarlo por la línea de arriba.

- [ ] **Step 2: Confirmar el Site URL**

En `https://supabase.com/dashboard/project/zedfvmmjscshaznlvqyc/auth/url-configuration`, confirmar que **Site URL** sea `http://localhost:3000` y que esté en la lista de **Redirect URLs**.

- [ ] **Step 3: Confirmar que "Confirm email" esté activado**

En `https://supabase.com/dashboard/project/zedfvmmjscshaznlvqyc/auth/providers`, dentro de **Email**, confirmar que "Confirm email" esté en **ON** (así el `signUp()` no deja sesión activa hasta que se confirme, como pide el diseño).

- [ ] **Step 4: Build completo**

Run: `npm run build --workspace=apps/web`
Expected: build exitoso, sin errores de tipos ni de compilación.

- [ ] **Step 5: Flujo completo en el navegador**

1. Visitar `/crear-cuenta`, registrar una cuenta con un email real al que tengas acceso.
2. Ver la pantalla "revisa tu correo".
3. Abrir el correo real y hacer clic en el link de confirmación.
4. Confirmar que redirige a `/registro` con sesión activa (se ve el formulario de invitación, no un error).
5. Verificar por API que se creó la fila en `profiles`:
   ```bash
   curl -s "https://zedfvmmjscshaznlvqyc.supabase.co/rest/v1/profiles?select=id,full_name&limit=5" \
     -H "apikey: sb_publishable_c48FBhc3BkmmcnQ96GE_lQ_q2Y-ZinP" \
     -H "Authorization: Bearer sb_publishable_c48FBhc3BkmmcnQ96GE_lQ_q2Y-ZinP"
   ```
   Expected: `[]` vacío sigue siendo normal (RLS bloquea lectura anónima) — lo que importa es que NO devuelva un error 500; si querés confirmar que la fila existe de verdad, hacerlo desde el **Table Editor** del dashboard de Supabase en vez de vía API anónima.
6. Click en "Cerrar sesión" en `AppNav` (visible en `/chat`) → confirmar que redirige a `/ingresar`.
7. Visitar `/registro` directo sin sesión → confirmar que redirige a `/ingresar` (no un error 500).
8. Iniciar sesión con la contraseña incorrecta a propósito → confirmar que se ve "Email o contraseña incorrectos." en el formulario, no un crash.
9. Iniciar sesión con la contraseña correcta → confirmar que entra a `/registro`.
10. Visitar `/invitacion/00000000-0000-0000-0000-000000000000` (un token inventado) sin sesión → confirmar que se ve "Invitación no encontrada" (no un redirect a `/ingresar`, confirmando que esta ruta quedó pública como se diseñó).

- [ ] **Step 6: Commit final (si algo se ajustó durante la verificación)**

Si el Step 5 no requirió cambios de código, no hay nada que commitear en este paso — ya quedó todo commiteado tarea por tarea.
