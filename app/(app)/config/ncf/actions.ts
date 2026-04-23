"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { TIPOS_COMPROBANTE } from "@/lib/facturacion/tipos-comprobante";
import type { EstadoRangoNcf, TipoComprobante } from "@/lib/supabase/types";

// Zod.enum requiere una tupla literal no-vacía. Hacemos el cast explícito al
// generar la tupla desde el catálogo canónico — así no hay que mantener la
// lista en dos lugares (enum TS + schema Zod).
const TIPO_COMPROBANTE = z.enum(
  TIPOS_COMPROBANTE as [TipoComprobante, ...TipoComprobante[]],
);

const CargarRangoSchema = z
  .object({
    tipo_comprobante: TIPO_COMPROBANTE,
    serie: z.enum(["B", "E"]),
    secuencia_desde: z.coerce.number().int().positive(),
    secuencia_hasta: z.coerce.number().int().positive(),
    fecha_vencimiento: z.iso.date().optional().nullable(),
    notas: z.string().optional().nullable(),
  })
  .refine((d) => d.secuencia_hasta >= d.secuencia_desde, {
    message: "secuencia_hasta debe ser ≥ secuencia_desde",
    path: ["secuencia_hasta"],
  });

export async function cargarRangoNcf(input: unknown) {
  const parsed = CargarRangoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", "),
    };
  }
  const d = parsed.data;
  const supabase = await createClient();

  // Validar que no solape con un rango existente activo del mismo tipo+serie
  const { data: existentes } = await supabase
    .from("ncf_rangos")
    .select("secuencia_desde, secuencia_hasta, estado")
    .eq("tipo_comprobante", d.tipo_comprobante)
    .eq("serie", d.serie)
    .in("estado", ["activo", "agotado"]);

  const rangos = (existentes ?? []) as Array<{
    secuencia_desde: number;
    secuencia_hasta: number;
    estado: EstadoRangoNcf;
  }>;
  const solape = rangos.find(
    (r) =>
      !(d.secuencia_hasta < r.secuencia_desde || d.secuencia_desde > r.secuencia_hasta),
  );
  if (solape) {
    return {
      error: `El rango se solapa con uno existente (${solape.secuencia_desde}-${solape.secuencia_hasta}).`,
    };
  }

  const { error } = await supabase.from("ncf_rangos").insert({
    tipo_comprobante: d.tipo_comprobante,
    serie: d.serie,
    secuencia_desde: d.secuencia_desde,
    secuencia_hasta: d.secuencia_hasta,
    secuencia_actual: d.secuencia_desde,
    fecha_vencimiento: d.fecha_vencimiento ?? null,
    notas: d.notas ?? null,
    estado: "activo" as EstadoRangoNcf,
  });

  if (error) return { error: error.message };

  revalidatePath("/config/ncf");
  return { ok: true };
}

const CambiarEstadoSchema = z.object({
  rango_id: z.uuid(),
  estado: z.enum(["activo", "anulado", "agotado", "vencido"]),
  motivo: z.string().optional().nullable(),
});

export async function cambiarEstadoRangoNcf(input: unknown) {
  const parsed = CambiarEstadoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { rango_id, estado, motivo } = parsed.data;
  const supabase = await createClient();

  const updates: { estado: EstadoRangoNcf; notas?: string } = {
    estado: estado as EstadoRangoNcf,
  };
  if (motivo) updates.notas = motivo;

  const { error } = await supabase
    .from("ncf_rangos")
    .update(updates)
    .eq("id", rango_id);

  if (error) return { error: error.message };

  revalidatePath("/config/ncf");
  return { ok: true };
}
