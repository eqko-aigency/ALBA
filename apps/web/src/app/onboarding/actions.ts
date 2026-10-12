"use server";

import { redirect } from "next/navigation";
import { setUsageModeInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function setUsageModeAction(formData: FormData) {
  const input = setUsageModeInputSchema.parse({ usageMode: formData.get("usageMode") });
  const { pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.setUsageMode(parentId, input);

  // Bilateral: la clienta pidió explícitamente que si van a usarla los dos,
  // se le ofrezca "emparejar" de una vez, no que tenga que encontrarlo
  // después. Unilateral: directo al dashboard, no hay a quién invitar.
  redirect(input.usageMode === "bilateral" ? "/registro" : "/dashboard");
}
