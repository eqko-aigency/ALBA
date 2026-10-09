"use server";

import { revalidatePath } from "next/cache";
import { analyzeToneInputSchema, sendMessageInputSchema, type ToneAnalysis } from "@alba/core";
import { getCurrentParentId, getRepositories, toneAnalyzer } from "@/lib/repository";

export async function checkToneAction(body: string): Promise<ToneAnalysis> {
  const input = analyzeToneInputSchema.parse({ body });
  return toneAnalyzer.analyze(input.body);
}

export async function sendMessageAction(formData: FormData) {
  const input = sendMessageInputSchema.parse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
  });
  const { chat } = await getRepositories();
  const parentId = await getCurrentParentId(String(formData.get("as") ?? ""));
  await chat.sendMessage(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);
}
