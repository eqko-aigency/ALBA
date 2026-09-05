import { z } from "zod";

export const expenseInputSchema = z.object({
  childId: z.string().uuid(),
  amountMxn: z.number().positive(),
  description: z.string().min(3).max(280),
  receiptUrl: z.string().url().nullable(),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const createInvitationInputSchema = z.object({
  childId: z.string().uuid(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;

export const acceptInvitationInputSchema = z.object({
  token: z.string().uuid(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;

export const custodyEventInputSchema = z.object({
  childId: z.string().uuid(),
  type: z.enum(["checkin", "checkout"]),
  scheduledAt: z.string().datetime(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable(),
});
export type CustodyEventInput = z.infer<typeof custodyEventInputSchema>;
