import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador. Sin genérico de Database:
 * confiamos en los tipos declarados en `lib/supabase/types.ts` al hacer
 * casts explícitos en cada página/action. Esto mantiene la DX simple
 * mientras no regeneramos tipos con `supabase gen types`.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
