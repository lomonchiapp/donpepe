import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * En Next.js 16 `cookies()` es asíncrono.
 *
 * Sin genérico de Database: hacemos casts explícitos en cada lectura con los
 * tipos declarados en `lib/supabase/types.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // En Server Components `set` lanza; el refresh se hace en proxy.ts
          }
        },
      },
    },
  );
}

/**
 * Cliente con service role (solo para Route Handlers server-side,
 * p.ej. el cron de vencimientos). NUNCA exponer al cliente.
 */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
