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

/** Categorías fijas de W-06 (Chat por Temas) — Manual Sandstone Sanctuary §4. */
export const CHAT_TOPICS = ["Salud", "Escuela", "Pensiones", "Vacaciones"] as const;
export type ChatTopic = (typeof CHAT_TOPICS)[number];

export const createThreadInputSchema = z.object({
  topic: z.enum(CHAT_TOPICS),
  /** "" desde el <select> significa "hilo general" — se normaliza a null. */
  childId: z
    .union([z.string().uuid(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});
export type CreateThreadInput = z.infer<typeof createThreadInputSchema>;

export const sendMessageInputSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(2000),
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
