# Detección automática de acuerdos en el Chat (Fase 1)

## Contexto

Pedido de la clienta: cuando los progenitores negocian algo en el Chat (ej. "¿el jueves a las 5 llevas a Eugenia al pediatra?" → "sí, va"), hoy no queda ningún rastro formal de ese acuerdo salvo releer el hilo completo. ALBA ya tiene una función de **Acuerdos verbales** (`/boveda/acuerdos`) para registrar justo este tipo de cosas, pero hoy solo se llena a mano, sin relación con el Chat.

La pregunta original de la clienta mezclaba tres ideas: (1) detectar acuerdos en el texto del Chat, (2) mandar audios en el Chat, (3) transcribir esos audios y detectarles acuerdos también. Se decidió dividir en fases independientes — este documento cubre **solo la Fase 1** (detección en mensajes de texto, sin audio). Fases 2 (mensajes de voz) y 3 (transcripción) quedan como specs separados, a futuro.

## Qué NO incluye esta fase (alcance deliberadamente acotado)

- No analiza mensajes de voz/audio — no existen todavía en el Chat.
- No analiza el historial completo de un hilo, solo los últimos ~8 mensajes.
- No permite más de una sugerencia de acuerdo pendiente a la vez por hilo.
- No intenta distinguir "quién propuso" vs "quién confirmó" el acuerdo — se registra con `createdByParentId` = quien haga clic en "Registrar", igual que ya funciona el flujo manual existente.
- No agrega ninguna UI nueva a `/boveda/acuerdos` — ese flujo manual se queda exactamente como está, esta fase solo le agrega una segunda forma de llegar a crear una fila ahí (desde el Chat).

## Diseño

### 1. Disparo: automático, después de cada mensaje

Mismo patrón que el Tone Meter ya existente ([anthropicToneAnalyzer.ts](../../../packages/api-client/src/tone/anthropicToneAnalyzer.ts)): cada vez que `sendMessageAction` ([chat/[threadId]/actions.ts](../../../apps/web/src/app/chat/%5BthreadId%5D/actions.ts)) guarda un mensaje nuevo, se dispara el análisis de acuerdos sobre el hilo. A diferencia del Tone Meter (que bloquea el envío hasta tener respuesta), este análisis corre **después** de que el mensaje ya se guardó y no bloquea nada para quien está escribiendo.

### 2. Nuevo puerto de dominio: `AgreementDetector`

Mismo molde que `ToneAnalyzer` (packages/core/src/domain/ports.ts):

```ts
export interface AgreementDetectedResult {
  isAgreement: boolean;
  /** Resumen en una frase, listo para precargar el campo description de
   * VerbalAgreementInput. null cuando isAgreement es false. */
  description: string | null;
}

export interface AgreementDetector {
  /** messages: los últimos ~8 mensajes del hilo, más antiguo primero,
   * cada uno con quién lo mandó (para que el modelo entienda el
   * intercambio, no solo texto suelto) y el texto. */
  detect(messages: { senderLabel: "Tú" | "El otro progenitor"; body: string }[]): Promise<AgreementDetectedResult>;
}
```

Implementación real (`createAnthropicAgreementDetector`, mismo archivo/carpeta que `anthropicToneAnalyzer.ts`): modelo `claude-haiku-4-5-20251001`, prompt de sistema que pide JSON estricto `{"isAgreement": boolean, "description": string | null}`, reutiliza el mismo helper `extractJson` (fencing de markdown) que ya existe. Igual que el Tone Meter, nunca debe inventar datos que no estén en los mensajes — el prompt lo deja explícito.

Implementación de prueba (`createHeuristicAgreementDetector`, mismo patrón que `createHeuristicToneAnalyzer`): heurística simple (ej. busca palabras como "va", "sí", "de acuerdo", "confirmado" cerca de una pregunta reciente) para poder construir/probar sin API key — igual que ya existe para el Tone Meter.

Se registra en `apps/web/src/lib/repository.ts` junto al `toneAnalyzer` existente, mismo criterio: real si `ANTHROPIC_API_KEY` está configurada, heurística si no.

