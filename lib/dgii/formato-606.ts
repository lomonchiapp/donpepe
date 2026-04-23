/**
 * Formato DGII 606 — Compras de Bienes y Servicios.
 *
 * Este reporte lo presentan mensualmente los contribuyentes a la DGII
 * declarando TODAS las compras que hicieron (proveedores + compras al
 * público). Para Don Pepe, las principales fuentes son:
 *   - `compras_oro`: oro comprado a personas físicas (tipo bien 06 = Oro)
 *   - otros gastos operativos (no los estamos capturando todavía —
 *     el contable puede agregarlos manualmente en un futuro).
 *
 * Estructura del registro (pipe-delimited, CRLF, encoding ISO-8859-1):
 *
 * 1.  RNC o Cédula              (text, 9 o 11 dígitos)
 * 2.  Tipo Identificación       ("1" RNC / "2" Cédula)
 * 3.  Tipo Bienes/Servicios     ("01"..."18")
 * 4.  NCF                       (19 chars si e-CF / 11 si B)
 * 5.  NCF Modificado            (opcional)
 * 6.  Fecha Comprobante         (YYYYMMDD)
 * 7.  Fecha Pago                (YYYYMMDD)
 * 8.  Monto Facturado Servicios (numeric, 2 dec)
 * 9.  Monto Facturado Bienes    (numeric, 2 dec)
 * 10. Total Monto Facturado     (numeric, 2 dec)
 * 11. ITBIS Facturado           (numeric, 2 dec)
 * 12. ITBIS Retenido            (numeric, 2 dec)
 * 13. ITBIS Sujeto Proporcionalidad (numeric)
 * 14. ITBIS Llevado al Costo    (numeric)
 * 15. ITBIS por Adelantar       (numeric)
 * 16. ITBIS Percibido Compras   (numeric)
 * 17. Tipo Retención ISR        ("01"..."05" o vacío)
 * 18. Monto Retención Renta     (numeric)
 * 19. ISR Percibido Compras     (numeric)
 * 20. Impuesto Selectivo Consumo (numeric)
 * 21. Otros Impuestos/Tasas     (numeric)
 * 22. Monto Propina Legal       (numeric)
 * 23. Forma de Pago             ("01"..."07")
 */

import {
  SEP,
  campo,
  fechaDGII,
  finalizar,
  limpiarRncCedula,
  montoDGII,
  registro,
  tipoIdDGII,
} from "./common";

/** Tipo de bienes/servicios comprados (DGII). */
export type TipoBien606 =
  | "01" // Gastos de Personal
  | "02" // Gastos por Trabajos, Suministros y Servicios
  | "03" // Arrendamientos
  | "04" // Gastos de Activos Fijos
  | "05" // Gastos de Representación
  | "06" // Otras Deducciones Admitidas
  | "07" // Gastos Financieros
  | "08" // Gastos Extraordinarios
  | "09" // Compras y Gastos que Formarán Parte del Costo de Venta
  | "10" // Adquisiciones de Activos
  | "11"; // Gastos de Seguros

/** Forma de pago (DGII 606 y 607). */
export type FormaPagoDGII =
  | "01" // Efectivo
  | "02" // Cheques/Transferencias/Depósitos
  | "03" // Tarjeta Crédito/Débito
  | "04" // Compra a Crédito
  | "05" // Permuta
  | "06" // Nota de Crédito
  | "07"; // Mixto

export interface Registro606 {
  rncCedula: string;
  tipoId?: "1" | "2" | ""; // se deriva si se omite
  tipoBien: TipoBien606;
  ncf: string;
  ncfModificado?: string | null;
  fechaComprobante: Date | string;
  fechaPago?: Date | string | null;
  montoServicios?: number;
  montoBienes?: number;
  /** Si no se pasa, se calcula como servicios + bienes. */
  totalFacturado?: number;
  itbisFacturado?: number;
  itbisRetenido?: number;
  itbisProporcionalidad?: number;
  itbisCosto?: number;
  itbisAdelantar?: number;
  itbisPercibido?: number;
  tipoRetencionIsr?: string;
  retencionRenta?: number;
  isrPercibido?: number;
  impuestoSelectivo?: number;
  otrosImpuestos?: number;
  propinaLegal?: number;
  formaPago: FormaPagoDGII;
}

