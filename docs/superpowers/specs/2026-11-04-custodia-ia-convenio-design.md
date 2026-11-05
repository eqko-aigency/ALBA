# Custodia: sección dedicada con calendario/recordatorios asistidos por IA

## Contexto

La tarjeta "Custodia" en `/mas` existe hoy como placeholder deshabilitado ("Próximamente"), sin ninguna pantalla detrás. Mucho de lo que uno esperaría de "custodia" ya está construido, pero vive disperso dentro de `/calendario`:

- **Convenio — slots de custodia**: editor manual de horario semanal recurrente por hijo/progenitor (`CustodyAgreement`/`CustodySlot`).
- **Check-in/check-out**: confirmación de traspasos con detección determinística de incumplimientos (`findComplianceIssues`, sin IA — ver `packages/core/src/compliance/complianceEngine.ts`).
- **Visitas**, **Vacaciones** y **Fechas importantes** (`Visit`, `MeetingPlace`, `ImportantDate`).

La clienta compartió 3 capturas de una app competidora ("Niido") como referencia (guardadas en `docs/design/pantallas niido/`): una pantalla "Custodia" con 3 pestañas (Calendario, Intercambios, Recordatorios), donde la idea central es que el progenitor **sube el convenio y una IA lo analiza** para armar el calendario automáticamente, en vez de llenar el formulario de slots a mano.

Este spec cubre la sección dedicada `/mas/custodia`, construida tomando esas capturas como inspiración (no como especificación literal — el copy, las etiquetas y el modelo de datos se adaptaron a lo ya existente en ALBA).

## Qué NO incluye este spec (alcance deliberadamente acotado)

- **No se toca el editor manual de slots** en `/calendario` ("Convenio — slots de custodia") — sigue funcionando exactamente igual. El camino asistido por IA es un atajo adicional, no un reemplazo.
- **No se analizan documentos Word** (.doc/.docx) — solo PDF e imágenes, que Claude puede leer directamente sin agregar una librería nueva de extracción de texto.
- **No se escanean hilos de chat sin confirmar** — la IA solo lee los `VerbalAgreement` ya confirmados por ambos progenitores (entidad existente), nunca mensajes sueltos.
- **No se modela recurrencia ni estado de obligaciones** ("pagar colegiatura el día 5 de cada mes" con estado pendiente/cumplido) — los "Recordatorios" son fechas puntuales o en rango, reusando `ImportantDate` tal cual existe.
- **Sin nombre de marca para el asistente IA** — el copy usa frases genéricas ("Configurar con IA", "Analizar mis documentos"), no un nombre propio tipo "Niido AI".
- **La propuesta de la IA nunca se guarda sola** — siempre requiere revisión y confirmación humana antes de volverse parte real del convenio/calendario, mismo criterio que `AgreementDetector`/`ToneAnalyzer`/`findComplianceIssues` ya establecido en el resto de la app.

## Diseño

### 1. Estructura general

Nueva ruta `apps/web/src/app/mas/custodia/page.tsx` (mismo patrón que `/mas/nucleo`): Server Component, `AppHeader`, `AppNav active="Más"`, back-link a `/mas`.

Tres pestañas controladas por query param `?tab=calendario|intercambios|recordatorios` (default `calendario`) — server-rendered, mismo criterio que los filtros de `/calendario` (`view`, `month`, `day`), sin estado cliente nuevo. Un componente simple de navegación por pestañas (`<Link>` con clase activa según el query param) encabeza la página.

La tarjeta "Custodia" en `apps/web/src/app/mas/page.tsx` pasa de `disabled` a `href="/mas/custodia${asQuery}"`.

Las tres pestañas leen el mismo `CustodyAgreement` de la familia (`CustodyRepository.getMyAgreement`).

### 2. Pestaña Calendario (resumen)

**Estado vacío** (`agreement.slots.length === 0`):

```
[ícono de calendario]
Aún no has configurado la custodia
Crea el calendario de custodia con ayuda de la IA
[Configurar con IA]
```

Al tocar "Configurar con IA":

1. Si la familia no tiene ningún documento PDF/imagen en Bóveda, se muestra un mensaje corto con link a `/boveda` para subir uno primero.
2. Si hay documentos, un selector `<select>` simple: "¿Cuál de tus documentos es el convenio?" — lista los documentos de `DocumentRepository.listDocuments` filtrados por mimeType PDF/imagen (ver sección 5 sobre el nuevo campo `mimeType` en `Document`).
3. Al elegir uno y confirmar, un Server Action llama a `CustodyDocumentAnalyzer.proposeSchedule` con los bytes del documento elegido + los `VerbalAgreement` ya confirmados de la familia (sin selector aparte — siempre se incluyen si existen).
4. El resultado (`CustodyScheduleProposal.slots`) se muestra como una lista editable: cada slot propuesto (día/hora inicio-fin/hijo/progenitor) con checkbox marcado por default, y los mismos campos editables que ya usa el formulario manual de Convenio (reutiliza los mismos `<select>`/`<input type="time">`).
5. Botón **"Agregar a mi convenio"**: el Server Action toma los slots tildados, los concatena con `agreement.slots` ya existentes (nunca los reemplaza — ver nota en sección 5 sobre `upsertSlots`), y llama `CustodyRepository.upsertSlots` con la lista combinada.
6. Si la IA no propone nada (documento no parece un convenio de custodia), se muestra "No pudimos detectar un horario de custodia en este documento — puedes intentar con otro o crear los horarios a mano en Calendario" con link a `/calendario`.