### 3. Dónde vive el estado: dos columnas nuevas en `chat_threads`

Migración nueva (`0026_sugerencia_acuerdo_en_chat.sql`):

```sql
alter table public.chat_threads
  add column if not exists pending_agreement_suggestion text,
  add column if not exists pending_agreement_suggestion_based_on uuid references public.messages(id) on delete set null;
```

En cada envío de mensaje, el resultado del análisis **sobreescribe** estas dos columnas:
- `isAgreement: true` → guarda `description` y el id del mensaje que disparó el análisis.
- `isAgreement: false` → limpia ambas a `null` (si la conversación siguió y ya no aplica — ej. "mejor el viernes no el jueves" — la sugerencia vieja no debe quedar pegada mostrando algo obsoleto).

Esto mantiene como invariante: el estado guardado siempre refleja el análisis del *último* mensaje del hilo, nunca uno desactualizado.

### 4. UI: banner en el hilo de chat

En `/chat/[threadId]/page.tsx`, cuando `thread.pendingAgreementSuggestion` no es null, se muestra un banner arriba del `MessageComposer` (mismo estilo visual que la tarjeta morada "✦ ALBA sugiere" que ya usa el Tone Meter), visible para **cualquiera** de los dos progenitores que abra el hilo (el estado vive en el hilo, no es por-usuario):

```
✦ ALBA sugiere
"Acuerdan que Eugenia va al pediatra el jueves 16 a las 5pm"
[Registrar como acuerdo]   [Ignorar]
```

- **Registrar como acuerdo** → nuevo Server Action `confirmAgreementSuggestionAction`: llama `verbalAgreements.createVerbalAgreement(parentId, { childId: thread.childId, description: thread.pendingAgreementSuggestion, agreedAt: hoy })` (reutiliza el repositorio ya existente, sin lógica nueva de escritura) y limpia las dos columnas del hilo.
- **Ignorar** → nuevo Server Action `dismissAgreementSuggestionAction`: solo limpia las dos columnas.

### 5. Capas a tocar (resumen)

- `packages/core/src/domain/ports.ts` — nuevo puerto `AgreementDetector` + tipo `AgreementDetectedResult`.
- `packages/api-client/src/tone/anthropicAgreementDetector.ts` (nuevo) + `heuristicAgreementDetector.ts` (nuevo) — mismo patrón que los dos analizadores de tono ya existentes.
- `packages/core/src/domain/entities.ts` — `ChatThread` gana `pendingAgreementSuggestion: string | null` y `pendingAgreementSuggestionBasedOn: string | null`.
- `packages/api-client/src/chat/supabaseChatRepository.ts` / `mockChatRepository.ts` — mapear las dos columnas nuevas; `sendMessage` pasa a correr el detector después de insertar y persistir el resultado.
- `supabase/migrations/0026_sugerencia_acuerdo_en_chat.sql` (nuevo).
- `apps/web/src/lib/repository.ts` — registrar `agreementDetector` (real/heurístico) igual que `toneAnalyzer`.
- `apps/web/src/app/chat/[threadId]/actions.ts` — `confirmAgreementSuggestionAction`, `dismissAgreementSuggestionAction`.
- `apps/web/src/app/chat/[threadId]/page.tsx` — banner nuevo.

## Testing

- Verificación en vivo (no mock) con un hilo real de dos progenitores emparejados: mandar un intercambio tipo propuesta→confirmación, confirmar que aparece el banner con un resumen razonable, confirmar que "Registrar" crea la fila correcta en `/boveda/acuerdos` con el `childId` heredado del hilo, confirmar que "Ignorar" limpia el banner sin crear nada.
- Confirmar que un mensaje posterior que NO es un acuerdo limpia una sugerencia pendiente anterior (evita sugerencias obsoletas).
- Confirmar en modo heurístico (sin `ANTHROPIC_API_KEY`) que el flujo completo no truena, aunque la detección sea más tosca.
