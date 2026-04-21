import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/supabase/types";

/**
 * Devuelve el `app_users.id` del usuario autenticado actual, o `null` si no
 * hay sesión o no tiene fila en `app_users`. Se usa para trazabilidad
 * (campos `emitido_por`, `emitida_por`, `recibido_por`, etc.).
 *
 * No lanza error si no hay usuario — el caller debe decidir si es aceptable
 * (la mayoría de acciones ya pasan por layout auth check, así que null es
 * raro; aún así devolvemos null para no romper rutas anónimas).
 */
export async function obtenerAppUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const row = data as Pick<AppUser, "id"> | null;
  return row?.id ?? null;
}
