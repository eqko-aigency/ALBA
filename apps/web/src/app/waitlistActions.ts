"use server";

import { waitlistInputSchema } from "@alba/core";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/repository";

export async function joinWaitlistAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const parsed = waitlistInputSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Escribe un correo válido." };
  }

  // Sin Supabase configurado (dev local sin credenciales) no hay dónde
  // guardar — mismo criterio que uploadReceiptFile en repository.ts:
  // responde éxito sin persistir nada, para no romper el flujo de prueba.
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  // Cliente directo con el anon key, sin cookies ni sesión — a diferencia
  // de getRequestContext()/getAuthedSupabaseClient(), este formulario es
  // público y anónimo, no hay progenitor logueado al que atarlo.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await client.from("waitlist_signups").insert({ email: parsed.data.email });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya estás en la lista — te avisaremos." };
    }
    return { error: "No se pudo guardar tu correo. Intenta de nuevo." };
  }

  return { success: true };
}
