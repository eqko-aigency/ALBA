"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabaseServerClient";

export async function logoutAction() {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/ingresar");
}