**Con slots ya configurados** (`agreement.slots.length > 0`):

Vista de solo lectura, agrupada por hijo: "Esta semana con [hijo]: [lista de slots ordenados por día]". Debajo, un botón secundario más chico "Volver a analizar con IA" repite el flujo de arriba (útil si el convenio cambió y hay un documento nuevo).

### 3. Pestaña Intercambios

**Bloqueada** si `agreement.slots.length === 0`:

```
Para ver los intercambios, primero activa un convenio de custodia.
[Ir a Calendario]
```

**Con convenio activo**, dos bloques:

**Próximos intercambios** (arriba): calcula los próximos traspasos a partir de `agreement.slots` para los próximos 14 días (mismo horizonte que ya usa el Dashboard para "Necesita tu atención"), usando `CustodyRepository.listEventsForRange` para saber cuáles ya tienen check-in/check-out confirmado. Cada fila muestra hijo, día/hora, progenitor que entrega/recibe, lugar (si el slot tiene `placeId`, resuelto contra `listMeetingPlaces`), y los botones de confirmar check-in/check-out — mismos Server Actions ya existentes (`confirmCheckinAction`/`confirmCheckoutAction` de `apps/web/src/app/calendario/actions.ts`, reutilizados tal cual).

**Historial** (abajo): los últimos 14 días hacia atrás, mismo rango simétrico. Para cada día con slot, corre `findComplianceIssues(agreement, events, día)` (ya existe, sin cambios) y muestra el resultado: "A tiempo" / "Tardío (N min)" / "Sin confirmar", con el mismo código de color que ya usa `/calendario` (naranja tardío, rojo sin confirmar).

No se agrega ninguna entidad ni método de puerto nuevo para esta pestaña — es una vista nueva sobre datos que ya existen.

### 4. Pestaña Recordatorios

**Estado vacío** (sin `ImportantDate` creados — o mejor dicho, antes de la primera vez que se corre el análisis; no hay forma de distinguir "no hay recordatorios" de "no se ha analizado todavía", así que el estado vacío siempre ofrece analizar):

```
[ícono de campana]
Aún no hay recordatorios
Analiza tu convenio para detectar obligaciones, fechas y avisos
[Analizar mis documentos]

¿Todavía no has subido ningún documento?
Sube tu convenio en Bóveda
```

(Nota: la captura original decía "Sube tu convenio en el chat" — se ajustó a "en Bóveda" porque ya definimos que la fuente documental es Bóveda, no un adjunto de chat.)

Mismo selector de documento que en la pestaña Calendario (recuerda la última selección vía query param, ej. `?tab=recordatorios&documentId=...`, no hace falta persistir nada en DB).

El Server Action llama `CustodyDocumentAnalyzer.proposeReminders` con los mismos bytes + `VerbalAgreement` confirmados. El resultado (`ReminderProposal.reminders`) se muestra como lista editable (título, rango de fecha, hijo opcional — mismos campos que el formulario manual de "Fechas importantes" en `/calendario`), con checkbox marcado por default.

Botón **"Agregar recordatorios"**: llama `CustodyRepository.createImportantDate` una vez por cada fila tildada (método existente, sin cambios — no hay operación de "crear varios a la vez", se itera).

**Con recordatorios ya creados**: se listan debajo usando `listImportantDatesForRange` para un horizonte amplio (ej. próximos 6 meses), mismo componente visual que ya existe en `/calendario` para "Fechas importantes". Botón secundario "Volver a analizar" repite el flujo.

### 5. Arquitectura técnica

**Nuevo puerto** (`packages/core/src/domain/ports.ts`), mismo criterio que `AgreementDetector`/`ToneAnalyzer`: nunca corre en el cliente, implementación real instanciada server-side solo si existe `ANTHROPIC_API_KEY`.

