import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase atado a la sesión de ESTA request, vía la cookie de
 * auth — nunca un singleton de módulo. El servidor atiende a muchos
 * progenitores a la vez; un cliente construido una sola vez al arrancar no
 * puede representar "quién es el usuario de esta petición". Cada Server
 * Action / Server Component que necesite auth.uid() correcto debe llamar
 * esto de nuevo, no reusar una instancia guardada.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Se llamó desde el render de un Server Component (no puede
          // escribir cookies) — el refresco de sesión ahí lo cubre el
          // middleware cuando exista. No es un error real.
        }
      },
    },
  });
}
