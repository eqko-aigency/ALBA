"use server";

import { redirect } from "next/navigation";
import { signInInputSchema } from "@alba/core";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const parsed = signInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Ingresa un email y una contraseña válidos." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message === "Email not confirmed") {
      return { error: "Todavía no confirmaste tu email — revisa tu bandeja de entrada." };
    }
    if (error.status === 429) {
      return { error: "Demasiados intentos — espera un momento e intenta de nuevo." };
    }
    if (error.status && error.status >= 500) {
      return { error: "Hubo un problema temporal del servidor. Intenta de nuevo en un momento." };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/dashboard");
}
