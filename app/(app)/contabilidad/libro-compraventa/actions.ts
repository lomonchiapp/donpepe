"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAcceso } from "@/lib/permisos/check";
import { toCsv } from "@/lib/dgii/common";
import type { LibroCompraventaRow } from "@/lib/supabase/types";

/**
 * Lee las filas del libro de compraventa filtradas por rango de fechas.
 * La vista (reescrita en migración 010) une compras_oro + gastos_operativos.
 */
export async function leerLibroCompraventa(input: {
  desde?: string; // "YYYY-MM-DD"
  hasta?: string; // "YYYY-MM-DD"
  /** Por defecto incluye ambos. */
  origen?: "compra_oro" | "gasto" | "ambos";
}): Promise<LibroCompraventaRow[]> {
  await requireAcceso("contabilidad");

  const supabase = await createClient();
  let q = supabase.from("v_libro_compraventa").select("*");

  if (input.desde) q = q.gte("fecha", input.desde);
  if (input.hasta) q = q.lte("fecha", input.hasta);
  if (input.origen && input.origen !== "ambos") q = q.eq("origen", input.origen);
  q = q.order("fecha", { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error("[libro-compraventa]", error);
    return [];
  }
  return (data as LibroCompraventaRow[] | null) ?? [];
}

const ExportSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  origen: z.enum(["compra_oro", "gasto", "ambos"]).optional(),
});

/**
 * Devuelve un CSV (UTF-8 BOM) del libro de compraventa, listo para
 * abrir en Excel. Mantiene el orden y nombres de columna del libro
 * físico para que el contable no se pierda.
 */
export async function exportarLibroCsv(input: {
  desde?: string;
  hasta?: string;
  origen?: "compra_oro" | "gasto" | "ambos";
}): Promise<{ filename: string; contenido: string }> {
  const parsed = ExportSchema.parse(input);
  const filas = await leerLibroCompraventa(parsed);

  const headers = [
    "Origen",
    "Cédula/RNC",
    "Fecha",
    "Nombre/Proveedor",
    "Edad",
    "Color",
    "Nacionalidad",
    "Estado Civil",
    "Oficio o Profesión",
    "Domicilio",
    "Teléfono",
    "Orden No. / NCF",
    "Categoría",
    "Efectos/Concepto",
    "Kilataje",
    "Peso (g)",
    "Precio/g",
    "Valor",
    "Disponible",
    "Fecha de Salida",
    "Notas",
  ];

  const rows = filas.map((f) => [
    f.origen,
    f.cedula,
    f.fecha,
    f.nombre,
    f.edad ?? "",
    f.color ?? "",
    f.nacionalidad ?? "",
    f.estado_civil ?? "",
    f.oficio_profesion ?? "",
    f.domicilio ?? "",
    f.telefono ?? "",
    f.orden_numero,
    f.categoria,
    f.efectos,
    f.kilataje ?? "",
    f.peso_gramos != null ? Number(f.peso_gramos) : "",
    f.precio_gramo != null ? Number(f.precio_gramo) : "",
    Number(f.valor),
    f.disponible == null ? "" : f.disponible ? "sí" : "no",
    f.fecha_salida ?? "",
    f.notas ?? "",
  ]);

  const csv = toCsv(headers, rows);
  const rango =
    parsed.desde && parsed.hasta
      ? `${parsed.desde}_${parsed.hasta}`
      : new Date().toISOString().slice(0, 10);
  return {
    filename: `libro-compraventa_${rango}.csv`,
    contenido: csv,
  };
}
