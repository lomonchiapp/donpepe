"use server";

/**
 * Server actions de configuración. Cada sección (general, empeños, oro,
 * facturación, alertas, perfil) tiene su propio Zod schema para mantener
 * los campos acotados y los mensajes de error claros.
 *
 * Todos los updates revalidan `/config` para reflejar los cambios en la
 * UI inmediatamente.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function erroresZod(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(", ");
}

// ---------------------------------------------------------------------------
// General: identidad del comercio (no-fiscal)
// ---------------------------------------------------------------------------

const GeneralSchema = z.object({
  id: z.uuid(),
  nombre_comercial: z.string().min(2, "Nombre comercial requerido"),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
});

export async function actualizarGeneral(formData: FormData) {
  const parsed = GeneralSchema.safeParse({
    id: formData.get("id")?.toString() ?? "",
    nombre_comercial: formData.get("nombre_comercial")?.toString() ?? "",
    direccion: formData.get("direccion")?.toString() || null,
    telefono: formData.get("telefono")?.toString() || null,
    logo_url: formData.get("logo_url")?.toString() || null,
  });
  if (!parsed.success) return { error: erroresZod(parsed.error) };

  const { id, logo_url, ...rest } = parsed.data;
  const updates = { ...rest, logo_url: logo_url === "" ? null : logo_url };
  const supabase = await createClient();
  const { error } = await supabase.from("config_negocio").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/config", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Empeños: valores por defecto para préstamos
// ---------------------------------------------------------------------------

const EmpenosSchema = z.object({
  id: z.uuid(),
  tasa_interes_default: z.coerce.number().min(0).max(1),
  plazo_meses_default: z.coerce.number().int().min(1).max(12),
  porcentaje_prestamo_default: z.coerce.number().min(0).max(1),
  dias_gracia_vencimiento: z.coerce.number().int().min(0).max(30),
});

export async function actualizarEmpenos(formData: FormData) {
  const parsed = EmpenosSchema.safeParse({
    id: formData.get("id")?.toString() ?? "",
    tasa_interes_default: formData.get("tasa_interes_default")?.toString() ?? "",
    plazo_meses_default: formData.get("plazo_meses_default")?.toString() ?? "",
    porcentaje_prestamo_default:
      formData.get("porcentaje_prestamo_default")?.toString() ?? "",
    dias_gracia_vencimiento:
      formData.get("dias_gracia_vencimiento")?.toString() ?? "",
  });
  if (!parsed.success) return { error: erroresZod(parsed.error) };

  const { id, ...updates } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("config_negocio").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/config", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Oro: margen sobre spot al comprar
// ---------------------------------------------------------------------------

const OroSchema = z.object({
  id: z.uuid(),
  margen_compra_oro: z.coerce.number().min(0).max(1),
});

export async function actualizarOro(formData: FormData) {
  const parsed = OroSchema.safeParse({
    id: formData.get("id")?.toString() ?? "",
    margen_compra_oro: formData.get("margen_compra_oro")?.toString() ?? "",
  });
  if (!parsed.success) return { error: erroresZod(parsed.error) };

  const { id, ...updates } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("config_negocio").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/config", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Facturación DGII: datos fiscales para e-CF
// ---------------------------------------------------------------------------

const FacturacionSchema = z.object({
  id: z.uuid(),
  rnc: z.string().optional().nullable(),
  razon_social: z.string().optional().nullable(),
  direccion_fiscal: z.string().optional().nullable(),
  email_fiscal: z.email("Email inválido").optional().nullable().or(z.literal("")),
  itbis_default: z.coerce.number().min(0).max(100),
  logo_factura_url: z.string().url().optional().nullable().or(z.literal("")),
});

export async function actualizarFacturacion(formData: FormData) {
  const parsed = FacturacionSchema.safeParse({
    id: formData.get("id")?.toString() ?? "",
    rnc: formData.get("rnc")?.toString() || null,
    razon_social: formData.get("razon_social")?.toString() || null,
    direccion_fiscal: formData.get("direccion_fiscal")?.toString() || null,
    email_fiscal: formData.get("email_fiscal")?.toString() || null,
    itbis_default: formData.get("itbis_default")?.toString() ?? "",
    logo_factura_url: formData.get("logo_factura_url")?.toString() || null,
  });
  if (!parsed.success) return { error: erroresZod(parsed.error) };

  const { id, email_fiscal, logo_factura_url, ...rest } = parsed.data;
  const updates = {
    ...rest,
    email_fiscal: email_fiscal === "" ? null : email_fiscal,
    logo_factura_url: logo_factura_url === "" ? null : logo_factura_url,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("config_negocio").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/config", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Alertas: horario y días previos para notificaciones WhatsApp
// ---------------------------------------------------------------------------

const AlertasSchema = z.object({
  id: z.uuid(),
  // Hora en formato HH:MM (24h). La DB guarda como `time`.
  hora_alerta_whatsapp: z
    .string()
    .regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)"),
  // Lista de días previos al vencimiento (ej [3, 1, 0] = 3 días antes, 1 día antes, día del vencimiento)
  dias_alerta_previa: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => Number(x)),
    )
    .pipe(
      z.array(
        z.number().int().min(0, "Días deben ser ≥ 0").max(30, "Máximo 30 días"),
      ),
    ),
});

export async function actualizarAlertas(formData: FormData) {
  const parsed = AlertasSchema.safeParse({
    id: formData.get("id")?.toString() ?? "",
    hora_alerta_whatsapp: formData.get("hora_alerta_whatsapp")?.toString() ?? "",
    dias_alerta_previa: formData.get("dias_alerta_previa")?.toString() ?? "",
  });
  if (!parsed.success) return { error: erroresZod(parsed.error) };

  const { id, ...updates } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("config_negocio").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/config", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mi perfil: datos del usuario logueado
// ---------------------------------------------------------------------------

const PerfilSchema = z.object({
  id: z.uuid(),
  nombre: z.string().min(2, "Nombre requerido"),
  telefono_whatsapp: z.string().optional().nullable(),
  recibir_alertas: z.coerce.boolean(),
});

export async function actualizarPerfil(formData: FormData) {
  const parsed = PerfilSchema.safeParse({
    id: formData.get("id")?.toString() ?? "",
    nombre: formData.get("nombre")?.toString() ?? "",
    telefono_whatsapp: formData.get("telefono_whatsapp")?.toString() || null,
    recibir_alertas:
      formData.get("recibir_alertas") === "on" ||
      formData.get("recibir_alertas") === "true",
  });
  if (!parsed.success) return { error: erroresZod(parsed.error) };

  const { id, ...updates } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/config", "layout");
  return { ok: true };
}
