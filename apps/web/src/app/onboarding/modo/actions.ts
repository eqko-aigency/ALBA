"use server";

import { redirect } from "next/navigation";
import { setUsageModeInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function setUsageModeAction(formData: FormData) {
  const input = setUsageModeInputSchema.parse({ usageMode: formData.get("usageMode") });
  const as = String(formData.get("as") ?? "");
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.getOrCreateMyFamily(parentId);
  await pairing.setUsageMode(parentId, input);
  redirect(as === "b" ? "/dashboard?as=b" : "/dashboard");
}
