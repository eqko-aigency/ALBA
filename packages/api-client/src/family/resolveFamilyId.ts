import type { SupabaseClient } from "@supabase/supabase-js";

export type FamilyIdResolver = (parentId: string) => Promise<string | null>;

/**
 * Resuelve el family_id de un progenitor — compartido entre repos de
 * Supabase. Memoizado por parentId dentro del closure: cada repositorio
 * crea su propio resolver (uno por getXxxRepository(client), una vez por
 * request vía getRequestContext), así que este cache nunca sobrevive entre
 * requests — pero SÍ evita que, dentro de una misma request, el mismo
 * repositorio vuelva a pegarle a la base por el mismo family_id en cada
 * llamada. Antes de esto, Calendario (6 llamadas a listEventsForWeek en
 * paralelo para pintar la grilla del mes) hacía 6 consultas idénticas a
 * family_members para resolver exactamente el mismo valor — un costo fijo
 * que se sumaba a la lentitud reportada por la clienta.
 */
export function createFamilyIdResolver(client: SupabaseClient): FamilyIdResolver {
  const cache = new Map<string, Promise<string | null>>();
  return function getMyFamilyId(parentId: string): Promise<string | null> {
    const cached = cache.get(parentId);
    if (cached) return cached;

    const promise = (async () => {
      const { data, error } = await client
        .from("family_members")
        .select("family_id")
        .eq("parent_id", parentId)
        .maybeSingle();
      if (error) throw error;
      return data?.family_id ?? null;
    })();
    cache.set(parentId, promise);
    return promise;
  };
}
