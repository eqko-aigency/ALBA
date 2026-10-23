"use server";

import { redirect } from "next/navigation";
import { confirmOnboardingNameInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function confirmOnboardingNameAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const input = confirmOnboardingNameInputSchema.parse({ fullName: formData.get("fullName") });
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.confirmOnboardingName(parentId, input);
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
