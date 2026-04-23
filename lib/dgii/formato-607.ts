/**
 * Formato DGII 607 — Ventas de Bienes y Servicios.
 *
 * Reporte mensual de TODAS las facturas/NCF emitidos por el negocio.
 * Para Don Pepe, las fuentes son:
 *   - `facturas`: facturas emitidas con NCF (crédito fiscal, consumo, etc.)
 *   - Nota: las ventas simples sin NCF no se reportan a DGII directamente;
 *     solo forman parte del libro físico de compraventa.
 *
 * Estructura (pipe-delimited, CRLF):
 *
 * 1.  RNC/Cédula/Pasaporte Receptor   (opcional si consumo < RD$250k)
 * 2.  Tipo Identificación             ("1" RNC / "2" Cédula / "3" Pasaporte)
 * 3.  NCF                             (19 chars e-CF o 11 B)
 * 4.  NCF Modificado                  (opcional)
 * 5.  Tipo Ingreso                    ("01"..."06")
 * 6.  Fecha Comprobante               (YYYYMMDD)
 * 7.  Fecha Retención                 (YYYYMMDD, opcional)
 * 8.  Monto Facturado                 (numeric, 2 dec)
 * 9.  ITBIS Facturado                 (numeric)
 * 10. ITBIS Retenido por Terceros     (numeric)
 * 11. ITBIS Percibido                 (numeric)
 * 12. Retención Renta por Terceros    (numeric)
 * 13. ISR Percibido                   (numeric)
 * 14. Impuesto Selectivo al Consumo   (numeric)
 * 15. Otros Impuestos/Tasas           (numeric)
 * 16. Monto Propina Legal             (numeric)
 * 17. Efectivo                        (numeric)
 * 18. Cheque/Transferencia/Depósito   (numeric)
 * 19. Tarjeta Débito/Crédito          (numeric)
 * 20. Venta a Crédito                 (numeric)
 * 21. Bonos/Certificados de Regalo    (numeric)
 * 22. Permuta                         (numeric)
 * 23. Otras Formas de Venta           (numeric)
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

/** Tipo de ingreso DGII 607. */
export type TipoIngreso607 =
  | "01" // Ingresos por Operaciones (no financieros)
  | "02" // Ingresos Financieros
  | "03" // Ingresos Extraordinarios
  | "04" // Ingresos por Arrendamientos
  | "05" // Ingresos por Venta de Activos Depreciables
  | "06"; // Otros Ingresos

export interface Registro607 {
  rncCedula?: string | null;
  tipoId?: "1" | "2" | "3" | "";
  ncf: string;
  ncfModificado?: string | null;
  tipoIngreso: TipoIngreso607;
  fechaComprobante: Date | string;
  fechaRetencion?: Date | string | null;
  montoFacturado: number;
  itbisFacturado?: number;
  itbisRetenidoTerceros?: number;
  itbisPercibido?: number;
  retencionRenta?: number;
  isrPercibido?: number;
  impuestoSelectivo?: number;
  otrosImpuestos?: number;
  propinaLegal?: number;
  // Formas de pago (la DGII espera desglose por monto)
  efectivo?: number;
  cheque?: number;
  tarjeta?: number;
  credito?: number;
  bonos?: number;
  permuta?: number;
  otros?: number;
}

export function linea607(r: Registro607): string {
  const rnc = limpiarRncCedula(r.rncCedula ?? "");
  const tipoId = r.tipoId ? r.tipoId : rnc ? tipoIdDGII(rnc) : "";

  return registro([
    rnc,
    tipoId,
    campo(r.ncf, 19),
    campo(r.ncfModificado ?? "", 19),
    r.tipoIngreso,
    fechaDGII(r.fechaComprobante),
    fechaDGII(r.fechaRetencion ?? null),
    montoDGII(r.montoFacturado),
    montoDGII(r.itbisFacturado),
    montoDGII(r.itbisRetenidoTerceros),
    montoDGII(r.itbisPercibido),
    montoDGII(r.retencionRenta),
    montoDGII(r.isrPercibido),
    montoDGII(r.impuestoSelectivo),
    montoDGII(r.otrosImpuestos),
    montoDGII(r.propinaLegal),
    montoDGII(r.efectivo),
    montoDGII(r.cheque),
    montoDGII(r.tarjeta),
    montoDGII(r.credito),
    montoDGII(r.bonos),
    montoDGII(r.permuta),
    montoDGII(r.otros),
  ]);
}

export function generar607(
  rncEmisor: string,
  periodo: string,
  registros: Registro607[],
): string {
  const periodoCompacto = periodo.replace("-", "");
  const cantidad = registros.length;
  const totalFacturado = registros.reduce(
    (sum, r) => sum + (r.montoFacturado ?? 0),
    0,
  );
  const header = [
    "607",
    limpiarRncCedula(rncEmisor),
    periodoCompacto,
    String(cantidad),
    montoDGII(totalFacturado),
  ].join(SEP);
  const lineas = [header, ...registros.map(linea607)];
  return finalizar(lineas);
}

export const COLUMNAS_607 = [
  "RNC/Cédula",
  "Tipo ID",
  "NCF",
  "NCF Modificado",
  "Tipo Ingreso",
  "Fecha Comprobante",
  "Monto Facturado",
  "ITBIS Facturado",
  "Efectivo",
  "Tarjeta",
  "Crédito",
] as const;

export function fila607Csv(r: Registro607): (string | number)[] {
  const rnc = limpiarRncCedula(r.rncCedula ?? "");
  const tipoId = r.tipoId ? r.tipoId : rnc ? tipoIdDGII(rnc) : "";
  return [
    rnc,
    tipoId,
    r.ncf,
    r.ncfModificado ?? "",
    r.tipoIngreso,
    fechaDGII(r.fechaComprobante),
    Number(montoDGII(r.montoFacturado)),
    Number(montoDGII(r.itbisFacturado)),
    Number(montoDGII(r.efectivo)),
    Number(montoDGII(r.tarjeta)),
    Number(montoDGII(r.credito)),
  ];
}
