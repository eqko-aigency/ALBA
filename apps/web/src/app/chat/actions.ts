"use server";

import { revalidatePath } from "next/cache";
import { createThreadInputSchema } from "@alba/core";
import { chatRepository } from "@/lib/repository";
import { resolveDemoParentId } from "@/lib/demoSession";

export async function createThreadAction(formData: FormData) {
  const input = createThreadInputSchema.parse({ topic: formData.get("topic") });
  const parentId = resolveDemoParentId(String(formData.get("as") ?? ""));
  await chatRepository.createThread(parentId, input);
  revalidatePath("/chat");
}
