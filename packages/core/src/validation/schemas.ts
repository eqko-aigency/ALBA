import { z } from "zod";
import { PROFILE_COLORS } from "./colors";

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
  color: z.enum(PROFILE_COLORS).nullable(),
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

const childHealthProviderSchema = z.object({
  role: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  phone: z.string().max(40),
});

const childSchoolContactSchema = z.object({
  role: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  phone: z.string().max(40),
});

const childNoteSchema = z.object({
  label: z.string().min(1).max(80),
  text: z.string().min(1).max(2000),
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
  healthProviders: z.array(childHealthProviderSchema).max(10),
  schoolName: optionalNote(160),
  schoolContacts: z.array(childSchoolContactSchema).max(10),
  allergies: optionalNote(1000),
  notes: z.array(childNoteSchema).max(20),
  color: z.enum(PROFILE_COLORS).nullable(),
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

/** A diferencia de CustodySlot (weekday recurrente), Visit vive en una
 * fecha exacta — no se repite cada semana. */
export const visitInputSchema = z.object({
  childId: z.string().uuid(),
  parentId: z.string().uuid(),
  title: z.string().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  placeId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().uuid().nullable()),
});
export type VisitInput = z.infer<typeof visitInputSchema>;

/** "" o ausente del form se normaliza a null — mismo criterio que optionalNote. */
const optionalPlaceField = (max: number) =>
  z
    .union([z.string().max(max), z.literal("")])
    .nullable()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

const optionalPlaceDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const meetingPlaceInputSchema = z.object({
  name: z.string().min(2).max(80),
  address: optionalPlaceField(200),
  hotelCheckIn: optionalPlaceDate,
  hotelCheckOut: optionalPlaceDate,
  contacts: optionalPlaceField(500),
  itinerary: optionalPlaceField(2000),
});
export type MeetingPlaceInput = z.infer<typeof meetingPlaceInputSchema>;

export const importantDateInputSchema = z
  .object({
    title: z.string().min(2).max(120),
    childId: z
      .union([z.string().uuid(), z.literal("")])
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "endDate debe ser >= startDate", path: ["endDate"] });
export type ImportantDateInput = z.infer<typeof importantDateInputSchema>;

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

export const waitlistInputSchema = z.object({
  email: z.string().email(),
});
export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

export const confirmOnboardingNameInputSchema = z.object({
  fullName: z.string().min(2).max(120),
});
export type ConfirmOnboardingNameInput = z.infer<typeof confirmOnboardingNameInputSchema>;

export const setWhatsappNumberInputSchema = z.object({
  whatsappNumber: z.string().min(7).max(20),
});
export type SetWhatsappNumberInput = z.infer<typeof setWhatsappNumberInputSchema>;

export const sendInvitationEmailInputSchema = z.object({
  email: z.string().email(),
});
export type SendInvitationEmailInput = z.infer<typeof sendInvitationEmailInputSchema>;
