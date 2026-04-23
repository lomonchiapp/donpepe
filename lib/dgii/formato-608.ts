/**
 * Formato DGII 608 — Comprobantes Anulados.
 *
 * Reporte mensual de todos los NCF que se ANULARON (por error,
 * deterioro, fin del rango sin usar, etc.). Para Don Pepe la fuente son
 * las facturas con `estado = 'anulada'`.
 *
 * Estructura (pipe-delimited, CRLF):
 *
 * 1. NCF                  (19 chars)
 * 2. Fecha Comprobante    (YYYYMMDD)
 * 3. Tipo Anulación       ("01"..."09")
 */

import { SEP, campo, fechaDGII, finalizar, limpiarRncCedula, registro } from "./common";

/** Tipo de anulación según DGII. */
export type TipoAnulacion608 =
  | "01" // Deterioro de Factura Pre-Impresa
  | "02" // Errores de Impresión (Factura Pre-Impresa)
  | "03" // Impresión Defectuosa
  | "04" // Duplicidad de Factura
  | "05" // Corrección de la Información
  | "06" // Cambio de Productos
  | "07" // Devolución de Productos
  | "08" // Omisión de Productos
  | "09"; // Errores en Secuencia de NCF

export interface Registro608 {
  ncf: string;
  fechaComprobante: Date | string;
  tipoAnulacion: TipoAnulacion608;
}

export function linea608(r: Registro608): string {
  return registro([
    campo(r.ncf, 19),
    fechaDGII(r.fechaComprobante),
    r.tipoAnulacion,
  ]);
}

export function generar608(
  rncEmisor: string,
  periodo: string,
  registros: Registro608[],
): string {
  const periodoCompacto = periodo.replace("-", "");
  const header = [
    "608",
    limpiarRncCedula(rncEmisor),
    periodoCompacto,
    String(registros.length),
  ].join(SEP);
  const lineas = [header, ...registros.map(linea608)];
  return finalizar(lineas);
}

export const COLUMNAS_608 = [
  "NCF",
  "Fecha Comprobante",
  "Tipo Anulación",
] as const;

export function fila608Csv(r: Registro608): (string | number)[] {
  return [r.ncf, fechaDGII(r.fechaComprobante), r.tipoAnulacion];
}

/** Labels para los tipos de anulación. */
export const TIPOS_ANULACION_608: Record<TipoAnulacion608, string> = {
  "01": "Deterioro de factura pre-impresa",
  "02": "Errores de impresión",
  "03": "Impresión defectuosa",
  "04": "Duplicidad de factura",
  "05": "Corrección de información",
  "06": "Cambio de productos",
  "07": "Devolución de productos",
  "08": "Omisión de productos",
  "09": "Errores en secuencia de NCF",
};
