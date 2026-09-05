"use server";

import { revalidatePath } from "next/cache";
import { sendMessageInputSchema } from "@alba/core";
import { chatRepository } from "@/lib/repository";
import { resolveDemoParentId } from "@/lib/demoSession";

export async function sendMessageAction(formData: FormData) {
  const input = sendMessageInputSchema.parse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
  });
  const parentId = resolveDemoParentId(String(formData.get("as") ?? ""));
  await chatRepository.sendMessage(parentId, input);
  revalidatePath(`/chat/${input.threadId}`);
}
