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

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    throw new Error("NEXT_PUBLIC_SITE_URL no está configurada — no se puede armar el link de confirmación.");
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
    // El mensaje que ve el usuario siempre fue genérico — pero nunca se
    // logueaba el error real de Supabase en ningún lado, así que un fallo
    // que no fuera "ya existe" era imposible de diagnosticar sin esto.
    console.error("[signupAction] Supabase signUp() falló", {
      message: error.message,
      status: error.status,
      code: (error as { code?: string }).code,
      email: parsed.data.email,
    });

    if (error.message.includes("already registered") || error.message.includes("already exists")) {
      return { error: "Ya existe una cuenta con ese email." };
    }
    if (error.status === 429) {
      return { error: "Demasiados intentos — espera unos minutos e intenta de nuevo." };
    }
    return { error: "No se pudo crear la cuenta. Intenta de nuevo." };
  }

  return { success: true };
}
