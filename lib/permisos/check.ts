import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/supabase/types";
import { MODULOS, type ModuloCodigo } from "@/lib/permisos/modulos";

/** Email del super-admin hardcoded. Nunca pierde el flag es_admin. */
export const EMAIL_SUPER_ADMIN = "elviocreations@gmail.com";

/**
 * Devuelve el `AppUser` del usuario autenticado, o `null` si no hay sesión
 * o no tiene fila en `app_users`.
 *
 * No redirige — el caller decide. La mayoría de callers deben usar
 * `requireAppUser()` que sí redirige a /login.
 */
export async function getAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("activo", true)
    .maybeSingle();

  const appUser = (data as AppUser | null) ?? null;
  if (!appUser) return null;

  // Fail-safe: el super-admin hardcoded SIEMPRE es admin, independiente del
  // estado en la DB. Esto garantiza que:
  //   * Si la migración 008 todavía no corrió, igual el dueño pasa.
  //   * Si alguien (incluso por error) le quitó es_admin en la DB, no se
  //     queda bloqueado fuera de su propio sistema.
  //   * Si la fila se crea al hacer login con defaults vacíos, igual
  //     tiene acceso total desde el primer request.
  if (user.email && user.email.toLowerCase() === EMAIL_SUPER_ADMIN) {
    return { ...appUser, es_admin: true };
  }

  return appUser;
}

/**
 * Igual que `getAppUser`, pero redirige a /login si no hay sesión o no hay
 * fila en `app_users`.
 */
export async function requireAppUser(): Promise<AppUser> {
  const me = await getAppUser();
  if (!me) redirect("/login");
  return me;
}

/**
 * `true` si el usuario tiene acceso al módulo indicado. El admin siempre
 * tiene acceso a todo.
 */
export function tieneAcceso(
  user: AppUser | null,
  modulo: ModuloCodigo,
): boolean {
  if (!user) return false;
  if (user.es_admin) return true;
  // Defensivo: si la migración 008 aún no se aplicó, la columna puede llegar
  // undefined — tratamos eso como "sin permisos" en lugar de crashear.
  const permitidos = Array.isArray(user.modulos_permitidos)
    ? user.modulos_permitidos
    : [];
  return permitidos.includes(modulo);
}

/**
 * Verifica acceso al módulo. Si el usuario no tiene permiso, redirige a /.
 * Uso típico en layouts/páginas server-side:
 *
 * ```ts
 * export default async function EmpenosLayout({ children }) {
 *   await requireAcceso("empenos");
 *   return <>{children}</>;
 * }
 * ```
 */
export async function requireAcceso(modulo: ModuloCodigo): Promise<AppUser> {
  const me = await requireAppUser();
  if (!tieneAcceso(me, modulo)) {
    redirect("/sin-permiso");
  }
  return me;
}

/**
 * Verifica que el usuario sea admin. Para páginas de gestión (usuarios, NCF,
 * numeraciones, etc.) y server actions sensibles.
 */
export async function requireAdmin(): Promise<AppUser> {
  const me = await requireAppUser();
  if (!me.es_admin) {
    redirect("/sin-permiso");
  }
  return me;
}

/**
 * Filtra la lista de `MODULOS` a los que el usuario puede acceder. Se usa
 * en el sidebar para no mostrar items vedados.
 */
export function modulosVisibles(user: AppUser | null) {
  if (!user) return [];
  if (user.es_admin) return [...MODULOS];
  const permitidos = Array.isArray(user.modulos_permitidos)
    ? user.modulos_permitidos
    : [];
  return MODULOS.filter(
    (m) => !m.soloAdmin && permitidos.includes(m.codigo),
  );
}
