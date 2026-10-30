# Calendario: Fechas importantes, Vacaciones y colores por progenitor/hijo

## Contexto

La clienta mandó una lista de mejoras escrita a mano, que mezclaba tres bloques independientes de la app: Calendario, Gastos y Chat. Se decidió partir esa lista en tres specs separados — **este documento cubre solo Calendario**. Gastos (mejorar UI + exportar) y Chat (quitar el elemento relacionado a "lo que resta" en calendarios) quedan pendientes, cada uno con su propio spec cuando se aborden.

Dentro de Calendario, la nota agrupaba tres pedidos, aclarados con la clienta antes de diseñar nada (las notas originales eran ambiguas: verbos sin objeto como "Quitar" y "Vincular"):

1. Una sección nueva, **"Fechas importantes"**, dentro de "Convivencia".
2. Reemplazar la sección actual **"Lugares de encuentro"** por **"Vacaciones"**.
3. **Colores fijos** por progenitor y por hijo, visibles en el grid del calendario.

## Qué NO incluye este spec (alcance deliberadamente acotado)

- **Mapa embebido** (Google Maps/Mapbox con pines reales) — la clienta eligió explícitamente la opción liviana: un campo de dirección + botón "Ver en mapa" que abre Google Maps en una pestaña nueva. Sin API key, sin geocodificación, sin costo de mapas.
- **Recurrencia automática** de fechas importantes (ej. "repetir este cumpleaños cada año" sin volver a crearlo) — cada fecha importante se crea una vez por ocurrencia, igual criterio que Visitas hoy.
- **Catálogo fijo de tipos** de fecha importante (ej. un enum "cumpleaños" / "escuela" / "otro") — la clienta pidió que sea libre (título de texto), no una lista cerrada.
- **Renombrar la entidad `MeetingPlace` en el código** — para no arrastrar un refactor grande de todo lo que ya usa `meetingPlaces`/`placeId` (slots, visitas), la entidad se queda con su nombre técnico actual; solo la UI pasa a llamarse "Vacaciones" y el tipo gana campos opcionales nuevos.
- **Impedir que ambos progenitores elijan el mismo color** — se avisa con un mensaje si coinciden, pero no se bloquea (simplicidad; es una preferencia visual, no una regla de negocio).

## Diseño

### 1. Fechas importantes

Nueva sección dentro de Calendario (junto a "Convenio — slots de custodia", "Visitas" y "Vacaciones"), para dos casos que la clienta quiere cubrir con la misma herramienta:

- Eventos recurrentes del hijo (cumpleaños, inicio/fin de ciclo escolar, vacaciones escolares).
- Recordatorios libres que cualquier progenitor agrega, sin catálogo fijo.

A diferencia de Visita (que vive en un solo día con hora de inicio/fin), una fecha importante es **un rango de fecha sin hora** — puede durar 1 día, una semana o un mes completo, y opcionalmente está ligada a un hijo.

**Entidad nueva** (`packages/core/src/domain/entities.ts`):

```ts
export interface ImportantDate {
  id: string;
  title: string;
  /** null = recordatorio libre, no ligado a un hijo en particular. */
  childId: string | null;
  /** "YYYY-MM-DD", fecha local. */
  startDate: string;
  /** "YYYY-MM-DD", fecha local, >= startDate. Igual a startDate = evento de 1 día. */
  endDate: string;
  createdByParentId: string;
}
```

**Puerto** — se agrega a `CustodyRepository` (`packages/core/src/domain/ports.ts:162`), mismo criterio que `listVisitsForRange`/`createVisit`/`deleteVisit`:

```ts
listImportantDatesForRange(parentId: string, start: string, end: string): Promise<ImportantDate[]>;
createImportantDate(parentId: string, input: ImportantDateInput): Promise<ImportantDate>;
deleteImportantDate(parentId: string, importantDateId: string): Promise<void>;
```

`ImportantDateInput` (`packages/core/src/validation/schemas.ts`, mismo patrón que `VisitInput`): `{ title: string (2-120 chars), childId: string | null, startDate: string, endDate: string }`, con validación `endDate >= startDate`.

**Migración nueva** `0029_fechas_importantes.sql`:

```sql
create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  title text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_by_parent_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
```

RLS idéntica a `custody_visits`/`meeting_places` (0024/0020): los dos miembros de la familia leen/crean/borran, sin "dueño" individual.

**UI** (`apps/web/src/app/calendario/page.tsx`): nuevo accordion "Fechas importantes" después de "Visitas" (antes de "Vacaciones"), mismo patrón de formulario que Visitas pero con un rango de fecha (dos `<input type="date">`, inicio y fin) en vez de fecha única + horas. En el grid mensual/semanal, cada día dentro del rango de una fecha importante muestra un marcador propio (un pequeño diamante ámbar, para no confundirse con los puntos redondos de custodia/verde y visita/morado que ya existen) y aparece listada en el panel del día seleccionado igual que las visitas.

### 2. "Lugares de encuentro" → "Vacaciones"

El selector de ubicación que hoy usan Convenio y Visitas (`meetingPlaces`, `calendario/page.tsx:565` y `:682`) se mantiene funcionando exactamente igual — no se toca esa integración. Lo que cambia es que cada lugar guardado gana campos opcionales para cuando ese "lugar" es en realidad un viaje/vacación, y el accordion se renombra de "Lugares de encuentro" a "Vacaciones".

**Entidad `MeetingPlace` extendida** (`packages/core/src/domain/entities.ts:222`):

```ts
export interface MeetingPlace {
  id: string;
  name: string;
  /** Dirección libre (para el botón "Ver en mapa") — null si no se especificó. */
  address: string | null;
  /** "YYYY-MM-DD" — null si este lugar no es una vacación con hotel. */
  hotelCheckIn: string | null;
  hotelCheckOut: string | null;
  /** Texto libre — mismo criterio que Child.notes. */
  contacts: string | null;
  itinerary: string | null;
}
```

