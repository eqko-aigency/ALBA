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
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/registro");
}
