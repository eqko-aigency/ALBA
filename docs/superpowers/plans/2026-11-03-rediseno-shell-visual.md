# Rediseño de shell visual (nav, header, Inicio, Tu Núcleo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el nav de 7 a 4 ítems, agregar un header global, un botón "+" contextual, modales de ayuda "Así funciona" por sección, rediseñar Inicio, y agregar las pantallas nuevas "Más funciones" (grid) y "Tu Núcleo" — todo sobre fondo blanco en vez de beige, usando los avatares ilustrados reales que proveyó la clienta.

**Architecture:** Mismo monorepo en capas ya establecido — `packages/core` (entidades/esquemas puros), `packages/api-client` (mock + Supabase), `apps/web` (Next.js 16 App Router, Server Components + Server Actions). Tres componentes nuevos y reutilizables (`AppHeader`, `QuickActionFab`, `SectionIntroModal`) se insertan en las páginas existentes sin reescribirlas por completo. Dos piezas de dato nuevas, ambas aditivas: `avatar_key` (self-selección, mismo patrón que `color` ya existente) y `seen_intros` (qué modales de ayuda ya vio cada usuario).

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), TypeScript, Zod, Supabase/Postgres, Tailwind 4, `node --test` + `tsx` para tests de `packages/core`.

**Spec:** `docs/superpowers/specs/2026-11-03-rediseno-shell-visual-design.md`

**Deviations from the spec document** (decisiones tomadas al escribir este plan, leyendo el código real — ver también el Self-Review al final):

1. **El header global NO reemplaza las campanitas/saludo que ya existen** — Dashboard, Chat y Calendario ya tienen su propio encabezado con contenido real (ej. Dashboard ya tiene campana de notificaciones con contador real, saludo "Hola, X"). El `AppHeader` nuevo (avatar/wordmark/campana) se agrega COMO FRANJA SUPERIOR FIJA antes de ese contenido existente, no lo sustituye. La campana del `AppHeader` reemplaza el link de campana que hoy vive inline en Dashboard (mismo contador `unseenCount`, mismo destino `/notificaciones`), pero NO toca la lógica de cálculo de `unseenCount` en absoluto.
2. **"Banner de recordatorio accionable" (spec, sección 6) = la sección "Necesita tu atención" que YA EXISTE en Dashboard**, solo re-estilizada de rojo/danger a naranja/dawn. Dashboard ya calcula alertas reales (check-in sin confirmar, gastos por aprobar, documentos sin anclar, acuerdos sin confirmar) — no hace falta inventar una señal nueva, el spec pedía exactamente esto y ya existe.
3. **"Tarjeta Primeros pasos" es nueva** (no existía) — se construye con señales reales ya disponibles en el mismo `Promise.all` de Dashboard: ¿tiene hijos?, ¿invitó al otro progenitor?, ¿registró al menos un gasto?. Se oculta por completo (no solo al 100%) cuando los 3 pasos están completos.
4. **Avatares: self-selección, no inferencia de género** — `Parent`/`Child` no tienen ningún campo de género hoy. En vez de adivinar Padre/Madre, se agrega `avatarKey` (nullable, mismo patrón que `color` ya existente) y un selector de 11 miniaturas en Perfil (propio) y Perfil→Hijo (del hijo), exactamente como ya funciona el selector de color. Esto es lo que el propio spec sugería como alternativa aceptable ("...o dejar que el usuario elija su avatar"). Sin avatar elegido, se usa el círculo de iniciales con color que el proyecto ya usa en otros lados (`topicAvatarClass` en Chat es el precedente de ese patrón).
5. **El "+" contextual de Calendario solo ofrece "Nuevo evento"** (mapea al formulario ya existente de "Fecha importante" dentro del panel del día seleccionado). **"Nueva tarea" se omite de esta pasada** — ALBA no tiene ningún concepto de "tarea" genérica (ni tabla, ni UI), inventarlo de la nada no es "shell visual", es una feature nueva fuera de alcance de este plan. Se deja como nota para un spec futuro, igual que Custodia/Medicación/Listas.
6. **Los filtros "Este mes / Esta semana / Hoy" de Calendario mapean a la navegación que YA EXISTE** (`?view=month`, `?view=week`, y el link "Hoy" que ya calcula `todayHref`) — no es un filtro nuevo de datos, es una forma más visual de acceder a algo que el Calendario real ya soporta vía los toggles de vista existentes.
7. **El fondo blanco se aplica solo al "shell autenticado"** (Dashboard, Chat, Calendario, Gastos, Perfil, Perfil→Hijo, Bóveda, Bóveda→Acuerdos, Notificaciones, PageSkeleton) — NO a la landing pública (`app/page.tsx`), pantallas de auth (`AuthLayout.tsx`, usado por ingresar/registro/crear-cuenta), `error.tsx`, `lista-espera`, ni `invitacion/[token]` ni `onboarding/*`. La clienta solo revisó/aprobó el mockup del shell autenticado — cambiar el resto es una decisión de diseño distinta, no tomada aquí.
8. **"Bóveda", "Perfil", "Gastos" y "Acuerdos" ya no tienen ícono propio en `AppNav`** — se llega a ellas desde la pantalla `/mas`. Para no dejar al usuario "perdido" sin forma de volver sin usar el botón atrás del navegador, cada una de esas 4 páginas gana un link "← Más" arriba del título, y su `<AppNav active="Más" />` en vez de su label individual (que ya no existe en el tipo `NavLabel`).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/public/avatars/*.png` | Los 12 assets ilustrados de la clienta (11 roles + retrato familiar completo) |
| `packages/core/src/validation/avatars.ts` | `AVATAR_KEYS` — mismo patrón que `colors.ts` |
| `packages/core/src/validation/schemas.ts` | `upsertProfileInputSchema`/`updateChildDetailsInputSchema` ganan `avatarKey` |
| `packages/core/src/domain/entities.ts` | `Parent` gana `avatarKey`, `seenIntros`; `Child` gana `avatarKey` |
| `packages/core/src/domain/ports.ts` | `PairingRepository` gana `markIntroSeen` |
| `supabase/migrations/0037_avatares_y_modales_ayuda.sql` | Columnas nuevas, aditivas |
| `packages/api-client/src/pairing/mockPairingRepository.ts` | Mock: avatarKey + seenIntros + markIntroSeen |
| `packages/api-client/src/pairing/supabasePairingRepository.ts` | Supabase: ídem |
| `apps/web/src/lib/avatars.ts` | Mapea `AvatarKey` → ruta pública + etiqueta |
| `apps/web/src/app/perfil/actions.ts` | `upsertProfileAction` incluye `avatarKey`; nueva `markIntroSeenAction` |
| `apps/web/src/app/perfil/SaveProfileForm.tsx` | Selector de avatar propio |
| `apps/web/src/app/perfil/hijo/[childId]/ChildDetailsForm.tsx` | Selector de avatar del hijo |
| `apps/web/src/app/globals.css` | `--background` pasa a blanco |
| Múltiples `page.tsx`/`loading.tsx` del shell autenticado | Quitar `bg-sand` del contenedor raíz (ver Tarea 8) |
| `apps/web/src/components/AppNav.tsx` | 4 ítems, ícono de "Más" nuevo |
| `apps/web/src/components/AppHeader.tsx` | Nuevo — avatar/wordmark/campana, fijo |
| `apps/web/src/components/QuickActionFab.tsx` | Nuevo — botón "+" contextual |
| `apps/web/src/components/SectionIntroModal.tsx` | Nuevo — sheet "Así funciona" + ícono "i" |
| `apps/web/src/app/dashboard/page.tsx` | Rediseño de Inicio |
| `apps/web/src/app/calendario/page.tsx` | Header/FAB/modal + filtros |
| `apps/web/src/app/chat/page.tsx` | Header/FAB/modal |
| `apps/web/src/app/perfil/page.tsx`, `gastos/page.tsx`, `boveda/page.tsx`, `boveda/acuerdos/page.tsx` | Link "← Más", `AppNav active="Más"` |
| `apps/web/src/app/mas/page.tsx` | Nuevo — grid de 8 tarjetas |
| `apps/web/src/app/mas/nucleo/page.tsx` | Nuevo — Tu Núcleo |

---

### Task 1: Avatares — copiar assets y declarar las claves

**Files:**
- Create: `apps/web/public/avatars/padre.png`, `madre.png`, `abuelos.png`, `madrastra.png`, `padrastro.png`, `hermano.png`, `hermana.png`, `hijo.png`, `hija.png`, `bebe-hombre.png`, `bebe-mujer.png`, `retrato-familiar.png`
- Create: `packages/core/src/validation/avatars.ts`
- Modify: `packages/core/src/index.ts`

**Suggested model:** haiku (copia de archivos + constante, sin lógica)

- [ ] **Step 1: Copiar los 12 archivos**

```powershell
$src = "C:\Users\HP\OneDrive\0.FAL IV OBSIDIAN VAULT\4. UNE CAPITAL\4.PROYECTOS\BRAND LAB CURATION\7. Proyectos\EQKO_AIgency\06_CLIENTES\11_DANCIRA\1_ALBA\Miniaturas familia alba"
$dest = "apps\web\public\avatars"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "$src\Avatares_Copaternidad\01_Padre.png" "$dest\padre.png"
Copy-Item "$src\Avatares_Copaternidad\02_Madre.png" "$dest\madre.png"
Copy-Item "$src\Avatares_Copaternidad\03_Abuelos.png" "$dest\abuelos.png"
Copy-Item "$src\Avatares_Copaternidad\04_Madrastra.png" "$dest\madrastra.png"
Copy-Item "$src\Avatares_Copaternidad\05_Padrastro.png" "$dest\padrastro.png"
Copy-Item "$src\Avatares_Copaternidad\06_Hermano.png" "$dest\hermano.png"
Copy-Item "$src\Avatares_Copaternidad\07_Hermana.png" "$dest\hermana.png"
Copy-Item "$src\Avatares_Copaternidad\08_Hijo.png" "$dest\hijo.png"
Copy-Item "$src\Avatares_Copaternidad\09_Hija.png" "$dest\hija.png"
Copy-Item "$src\Avatares_Copaternidad\10_Bebe_hombre.png" "$dest\bebe-hombre.png"
Copy-Item "$src\Avatares_Copaternidad\11_Bebe_mujer.png" "$dest\bebe-mujer.png"
Copy-Item "$src\Retrato familiar en once personajes.png" "$dest\retrato-familiar.png"
```

Verificar: `Get-ChildItem apps\web\public\avatars` debe listar los 12 archivos.

- [ ] **Step 2: Declarar `AVATAR_KEYS`**

Crea `packages/core/src/validation/avatars.ts`:

```ts
export const AVATAR_KEYS = [
  "padre",
  "madre",
  "abuelos",
  "madrastra",
  "padrastro",
  "hermano",
  "hermana",
  "hijo",
  "hija",
  "bebe_hombre",
  "bebe_mujer",
] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];
```

- [ ] **Step 3: Exportarlo desde el índice del paquete**

En `packages/core/src/index.ts`, busca la línea que exporta `./validation/colors` (ej. `export * from "./validation/colors";`) y agrega inmediatamente después:

```ts
export * from "./validation/avatars";
```

Si no existe una línea para `colors`, agrega `export * from "./validation/avatars";` junto a las demás exportaciones de `./validation/*`.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck --workspace=packages/core
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/avatars packages/core/src/validation/avatars.ts packages/core/src/index.ts
git commit -m "$(cat <<'EOF'
feat: avatares ilustrados de la familia (assets + AVATAR_KEYS)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Core — entidades y esquemas (avatarKey, seenIntros)

**Files:**
- Modify: `packages/core/src/domain/entities.ts`
- Modify: `packages/core/src/validation/schemas.ts`

**Suggested model:** standard (toca el shape de `Parent`/`Child`, requiere cuidado con el resto del archivo)

- [ ] **Step 1: Extender `Parent` y `Child`**

En `packages/core/src/domain/entities.ts`, dentro de `interface Parent`, agrega estos dos campos (después de `color: ProfileColor | null;`):

```ts
  /** Avatar ilustrado elegido en Perfil, uno de AVATAR_KEYS. null = todavía no eligió uno. */
  avatarKey: AvatarKey | null;
  /** Claves de sección ("inicio", "chat", "calendario", ...) cuyo modal "Así funciona" ya vio — ver SectionIntroModal. */
  seenIntros: string[];
