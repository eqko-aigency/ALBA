"use server";

import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/repository";
import { skipOnboardingStepForSession } from "@/lib/onboardingGate";

export async function createChildAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const fullName = String(formData.get("childFullName") ?? "").trim();
  const birthDate = String(formData.get("childBirthDate") ?? "");

  if (fullName.length < 2 || !birthDate) {
    throw new Error("Nombre y fecha de nacimiento son requeridos");
  }

  const { pairing, parentId } = await getRequestContext(as);
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.createChild(parentId, { fullName, birthDate });
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}

export async function skipChildrenStepAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  await skipOnboardingStepForSession("hijos");
  redirect(as ? `/dashboard?as=${as}` : "/dashboard");
}
