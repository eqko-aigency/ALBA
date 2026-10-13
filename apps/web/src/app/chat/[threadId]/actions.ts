"use server";

import { revalidatePath } from "next/cache";
import { analyzeToneInputSchema, renameThreadInputSchema, sendMessageInputSchema, type ToneAnalysis } from "@alba/core";
import { getRequestContext, toneAnalyzer, uploadChatPhoto } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

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
