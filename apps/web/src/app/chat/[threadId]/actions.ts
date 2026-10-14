"use server";

import { revalidatePath } from "next/cache";
import {
  analyzeToneInputSchema,
  renameThreadInputSchema,
  sendMessageInputSchema,
  verbalAgreementInputSchema,
  type ToneAnalysis,
} from "@alba/core";
import { agreementDetector, getRequestContext, toneAnalyzer, uploadChatPhoto } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function checkToneAction(body: string): Promise<ToneAnalysis> {
  const input = analyzeToneInputSchema.parse({ body });
  return toneAnalyzer.analyze(input.body);
}

export async function sendMessageAction(formData: FormData) {
  const file = formData.get("file");
  const attachmentUrl = file instanceof File && file.size > 0 ? await uploadChatPhoto(file) : null;

  // Una foto sin texto es un mensaje válido — el body en la base exige al
  // menos 1 carácter, así que le ponemos un texto por default en vez de
  // bloquear el envío.
  const rawBody = String(formData.get("body") ?? "").trim();
  const body = rawBody.length > 0 ? rawBody : attachmentUrl ? "📷 Foto" : "";

  const input = sendMessageInputSchema.parse({
    threadId: formData.get("threadId"),
    body,
    attachmentUrl,
  });
  const { chat, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.sendMessage(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo mensaje",
    body: body.slice(0, 120),
    url: `/chat/${input.threadId}`,
  });

  // Se corre DESPUÉS de notificar (nunca bloquea el envío del mensaje ni la
  // notificación) — si falla, se loguea y el envío del mensaje sigue siendo
  // exitoso para quien escribió. Los últimos 8 mensajes alcanzan para la
  // mayoría de los intercambios tipo propuesta → confirmación.
  try {
    const recentMessages = await chat.listMessages(parentId, input.threadId);
    const lastEight = recentMessages.slice(-8);
    const detectorInput = lastEight.map((m) => ({
      senderLabel: (m.senderId === parentId ? "Tú" : "El otro progenitor") as "Tú" | "El otro progenitor",
      body: m.body,
    }));
    const result = await agreementDetector.detect(detectorInput);
    const lastMessage = lastEight[lastEight.length - 1];
    await chat.setAgreementSuggestion(
      parentId,
      input.threadId,
      result.isAgreement && result.description && lastMessage
        ? { description: result.description, basedOnMessageId: lastMessage.id }
        : null
    );
    revalidatePath(`/chat/${input.threadId}`);
  } catch (err) {
    console.error("[sendMessageAction] detección de acuerdo falló, el mensaje ya se envió igual", err);
  }
}

export async function renameThreadAction(formData: FormData) {
  const input = renameThreadInputSchema.parse({
    threadId: formData.get("threadId"),
    topic: formData.get("topic"),
  });
  const { chat, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.renameThread(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);
  revalidatePath("/chat");
}

export async function sealThreadAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const { chat, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.sealThread(parentId, threadId);
  revalidatePath(`/chat/${threadId}`);
  revalidatePath(`/chat/${threadId}/export`);
}

export async function confirmAgreementSuggestionAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const { chat, verbalAgreements, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));

  const threads = await chat.listThreads(parentId);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread || !thread.pendingAgreementSuggestion) return;

  const input = verbalAgreementInputSchema.parse({
    childId: thread.childId ?? "",
    description: thread.pendingAgreementSuggestion,
    agreedAt: todayLocal(),
  });
  const agreement = await verbalAgreements.createVerbalAgreement(parentId, input);
  await chat.setAgreementSuggestion(parentId, threadId, null);
  revalidatePath(`/chat/${threadId}`);
  revalidatePath("/boveda/acuerdos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo acuerdo verbal registrado",
    body: agreement.description.slice(0, 120),
    url: "/boveda/acuerdos",
  });
}

export async function dismissAgreementSuggestionAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const { chat, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await chat.setAgreementSuggestion(parentId, threadId, null);
  revalidatePath(`/chat/${threadId}`);
}
