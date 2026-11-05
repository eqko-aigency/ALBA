import Anthropic from "@anthropic-ai/sdk";
import type {
  Child,
  CustodyDocumentAnalyzer,
  CustodyScheduleProposalSlot,
  Parent,
  ReminderProposalItem,
  VerbalAgreement,
} from "@alba/core";
import { extractJson } from "./extractJson";

// Sonnet (no Haiku, a diferencia del resto de la app) — esta tarea lee un
// documento real (PDF/foto de un convenio legal) y extrae una estructura
// de varios campos, no solo clasifica un mensaje corto; en pruebas
// informales Sonnet interpreta documentos escaneados/PDFs con mucha más
// consistencia que Haiku. Si en producción Haiku resulta suficiente, se
// puede bajar el costo cambiando solo esta constante.
const MODEL = "claude-sonnet-4-5-20250929";

// El SDK instalado (@anthropic-ai/sdk ^0.32.0) solo expone el bloque de
// contenido "document" (PDF) bajo el namespace beta — `client.messages`
// (estable) ni siquiera tiene el tipo en sus definiciones. Por eso este
// archivo usa `client.beta.messages` en vez de `client.messages` como
// anthropicAgreementDetector.ts/anthropicToneAnalyzer.ts: no es una
// preferencia, es la única superficie de esta versión del SDK que acepta
// un PDF como contenido multimodal. No requiere un header de beta
// explícito (el campo `betas` es opcional) — el soporte de PDF ya no está
// gateado detrás de un feature flag en esta versión.
function buildDocumentBlock(
  bytes: Uint8Array,
  mimeType: string
): Anthropic.Beta.Messages.BetaBase64PDFBlock | Anthropic.Beta.Messages.BetaImageBlockParam {
  const data = Buffer.from(bytes).toString("base64");
  if (mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  // Claude solo acepta estos 4 media_type de imagen — mimeType ya viene
  // filtrado a "image/*" por el selector de documentos en Custodia, pero
  // se castea explícito porque el tipo del SDK es un union cerrado.
  return {
    type: "image",
    source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data },
  };
}

function formatVerbalAgreements(agreements: VerbalAgreement[]): string {
  if (agreements.length === 0) return "(sin acuerdos verbales confirmados)";
  return agreements.map((a) => `- [${a.agreedAt}] ${a.description}`).join("\n");
}

function formatPeople(children: Child[], familyMembers: Parent[]): string {
  const childLines = children.map((c) => `  - childId="${c.id}" → ${c.fullName}`).join("\n");
  const parentLines = familyMembers.map((p) => `  - parentId="${p.id}" → ${p.fullName}`).join("\n");
  return `Hijos:\n${childLines || "  (ninguno)"}\nProgenitores:\n${parentLines || "  (ninguno)"}`;
}

// Mismo patrón que timeOfDaySchema en packages/core/src/validation/schemas.ts
// (no se importa porque ese schema es z.string(), pensado para validar input
// de formularios, no para filtrar items sueltos de un array ya parseado).
const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La IA devuelve JSON "bien formado" (pasa Array.isArray) pero no hay
 * garantía de que cada item tenga los campos/tipos correctos, ni de que
 * childId/parentId sean ids reales que de verdad se le pasaron al modelo
 * (podría alucinar uno). Igual que anthropicAgreementDetector valida
 * `typeof parsed.description === "string"` antes de confiar en el campo,
 * acá se valida cada item antes de castear — un item inválido simplemente
 * se descarta (silencioso, no es una condición de error).
 */
function isValidScheduleSlot(
  item: unknown,
  childIds: ReadonlySet<string>,
  parentIds: ReadonlySet<string>
): item is CustodyScheduleProposalSlot {
  if (typeof item !== "object" || item === null) return false;
  const slot = item as Record<string, unknown>;
  return (
    typeof slot.childId === "string" &&
    childIds.has(slot.childId) &&
    typeof slot.parentId === "string" &&
    parentIds.has(slot.parentId) &&
    typeof slot.weekday === "number" &&
    Number.isInteger(slot.weekday) &&
    slot.weekday >= 0 &&
    slot.weekday <= 6 &&
    typeof slot.startTime === "string" &&
    TIME_OF_DAY_REGEX.test(slot.startTime) &&
    typeof slot.endTime === "string" &&
    TIME_OF_DAY_REGEX.test(slot.endTime)
  );
}

function isValidReminderItem(item: unknown, childIds: ReadonlySet<string>): item is ReminderProposalItem {
  if (typeof item !== "object" || item === null) return false;
  const reminder = item as Record<string, unknown>;
  if (typeof reminder.title !== "string" || reminder.title.trim().length === 0) return false;
  if (reminder.childId !== null && !(typeof reminder.childId === "string" && childIds.has(reminder.childId))) {
    return false;
  }
  if (typeof reminder.startDate !== "string" || !ISO_DATE_REGEX.test(reminder.startDate)) return false;
  if (typeof reminder.endDate !== "string" || !ISO_DATE_REGEX.test(reminder.endDate)) return false;
  return reminder.endDate >= reminder.startDate;
}

