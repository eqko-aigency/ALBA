import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    redirect("/ingresar?error=link_invalido");
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    redirect("/ingresar?error=link_vencido");
  }

  redirect("/registro");
}
