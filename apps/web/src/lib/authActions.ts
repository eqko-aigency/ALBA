"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./repository";
import { createSupabaseServerClient } from "./supabaseServerClient";

export async function logoutAction() {
  if (isSupabaseConfigured) {
    const client = await createSupabaseServerClient();
    await client.auth.signOut();
  }
  // En modo demo no hay sesión real de Supabase que cerrar — DEMO_PARENT_A_ID
  // es fijo, no depende de una cookie. Redirigir basta para no romper
  // el botón con un cliente de Supabase sin URL/key configuradas.
  redirect("/ingresar");
}