const SCHEDULE_SYSTEM_PROMPT = `Eres el asistente de Custodia de ALBA, una app de coparentalidad. Te dan un documento (convenio de custodia, PDF o foto) y, opcionalmente, acuerdos verbales ya confirmados por ambos progenitores. Tu tarea es proponer el horario semanal RECURRENTE de custodia (quién tiene a cada hijo, qué día de la semana, de qué hora a qué hora).

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"slots": [{"childId": string, "parentId": string, "weekday": number, "startTime": "HH:MM", "endTime": "HH:MM"}]}

- "weekday": 0 = domingo ... 6 = sábado.
- "childId"/"parentId" DEBEN ser exactamente uno de los ids listados abajo — nunca inventes un id ni uses un nombre en su lugar.
- Si el documento no describe un horario recurrente claro, o si no podés mapear con confianza un día a un progenitor/hijo de la lista, devolvé {"slots": []} — nunca inventes un horario que no esté explícito.
- No repitas el mismo childId+parentId+weekday dos veces.`;

const REMINDERS_SYSTEM_PROMPT = `Eres el asistente de Custodia de ALBA, una app de coparentalidad. Te dan un documento (convenio de custodia, PDF o foto) y, opcionalmente, acuerdos verbales ya confirmados por ambos progenitores. Tu tarea es proponer "recordatorios": fechas puntuales o rangos de fecha relevantes (entregas, inicios/fines de ciclo escolar, vacaciones, cumpleaños, plazos) — NO horario recurrente semanal (eso es otra tarea).

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"reminders": [{"title": string, "childId": string | null, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}]}

- "title": 2 a 120 caracteres, en español, describe el recordatorio (ej. "Entrega de útiles escolares").
- "childId": uno de los ids listados abajo, o null si no aplica a un hijo en particular.
- "endDate" siempre >= "startDate". Si es un evento de 1 día, startDate = endDate.
- Si el documento no menciona ninguna fecha reconocible, devolvé {"reminders": []} — nunca inventes una fecha que no esté explícita.`;

/**
 * Implementación real — nunca se llama desde el cliente (la API key no
 * puede vivir en un binario/bundle del navegador). Se instancia
 * server-side en apps/web/src/lib/repository.ts cuando existe
 * ANTHROPIC_API_KEY, mismo criterio que createAnthropicAgreementDetector.
 */
export function createAnthropicCustodyDocumentAnalyzer(apiKey: string): CustodyDocumentAnalyzer {
  const client = new Anthropic({ apiKey });

  // Fix 2: ambos métodos comparten el mismo esqueleto
  // build-request → extraer bloque de texto → parsear JSON (log + null en
  // fallo) — solo difiere el prompt, el contenido del mensaje y qué campo
  // del JSON cada uno extrae/valida después. Ese resto (nombre del campo,
  // validación por item de Fix 1) se queda en cada método porque depende
  // del shape de cada uno.
  async function requestAndParseJson(
    systemPrompt: string,
    content: Anthropic.Beta.Messages.BetaContentBlockParam[],
    methodLabel: string
  ): Promise<Record<string, unknown> | null> {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    });

    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "{}";

    try {
      return JSON.parse(extractJson(text)) as Record<string, unknown>;
    } catch (err) {
      console.error(`[anthropicCustodyDocumentAnalyzer] ${methodLabel}: respuesta no parseable`, { text, err });
      return null;
    }
  }

  return {
    async proposeSchedule({ documentBytes, mimeType, verbalAgreements, children, familyMembers }) {
      if (children.length === 0 || familyMembers.length === 0) return { slots: [] };

      const parsed = await requestAndParseJson(
        SCHEDULE_SYSTEM_PROMPT,
        [
          buildDocumentBlock(documentBytes, mimeType),
          {
            type: "text",
            text: `${formatPeople(children, familyMembers)}\n\nAcuerdos verbales confirmados:\n${formatVerbalAgreements(verbalAgreements)}`,
          },
        ],
        "proposeSchedule"
      );
      if (parsed === null || !Array.isArray(parsed.slots)) return { slots: [] };

      const childIds = new Set(children.map((c) => c.id));
      const parentIds = new Set(familyMembers.map((p) => p.id));
      const slots = parsed.slots.filter((item): item is CustodyScheduleProposalSlot =>
        isValidScheduleSlot(item, childIds, parentIds)
      );
      return { slots };
    },

    async proposeReminders({ documentBytes, mimeType, verbalAgreements, children }) {
      const parsed = await requestAndParseJson(
        REMINDERS_SYSTEM_PROMPT,
        [
          buildDocumentBlock(documentBytes, mimeType),
          {
            type: "text",
            text: `${formatPeople(children, [])}\n\nAcuerdos verbales confirmados:\n${formatVerbalAgreements(verbalAgreements)}`,
          },
        ],
        "proposeReminders"
      );
      if (parsed === null || !Array.isArray(parsed.reminders)) return { reminders: [] };

      const childIds = new Set(children.map((c) => c.id));
      const reminders = parsed.reminders.filter((item): item is ReminderProposalItem =>
        isValidReminderItem(item, childIds)
      );
      return { reminders };
    },
  };
}