```ts
export interface CustodyScheduleProposalSlot {
  childId: string;
  parentId: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface ReminderProposalItem {
  title: string;
  /** null = no ligado a un hijo en particular, mismo criterio que ImportantDate.childId */
  childId: string | null;
  startDate: string;
  endDate: string;
}

/**
 * Analiza el convenio (documento + acuerdos verbales confirmados) para
 * proponer horario de custodia y/o fechas importantes — nunca escribe
 * directamente, solo propone; la UI exige confirmación humana antes de
 * persistir (ver findComplianceIssues/AgreementDetector para el mismo
 * criterio ya establecido en el resto de la app).
 */
export interface CustodyDocumentAnalyzer {
  proposeSchedule(input: {
    documentBytes: Uint8Array;
    mimeType: string;
    verbalAgreements: VerbalAgreement[];
    children: Child[];
    familyMembers: Parent[];
  }): Promise<{ slots: CustodyScheduleProposalSlot[] }>;

  proposeReminders(input: {
    documentBytes: Uint8Array;
    mimeType: string;
    verbalAgreements: VerbalAgreement[];
    children: Child[];
  }): Promise<{ reminders: ReminderProposalItem[] }>;
}
```

`children`/`familyMembers` se pasan para que el prompt pueda mapear nombres mencionados en el documento ("Eugenia", "papá") a los `childId`/`parentId` reales de la familia — sin esto la IA no tendría forma de saber a qué ID se refiere cada nombre propio.

**Implementación real**: `packages/api-client/src/tone/anthropicCustodyDocumentAnalyzer.ts`, mismo patrón que `anthropicAgreementDetector.ts` (`extractJson` compartido, prompt en español, `try/catch` que cae a "sin propuesta" ante JSON no parseable en vez de romper el flujo). A diferencia de `AgreementDetector` (que solo recibe texto), este envía el documento como content block `document` (PDF) o `image` (foto/escaneo) en la llamada a `client.messages.create` — Claude soporta ambos nativamente. El modelo exacto (Haiku vs Sonnet) se decide en implementación según qué tan bien interprete documentos reales en pruebas; el spec no lo fija de antemano.

**Implementación de prueba** (demo mode): `packages/api-client/src/tone/heuristicCustodyDocumentAnalyzer.ts` — devuelve una propuesta fija de ejemplo (2-3 slots, 1-2 recordatorios) sin llamar a ninguna API, mismo criterio que `heuristicAgreementDetector.ts`, para poder probar el flujo completo en modo demo sin `ANTHROPIC_API_KEY`.

**Nuevo método en `DocumentRepository`**: hoy `Document` no expone forma de releer los bytes de un archivo ya subido (solo guarda `fileUrl`). Se agrega:

```ts
getDocumentFileBytes(parentId: string, documentId: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
```

Implementación Supabase: descarga desde Storage usando `fileUrl`. Implementación mock: sirve los bytes guardados en memoria desde `uploadDocument`.

**Nuevo campo en `Document`**: se agrega `mimeType: string` a la entidad (hoy se recibe en `uploadDocument` pero se descarta después de guardar el archivo) — necesario para que el selector de documentos en Custodia pueda filtrar solo PDF/imagen sin adivinar por extensión del nombre de archivo. Migración `0038_mimetype_documentos.sql`:

```sql
alter table public.documents add column if not exists mime_type text;
```

Los documentos ya existentes (subidos antes de esta migración) quedan con `mime_type` null — se excluyen del selector de Custodia (no se puede inferir con certeza), sin romper nada en Bóveda (donde no se usa este campo).

**Merge de slots propuestos con el convenio existente**: `upsertSlots` reemplaza TODOS los slots (comportamiento ya documentado en el puerto, sin cambios). El Server Action de "Agregar a mi convenio" (`apps/web/src/app/mas/custodia/actions.ts`) es responsable de leer `agreement.slots` actual, concatenar los slots tildados de la propuesta, y recién ahí llamar `upsertSlots` con la lista combinada — así el camino IA nunca pisa lo que el editor manual ya tenía.

## Migraciones, en orden

1. `0038_mimetype_documentos.sql`

## Testing

- `packages/core`: no hay lógica de validación nueva que testear directamente (los schemas de `CustodyScheduleProposalSlot`/`ReminderProposalItem` son tipos de puerto, no inputs validados con Zod — la validación real ocurre quando se confirma y se llama `upsertSlots`/`createImportantDate`, que ya tienen sus propios tests).
- `packages/api-client`: test de `heuristicCustodyDocumentAnalyzer` (devuelve la propuesta fija esperada) y de `extractJson` si el parseo de la respuesta de Claude necesita casos nuevos (documento sin convenio detectable → `{ slots: [] }`).
- `apps/web`: el mock `DocumentRepository`/`CustodyRepository` necesita `getDocumentFileBytes` implementado para poder probar el flujo en modo demo.
- Verificación manual en navegador (preview local, modo demo): subir un PDF cualquiera a Bóveda, ir a `/mas/custodia`, confirmar que el selector lo lista, correr "Configurar con IA" y confirmar que aparece la propuesta fija del heurístico, tildar/destildar slots y confirmar que "Agregar a mi convenio" los suma a los que ya había (no los reemplaza); repetir para Recordatorios; confirmar que Intercambios queda bloqueada sin convenio y se desbloquea después.
