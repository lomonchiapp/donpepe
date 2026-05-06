"use server";

import { z } from "zod";

import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Server actions del lockscreen.
 *
 * - `listarUsuariosLockscreen` lee `app_users` con service role (bypassa RLS)
 *   para que la pantalla de login pueda mostrar los avatares antes de
 *   autenticar. Devuelve solo los campos seguros para mostrar.
 *
 * - `loginConPin` resuelve el email del usuario seleccionado y autentica
 *   con `signInWithPassword(email, pin)`. La sesión se setea automática-
 *   mente vía cookies (createClient).
 */

export interface LockscreenUserDTO {
  id: string;
  nombre: string;
  avatar_url: string | null;
  es_admin: boolean;
  rol_display: string;
  pin_length: number;
}

function rolDisplay(u: {
  es_admin: boolean;
  rol: string;
  modulos_permitidos: string[];
}): string {
  if (u.es_admin) return "Admin";
  if (u.rol === "dueno") return "Dueño";
  if (u.modulos_permitidos.includes("contabilidad")) return "Contador";
  return "Empleado";
}

export async function listarUsuariosLockscreen(): Promise<LockscreenUserDTO[]> {
  const sb = createServiceClient();

  // Intentamos primero con las columnas nuevas (migración 012). Si fallan,
  // hacemos fallback al subset legacy para no romper antes de aplicar 012.
  type Row = {
    id: string;
    nombre: string;
    rol: string;
    es_admin: boolean;
    modulos_permitidos: string[] | null;
    avatar_url: string | null;
    pin_length: number | null;
    activo: boolean;
  };

  let rows: Row[] = [];
  const fullQuery = await sb
    .from("app_users")
    .select("id, nombre, rol, es_admin, modulos_permitidos, avatar_url, pin_length, activo")
    .eq("activo", true);

  if (fullQuery.error) {
    // Fallback: 012 aún no aplicada. Re-queremos sólo columnas legacy.
    const legacy = await sb
      .from("app_users")
      .select("id, nombre, rol, es_admin, modulos_permitidos, activo")
      .eq("activo", true);
    if (legacy.error) {
      console.error("listarUsuariosLockscreen:", legacy.error);
      return [];
    }
    rows = ((legacy.data ?? []) as Omit<Row, "avatar_url" | "pin_length">[]).map(
      (r) => ({ ...r, avatar_url: null, pin_length: null }),
    );
  } else {
    rows = (fullQuery.data ?? []) as Row[];
  }

  const users = rows.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    avatar_url: u.avatar_url ?? null,
    es_admin: u.es_admin,
    rol_display: rolDisplay({
      es_admin: u.es_admin,
      rol: u.rol,
      modulos_permitidos: u.modulos_permitidos ?? [],
    }),
    // Si la migración 012 aún no se aplicó, pin_length será null → fallback 6.
    pin_length: u.pin_length ?? 6,
  }));

  // Orden: admin primero, dueños después, resto alfabético.
  users.sort((a, b) => {
    if (a.es_admin !== b.es_admin) return a.es_admin ? -1 : 1;
    if (a.rol_display !== b.rol_display) {
      const order = ["Admin", "Dueño", "Contador", "Empleado"];
      return order.indexOf(a.rol_display) - order.indexOf(b.rol_display);
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return users;
}

const loginInput = z.object({
  userId: z.uuid(),
  pin: z.string().regex(/^\d{6,8}$/, "El PIN debe tener entre 6 y 8 dígitos."),
});

export async function loginConPin(
  userId: string,
  pin: string,
): Promise<{ ok: true } | { error: string }> {
  const parsed = loginInput.safeParse({ userId, pin });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "PIN inválido." };
  }

  // Resolver email con service role (no se devuelve al cliente).
  const svc = createServiceClient();
  const { data: row, error: lookupErr } = await svc
    .from("app_users")
    .select("email, activo")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (lookupErr) {
    console.error("loginConPin lookup:", lookupErr);
    return { error: "No pudimos validar tu usuario. Intenta de nuevo." };
  }
  if (!row || !row.activo) {
    return { error: "Usuario no disponible." };
  }

  // Login con el cliente cookies-aware (settea la sesión automáticamente).
  const sb = await createClient();
  const { error: signInError } = await sb.auth.signInWithPassword({
    email: (row as { email: string }).email,
    password: parsed.data.pin,
  });
  if (signInError) {
    return { error: "PIN incorrecto." };
  }
  return { ok: true };
}
