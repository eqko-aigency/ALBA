"use server";

import { revalidatePath } from "next/cache";
import { createThreadInputSchema } from "@alba/core";
import { chatRepository } from "@/lib/repository";
import { resolveDemoParentId } from "@/lib/demoSession";

export async function createThreadAction(formData: FormData) {
  const input = createThreadInputSchema.parse({
    topic: formData.get("topic"),
    childId: formData.get("childId"),
  });
  const parentId = resolveDemoParentId(String(formData.get("as") ?? ""));

  const existing = await chatRepository.listThreads(parentId);
  const alreadyExists = existing.some((t) => t.topic === input.topic && t.childId === input.childId);
  if (!alreadyExists) {
    await chatRepository.createThread(parentId, input);
  }

  revalidatePath("/chat");
}
