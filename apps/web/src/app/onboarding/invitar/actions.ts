"use server";

import { redirect } from "next/navigation";
import { skipOnboardingStepForSession } from "@/lib/onboardingGate";

export async function skipInviteStepAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  await skipOnboardingStepForSession("invitar");
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