/**
 * Formatea un registro 606 como línea DGII.
 */
export function linea606(r: Registro606): string {
  const rnc = limpiarRncCedula(r.rncCedula);
  const tipoId = r.tipoId ? r.tipoId : tipoIdDGII(rnc);
  const servicios = r.montoServicios ?? 0;
  const bienes = r.montoBienes ?? 0;
  const total = r.totalFacturado ?? servicios + bienes;

  return registro([
    rnc,
    tipoId,
    r.tipoBien,
    campo(r.ncf, 19),
    campo(r.ncfModificado ?? "", 19),
    fechaDGII(r.fechaComprobante),
    fechaDGII(r.fechaPago ?? r.fechaComprobante),
    montoDGII(servicios),
    montoDGII(bienes),
    montoDGII(total),
    montoDGII(r.itbisFacturado),
    montoDGII(r.itbisRetenido),
    montoDGII(r.itbisProporcionalidad),
    montoDGII(r.itbisCosto),
    montoDGII(r.itbisAdelantar),
    montoDGII(r.itbisPercibido),
    campo(r.tipoRetencionIsr ?? "", 2),
    montoDGII(r.retencionRenta),
    montoDGII(r.isrPercibido),
    montoDGII(r.impuestoSelectivo),
    montoDGII(r.otrosImpuestos),
    montoDGII(r.propinaLegal),
    r.formaPago,
  ]);
}

/**
 * Genera el TXT completo del 606.
 *
 * Encabezado (primera línea): `606|RNC|PERIODO|CANTIDAD|TOTAL`
 * donde PERIODO = YYYYMM, CANTIDAD = nro de registros, TOTAL = suma
 * de totalFacturado (DGII usa este header como control).
 */
export function generar606(
  rncEmisor: string,
  periodo: string, // "YYYY-MM"
  registros: Registro606[],
): string {
  const periodoCompacto = periodo.replace("-", "");
  const cantidad = registros.length;
  const totalFacturado = registros.reduce(
    (sum, r) =>
      sum +
      (r.totalFacturado ?? (r.montoServicios ?? 0) + (r.montoBienes ?? 0)),
    0,
  );

  const header = [
    "606",
    limpiarRncCedula(rncEmisor),
    periodoCompacto,
    String(cantidad),
    montoDGII(totalFacturado),
  ].join(SEP);

  const lineas = [header, ...registros.map(linea606)];
  return finalizar(lineas);
}

/**
 * Encabezados para la vista tabular (UI + Excel/CSV).
 */
export const COLUMNAS_606 = [
  "RNC/Cédula",
  "Tipo ID",
  "Tipo Bien",
  "NCF",
  "NCF Modificado",
  "Fecha Comprobante",
  "Fecha Pago",
  "Monto Servicios",
  "Monto Bienes",
  "Total",
  "ITBIS Facturado",
  "ITBIS Retenido",
  "Forma Pago",
] as const;

/** Convierte un Registro606 en la fila correspondiente para CSV/Excel. */
export function fila606Csv(r: Registro606): (string | number)[] {
  const rnc = limpiarRncCedula(r.rncCedula);
  const tipoId = r.tipoId ? r.tipoId : tipoIdDGII(rnc);
  const servicios = r.montoServicios ?? 0;
  const bienes = r.montoBienes ?? 0;
  const total = r.totalFacturado ?? servicios + bienes;
  return [
    rnc,
    tipoId,
    r.tipoBien,
    r.ncf,
    r.ncfModificado ?? "",
    fechaDGII(r.fechaComprobante),
    fechaDGII(r.fechaPago ?? r.fechaComprobante),
    Number(montoDGII(servicios)),
    Number(montoDGII(bienes)),
    Number(montoDGII(total)),
    Number(montoDGII(r.itbisFacturado)),
    Number(montoDGII(r.itbisRetenido)),
    r.formaPago,
  ];
}
