"use server";

import { revalidatePath } from "next/cache";
import { acceptInvitationInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function acceptInvitationAction(formData: FormData) {
  const input = acceptInvitationInputSchema.parse({ token: formData.get("token") });
  const { pairing, parentId } = await getRequestContext("b");
  await pairing.acceptInvitation(parentId, input);
  revalidatePath(`/invitacion/${input.token}`);
}