```

Dentro de `interface Child`, agrega (después de `color: ProfileColor | null;`):

```ts
  /** Mismo criterio que Parent.avatarKey. */
  avatarKey: AvatarKey | null;
```

Agrega el import de `AvatarKey` al inicio del archivo, junto al import existente de `ProfileColor` (busca `import type { ProfileColor }` o similar y agrega `AvatarKey` al mismo import si viene del mismo módulo de validación; si `ProfileColor` se importa desde `../validation/colors`, agrega una línea `import type { AvatarKey } from "../validation/avatars";` justo después).

- [ ] **Step 2: Extender los esquemas de validación**

En `packages/core/src/validation/schemas.ts`:

Agrega el import de `AVATAR_KEYS` junto al de `PROFILE_COLORS`:

```ts
import { AVATAR_KEYS } from "./avatars";
```

En `upsertProfileInputSchema`, agrega el campo `avatarKey` (después de `color`):

```ts
export const upsertProfileInputSchema = z.object({
  fullName: z.string().min(2).max(120),
  color: z.enum(PROFILE_COLORS).nullable(),
  avatarKey: z.enum(AVATAR_KEYS).nullable(),
});
export type UpsertProfileInput = z.infer<typeof upsertProfileInputSchema>;
```

En `updateChildDetailsInputSchema`, agrega el mismo campo (después de `color`):

```ts
export const updateChildDetailsInputSchema = z.object({
  contacts: z.array(childContactSchema).max(10),
  healthProviders: z.array(childHealthProviderSchema).max(10),
  schoolName: optionalNote(160),
  schoolContacts: z.array(childSchoolContactSchema).max(10),
  allergies: optionalNote(1000),
  notes: z.array(childNoteSchema).max(20),
  color: z.enum(PROFILE_COLORS).nullable(),
  avatarKey: z.enum(AVATAR_KEYS).nullable(),
});
export type UpdateChildDetailsInput = z.infer<typeof updateChildDetailsInputSchema>;
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck --workspace=packages/core
```

Esperado: errores en `packages/api-client` (no implementan todavía los campos nuevos de `Parent`/`Child` en sus objetos retornados) — eso es esperado, se arregla en la Tarea 4. `packages/core` en sí debe compilar sin errores.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/domain/entities.ts packages/core/src/validation/schemas.ts
git commit -m "$(cat <<'EOF'
feat(core): avatarKey en Parent/Child, seenIntros en Parent

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migración SQL — columnas nuevas

**Files:**
- Create: `supabase/migrations/0037_avatares_y_modales_ayuda.sql`

**Suggested model:** haiku (SQL autocontenido, sin ambigüedad)

- [ ] **Step 1: Escribir la migración**

```sql
-- Avatares ilustrados (selección propia, spec rediseño shell visual,
-- sección 7) y modales "Así funciona" vistos por sección (sección 5).
-- Ambas aditivas, mismo criterio que 0031 (color: columna simple sin
-- check constraint en SQL — se valida en la capa Zod con AVATAR_KEYS).
-- No hace falta tocar RLS: las políticas de UPDATE de profiles/children
-- ya cubren "el dueño actualiza su propia fila", sin restringir columnas.

alter table public.profiles add column if not exists avatar_key text;
alter table public.children add column if not exists avatar_key text;
alter table public.profiles add column if not exists seen_intros jsonb not null default '[]'::jsonb;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0037_avatares_y_modales_ayuda.sql
git commit -m "$(cat <<'EOF'
feat(db): columnas avatar_key (profiles/children) y seen_intros (profiles)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

No apliques esta migración contra Supabase todavía — eso se hace al final del plan, con confirmación explícita, igual que en features anteriores.

---

### Task 4: Repos — avatarKey, seenIntros y markIntroSeen (mock + Supabase)

**Files:**
- Modify: `packages/core/src/domain/ports.ts`
- Modify: `packages/api-client/src/pairing/mockPairingRepository.ts`
- Modify: `packages/api-client/src/pairing/supabasePairingRepository.ts`

**Suggested model:** standard (toca 5 sitios de construcción de `Parent` en el mock, más Supabase — requiere no perder ningún campo existente)

- [ ] **Step 1: Agregar `markIntroSeen` al puerto**

En `packages/core/src/domain/ports.ts`, dentro de `interface PairingRepository`, agrega (cerca de `upsertProfile`):

```ts
  /** Marca que el progenitor ya vio el modal "Así funciona" de esa sección — no vuelve a aparecer solo después de esto (ver SectionIntroModal). Idempotente. */
  markIntroSeen(parentId: string, sectionKey: string): Promise<void>;
```

- [ ] **Step 2: Mock — actualizar los 5 sitios que construyen `Parent`**

Abre `packages/api-client/src/pairing/mockPairingRepository.ts`. Hay 5 bloques `const profile: Parent = { ... }` (en `upsertProfile`, `setUsageMode`, `confirmOnboardingName`, `setWhatsappNumber`, `markNotificationsSeen`). En **cada uno**, agrega estas dos líneas justo después de la línea `color: ...,`:

En `upsertProfile` (el único que recibe `avatarKey` como input nuevo):
```ts
        avatarKey: input.avatarKey,
        seenIntros: profiles.get(parentId)?.seenIntros ?? [],
```

En los otros 4 (`setUsageMode`, `confirmOnboardingName`, `setWhatsappNumber`, `markNotificationsSeen` — todos preservan el valor existente, igual que ya hacen con `color: existing?.color ?? null`):
```ts
        avatarKey: existing?.avatarKey ?? null,
        seenIntros: existing?.seenIntros ?? [],
```

- [ ] **Step 3: Mock — agregar `markIntroSeen`**

En el objeto retornado por `createMockPairingRepository` (mismo nivel que `markNotificationsSeen`), agrega:

```ts
    async markIntroSeen(parentId, sectionKey) {
      const existing = profiles.get(parentId);
      if (!existing) return;
      if (existing.seenIntros.includes(sectionKey)) return;
      profiles.set(parentId, { ...existing, seenIntros: [...existing.seenIntros, sectionKey] });
    },
```

- [ ] **Step 4: Supabase — actualizar `getProfile`, `upsertProfile` y los demás mapeos de `Parent`**

En `packages/api-client/src/pairing/supabasePairingRepository.ts`, busca cada lugar donde se construye el objeto `Parent` de retorno a partir de una fila (`data`/`row`) de `profiles` — son los mismos métodos que en el mock: `getProfile`, `upsertProfile`, `setUsageMode`, `confirmOnboardingName`, `setWhatsappNumber`, `markNotificationsSeen` (y cualquier función `mapProfile` si existe, en vez de estar repetido inline — usa la que encuentres en el archivo real). En cada uno, agrega después de `color: data.color ?? null,` (ajusta el nombre de variable `data`/`row` según corresponda en cada sitio real):

