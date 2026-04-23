"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAcceso, getAppUser } from "@/lib/permisos/check";
import {
  generar606,
  COLUMNAS_606,
  fila606Csv,
  linea606,
  type Registro606,
} from "@/lib/dgii/formato-606";
import { rangoPeriodo, toCsv } from "@/lib/dgii/common";

/**
 * Construye la lista de registros 606 para un periodo dado.
 *
 * Fuentes:
 *   1. `compras_oro`  → oro comprado a personas físicas.
 *        • Tipo ID: 2 (cédula)
 *        • Tipo Bien: "09" (forma parte del costo de venta)
 *        • NCF: vacío (se llena a mano si aplica)
 *        • Forma Pago: "01" (efectivo)
 *
 *   2. `gastos_operativos` → gastos del negocio con RNC/NCF.
 *        • Usa los campos tal como los cargó el contable.
 *        • Si falta RNC o NCF, el gasto NO entra al 606 (se reporta
 *          solo internamente).
 */
async function buildRegistros606(periodo: string): Promise<Registro606[]> {
  const rango = rangoPeriodo(periodo);
  if (!rango) return [];

  const supabase = await createClient();

  // Fuente 1: compras de oro
  const { data: comprasData, error: comprasErr } = await supabase
    .from("compras_oro")
    .select(
      "id, codigo, created_at, total_pagado, cliente_id, clientes:cliente_id(cedula, nombre_completo)",
    )
    .gte("created_at", rango.inicio.toISOString())
    .lt("created_at", rango.fin.toISOString())
    .order("created_at", { ascending: true });

  if (comprasErr) {
    console.error("[606 compras]", comprasErr);
  }

  type ComprasRow = {
    id: string;
    codigo: string;
    created_at: string;
    total_pagado: number;
    clientes:
      | { cedula: string; nombre_completo: string }
      | { cedula: string; nombre_completo: string }[]
      | null;
  };

  const registros: Registro606[] = [];

  for (const row of (comprasData ?? []) as unknown as ComprasRow[]) {
    const cli = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;
    const cedula = cli?.cedula ?? "";
    registros.push({
      rncCedula: cedula,
      tipoBien: "09",
      ncf: "",
      fechaComprobante: new Date(row.created_at),
      montoBienes: Number(row.total_pagado),
      totalFacturado: Number(row.total_pagado),
      formaPago: "01",
    });
  }

  // Fuente 2: gastos operativos
  const desdeStr = rango.inicio.toISOString().slice(0, 10);
  const hastaStr = rango.fin.toISOString().slice(0, 10);

  const { data: gastosData, error: gastosErr } = await supabase
    .from("gastos_operativos")
    .select(
      "id, fecha, concepto, monto, categoria, rnc_proveedor, nombre_proveedor, tipo_id_proveedor, ncf, ncf_modificado, itbis_facturado, itbis_retenido, forma_pago",
    )
    .gte("fecha", desdeStr)
    .lt("fecha", hastaStr)
    .order("fecha", { ascending: true });

  if (gastosErr) {
    // Si la tabla aún no existe (migración no corrida) NO rompemos el 606;
    // seguimos solo con las compras de oro.
    console.warn("[606 gastos]", gastosErr.message);
  }

  type GastoRow = {
    id: string;
    fecha: string;
    concepto: string;
    monto: number;
    categoria: string;
    rnc_proveedor: string | null;
    nombre_proveedor: string | null;
    tipo_id_proveedor: "1" | "2" | null;
    ncf: string | null;
    ncf_modificado: string | null;
    itbis_facturado: number;
    itbis_retenido: number;
    forma_pago: string;
  };

  for (const g of (gastosData ?? []) as unknown as GastoRow[]) {
    // Solo entran al 606 los gastos con RNC + NCF (requerido por DGII).
    if (!g.rnc_proveedor || !g.ncf) continue;

    registros.push({
      rncCedula: g.rnc_proveedor,
      tipoId: (g.tipo_id_proveedor ?? undefined) as "1" | "2" | undefined,
      tipoBien: g.categoria as Registro606["tipoBien"],
      ncf: g.ncf,
      ncfModificado: g.ncf_modificado ?? null,
      fechaComprobante: g.fecha,
      montoServicios: 0,
      montoBienes: Number(g.monto),
      totalFacturado: Number(g.monto),
      itbisFacturado: Number(g.itbis_facturado ?? 0),
      itbisRetenido: Number(g.itbis_retenido ?? 0),
      formaPago: g.forma_pago as Registro606["formaPago"],
    });
  }

  // Ordenar por fecha para que el TXT salga cronológico.
  registros.sort((a, b) => {
    const fa = new Date(
      typeof a.fechaComprobante === "string"
        ? a.fechaComprobante
        : a.fechaComprobante.toISOString(),
    ).getTime();
    const fb = new Date(
      typeof b.fechaComprobante === "string"
        ? b.fechaComprobante
        : b.fechaComprobante.toISOString(),
    ).getTime();
    return fa - fb;
  });

  return registros;
}

const PeriodoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Periodo inválido (YYYY-MM)");

/**
 * Lee el RNC del negocio desde config_negocio.
 */
async function rncNegocio(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("config_negocio")
    .select("rnc")
    .maybeSingle();
  return (data as { rnc: string | null } | null)?.rnc ?? "";
}

/**
 * Devuelve la vista preview + los totales para que la UI los muestre
 * antes de generar el archivo.
 */
export async function previewReporte606(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const registros = await buildRegistros606(periodoVal);
  const total = registros.reduce(
    (s, r) => s + (r.totalFacturado ?? (r.montoBienes ?? 0) + (r.montoServicios ?? 0)),
    0,
  );
  return {
    periodo: periodoVal,
    cantidad: registros.length,
    total,
    registros,
  };
}

/**
 * Genera el TXT DGII 606, lo guarda en `reportes_dgii_generados` y
 * devuelve su contenido + filename para que el cliente lo descargue.
 */
export async function generarTxt606(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const rnc = await rncNegocio();
  const registros = await buildRegistros606(periodoVal);
  const contenido = generar606(rnc, periodoVal, registros);
  const total = registros.reduce(
    (s, r) => s + (r.totalFacturado ?? (r.montoBienes ?? 0) + (r.montoServicios ?? 0)),
    0,
  );

  const me = await getAppUser();
  const svc = createServiceClient();
  await svc.from("reportes_dgii_generados").insert({
    formato: "606",
    periodo: periodoVal,
    generado_por: me?.id ?? null,
    conteo_registros: registros.length,
    total_monto: total,
    total_itbis: 0,
    archivo_txt_contenido: contenido,
  });
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/606");

  // Encabezado DGII para el nombre: DGII_F_606_<RNC>_<YYYYMM>.TXT
  const filename = `DGII_F_606_${rnc || "SINRNC"}_${periodoVal.replace(
    "-",
    "",
  )}.TXT`;
  return { filename, contenido };
}

/** Exporta el mismo dataset a CSV (UTF-8 BOM) para revisión en Excel. */
export async function generarCsv606(periodo: string) {
  await requireAcceso("contabilidad");
  const periodoVal = PeriodoSchema.parse(periodo);
  const registros = await buildRegistros606(periodoVal);
  const rows = registros.map(fila606Csv);
  const csv = toCsv([...COLUMNAS_606], rows);
  return {
    filename: `606_${periodoVal}.csv`,
    contenido: csv,
  };
}

/** Devuelve una línea DGII sin guardar — útil para validaciones. */
export async function debugLinea606(r: Registro606) {
  await requireAcceso("contabilidad");
  return linea606(r);
}
