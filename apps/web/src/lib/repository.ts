import { createAlbaClient, createMockPairingRepository, createSupabasePairingRepository } from "@alba/api-client";
import type { PairingRepository } from "@alba/core";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Singleton en globalThis para sobrevivir el hot-reload de Next en desarrollo
// (si no, cada recarga de módulo perdería los datos del mock en memoria).
const globalForAlba = globalThis as unknown as { pairingRepository?: PairingRepository };

function buildRepository(): PairingRepository {
  if (!isSupabaseConfigured) return createMockPairingRepository();

  const client = createAlbaClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
  return createSupabasePairingRepository(client);
}

export const pairingRepository: PairingRepository =
  globalForAlba.pairingRepository ?? (globalForAlba.pairingRepository = buildRepository());
