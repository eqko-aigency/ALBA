"use server";

import { signUpInputSchema } from "@alba/core";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function signupAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const parsed = signUpInputSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password,
  });

  if (!parsed.success) {
    return { error: "Revisa los datos: nombre, email y contraseña (mínimo 8 caracteres)." };
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  if (error) {
    if (error.message.includes("already registered") || error.message.includes("already exists")) {
      return { error: "Ya existe una cuenta con ese email." };
    }
    return { error: "No se pudo crear la cuenta. Intenta de nuevo." };
  }

  return { success: true };
}
