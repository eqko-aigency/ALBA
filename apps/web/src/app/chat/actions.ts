"use server";

import { revalidatePath } from "next/cache";
import { createThreadInputSchema } from "@alba/core";
import { getCurrentParentId, getRepositories } from "@/lib/repository";

export async function createThreadAction(formData: FormData) {
  const input = createThreadInputSchema.parse({
    topic: formData.get("topic"),
    childId: formData.get("childId"),
  });
  const { chat } = await getRepositories();
  const parentId = await getCurrentParentId(String(formData.get("as") ?? ""));

  const existing = await chat.listThreads(parentId);
  const alreadyExists = existing.some((t) => t.topic === input.topic && t.childId === input.childId);
  if (!alreadyExists) {
    await chat.createThread(parentId, input);
  }

  revalidatePath("/chat");
}
