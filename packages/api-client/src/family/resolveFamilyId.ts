import type { SupabaseClient } from "@supabase/supabase-js";

/** Resuelve el family_id de un progenitor — compartido entre repos de Supabase. */
export function createFamilyIdResolver(client: SupabaseClient) {
  return async function getMyFamilyId(parentId: string): Promise<string | null> {
    const { data, error } = await client
      .from("family_members")
      .select("family_id")
      .eq("parent_id", parentId)
      .maybeSingle();
    if (error) throw error;
    return data?.family_id ?? null;
  };
}
