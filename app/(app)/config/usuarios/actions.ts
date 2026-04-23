"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";
import {
  EMAIL_SUPER_ADMIN,
  getAppUser,
  requireAdmin,
} from "@/lib/permisos/check";
import { MODULOS_CODIGOS } from "@/lib/permisos/modulos";
import type { AppUser } from "@/lib/supabase/types";

type ActionResult = { ok: true } | { error: string };

// ============================================================
// Schemas
// ============================================================

const moduloSchema = z.enum(MODULOS_CODIGOS as [string, ...string[]]);

const crearUsuarioSchema = z.object({
  email: z.string().email("Email inválido").transform((v) => v.toLowerCase().trim()),
  nombre: z.string().min(2, "Nombre muy corto").max(120).trim(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
  telefono_whatsapp: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  modulos: z.array(moduloSchema).min(0).max(MODULOS_CODIGOS.length),
  es_admin: z.boolean().default(false),
});

const editarPermisosSchema = z.object({
  id: z.uuid(),
  modulos: z.array(moduloSchema),
  es_admin: z.boolean().default(false),
  nombre: z.string().min(2).max(120).trim().optional(),
  telefono_whatsapp: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

const resetPasswordSchema = z.object({
  id: z.uuid(),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
});

const idSchema = z.object({ id: z.uuid() });

// ============================================================
// Helpers internos
// ============================================================

/**
 * Lee una fila de app_users por id usando el service client (bypasa RLS).
 */
async function leerUsuario(id: string): Promise<AppUser | null> {
  const svc = createServiceClient();
  const { data } = await svc.from("app_users").select("*").eq("id", id).maybeSingle();
  return (data as AppUser | null) ?? null;
}

/**
 * Verifica que el target no sea el super-admin (ixidominicana@gmail.com).
 * Lanza error si lo es (y el actor está intentando modificarlo).
 */
function asegurarNoSuperAdmin(
  target: AppUser,
  motivo: string,
): void | never {
  if (target.email.toLowerCase() === EMAIL_SUPER_ADMIN) {
    throw new Error(`No se puede ${motivo} al super-admin.`);
  }
}

// ============================================================
// Actions
// ============================================================

/**
 * Crea un nuevo usuario con password inicial. Solo admins.
 * - Valida email único.
 * - Crea fila en auth.users (email_confirm: true para skippear verificación).
 * - Crea fila en app_users con modulos_permitidos.
 * - En caso de error después de crear auth.users, hace rollback borrando.
 */
export async function crearUsuario(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = crearUsuarioSchema.safeParse({
      email: formData.get("email"),
      nombre: formData.get("nombre"),
      password: formData.get("password"),
      telefono_whatsapp: formData.get("telefono_whatsapp") ?? undefined,
      modulos: formData.getAll("modulos").map(String),
      es_admin: formData.get("es_admin") === "on" || formData.get("es_admin") === "true",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const { email, nombre, password, telefono_whatsapp, modulos, es_admin } =
      parsed.data;

    // Nadie más puede marcar es_admin: el super-admin ya está seedeado.
    // Si se marca en el form, lo ignoramos silenciosamente (defensa en profundidad).
    const flagAdminReal = email === EMAIL_SUPER_ADMIN ? true : false;
    void es_admin;

    const svc = createServiceClient();

    // 1. Validar email único
    const { data: existe } = await svc
      .from("app_users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existe) {
      return { error: "Ya existe un usuario con ese email." };
    }

    // 2. Crear en auth.users
    const { data: auth, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (authError || !auth.user) {
      return { error: authError?.message ?? "No se pudo crear el usuario." };
    }

    // 3. Insertar en app_users
    const { error: insertError } = await svc.from("app_users").insert({
      auth_user_id: auth.user.id,
      email,
      nombre,
      rol: "empleado",
      es_admin: flagAdminReal,
      modulos_permitidos: modulos,
      telefono_whatsapp,
      activo: true,
    });

    if (insertError) {
      // Rollback del auth.users para no dejar orphan
      await svc.auth.admin.deleteUser(auth.user.id);
      return { error: insertError.message };
    }

    revalidatePath("/config/usuarios");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Edita permisos (módulos), nombre y teléfono de un usuario. Solo admins.
 * No permite modificar el es_admin del super-admin.
 */
export async function editarUsuario(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = editarPermisosSchema.safeParse({
      id: formData.get("id"),
      modulos: formData.getAll("modulos").map(String),
      es_admin:
        formData.get("es_admin") === "on" || formData.get("es_admin") === "true",
      nombre: formData.get("nombre") ?? undefined,
      telefono_whatsapp: formData.get("telefono_whatsapp") ?? undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const { id, modulos, nombre, telefono_whatsapp } = parsed.data;

    const target = await leerUsuario(id);
    if (!target) return { error: "Usuario no encontrado." };

    // Solo el super-admin puede ser admin. No permitimos modificar su es_admin.
    // Para otros, es_admin queda siempre en false.
    const esSuper = target.email.toLowerCase() === EMAIL_SUPER_ADMIN;
    const updates: Record<string, unknown> = {
      modulos_permitidos: modulos,
      es_admin: esSuper ? true : false,
    };
    if (nombre !== undefined) updates.nombre = nombre;
    if (telefono_whatsapp !== undefined) updates.telefono_whatsapp = telefono_whatsapp;

    const svc = createServiceClient();
    const { error } = await svc.from("app_users").update(updates).eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/config/usuarios");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Cambia la contraseña de un usuario (lo hace el admin para sus empleados).
 */
export async function resetearPassword(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = resetPasswordSchema.safeParse({
      id: formData.get("id"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const target = await leerUsuario(parsed.data.id);
    if (!target) return { error: "Usuario no encontrado." };
    if (!target.auth_user_id) return { error: "Usuario sin cuenta de auth." };

    const svc = createServiceClient();
    const { error } = await svc.auth.admin.updateUserById(target.auth_user_id, {
      password: parsed.data.password,
    });

    if (error) return { error: error.message };

    revalidatePath("/config/usuarios");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/** Desactiva un usuario (soft). No se puede auto-desactivar ni desactivar al super-admin. */
export async function desactivarUsuario(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return { error: "ID inválido" };

    const target = await leerUsuario(parsed.data.id);
    if (!target) return { error: "Usuario no encontrado." };
    if (target.id === me.id) return { error: "No puedes desactivarte a ti mismo." };
    asegurarNoSuperAdmin(target, "desactivar");

    const svc = createServiceClient();
    const { error } = await svc
      .from("app_users")
      .update({ activo: false })
      .eq("id", parsed.data.id);

    if (error) return { error: error.message };

    revalidatePath("/config/usuarios");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/** Reactiva un usuario previamente desactivado. */
export async function reactivarUsuario(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return { error: "ID inválido" };

    const svc = createServiceClient();
    const { error } = await svc
      .from("app_users")
      .update({ activo: true })
      .eq("id", parsed.data.id);

    if (error) return { error: error.message };

    revalidatePath("/config/usuarios");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Elimina permanentemente un usuario (auth + app_users). Irreversible.
 * El super-admin no puede eliminarse.
 */
export async function eliminarUsuario(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return { error: "ID inválido" };

    const target = await leerUsuario(parsed.data.id);
    if (!target) return { error: "Usuario no encontrado." };
    if (target.id === me.id) return { error: "No puedes eliminarte a ti mismo." };
    asegurarNoSuperAdmin(target, "eliminar");

    const svc = createServiceClient();

    // Primero borrar auth.users (cascade a app_users si el FK es on delete cascade).
    // Por seguridad hacemos las dos por separado.
    if (target.auth_user_id) {
      await svc.auth.admin.deleteUser(target.auth_user_id);
    }
    const { error } = await svc
      .from("app_users")
      .delete()
      .eq("id", parsed.data.id);

    if (error) return { error: error.message };

    revalidatePath("/config/usuarios");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/**
 * Lee todos los usuarios (para la tabla del admin).
 */
export async function listarUsuarios(): Promise<AppUser[]> {
  const me = await getAppUser();
  if (!me?.es_admin) return [];

  const svc = createServiceClient();
  const { data } = await svc
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: true });

  // Coerción defensiva: si la migración 008 todavía no se aplicó en la DB,
  // las columnas `es_admin` y `modulos_permitidos` pueden llegar undefined.
  // Les damos defaults para que la UI no crashee.
  const usuarios = (data as AppUser[] | null) ?? [];
  return usuarios.map((u) => ({
    ...u,
    es_admin: u.es_admin ?? false,
    modulos_permitidos: Array.isArray(u.modulos_permitidos)
      ? u.modulos_permitidos
      : [],
  }));
}