```ts
        avatarKey: (data.avatar_key ?? null) as AvatarKey | null,
        seenIntros: data.seen_intros ?? [],
```

Agrega el import de `AvatarKey` al inicio del archivo si no está ya disponible vía `@alba/core`.

En `upsertProfile` específicamente, el `.upsert({...})` debe incluir la columna nueva:

```ts
        .upsert({ id: parentId, full_name: input.fullName, color: input.color, avatar_key: input.avatarKey })
```

- [ ] **Step 5: Supabase — agregar `markIntroSeen`**

Agrega al objeto retornado (mismo nivel que `markNotificationsSeen`):

```ts
    async markIntroSeen(parentId, sectionKey) {
      const { data: existing, error: fetchError } = await client
        .from("profiles")
        .select("seen_intros")
        .eq("id", parentId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const current: string[] = existing?.seen_intros ?? [];
      if (current.includes(sectionKey)) return;
      const { error } = await client
        .from("profiles")
        .update({ seen_intros: [...current, sectionKey] })
        .eq("id", parentId);
      if (error) throw error;
    },
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Esperado: 0 errores en los 3 workspaces (`packages/core`, `packages/api-client`, `apps/web` — este último puede seguir fallando si `SaveProfileForm`/`ChildDetailsForm`/acciones todavía no pasan `avatarKey`; si es así, confírmalo y continúa, se arregla en las Tareas 5-6).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/ports.ts packages/api-client/src/pairing/mockPairingRepository.ts packages/api-client/src/pairing/supabasePairingRepository.ts
git commit -m "$(cat <<'EOF'
feat(api-client): avatarKey, seenIntros y markIntroSeen en mock y Supabase

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Perfil — selector de avatar propio

**Files:**
- Create: `apps/web/src/lib/avatars.ts`
- Modify: `apps/web/src/app/perfil/actions.ts`
- Modify: `apps/web/src/app/perfil/SaveProfileForm.tsx`
- Modify: `apps/web/src/app/perfil/page.tsx` (pasar `initialAvatarKey` al form)

**Suggested model:** standard (componente cliente con estado, requiere cuidado para no romper el submit existente de color)

- [ ] **Step 1: Mapear claves a rutas/etiquetas**

Crea `apps/web/src/lib/avatars.ts`:

```ts
import type { AvatarKey } from "@alba/core";

export const AVATAR_SRC: Record<AvatarKey, string> = {
  padre: "/avatars/padre.png",
  madre: "/avatars/madre.png",
  abuelos: "/avatars/abuelos.png",
  madrastra: "/avatars/madrastra.png",
  padrastro: "/avatars/padrastro.png",
  hermano: "/avatars/hermano.png",
  hermana: "/avatars/hermana.png",
  hijo: "/avatars/hijo.png",
  hija: "/avatars/hija.png",
  bebe_hombre: "/avatars/bebe-hombre.png",
  bebe_mujer: "/avatars/bebe-mujer.png",
};

export const AVATAR_LABEL: Record<AvatarKey, string> = {
  padre: "Padre",
  madre: "Madre",
  abuelos: "Abuel@s",
  madrastra: "Madrastra",
  padrastro: "Padrastro",
  hermano: "Hermano",
  hermana: "Hermana",
  hijo: "Hijo",
  hija: "Hija",
  bebe_hombre: "Bebé hombre",
  bebe_mujer: "Bebé mujer",
};
```

- [ ] **Step 2: `upsertProfileAction` recibe `avatarKey`**

En `apps/web/src/app/perfil/actions.ts`, reemplaza `upsertProfileAction`:

```ts
export async function upsertProfileAction(formData: FormData) {
  const rawColor = String(formData.get("color") ?? "");
  const rawAvatarKey = String(formData.get("avatarKey") ?? "");
  const input = upsertProfileInputSchema.parse({
    fullName: formData.get("parentFullName"),
    color: rawColor === "" ? null : rawColor,
    avatarKey: rawAvatarKey === "" ? null : rawAvatarKey,
  });
  const { pairing, parentId } = await getRequestContext();
  await pairing.upsertProfile(parentId, input);
  revalidatePath("/perfil");
}
```

- [ ] **Step 3: Selector de avatar en `SaveProfileForm`**

Reemplaza el contenido de `apps/web/src/app/perfil/SaveProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PROFILE_COLORS, AVATAR_KEYS, type AvatarKey } from "@alba/core";
import { COLOR_CLASS } from "@/lib/profileColors";
import { AVATAR_SRC, AVATAR_LABEL } from "@/lib/avatars";
import { upsertProfileAction } from "./actions";

