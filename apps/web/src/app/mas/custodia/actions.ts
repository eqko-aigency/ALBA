"use server";

import { revalidatePath } from "next/cache";
import { custodySlotInputSchema, importantDateInputSchema } from "@alba/core";
import type { CustodyScheduleProposalSlot, ReminderProposalItem } from "@alba/core";
import { custodyDocumentAnalyzer, getRequestContext } from "@/lib/repository";

/** Acuerdos verbales considerados por la IA — solo los ya confirmados por
 * ambos progenitores, nunca propuestas sin confirmar (ver spec). */
async function getConfirmedVerbalAgreements(
  verbalAgreements: Awaited<ReturnType<typeof getRequestContext>>["verbalAgreements"],
  parentId: string
) {
  const all = await verbalAgreements.listVerbalAgreements(parentId);
  return all.filter((a) => a.confirmedAt !== null);
}

export async function proposeScheduleAction(
  documentId: string,
  as?: string
): Promise<{ slots: CustodyScheduleProposalSlot[] } | { error: string }> {
  const { documents, pairing, verbalAgreements, parentId } = await getRequestContext(as);
  const fileData = await documents.getDocumentFileBytes(parentId, documentId);
  if (!fileData) return { error: "No se pudo leer el documento elegido." };

  const [confirmedAgreements, kids, familyMembers] = await Promise.all([
    getConfirmedVerbalAgreements(verbalAgreements, parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);

  return custodyDocumentAnalyzer.proposeSchedule({
    documentBytes: fileData.bytes,
    mimeType: fileData.mimeType,
    verbalAgreements: confirmedAgreements,
    children: kids,
    familyMembers,
  });
}

export async function confirmScheduleProposalAction(
  slots: CustodyScheduleProposalSlot[],
  as?: string
): Promise<{ error: string } | { success: true }> {
  if (slots.length === 0) return { error: "No seleccionaste ningún horario." };

  const { custody, parentId } = await getRequestContext(as);
  let validated;
  try {
    validated = slots.map((s) => custodySlotInputSchema.parse({ ...s, placeId: null }));
  } catch {
    return { error: "Alguno de los horarios quedó con un dato inválido — revisa los campos y vuelve a intentar." };
  }

  const agreement = await custody.getMyAgreement(parentId);
  await custody.upsertSlots(parentId, [...agreement.slots, ...validated]);
  revalidatePath("/mas/custodia");
  return { success: true };
}

export async function proposeRemindersAction(
  documentId: string,
  as?: string
): Promise<{ reminders: ReminderProposalItem[] } | { error: string }> {
  const { documents, verbalAgreements, pairing, parentId } = await getRequestContext(as);
  const fileData = await documents.getDocumentFileBytes(parentId, documentId);
  if (!fileData) return { error: "No se pudo leer el documento elegido." };

  const [confirmedAgreements, kids] = await Promise.all([
    getConfirmedVerbalAgreements(verbalAgreements, parentId),
    pairing.getMyChildren(parentId),
  ]);

  return custodyDocumentAnalyzer.proposeReminders({
    documentBytes: fileData.bytes,
    mimeType: fileData.mimeType,
    verbalAgreements: confirmedAgreements,
    children: kids,
  });
}

export async function confirmReminderProposalAction(
  reminders: ReminderProposalItem[],
  as?: string
): Promise<{ error: string } | { success: true }> {
  if (reminders.length === 0) return { error: "No seleccionaste ningún recordatorio." };

  const { custody, parentId } = await getRequestContext(as);
  let validated;
  try {
    validated = reminders.map((r) => importantDateInputSchema.parse(r));
  } catch {
    return { error: "Alguno de los recordatorios quedó con un dato inválido — revisa los campos y vuelve a intentar." };
  }

  for (const reminder of validated) {
    await custody.createImportantDate(parentId, reminder);
  }
  revalidatePath("/mas/custodia");
  return { success: true };
}
