import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Forma mínima que Supabase Auth espera de un storage de sesión. */
export interface SessionStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface AlbaSupabaseConfig {
  url: string;
  anonKey: string;
  /**
   * Next.js/web no lo necesita (usa localStorage por default); React Native
   * (Etapa 2) debe pasar un adaptador sobre AsyncStorage — es la única
   * diferencia real entre plataformas para este cliente, documentada en la
   * auditoría de framework.
   */
  storage?: SessionStorageAdapter;
}

export function createAlbaClient(config: AlbaSupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: config.storage,
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}
