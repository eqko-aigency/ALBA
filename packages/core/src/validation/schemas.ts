import { z } from "zod";

export const expenseInputSchema = z.object({
  childId: z.string().uuid(),
  amountMxn: z.number().positive(),
  description: z.string().min(3).max(280),
  receiptUrl: z.string().url().nullable(),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const acceptInvitationInputSchema = z.object({
  token: z.string().uuid(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;

export const upsertProfileInputSchema = z.object({
  fullName: z.string().min(2).max(120),
});
export type UpsertProfileInput = z.infer<typeof upsertProfileInputSchema>;

export const updateChildInputSchema = z.object({
  fullName: z.string().min(2).max(120),
  birthDate: z.string(),
});
export type UpdateChildInput = z.infer<typeof updateChildInputSchema>;

const childContactSchema = z.object({
  name: z.string().min(1).max(120),
  relation: z.string().min(1).max(80),
  phone: z.string().max(40),
});

/** Campos nullable: string vacío del form se normaliza a null (sin dato). */
const optionalNote = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

export const updateChildDetailsInputSchema = z.object({
  contacts: z.array(childContactSchema).max(10),
  therapistName: optionalNote(160),
  therapistPhone: optionalNote(40),
  schoolName: optionalNote(160),
  schoolContact: optionalNote(160),
  allergies: optionalNote(1000),
  specialNotes: optionalNote(2000),
  sleepRoutine: optionalNote(2000),
});
export type UpdateChildDetailsInput = z.infer<typeof updateChildDetailsInputSchema>;

export const setUsageModeInputSchema = z.object({
  usageMode: z.enum(["unilateral", "bilateral"]),
});
export type SetUsageModeInput = z.infer<typeof setUsageModeInputSchema>;

/** Categorías sugeridas de W-06 (Chat por Temas) — Manual Sandstone Sanctuary
 * §4. Son solo el default del <select>: el topic en sí es texto libre
 * (2-60 caracteres, igual que valida la base) para que se pueda escribir
 * una categoría propia ("Otro") o renombrar el hilo después. */
export const CHAT_TOPICS = ["Salud", "Escuela", "Pensiones", "Vacaciones"] as const;
export type ChatTopic = (typeof CHAT_TOPICS)[number];

const freeTopicSchema = z.string().trim().min(2).max(60);

export const createThreadInputSchema = z.object({
  topic: freeTopicSchema,
  /** "" desde el <select> significa "hilo general" — se normaliza a null. */
  childId: z
    .union([z.string().uuid(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});
export type CreateThreadInput = z.infer<typeof createThreadInputSchema>;

export const renameThreadInputSchema = z.object({
  threadId: z.string().uuid(),
  topic: freeTopicSchema,
});
export type RenameThreadInput = z.infer<typeof renameThreadInputSchema>;

export const sendMessageInputSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  attachmentUrl: z.string().url().nullable().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const analyzeToneInputSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type AnalyzeToneInput = z.infer<typeof analyzeToneInputSchema>;

export const custodyEventInputSchema = z.object({
  childId: z.string().uuid(),
  type: z.enum(["checkin", "checkout"]),
  scheduledAt: z.string().datetime(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable(),
});
export type CustodyEventInput = z.infer<typeof custodyEventInputSchema>;

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)");

export const custodySlotInputSchema = z.object({
  childId: z.string().uuid(),
  parentId: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  // El <select> manda "" cuando el usuario deja "Sin lugar específico" — se
  // normaliza a null antes de validar como uuid, igual que el resto de los
  // campos opcionales de la app (ej. receiptUrlManual en gastos).
  placeId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().uuid().nullable()),
});
export type CustodySlotInput = z.infer<typeof custodySlotInputSchema>;

export const meetingPlaceInputSchema = z.object({
  name: z.string().min(2).max(80),
});
export type MeetingPlaceInput = z.infer<typeof meetingPlaceInputSchema>;

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

/** Título del documento subido a Bóveda — el archivo en sí se valida por separado (tamaño/tipo) en el Server Action. */
export const documentUploadInputSchema = z.object({
  title: z.string().min(3).max(160),
});
export type DocumentUploadInput = z.infer<typeof documentUploadInputSchema>;

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

export const pensionSettingsInputSchema = z.object({
  payerParentId: z.string().uuid(),
  amountMxn: z.number().positive(),
  dueDay: z.coerce.number().int().min(1).max(28),
});
export type PensionSettingsInput = z.infer<typeof pensionSettingsInputSchema>;

export const pensionPaymentInputSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Período inválido"),
});
export type PensionPaymentInput = z.infer<typeof pensionPaymentInputSchema>;

export const verbalAgreementInputSchema = z.object({
  childId: z
    .union([z.string().uuid(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  description: z.string().min(5).max(1000),
  agreedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});
export type VerbalAgreementInput = z.infer<typeof verbalAgreementInputSchema>;