export function SaveProfileForm({
  initialFullName,
  initialColor,
  initialAvatarKey,
}: {
  initialFullName: string;
  initialColor: string | null;
  initialAvatarKey: AvatarKey | null;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [color, setColor] = useState<string | null>(initialColor);
  const [avatarKey, setAvatarKey] = useState<AvatarKey | null>(initialAvatarKey);

  async function handleSubmit(formData: FormData) {
    formData.set("color", color ?? "");
    formData.set("avatarKey", avatarKey ?? "");
    setPending(true);
    setSaved(false);
    await upsertProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  return (
    <form action={handleSubmit} onChange={() => setSaved(false)} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <input
          name="parentFullName"
          autoComplete="off"
          required
          minLength={2}
          defaultValue={initialFullName}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-ink">Tu avatar</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`Elegir avatar ${AVATAR_LABEL[key]}`}
              onClick={() => {
                setAvatarKey(key);
                setSaved(false);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 ${
                avatarKey === key ? "border-orange ring-2 ring-orange" : "border-subtle"
              }`}
            >
              <img
                src={AVATAR_SRC[key]}
                alt={AVATAR_LABEL[key]}
                className="h-12 w-12 rounded-full object-cover"
                style={{ objectPosition: "center 15%" }}
              />
              <span className="text-[10px] text-ink-soft">{AVATAR_LABEL[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Tu color en el Calendario</p>
        <div className="mt-2 flex gap-2">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Elegir color ${c}`}
              onClick={() => {
                setColor(c);
                setSaved(false);
              }}
              className={`h-8 w-8 rounded-full ${COLOR_CLASS[c]} ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {saved && <span className="text-sm font-medium text-success">✓ Guardado</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Pasar `initialAvatarKey` desde la página**

En `apps/web/src/app/perfil/page.tsx`, busca dónde se renderiza `<SaveProfileForm initialFullName={...} initialColor={...} />` y agrega la prop:

```tsx
<SaveProfileForm
  initialFullName={profile?.fullName ?? ""}
  initialColor={profile?.color ?? null}
  initialAvatarKey={profile?.avatarKey ?? null}
/>
```

(Usa el nombre real de la variable que ya tiene el perfil cargado en ese archivo — probablemente `profile`, confírmalo leyendo el archivo antes de editar.)

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/avatars.ts apps/web/src/app/perfil/actions.ts apps/web/src/app/perfil/SaveProfileForm.tsx apps/web/src/app/perfil/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): selector de avatar ilustrado en Perfil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Perfil → Hijo — selector de avatar del hijo

**Files:**
- Modify: `apps/web/src/app/perfil/actions.ts` (si `updateChildDetailsAction` vive aquí; si no, en `apps/web/src/app/perfil/hijo/[childId]/actions.ts` — confirma leyendo el árbol real)
- Modify: `apps/web/src/app/perfil/hijo/[childId]/ChildDetailsForm.tsx`

**Suggested model:** standard (mismo patrón que la Tarea 5, aplicado al formulario del hijo)

- [ ] **Step 1: Localiza la Server Action de `updateChildDetails`**

Lee el archivo de acciones real que llama a `pairing.updateChildDetails(...)` (probablemente `updateChildDetailsAction` en `apps/web/src/app/perfil/actions.ts` o en una carpeta propia bajo `perfil/hijo/[childId]/`). Agrega el campo `avatarKey` a su `FormData`/parseo, igual que en la Tarea 5 Paso 2:

```ts
const rawAvatarKey = String(formData.get("avatarKey") ?? "");
// ... dentro del objeto que se le pasa a updateChildDetailsInputSchema.parse({...}):
avatarKey: rawAvatarKey === "" ? null : rawAvatarKey,
```

- [ ] **Step 2: Selector de avatar en `ChildDetailsForm`**

Lee `apps/web/src/app/perfil/hijo/[childId]/ChildDetailsForm.tsx` completo primero (ya tiene el selector de `color`, cópialo como referencia exacta de estilo/estructura). Agrega, inmediatamente antes o después del bloque de selector de color ya existente, un bloque de selector de avatar IDÉNTICO en estructura al que se escribió en la Tarea 5 Paso 3 (grid de 4 columnas, `AVATAR_KEYS.map(...)`, imagen 48px circular con `objectPosition: "center 15%"`, borde `orange` + ring cuando está seleccionado), con su propio `useState<AvatarKey | null>(initialAvatarKey)` y seteando `formData.set("avatarKey", avatarKey ?? "")` en el submit, igual que el patrón ya usado para `color` en este mismo archivo.

Agrega la prop `initialAvatarKey: AvatarKey | null` a la firma del componente, y pásala desde `apps/web/src/app/perfil/hijo/[childId]/page.tsx` como `initialAvatarKey={child.avatarKey}` (ajusta el nombre real de la variable que contiene el hijo cargado).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/perfil/actions.ts apps/web/src/app/perfil/hijo
git commit -m "$(cat <<'EOF'
feat(web): selector de avatar ilustrado para hijos en Perfil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Si la action real vive en otro archivo, ajusta el `git add` al path correcto.)

---

### Task 7: Fondo blanco — `globals.css`

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Suggested model:** haiku (un cambio de una línea)

- [ ] **Step 1: Cambiar el fondo base**

En `apps/web/src/app/globals.css`, reemplaza:

```css
  --background: var(--alba-sand);
```

por:

```css
  --background: #ffffff;
```

No toques ninguna otra línea del archivo — `--alba-sand` sigue existiendo como token de acento (se sigue usando en `bg-sand` para chips/badges/tracks decorativos en todo el código, eso NO cambia en esta tarea).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(web): fondo base de la app pasa de beige a blanco

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Quitar `bg-sand` de los contenedores raíz del shell autenticado

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/chat/page.tsx`
- Modify: `apps/web/src/app/chat/[threadId]/page.tsx`
- Modify: `apps/web/src/app/chat/[threadId]/loading.tsx`
- Modify: `apps/web/src/app/calendario/page.tsx`
- Modify: `apps/web/src/app/gastos/page.tsx`
- Modify: `apps/web/src/app/perfil/page.tsx`
- Modify: `apps/web/src/app/perfil/hijo/[childId]/page.tsx`
- Modify: `apps/web/src/app/boveda/page.tsx`
- Modify: `apps/web/src/app/boveda/acuerdos/page.tsx`
- Modify: `apps/web/src/app/notificaciones/page.tsx`
- Modify: `apps/web/src/components/PageSkeleton.tsx`

**Suggested model:** haiku (sustitución mecánica, un solo patrón por archivo — pero NO uses buscar-y-reemplazar global de "bg-sand" en todo el repo, solo en los contenedores raíz listados abajo)

- [ ] **Step 1: Los 7 archivos con el patrón exacto `pt-16 bg-sand"`**

En cada uno de estos 7 archivos, busca la línea del `<div>` raíz que termina en `pt-16 bg-sand"` y quita ` bg-sand` (deja el resto de clases intacto):

- `apps/web/src/app/dashboard/page.tsx` (línea ~228): `className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand"` → quita ` bg-sand`
- `apps/web/src/app/chat/page.tsx` (línea ~23): `className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand"` → quita ` bg-sand`
- `apps/web/src/app/calendario/page.tsx` (línea ~229): mismo patrón que dashboard → quita ` bg-sand`
- `apps/web/src/app/gastos/page.tsx` (línea ~91): mismo patrón → quita ` bg-sand`
- `apps/web/src/app/perfil/page.tsx` (línea ~29): mismo patrón → quita ` bg-sand`
- `apps/web/src/app/boveda/page.tsx` (línea ~54): mismo patrón → quita ` bg-sand`
- `apps/web/src/app/boveda/acuerdos/page.tsx` (línea ~44): mismo patrón → quita ` bg-sand`
- `apps/web/src/components/PageSkeleton.tsx` (línea ~19): mismo patrón → quita ` bg-sand`

Los números de línea son aproximados (de una lectura previa) — ubica el `<div>` raíz por su contenido, no por el número de línea exacto, puede haber cambiado levemente.

- [ ] **Step 2: `perfil/hijo/[childId]/page.tsx` y `notificaciones/page.tsx`**

Mismo patrón `pt-16 bg-sand"` en el `<div>` raíz de ambos archivos (confirmado por grep previo) → quita ` bg-sand` en cada uno.

- [ ] **Step 3: `chat/[threadId]/page.tsx` — 2 lugares, NO 1**

Este archivo usa un patrón de contenedor raíz distinto (sin `pt-16`). Hay 2 `bg-sand` a cambiar (el raíz y la barra inferior fija de composición), y uno a **dejar intacto** (el chip de categoría del hilo, que es un acento de color, no fondo de página):

- Línea ~81: `className="mx-auto flex min-h-screen max-w-2xl flex-col bg-sand"` → quita ` bg-sand` (contenedor raíz).
- Línea ~280: `className="fixed inset-x-0 z-10 mx-auto max-w-2xl bg-sand px-4 pb-1 pt-2"` → cambia `bg-sand` por `bg-white` (es la barra fija donde vive el compositor de mensajes, debe verse blanca como el resto, no transparente).
- Línea ~176 (`className="flex-shrink-0 rounded-full border border-subtle bg-sand px-3 py-1 text-xs font-medium text-ink-soft"`, el chip de categoría del hilo): **no tocar** — es un acento de color, no fondo de página.

No toques `MessageComposer.tsx` en esta tarea (sus usos de `bg-sand` son el color de fondo del input de texto y de chips, deliberados, parte del diseño del compositor, no del fondo de la página).

- [ ] **Step 4: `chat/[threadId]/loading.tsx` — mismo criterio**

Línea ~11, contenedor raíz `className="mx-auto flex min-h-screen max-w-2xl flex-col bg-sand"` → quita ` bg-sand`. Las demás ocurrencias en este archivo (líneas ~14, ~16, ~17, ~29) son placeholders de skeleton animado (`animate-pulse rounded bg-sand`) — **no tocar**, son el color del "shimmer" del loading state, no el fondo de la página.

- [ ] **Step 5: Verificación visual rápida**

```bash
npm run typecheck --workspace=apps/web
```

Esperado: sin errores (son solo cambios de className, no de tipos).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx apps/web/src/app/chat/page.tsx "apps/web/src/app/chat/[threadId]/page.tsx" "apps/web/src/app/chat/[threadId]/loading.tsx" apps/web/src/app/calendario/page.tsx apps/web/src/app/gastos/page.tsx apps/web/src/app/perfil/page.tsx "apps/web/src/app/perfil/hijo/[childId]/page.tsx" apps/web/src/app/boveda/page.tsx apps/web/src/app/boveda/acuerdos/page.tsx apps/web/src/app/notificaciones/page.tsx apps/web/src/components/PageSkeleton.tsx
git commit -m "$(cat <<'EOF'
feat(web): quitar bg-sand de los contenedores raíz del shell autenticado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: AppNav — 4 ítems + ícono de "Más"

**Files:**
- Modify: `apps/web/src/components/AppNav.tsx`

**Suggested model:** standard (cambia un tipo usado en 10+ páginas — requiere actualizar cada `<AppNav active="X">` a la vez, ver Tareas 11-17)

- [ ] **Step 1: Reescribir `AppNav.tsx`**

Reemplaza el contenido completo de `apps/web/src/components/AppNav.tsx`:

```tsx
import Link from "next/link";

type NavLabel = "Inicio" | "Chat" | "Calendario" | "Más";

const items: { href: string; label: NavLabel; enabled: boolean }[] = [
  { href: "/dashboard", label: "Inicio", enabled: true },
  { href: "/chat", label: "Chat", enabled: true },
  { href: "/calendario", label: "Calendario", enabled: true },
  { href: "/mas", label: "Más", enabled: true },
];

function NavIcon({ label }: { label: NavLabel }) {
  const common = { viewBox: "0 0 24 24", fill: "none", className: "h-5 w-5", "aria-hidden": true } as const;
  switch (label) {
    case "Inicio":
      return (
        <svg {...common}>
          <path
            d="M4 11l8-6.5L20 11M6 9.5V19a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1V9.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Chat":
      return (
        <svg {...common}>
          <path
            d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Calendario":
      return (
        <svg {...common}>
          <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "Más":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}

export function AppNav({ active }: { active?: NavLabel }) {
  return (
    <nav
      className="fixed inset-x-2 z-20 mx-auto flex max-w-md items-stretch justify-between rounded-2xl bg-card px-1 py-1.5 shadow-elevated"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))", transform: "translateZ(0)" }}
    >
      {items.map((item) => {
        const isActive = active === item.label;
        if (!item.enabled) {
          return (
            <span key={item.label} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-ink-faint/60">
              <span className="flex h-7 w-7 items-center justify-center">
                <NavIcon label={item.label} />
              </span>
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 transition-colors ${
              isActive ? "text-ink" : "text-ink-soft"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isActive ? "bg-orange" : ""
              }`}
            >
              <NavIcon label={item.label} />
            </span>
            <span className={`text-[9px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

Esperado: errores de tipo en TODAS las páginas que usan `<AppNav active="Dashboard">`, `active="Perfil">`, `active="Gastos">`, `active="Acuerdos">` o `active="Bóveda">` (esos valores ya no existen en `NavLabel`). Es esperado — se corrigen en las Tareas 13-17 de este mismo plan. Anota la lista de archivos que el compilador señale, para no perder ninguno.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AppNav.tsx
git commit -m "$(cat <<'EOF'
feat(web): AppNav de 7 a 4 ítems (Inicio/Chat/Calendario/Más)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Componente `AppHeader`

**Files:**
- Create: `apps/web/src/components/AppHeader.tsx`

**Suggested model:** standard (componente nuevo, necesita leer el perfil para el avatar)

- [ ] **Step 1: Escribir el componente**

```tsx
import Link from "next/link";
import type { AvatarKey } from "@alba/core";
import { AVATAR_SRC } from "@/lib/avatars";

export function AppHeader({
  avatarKey,
  unseenNotifications,
  as,
}: {
  avatarKey: AvatarKey | null;
  unseenNotifications: number;
  as?: string;
}) {
  const asQuery = as === "b" ? "?as=b" : "";
  return (
    <div className="flex flex-shrink-0 items-center justify-between px-6 pb-4 pt-5">
      <Link href={`/perfil${asQuery}`} aria-label="Tu perfil" className="flex-shrink-0">
        {avatarKey ? (
          <img
            src={AVATAR_SRC[avatarKey]}
            alt="Tu perfil"
            className="h-[46px] w-[46px] rounded-full border-2 border-white object-cover shadow-ambient"
            style={{ objectPosition: "center 15%" }}
          />
        ) : (
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-white bg-dawn text-sm font-semibold text-ink shadow-ambient">
            Tú
          </span>
        )}
      </Link>

      <span className="text-[28px] font-extrabold tracking-tight text-ink">
        alba<span className="text-orange">.</span>
      </span>

      <Link
        href={`/notificaciones${asQuery}`}
        aria-label="Notificaciones"
        className="relative flex-shrink-0 p-1"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-[26px] w-[26px] text-ink" aria-hidden="true">
          <path
            d="M6 10a6 6 0 0112 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unseenNotifications > 0 && (
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {unseenNotifications > 9 ? "9+" : unseenNotifications}
          </span>
        )}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

Esperado: sin errores nuevos (el componente todavía no se usa en ninguna página — eso pasa en las Tareas 13-15).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AppHeader.tsx
git commit -m "$(cat <<'EOF'
feat(web): componente AppHeader (avatar, logo, notificaciones)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Componente `QuickActionFab`

**Files:**
- Create: `apps/web/src/components/QuickActionFab.tsx`

**Suggested model:** standard (componente cliente con estado de abierto/cerrado + íconos por acción)

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export type QuickAction = {
  label: string;
  href: string;
  iconBgClass: string;
  icon: React.ReactNode;
};

export function QuickActionFab({ actions }: { actions: QuickAction[] }) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-[168px] right-5 z-30 flex flex-col items-end gap-3">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <span className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-elevated">
                {action.label}
              </span>
              <span
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full shadow-elevated ${action.iconBgClass}`}
              >
                {action.icon}
              </span>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Agregar"
        className="fixed bottom-[92px] right-5 z-30 flex h-[58px] w-[58px] items-center justify-center rounded-full border-4 border-white bg-orange shadow-elevated transition-transform"
        style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="#3a332e" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/QuickActionFab.tsx
git commit -m "$(cat <<'EOF'
feat(web): componente QuickActionFab (botón + contextual)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Componente `SectionIntroModal`

**Files:**
- Create: `apps/web/src/app/actions/sectionIntroActions.ts`
- Create: `apps/web/src/components/SectionIntroModal.tsx`

**Suggested model:** standard (estado + efecto para auto-abrir y marcar como visto, el componente más delicado de esta tarea)

- [ ] **Step 1: Server Action para marcar como visto**

Crea `apps/web/src/app/actions/sectionIntroActions.ts`:

```ts
"use server";

import { getRequestContext } from "@/lib/repository";

export async function markSectionIntroSeenAction(sectionKey: string, as?: string) {
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.markIntroSeen(parentId, sectionKey);
}
```

- [ ] **Step 2: El componente del modal**

Crea `apps/web/src/components/SectionIntroModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { markSectionIntroSeenAction } from "@/app/actions/sectionIntroActions";

export type IntroPoint = {
  icon: React.ReactNode;
  iconBgClass: string;
  title: string;
  description: string;
};

export function SectionIntroModal({
  sectionKey,
  as,
  alreadySeen,
  hero,
  title,
  description,
  points,
}: {
  sectionKey: string;
  as?: string;
  alreadySeen: boolean;
  hero: React.ReactNode;
  title: string;
  description: string;
  points: IntroPoint[];
}) {
  const [open, setOpen] = useState(!alreadySeen);

  useEffect(() => {
    if (!alreadySeen) {
      markSectionIntroSeenAction(sectionKey, as);
    }
    // Solo al montar — "ya lo vio" se registra en el momento en que se le
    // mostró automáticamente, sin esperar a que lo cierre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cómo funciona ${title}`}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.6px] border-ink-soft text-[12px] font-bold italic text-ink-soft"
      >
        i
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div
            className="relative z-10 flex max-h-[calc(100%-36px)] w-full max-w-md flex-col overflow-y-auto rounded-t-[28px] px-[22px] pb-6 pt-3.5"
            style={{ background: "#4a5a62" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="mb-2 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 5l14 14M19 5L5 19" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="mb-2.5 flex-shrink-0">{hero}</div>

            <p className="mb-1 text-[21px] font-extrabold tracking-tight text-white">{title.toUpperCase()}</p>
            <p className="mb-3 text-[12.5px] leading-snug text-white/70">{description}</p>
            <p className="mb-1.5 text-sm font-extrabold text-white">Así funciona</p>

            <div className="flex flex-col">
              {points.map((point, i) => (
                <div
                  key={point.title}
                  className={`flex gap-2.5 py-[7px] ${i < points.length - 1 ? "border-b border-white/10" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${point.iconBgClass}`}
                  >
                    {point.icon}
                  </span>
                  <div>
                    <p className="text-[13.5px] font-bold text-white">{point.title}</p>
                    <p className="text-[11.5px] leading-snug text-white/70">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 flex-shrink-0 rounded-full bg-orange py-[11px] text-[13px] font-extrabold text-ink"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/actions/sectionIntroActions.ts apps/web/src/components/SectionIntroModal.tsx
git commit -m "$(cat <<'EOF'
feat(web): componente SectionIntroModal (modal "Así funciona")

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Dashboard → Inicio (rediseño completo)

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

**Suggested model:** standard (el archivo más grande y con más lógica real a preservar de todo el plan)

- [ ] **Step 1: Leer el archivo completo antes de tocarlo**

Lee `apps/web/src/app/dashboard/page.tsx` completo (ya se verificó en el momento de escribir este plan, pero puede haber cambiado desde entonces). Ubica: el `Promise.all` principal, el bloque del `<h1>`+campana actual (líneas ~238-265), el bloque `{!otherParent && (...)}`, la sección "Necesita tu atención" (`alerts`), y la línea final `<AppNav active="Dashboard" />`.

- [ ] **Step 2: Agregar las señales de "Primeros pasos" al `Promise.all` existente**

El `Promise.all` ya carga `expenseList` y `otherParent` (vía `familyMembers`). Agrega, justo después de donde se calcula `otherParent` (línea ~121), el cálculo de los 3 pasos:

```ts
  const onboardingSteps = [
    { label: "Agrega a tu hijo/a", done: children.length > 0, href: "/perfil" },
    { label: "Invita al otro progenitor", done: otherParent !== null, href: `/onboarding/invitar${as === "b" ? "?as=b" : ""}` },
    { label: "Registra un gasto compartido", done: expenseList.length > 0, href: `/gastos${as === "b" ? "?as=b" : ""}` },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const showOnboardingCard = completedSteps < onboardingSteps.length;
```

- [ ] **Step 3: Reemplazar el bloque del encabezado actual por `AppHeader` + saludo con ícono "i"**

Reemplaza (líneas ~238-265, el `<div className="flex items-start justify-between gap-3">...</div>` que contiene el `<h1>Hola...` y el link de campana) por:

```tsx
      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={unseenCount} as={as} />

      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
        <SectionIntroModal
          sectionKey="inicio"
          as={as}
          alreadySeen={profile?.seenIntros?.includes("inicio") ?? false}
          hero={<InicioIntroHero />}
          title="Inicio"
          description="Tu resumen del día: lo próximo en el calendario, el balance de gastos y lo último del chat, todo de un vistazo."
          points={[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="#a4bed5" strokeWidth="1.8" />
                  <path d="M4 9.5h16" stroke="#a4bed5" strokeWidth="1.8" />
                </svg>
              ),
              iconBgClass: "bg-sky/20",
              title: "Lo próximo primero",
              description: "Tu próxima visita o entrega siempre está arriba de todo.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" stroke="#f79a7a" strokeWidth="1.8" />
                  <path
                    d="M14.5 9.5c-.4-.8-1.3-1.3-2.5-1.3-1.5 0-2.7.8-2.7 2s1.2 1.8 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.1-.5-2.5-1.3M12 7.3v9.4"
                    stroke="#f79a7a"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ),
              iconBgClass: "bg-orange/20",
              title: "Balance siempre visible",
              description: "Quién le debe a quién, sin tener que entrar a Gastos.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
                    stroke="#bb889b"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
              iconBgClass: "bg-purple/20",
              title: "Último mensaje a la mano",
              description: "Un vistazo a lo último que se dijeron, sin abrir Chat.",
            },
          ]}
        />
      </div>
      <p className="mt-1 text-ink-soft">Esto es lo que está pasando en tu familia hoy.</p>
```

Agrega los imports necesarios al inicio del archivo: `AppHeader` desde `@/components/AppHeader`, `SectionIntroModal` desde `@/components/SectionIntroModal`.

- [ ] **Step 4: Avatar grande del hijo, centrado, justo después del saludo**

Inmediatamente después del párrafo `<p className="mt-1 text-ink-soft">Esto es lo que está pasando...</p>` (y antes del bloque `{!otherParent && (...)}`), agrega:

```tsx
      {children[0] && (
        <div className="mt-5 flex flex-col items-center gap-1.5">
          {children[0].avatarKey ? (
            <img
              src={AVATAR_SRC[children[0].avatarKey]}
              alt={children[0].fullName}
              className="h-[76px] w-[76px] rounded-full border-[3px] border-orange object-cover"
              style={{ objectPosition: "center 15%" }}
            />
          ) : (
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-orange bg-dawn text-2xl font-bold text-ink">
              {children[0].fullName.slice(0, 1)}
            </span>
          )}
          <span className="text-sm font-bold text-ink">{children[0].fullName}</span>
        </div>
      )}
```

Agrega el import `import { AVATAR_SRC } from "@/lib/avatars";` al inicio del archivo.

- [ ] **Step 5: Restyle de "Necesita tu atención" (de danger/rojo a dawn/naranja)**

En la sección `{alerts.length > 0 && (...)}` (línea ~334), cambia las clases del `<Link>` de cada alerta:

```diff
-                className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-ink"
+                className="flex items-center gap-3 rounded-xl border border-orange bg-dawn/40 px-4 py-3 text-sm font-medium text-ink"
```

```diff
-                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
+                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange/20 text-ink">
```

No cambies nada de la lógica que calcula `alerts` — solo las clases de Tailwind de presentación.

- [ ] **Step 6: Tarjeta "Primeros pasos"**

Justo antes de la sección `{alerts.length > 0 && (...)}`, agrega:

```tsx
      {showOnboardingCard && (
        <div className="mt-6 rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <p className="text-sm font-bold text-ink">Primeros pasos</p>
          <p className="mt-0.5 text-xs text-ink-soft">Completa esto para sacarle el máximo a ALBA.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full bg-orange"
              style={{ width: `${Math.round((completedSteps / onboardingSteps.length) * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex flex-col">
            {onboardingSteps.map((step, i) => (
              <div
                key={step.label}
                className={`flex items-center gap-2.5 py-2 ${
                  i < onboardingSteps.length - 1 ? "border-b border-subtle" : ""
                }`}
              >
                {step.done ? (
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-success">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span className="h-4 w-4 flex-shrink-0 rounded-full border-[1.6px] border-ink-faint" />
                )}
                {step.done ? (
                  <span className="flex-1 text-sm text-ink line-through opacity-60">{step.label}</span>
                ) : (
                  <Link href={step.href} className="flex flex-1 items-center justify-between text-sm text-ink">
                    {step.label}
                    <span className="text-ink-faint" aria-hidden="true">›</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 7: Encabezado "Resumen" antes de "Mes en cifras"**

No hace falta renombrar "Mes en cifras" — el spec ya queda satisfecho con el contenido existente reubicado debajo de lo nuevo (avatar/banner/primeros pasos ya quedaron arriba en los Steps 4 y 6). No agregues un encabezado "Resumen" duplicado si ya existe "Mes en cifras" inmediatamente después — déjalo tal cual está.

- [ ] **Step 8: El componente `InicioIntroHero`**

Al final del archivo (o en un archivo nuevo `apps/web/src/components/icons/IntroHeroes.tsx` si prefieres mantener `dashboard/page.tsx` más corto — usa tu criterio, pero si lo separas, impórtalo correctamente), agrega:

```tsx
function InicioIntroHero() {
  return (
    <div className="relative h-[88px] w-full rounded-[18px]" style={{ background: "#a4bed5" }}>
      <div className="absolute left-[18px] top-[18px] w-[150px] rounded-[14px] bg-white px-3.5 py-[11px] shadow-md">
        <p className="text-[10px] font-bold text-ink-soft">PRÓXIMA VISITA</p>
        <p className="mt-0.5 text-xs font-bold text-ink">Viernes 7, 17:00</p>
      </div>
      <div className="absolute bottom-3.5 right-4 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-orange shadow-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 11l8-6.5L20 11M6 9.5V19a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1V9.5"
            stroke="#3a332e"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 10: Verificación en modo demo**

Renombra `apps/web/.env.local` → `.env.local.disabled-for-qa`, corre `npm run dev --workspace=apps/web` (o usa la herramienta de preview del proyecto), confirma en `/dashboard`:
- El header (avatar/alba./campana) aparece arriba de todo.
- El modal "Así funciona" de Inicio se abre automático la primera vez.
- Al recargar, ya no se abre solo, pero el ícono "i" junto a "Hola, ..." lo vuelve a abrir.
- Si hay un hijo cargado, su avatar/nombre aparece centrado.
- La tarjeta "Primeros pasos" refleja el estado real (hijos/otro progenitor/gastos).

Restaura `.env.local.disabled-for-qa` → `.env.local` al terminar.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): rediseño de Inicio (header, avatar, primeros pasos, modal)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Chat — header, modal, FAB

**Files:**
- Modify: `apps/web/src/app/chat/page.tsx`

**Suggested model:** standard (más simple que Dashboard, pero toca el mismo conjunto de componentes nuevos)

- [ ] **Step 1: Agregar `<details id="nuevo-hilo">`**

El disclosure "+ Nuevo hilo" ya existente (línea ~36) gana un `id` para que el FAB pueda enlazar hacia él:

```diff
-      <details className="mt-6 rounded-xl border border-subtle bg-card p-4 shadow-ambient [&_summary::-webkit-details-marker]:hidden">
+      <details id="nuevo-hilo" className="mt-6 rounded-xl border border-subtle bg-card p-4 shadow-ambient [&_summary::-webkit-details-marker]:hidden">
```

(Nota: el navegador hace scroll hasta el `id` pero no abre el `<details>` automáticamente — es una limitación conocida y aceptada para esta pasada, no bloqueante.)

- [ ] **Step 2: Header + título con ícono "i" + necesita que exista `profile`**

Reemplaza el bloque del `<h1>Mensajes</h1>` + párrafo (líneas ~33-34) por:

```tsx
      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Mensajes</h1>
        <SectionIntroModal
          sectionKey="chat"
          as={as}
          alreadySeen={profile?.seenIntros?.includes("chat") ?? false}
          hero={<ChatIntroHero />}
          title="Chat"
          description="Habla con el otro progenitor con herramientas que bajan la tensión y dejan constancia de lo que se dice."
          points={[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="#f79a7a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              iconBgClass: "bg-orange/20",
              title: "Tono cuidado",
              description: "Antes de enviar, revisamos el tono. Si hay tensión, te sugerimos una versión más neutral — tú decides si la usas.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="#a4bed5" strokeWidth="1.8" />
                  <path d="M8 10.5V7.8a4 4 0 118 0v2.7" stroke="#a4bed5" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ),
              iconBgClass: "bg-sky/20",
              title: "Queda con respaldo",
              description: "Cada mensaje genera su propia huella digital. Puedes sellar la conversación como evidencia si alguna vez la necesitas.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M7 4.5h7.5L18 8v10.5A1.5 1.5 0 0116.5 20h-9A1.5 1.5 0 016 18.5v-12A1.5 1.5 0 017 4.5z"
                    stroke="#bb889b"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
              iconBgClass: "bg-purple/20",
              title: "Organiza por hilos",
              description: "Crea un hilo por tema para que cada conversación quede junta y sea fácil de encontrar después.",
            },
          ]}
        />
      </div>
      <p className="mt-2 text-ink-soft">Categoría fija + hijo — compartido con el otro progenitor.</p>
```

- [ ] **Step 3: Cargar `profile` en el `Promise.all` existente**

El `Promise.all` actual solo carga `threads`/`children`. Agrega `pairing.getProfile(parentId)`:

```ts
  const [threads, children, profile] = await Promise.all([
    chat.listThreads(parentId),
    pairing.getMyChildren(parentId),
    pairing.getProfile(parentId),
  ]);
```

- [ ] **Step 4: Agregar el FAB antes de `<AppNav active="Chat" />`**

```tsx
      <QuickActionFab
        actions={[
          {
            label: "Nuevo mensaje",
            href: `/chat${as === "b" ? "?as=b" : ""}#nuevo-hilo`,
            iconBgClass: "bg-sea",
            icon: (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
                  stroke="#3a332e"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
        ]}
      />
```

- [ ] **Step 5: Cambiar `<AppNav active="Chat" />` — ya era "Chat", no cambia**

Confirma que sigue siendo `active="Chat"` (es uno de los 4 ítems nuevos, no requiere cambio).

- [ ] **Step 6: Imports + `ChatIntroHero`**

Agrega los imports: `AppHeader`, `SectionIntroModal`, `QuickActionFab`. Al final del archivo (o junto a `InicioIntroHero` si decidiste centralizarlos en la Tarea 13):

```tsx
function ChatIntroHero() {
  return (
    <div className="relative h-[88px] w-full rounded-[18px]" style={{ background: "#f7dbb7" }}>
      <div className="absolute left-[18px] top-5 max-w-[150px] rounded-[14px_14px_14px_4px] bg-white px-3.5 py-2.5 text-xs text-ink shadow-md">
        ¿Nos vemos a las 5?
      </div>
      <div className="absolute left-[66px] top-16 max-w-[140px] rounded-[14px_14px_4px_14px] bg-orange px-3.5 py-2.5 text-xs text-ink shadow-md">
        Sí, perfecto
      </div>
      <div className="absolute right-4 top-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-success shadow-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/chat/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): header, modal "Así funciona" y FAB en Chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Calendario — header, modal, FAB, filtros

**Files:**
- Modify: `apps/web/src/app/calendario/page.tsx`

**Suggested model:** standard (el archivo más grande después de Dashboard — localizar bien el `<h1>` y el final del archivo antes de editar)

- [ ] **Step 1: Header + título con ícono "i"**

Reemplaza el bloque `<h1 className="text-2xl font-semibold tracking-tight text-ink">Calendario de custodia y visitas</h1>` + el párrafo siguiente (línea ~239-240) por:

```tsx
      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Calendario</h1>
        <SectionIntroModal
          sectionKey="calendario"
          as={as}
          alreadySeen={profile?.seenIntros?.includes("calendario") ?? false}
          hero={<CalendarioIntroHero />}
          title="Calendario"
          description="Coordina visitas, entregas y fechas importantes sin tener que preguntarle al otro progenitor qué quedó dicho."
          points={[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="#3a332e" strokeWidth="1.8" />
                  <path d="M4 9.5h16" stroke="#3a332e" strokeWidth="1.8" />
                </svg>
              ),
              iconBgClass: "bg-sea",
              title: "Slots recurrentes",
              description: "Configura el convenio de custodia una vez y se repite solo.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="#f79a7a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              iconBgClass: "bg-orange/20",
              title: "Confirma check-in y check-out",
              description: "Marca cuándo empezó y terminó cada visita, sin ambigüedad.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s-7-4.4-7-10a7 7 0 0114 0c0 5.6-7 10-7 10z" stroke="#bb889b" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="11" r="2.4" stroke="#bb889b" strokeWidth="1.8" />
                </svg>
              ),
              iconBgClass: "bg-purple/20",
              title: "Lugares de encuentro",
              description: "Guarda los puntos de entrega habituales para no repetirlos cada vez.",
            },
          ]}
        />
      </div>
      <p className="mt-2 text-ink-soft">Toca un día para ver y confirmar check-in/check-out, y dónde se hace el encuentro.</p>
```

- [ ] **Step 2: Filtros "Este mes / Esta semana / Hoy"**

Justo después del párrafo del Step 1 (y antes del toggle `week`/`month` ya existente en línea ~242), agrega:

```tsx
      <div className="mt-3 flex gap-2">
        <Link
          href={`/calendario?view=month&month=${monthKey(refMonthDate)}${asQuery}`}
          className={`rounded-full px-3.5 py-2 text-xs font-bold ${
            view === "month" ? "bg-ink text-white" : "border border-subtle bg-card text-ink-soft"
          }`}
        >
          Este mes
        </Link>
        <Link
          href={`/calendario?view=week&day=${selectedDayKey}${asQuery}`}
          className={`rounded-full px-3.5 py-2 text-xs font-bold ${
            view === "week" ? "bg-ink text-white" : "border border-subtle bg-card text-ink-soft"
          }`}
        >
          Esta semana
        </Link>
        <Link
          href={todayHref}
          className={`rounded-full px-3.5 py-2 text-xs font-bold ${
            isSelectedToday ? "bg-ink text-white" : "border border-subtle bg-card text-ink-soft"
          }`}
        >
          Hoy
        </Link>
      </div>
```

Esto reutiliza `view`, `refMonthDate`, `monthKey`, `asQuery`, `selectedDayKey`, `todayHref`, `isSelectedToday` — todos ya calculados más arriba en el archivo, no se inventa ningún estado/filtro de datos nuevo (ver Deviation 6 al inicio de este plan).

- [ ] **Step 3: Cargar `profile`**

El `Promise.all` principal (línea ~165) ya carga `profile` (`pairing.getProfile(parentId)`, se ve en la lista de destructuring). Confírmalo leyendo el archivo — si por algún motivo no está, agrégalo al array y a la destructuración, siguiendo el mismo patrón que los demás elementos de ese `Promise.all`.

- [ ] **Step 4: FAB — solo "Nuevo evento"**

Antes de `<AppNav active="Calendario" />` (línea ~980), agrega:

```tsx
      <QuickActionFab
        actions={[
          {
            label: "Nuevo evento",
            href: `/calendario?view=${view}&month=${monthKey(refMonthDate)}&day=${selectedDayKey}${asQuery}#fecha-importante`,
            iconBgClass: "bg-dawn",
            icon: (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="#3a332e" strokeWidth="1.8" />
                <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ),
          },
        ]}
      />
```

Agrega `id="fecha-importante"` al `<form action={createImportantDateAction} ...>` existente (línea ~819) para que el link del FAB tenga un destino real al que hacer scroll (misma limitación conocida que en Chat Task 14 Step 1 — no se auto-expande ningún `<details>` si el formulario está dentro de uno, solo hace scroll).

**No agregues ninguna acción "Nueva tarea"** — ver Deviation 5 al inicio del plan.

- [ ] **Step 5: Imports + `CalendarioIntroHero`**

Agrega los imports: `AppHeader`, `SectionIntroModal`, `QuickActionFab`. Agrega al final del archivo (o junto a los otros `*IntroHero` si los centralizaste):

```tsx
function CalendarioIntroHero() {
  return (
    <div className="relative h-[88px] w-full rounded-[18px]" style={{ background: "#cee4e7" }}>
      <div className="absolute left-[18px] top-[18px] w-[150px] rounded-[14px] bg-white px-3 py-2.5 shadow-md">
        <p className="mb-1.5 text-[10px] font-bold text-ink-soft">NOVIEMBRE</p>
        <div className="grid grid-cols-6 gap-[5px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`h-[13px] w-[13px] rounded-full ${i === 2 ? "bg-orange" : "bg-sand"}`}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-3.5 right-4 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-orange shadow-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 7v5l3 2" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="8" stroke="#3a332e" strokeWidth="1.8" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/calendario/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): header, modal, FAB y filtros en Calendario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Back-link "← Más" en Perfil, Gastos, Bóveda, Acuerdos

**Files:**
- Modify: `apps/web/src/app/perfil/page.tsx`
- Modify: `apps/web/src/app/gastos/page.tsx`
- Modify: `apps/web/src/app/boveda/page.tsx`
- Modify: `apps/web/src/app/boveda/acuerdos/page.tsx`

**Suggested model:** standard (mecánico pero toca 4 archivos distintos con headers ligeramente distintos)

- [ ] **Step 1: El mismo patrón de back-link en los 4 archivos**

En cada uno de los 4 archivos, justo antes del primer `<h1>`/encabezado de la página (y después del bloque `{isDemoMode && (...)}` si existe), agrega:

```tsx
      <Link
        href={`/mas${as === "b" ? "?as=b" : ""}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Más
      </Link>
```

(Ajusta si el archivo ya importa `Link` de `next/link` — en los 4 casos ya lo hace, no hace falta agregar el import.)

- [ ] **Step 2: Cambiar `<AppNav active="X" />` a `active="Más"` en los 4 archivos**

- `apps/web/src/app/perfil/page.tsx`: `<AppNav active="Perfil" />` → `<AppNav active="Más" />`
- `apps/web/src/app/gastos/page.tsx`: `<AppNav active="Gastos" />` → `<AppNav active="Más" />`
- `apps/web/src/app/boveda/page.tsx`: `<AppNav active="Bóveda" />` → `<AppNav active="Más" />`
- `apps/web/src/app/boveda/acuerdos/page.tsx`: `<AppNav active="Acuerdos" />` → `<AppNav active="Más" />`

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

Esperado: estos 4 errores de la Tarea 9 (Step 2) quedan resueltos. Confirma que no quedan más referencias a `active="Dashboard"`, `active="Perfil"`, `active="Gastos"`, `active="Acuerdos"` o `active="Bóveda"` en todo `apps/web/src` (`grep -rn 'active="Dashboard"\|active="Perfil"\|active="Gastos"\|active="Acuerdos"\|active="Bóveda"' apps/web/src` debe devolver vacío — si queda alguna, corrígela también en esta tarea, no la dejes para después).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/perfil/page.tsx apps/web/src/app/gastos/page.tsx apps/web/src/app/boveda/page.tsx apps/web/src/app/boveda/acuerdos/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): link "← Más" y AppNav active="Más" en Perfil/Gastos/Bóveda/Acuerdos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: `/mas` — grid de "Más funciones"

**Files:**
- Create: `apps/web/src/app/mas/page.tsx`

**Suggested model:** standard (página nueva, grid de 8 tarjetas con 3 deshabilitadas)

- [ ] **Step 1: Escribir la página**

```tsx
import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";

function FeatureCard({
  href,
  label,
  iconBgClass,
  icon,
  disabled,
}: {
  href?: string;
  label: string;
  iconBgClass: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBgClass}`}>{icon}</span>
      <span className="text-center text-sm font-bold leading-tight text-ink">{label}</span>
    </>
  );
  if (disabled) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[18px] border border-subtle bg-card p-[18px_10px] opacity-50 shadow-ambient">
        {inner}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Próximamente</span>
      </div>
    );
  }
  return (
    <Link
      href={href!}
      className="flex flex-col items-center gap-2.5 rounded-[18px] border border-subtle bg-card p-[18px_10px] shadow-ambient"
    >
      {inner}
    </Link>
  );
}

export default async function MasPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const profile = await pairing.getProfile(parentId);
  const asQuery = as === "b" ? "?as=b" : "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {isDemoMode && (
        <p className="mb-6 mt-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/mas" : "/mas?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <h1 className="text-xl font-extrabold text-ink">Más funciones</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <FeatureCard
          href={`/mas/nucleo${asQuery}`}
          label="Tu Núcleo"
          iconBgClass="bg-dawn"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 11l8-6.5L20 11M6 9.5V19a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1V9.5" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/gastos${asQuery}`}
          label="Gastos"
          iconBgClass="bg-orange"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8" stroke="#3a332e" strokeWidth="1.8" />
              <path d="M14.5 9.5c-.4-.8-1.3-1.3-2.5-1.3-1.5 0-2.7.8-2.7 2s1.2 1.8 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.1-.5-2.5-1.3M12 7.3v9.4" stroke="#3a332e" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/perfil${asQuery}`}
          label="Perfil"
          iconBgClass="bg-sky"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8.5" r="3.3" stroke="#3a332e" strokeWidth="1.8" />
              <path d="M5 19.5c1.3-3.2 4-4.8 7-4.8s5.7 1.6 7 4.8" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/boveda${asQuery}`}
          label="Info y documentos"
          iconBgClass="bg-salmon"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="#3a332e" strokeWidth="1.8" />
              <path d="M8 10.5V7.8a4 4 0 118 0v2.7" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
        />
        <FeatureCard
          label="Medicación"
          iconBgClass="bg-success"
          disabled
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="4" stroke="#fff" strokeWidth="1.8" />
              <path d="M12 8v8M8 12h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
        />
        <FeatureCard
          label="Custodia"
          iconBgClass="bg-purple"
          disabled
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7l-3 3 3 3M17 7l3 3-3 3M4 10h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/boveda/acuerdos${asQuery}`}
          label="Acuerdos"
          iconBgClass="bg-sea"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 4.5h7.5L18 8v10.5A1.5 1.5 0 0116.5 20h-9A1.5 1.5 0 016 18.5v-12A1.5 1.5 0 017 4.5z" stroke="#3a332e" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 13.3l1.8 1.8L15 11" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <FeatureCard
          label="Listas"
          iconBgClass="bg-sky"
          disabled
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="4" stroke="#3a332e" strokeWidth="1.8" />
              <path d="M8.5 12l2.2 2.2L16 9" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>

      <AppNav active="Más" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/mas/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): pantalla "Más funciones" (grid de 8 tarjetas)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: `/mas/nucleo` — Tu Núcleo

**Files:**
- Create: `apps/web/src/app/mas/nucleo/page.tsx`

**Suggested model:** standard (lee datos reales de children/familyMembers, requiere mapear correctamente a avatar real o fallback de iniciales)

- [ ] **Step 1: Escribir la página**

```tsx
import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { AVATAR_SRC } from "@/lib/avatars";
import type { AvatarKey } from "@alba/core";

function PersonRow({ name, avatarKey }: { name: string; avatarKey: AvatarKey | null }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-subtle bg-card px-3.5 py-2.5 shadow-ambient">
      {avatarKey ? (
        <img
          src={AVATAR_SRC[avatarKey]}
          alt={name}
          className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
          style={{ objectPosition: "center 15%" }}
        />
      ) : (
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold text-ink">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="text-[15px] font-semibold text-ink">{name}</span>
    </div>
  );
}

export default async function NucleoPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const [profile, children, familyMembers] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);
  const asQuery = as === "b" ? "?as=b" : "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {isDemoMode && (
        <p className="mb-6 mt-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/mas/nucleo" : "/mas/nucleo?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <Link href={`/mas${asQuery}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Más
      </Link>

      <h1 className="text-xl font-extrabold text-ink">Tu Núcleo</h1>
      <p className="mt-1 text-sm text-ink-soft">Quiénes forman parte de la vida de tu familia.</p>

      <div className="mt-5 overflow-hidden rounded-[20px] border border-subtle shadow-ambient">
        <img src="/avatars/retrato-familiar.png" alt="Retrato ilustrado de la familia" className="w-full" />
      </div>

      <div className="mt-6">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-ink">Los hijos</p>
        <div className="flex flex-col gap-2">
          {children.length === 0 ? (
            <p className="rounded-2xl border border-subtle bg-card px-3.5 py-3 text-sm text-ink-soft">
              Todavía no agregaste a ningún hijo.
            </p>
          ) : (
            children.map((child) => <PersonRow key={child.id} name={child.fullName} avatarKey={child.avatarKey} />)
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-ink">Los progenitores</p>
        <div className="flex flex-col gap-2">
          <PersonRow name="Tú" avatarKey={profile?.avatarKey ?? null} />
          {familyMembers
            .filter((m) => m.id !== parentId)
            .map((m) => (
              <PersonRow key={m.id} name={m.fullName} avatarKey={null} />
            ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-ink">Los familiares</p>
        <div className="rounded-2xl border border-dashed border-subtle bg-card px-3.5 py-4 text-center">
          <p className="text-sm font-semibold text-ink">Próximamente</p>
          <p className="mt-1 text-xs text-ink-soft">
            Vas a poder invitar a abuelos, niñeras y otras personas de confianza.
          </p>
        </div>
      </div>

      <AppNav active="Más" />
    </div>
  );
}
```

Nota: `familyMembers` (el otro progenitor) no tiene su propio `avatarKey` expuesto en el tipo `Parent` que devuelve `listFamilyMembers` — confirma el shape real leyendo `packages/core/src/domain/ports.ts`/`entities.ts` antes de escribir esta parte; si `listFamilyMembers` SÍ devuelve `avatarKey` (porque reusa el mismo tipo `Parent`), usa `m.avatarKey` en vez de `null` para que el otro progenitor también muestre su avatar real si ya lo configuró.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace=apps/web
```

- [ ] **Step 3: Verificación en modo demo**

Renombra `.env.local` → `.env.local.disabled-for-qa`, levanta el dev server, confirma en `/mas/nucleo`:
- El retrato familiar completo se ve como banner.
- "Los hijos" muestra el hijo real agregado (o el mensaje vacío si no hay ninguno).
- "Los progenitores" muestra "Tú" y, si está emparejado, al otro progenitor.
- "Los familiares" muestra el estado "Próximamente", sin datos inventados.

Restaura el `.env.local` al terminar.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/mas/nucleo/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): pantalla "Tu Núcleo" (hijos, progenitores, familiares)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Verificación manual completa + typecheck/tests finales

**Files:** ninguno (QA, solo arreglos puntuales si algo falla — con un commit nuevo, no amend de tareas anteriores)

**Suggested model:** standard (requiere criterio para notar problemas de UX, no solo seguir un script)

- [ ] **Step 1: Typecheck y tests de todo el monorepo**

```bash
npm run typecheck
npm run test --workspace=packages/core
```

Esperado: 0 errores, todos los tests en verde.

- [ ] **Step 2: Recorrido en modo demo**

Renombra `apps/web/.env.local` → `.env.local.disabled-for-qa`, levanta el dev server.

1. **Nav**: confirma que el nav inferior tiene 4 ítems (Inicio/Chat/Calendario/Más) y que el de "Más" muestra el ícono de grid 2×2.
2. **Header**: en cada una de las 4 pestañas, confirma que el header (avatar/alba./campana) aparece fijo arriba.
3. **Perfil**: elige un avatar y un color, guarda, confirma que persiste al recargar.
4. **Inicio**: confirma el modal "Así funciona" automático la primera vez; recarga, confirma que ya no aparece solo pero el ícono "i" lo reabre; si hay un hijo con avatar elegido, confirma que se ve centrado arriba.
5. **Chat** y **Calendario**: mismo chequeo de modal automático + ícono "i" manual.
6. **Calendario**: confirma que los 3 chips de filtro (Este mes/Esta semana/Hoy) cambian la vista correctamente y resaltan el activo.
7. **FAB**: en Inicio, Chat y Calendario, confirma que el "+" aparece abajo a la derecha, se abre con las acciones correctas por sección, y que gira a "×" mientras está abierto. Confirma que NO aparece en `/mas` ni en `/mas/nucleo`.
8. **Más**: confirma el grid de 8 tarjetas, que Medicación/Custodia/Listas se ven atenuadas y no navegan a ningún lado.
9. **Tu Núcleo**: confirma el banner del retrato familiar, y las 3 secciones con datos reales (o el estado vacío/"Próximamente" donde corresponda).
10. **Perfil, Gastos, Bóveda, Acuerdos**: confirma que cada una tiene el link "← Más" arriba, y que el nav inferior resalta "Más" al estar en cualquiera de ellas.
11. **Fondo**: confirma visualmente que todas las pantallas del shell autenticado se ven blancas (no beige), con las tarjetas distinguiéndose por su borde delgado.

Restaura `.env.local.disabled-for-qa` → `.env.local` al terminar, sin excepción.

- [ ] **Step 3: Arreglar lo que encuentres**

Si algo falla, corrígelo aquí mismo con los cambios mínimos necesarios.

- [ ] **Step 4: Commit (solo si el Step 3 requirió cambios)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(web): ajustes encontrados en verificación manual del shell visual

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Cobertura del spec:** cada sección del spec (1. Nav, 2. FAB, 3. Header, 4. Fondo blanco, 5. Modales, 6. Inicio, 7. Tu Núcleo, 8. Calendario, 9. Más funciones) tiene al menos una tarea que la implementa. Las 7 Deviations documentadas arriba cubren cada punto donde el código real obligó a una decisión que el spec dejaba abierta o no podía anticipar sin leer el código (banner de alertas ya existente, "Nueva tarea" sin backend, filtros de Calendario mapeados a navegación existente, alcance del fondo blanco, back-links de las 4 páginas que perdieron su ícono de nav).

**2. Sin placeholders:** cada paso de código trae el contenido completo a escribir — no hay "TODO", "agregar validación", ni "similar a la Tarea X" sin el código repetido.

**3. Consistencia de tipos:** `AvatarKey`/`AVATAR_KEYS` se define una sola vez (Tarea 1) y se usa idéntico en entities/schemas/mock/Supabase/componentes (Tareas 2, 4, 5, 6, 10, 13, 14, 15, 18). `SectionIntroModal`/`QuickActionFab`/`AppHeader` se definen una vez (Tareas 10-12) y se consumen igual en Dashboard/Chat/Calendario (Tareas 13-15) — mismas props (`sectionKey`, `as`, `alreadySeen`, `hero`, etc.) en los 3 usos.

**4. Orden de dependencias:** Tareas 1-4 (avatares + core + migración + repos) antes que cualquier UI que los consuma (Tareas 5-6, 10, 13-15, 18) — ningún componente de UI referencia un campo que no exista todavía en `Parent`/`Child` en el momento en que se escribe.

**5. Riesgo:** la Tarea 8 (sweep de `bg-sand`) es la más mecánica pero también la de mayor superficie (12 archivos) — se escribió con el patrón exacto por archivo, no como "busca y reemplaza en todo el repo", justamente para no tocar los usos decorativos de `bg-sand` (chips, skeleton, tracks) que deben quedarse igual.
