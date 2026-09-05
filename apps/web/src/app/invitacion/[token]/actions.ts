"use server";

import { revalidatePath } from "next/cache";
import { acceptInvitationInputSchema } from "@alba/core";
import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_B_ID } from "@/lib/demoSession";

export async function acceptInvitationAction(formData: FormData) {
  const input = acceptInvitationInputSchema.parse({ token: formData.get("token") });
  await pairingRepository.acceptInvitation(DEMO_PARENT_B_ID, input);
  revalidatePath(`/invitacion/${input.token}`);
}
