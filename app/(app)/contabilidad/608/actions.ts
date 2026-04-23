"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAcceso, getAppUser } from "@/lib/permisos/check";
import {
  generar608,
  COLUMNAS_608,
  fila608Csv,
  type Registro608,
  type TipoAnulacion608,
} from "@/lib/dgii/formato-608";
import { rangoPeriodo, toCsv } from "@/lib/dgii/common";

/**
 * Construye la lista de NCF anulados para el periodo.
 * Fuente: tabla `facturas` con estado = 'anulada'.
 * Tipo de anulación por default: "05" (Corrección de información) —
 * si el usuario quiere otro, puede ajustarlo desde la factura original
 * (pero como nuestro schema no guarda ese motivo granular, usamos 05
 * que es el más comúnmente aplicable).
 */
async function buildRegistros608(periodo: string): Promise<Registro608[]> {
  const rango = rangoPeriodo(periodo);
  if (!rango) return [];

  const supabase = await createClient();
  const inicioYmd = rango.inicio.toISOString().slice(0, 10);
  const finYmd = rango.fin.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("facturas")
    .select("ncf, fecha_emision, anulada_at, anulada_motivo")
    .eq("estado", "anulada")
    .gte("fecha_emision", inicioYmd)
    .lt("fecha_emision", finYmd)
    .order("fecha_emision", { ascending: true });

  if (error) {
    console.error("[608 build]", error);
    return [];
  }

  type Row = {
    ncf: string | null;
    fecha_emision: string;
    anulada_at: string | null;
    anulada_motivo: string | null;
  };

  const registros: Registro608[] = [];
  for (const f of (data ?? []) as Row[]) {
    if (!f.ncf) continue;
    registros.push({
      ncf: f.ncf,
      fechaComprobante: f.fecha_emision,
      tipoAnulacion: inferirTipoAnulacion(f.anulada_motivo),
    });
  }
  return registros;
}

function inferirTipoAnulacion(motivo: string | null): TipoAnulacion608 {
  if (!motivo) return "05";
  const m = motivo.toLowerCase();
  if (m.includes("duplicid")) return "04";
  if (m.includes("devol")) return "07";
  if (m.includes("cambio")) return "06";
  if (m.includes("omisi")) return "08";
  if (m.includes("secuencia")) return "09";
  if (m.includes("deterior")) return "01";
  if (m.includes("impresi")) return "02";
  if (m.includes("defect")) return "03";
  return "05"; // Corrección de información (default)
}

const PeriodoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Periodo inválido (YYYY-MM)");

async function rncNegocio(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("config_negocio")
    .select("rnc")
    .maybeSingle();
  return (data as { rnc: string | null } | null)?.rnc ?? "";
}

export async function previewReporte608(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const registros = await buildRegistros608(periodoVal);
  return {
    periodo: periodoVal,
    cantidad: registros.length,
    registros,
  };
}

export async function generarTxt608(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const rnc = await rncNegocio();
  const registros = await buildRegistros608(periodoVal);
  const contenido = generar608(rnc, periodoVal, registros);

  const me = await getAppUser();
  const svc = createServiceClient();
  await svc.from("reportes_dgii_generados").insert({
    formato: "608",
    periodo: periodoVal,
    generado_por: me?.id ?? null,
    conteo_registros: registros.length,
    total_monto: 0,
    total_itbis: 0,
    archivo_txt_contenido: contenido,
  });
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/608");

  const filename = `DGII_F_608_${rnc || "SINRNC"}_${periodoVal.replace(
    "-",
    "",
  )}.TXT`;
  return { filename, contenido };
}

export async function generarCsv608(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const registros = await buildRegistros608(periodoVal);
  const rows = registros.map(fila608Csv);
  const csv = toCsv([...COLUMNAS_608], rows);
  return {
    filename: `608_${periodoVal}.csv`,
    contenido: csv,
  };
}
