"use server";

import { revalidatePath } from "next/cache";
import { getRequestContext } from "@/lib/repository";

export async function markNotificationsSeenAction(formData: FormData) {
  const { pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await pairing.markNotificationsSeen(parentId);
  revalidatePath("/notificaciones");
  revalidatePath("/dashboard");
}
