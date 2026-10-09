"use server";

import { revalidatePath } from "next/cache";
import { createThreadInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function createThreadAction(formData: FormData) {
  const input = createThreadInputSchema.parse({
    topic: formData.get("topic"),
    childId: formData.get("childId"),
  });
  const { chat, parentId } = await getRequestContext(String(formData.get("as") ?? ""));

  // createThread es idempotente ante duplicados (family_id + topic +
  // child_id) — tanto en el repo real (constraint único en la base,
  // migración 0006) como en el mock — así que no hace falta un chequeo
  // previo acá, que sería time-of-check-to-time-of-use de todos modos.
  await chat.createThread(parentId, input);

  revalidatePath("/chat");
}