**Puerto** — `createMeetingPlace` pasa a recibir un input con los campos opcionales (en vez de solo `name`), y se agrega `updateMeetingPlace` para poder editar un lugar ya creado (hoy solo se puede crear/borrar):

```ts
createMeetingPlace(parentId: string, input: MeetingPlaceInput): Promise<MeetingPlace>;
updateMeetingPlace(parentId: string, placeId: string, input: MeetingPlaceInput): Promise<MeetingPlace>;
```

`MeetingPlaceInput`: `{ name: string, address: string | null, hotelCheckIn: string | null, hotelCheckOut: string | null, contacts: string | null, itinerary: string | null }`.

**Migración nueva** `0030_vacaciones_en_lugares.sql`:

```sql
alter table public.meeting_places
  add column if not exists address text,
  add column if not exists hotel_check_in date,
  add column if not exists hotel_check_out date,
  add column if not exists contacts text,
  add column if not exists itinerary text;
```

Idempotente, sin tocar RLS existente (ya cubre esta tabla completa, no por columna).

**UI**: el accordion "Lugares de encuentro" (`calendario/page.tsx:701-725`) se renombra a "Vacaciones" y su formulario de alta crece de un solo campo (`name`) a un formulario corto: nombre, dirección (opcional, con el botón "Ver en mapa" que aparece una vez guardada — `https://www.google.com/maps/search/?api=1&query=<address>`), fecha de hotel (rango, opcional), contactos (opcional), itinerario (opcional). Los lugares sin ninguno de estos campos extra siguen funcionando exactamente como "lugares de encuentro" simples en los selectores de Convenio/Visitas — no se obliga a llenar nada nuevo.

### 3. Color fijo por progenitor y por hijo

Hoy el calendario distingue "tú" vs. "el otro progenitor" con un color **relativo** (`parentAccent(isMe)`, `calendario/page.tsx:352`) — cambia según quién mire la app. Pasa a ser un color **fijo por persona**, elegido una vez en el perfil de cada progenitor y de cada hijo, igual para los dos sin importar quién lo vea.

**Entidades** (`packages/core/src/domain/entities.ts`):

```ts
export interface Parent {
  // ...campos existentes...
  /** Color elegido en Perfil, hex (ej. "#2fae7a"). null = todavía no eligió uno. */
  color: string | null;
}

export interface Child {
  // ...campos existentes...
  /** Mismo criterio que Parent.color. */
  color: string | null;
}
```

Se agregan a `UpsertProfileInput` (Parent) y `UpdateChildDetailsInput` (Child) en `packages/core/src/validation/schemas.ts`, como un campo opcional validado contra una paleta fija (evita que alguien pegue cualquier string raro ahí). La paleta reusa los tokens de color que la app ya usa en todas partes: `orange`, `sky`, `salmon`, `success`, `dawn`, `danger` (se excluye `purple`, reservado para "Visita" en el diseño actual) — así los colores elegidos ya conviven con la paleta visual existente en vez de introducir tonos nuevos.

**Migración nueva** `0031_colores_progenitor_hijo.sql`:

```sql
alter table public.profiles add column if not exists color text;
alter table public.children add column if not exists color text;
```

**UI**:

- **Perfil** (`apps/web/src/app/perfil/page.tsx`) y **perfil del hijo** (`perfil/hijo/[childId]/page.tsx`): un selector de color (paleta fija, no color picker libre) agregado al formulario existente de cada uno.
- **Fallback sin color elegido**: mientras `color` sea `null`, el progenitor sigue viéndose con el acento relativo actual ("tú" vs. "el otro") y el hijo con un gris neutro — así nadie pierde la distinción visual de hoy mientras no haya elegido un color todavía.
- **Grid mensual/semanal** (`calendario/page.tsx:266-313`): cada celda de día agrega una franja de 4px debajo del número, dividida en dos mitades — izquierda con el/los color(es) de progenitor(es) con algo ese día, derecha con el/los color(es) de hijo(s) involucrado(s). Si hay más de un progenitor o hijo ese día, la mitad correspondiente se reparte en bandas iguales entre esos colores. Los puntos redondos que ya existen (verde = custodia, morado = visita) se mantienen arriba de la franja, sin cambios — ahora con un tercer marcador (diamante ámbar) para fechas importantes, ver sección 1.
- **Lista del día seleccionado** (`calendario/page.tsx:356-474`): el círculo con la inicial (`accent.avatar`) pasa a usar el color fijo real del progenitor en vez del acento relativo; junto al nombre del hijo se agrega un punto pequeño con su color fijo.

## Migraciones, en orden

1. `0029_fechas_importantes.sql`
2. `0030_vacaciones_en_lugares.sql`
3. `0031_colores_progenitor_hijo.sql`

## Testing

- `packages/core`: tests de validación para `ImportantDateInput` (rechaza `endDate < startDate`, título fuera de rango de longitud) y para el nuevo campo `color` en los schemas existentes (rechaza valores fuera de la paleta fija).
- `apps/web`: el modo demo (mock repositories) necesita las mismas tres funciones nuevas en `mockCustodyRepository.ts` para poder probar la UI sin Supabase real — mismo patrón que ya existe para Visitas.
- Verificación manual en navegador (preview local): crear una fecha importante con rango de una semana y confirmar que aparece marcada los 7 días en el grid; transformar un lugar de encuentro existente en "vacación" agregando dirección y confirmar que el botón "Ver en mapa" abre Google Maps con esa dirección; elegir colores distintos para ambos progenitores y para 2 hijos, y confirmar que el grid y la lista del día los reflejan.
