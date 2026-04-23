"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAcceso, getAppUser } from "@/lib/permisos/check";
import {
  generar607,
  COLUMNAS_607,
  fila607Csv,
  type Registro607,
} from "@/lib/dgii/formato-607";
import { rangoPeriodo, toCsv } from "@/lib/dgii/common";

/**
 * Construye la lista de registros 607 para un periodo dado.
 * Fuente: tabla `facturas` con estado emitida/firmada/aceptada.
 *
 * Asume que `pago.metodo` refleja la forma principal (efectivo/transferencia/
 * tarjeta). La DGII pide desglose por forma de pago — ponemos el total
 * en la columna correspondiente al método registrado.
 */
async function buildRegistros607(periodo: string): Promise<Registro607[]> {
  const rango = rangoPeriodo(periodo);
  if (!rango) return [];

  const supabase = await createClient();
  const inicioYmd = rango.inicio.toISOString().slice(0, 10);
  const finYmd = rango.fin.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("facturas")
    .select(
      "id, ncf, rnc_receptor, cedula_receptor, fecha_emision, subtotal, itbis_monto, total, estado, pago_id, pagos:pago_id(metodo)",
    )
    .gte("fecha_emision", inicioYmd)
    .lt("fecha_emision", finYmd)
    .in("estado", ["emitida", "firmada", "aceptada"])
    .order("fecha_emision", { ascending: true });

  if (error) {
    console.error("[607 build]", error);
    return [];
  }

  type Row = {
    ncf: string | null;
    rnc_receptor: string | null;
    cedula_receptor: string | null;
    fecha_emision: string;
    subtotal: number;
    itbis_monto: number;
    total: number;
    pagos: { metodo: string } | { metodo: string }[] | null;
  };

  const registros: Registro607[] = [];
  for (const f of (data ?? []) as unknown as Row[]) {
    if (!f.ncf) continue; // sin NCF no se reporta

    const rncCed = (f.rnc_receptor || f.cedula_receptor || "").replace(/\D/g, "");
    const total = Number(f.total);
    const pago = Array.isArray(f.pagos) ? f.pagos[0] : f.pagos;
    const metodo = pago?.metodo ?? "efectivo";
    const efectivo = metodo === "efectivo" ? total : 0;
    const tarjeta = metodo === "tarjeta" ? total : 0;
    const cheque = metodo === "transferencia" ? total : 0;

    registros.push({
      rncCedula: rncCed,
      ncf: f.ncf,
      tipoIngreso: "01",
      fechaComprobante: f.fecha_emision,
      montoFacturado: Number(f.subtotal),
      itbisFacturado: Number(f.itbis_monto),
      efectivo,
      cheque,
      tarjeta,
    });
  }
  return registros;
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

export async function previewReporte607(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const registros = await buildRegistros607(periodoVal);
  const total = registros.reduce((s, r) => s + r.montoFacturado, 0);
  return {
    periodo: periodoVal,
    cantidad: registros.length,
    total,
    registros,
  };
}

export async function generarTxt607(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const rnc = await rncNegocio();
  const registros = await buildRegistros607(periodoVal);
  const contenido = generar607(rnc, periodoVal, registros);
  const total = registros.reduce((s, r) => s + r.montoFacturado, 0);
  const totalItbis = registros.reduce(
    (s, r) => s + (r.itbisFacturado ?? 0),
    0,
  );

  const me = await getAppUser();
  const svc = createServiceClient();
  await svc.from("reportes_dgii_generados").insert({
    formato: "607",
    periodo: periodoVal,
    generado_por: me?.id ?? null,
    conteo_registros: registros.length,
    total_monto: total,
    total_itbis: totalItbis,
    archivo_txt_contenido: contenido,
  });
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/607");

  const filename = `DGII_F_607_${rnc || "SINRNC"}_${periodoVal.replace(
    "-",
    "",
  )}.TXT`;
  return { filename, contenido };
}

export async function generarCsv607(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const registros = await buildRegistros607(periodoVal);
  const rows = registros.map(fila607Csv);
  const csv = toCsv([...COLUMNAS_607], rows);
  return {
    filename: `607_${periodoVal}.csv`,
    contenido: csv,
  };
}
