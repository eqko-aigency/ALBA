"use server";

import { revalidatePath } from "next/cache";
import { analyzeToneInputSchema, sendMessageInputSchema, type ToneAnalysis } from "@alba/core";
import { chatRepository, toneAnalyzer } from "@/lib/repository";
import { resolveDemoParentId } from "@/lib/demoSession";

export async function checkToneAction(body: string): Promise<ToneAnalysis> {
  const input = analyzeToneInputSchema.parse({ body });
  return toneAnalyzer.analyze(input.body);
}

export async function sendMessageAction(formData: FormData) {
  const input = sendMessageInputSchema.parse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
  });
  const parentId = resolveDemoParentId(String(formData.get("as") ?? ""));
  await chatRepository.sendMessage(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);
}
