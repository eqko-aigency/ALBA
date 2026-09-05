import { isSupabaseConfigured } from "./repository";

/**
 * Placeholder mientras no existe Supabase Auth conectado. Simula a los dos
 * progenitores con ids fijos para poder probar el flujo de emparejamiento
 * de punta a punta sin un sistema de sesiones real. Se reemplaza por la
 * sesión real de Supabase Auth en cuanto exista el proyecto.
 */
export const DEMO_PARENT_A_ID = "00000000-0000-0000-0000-00000000000a";
export const DEMO_PARENT_B_ID = "00000000-0000-0000-0000-00000000000b";

export const isDemoMode = !isSupabaseConfigured;
