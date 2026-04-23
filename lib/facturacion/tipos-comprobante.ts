import type { TipoComprobante } from "@/lib/supabase/types";

/**
 * Catálogo canónico de tipos de comprobante fiscal DGII.
 *
 * Tener un único map evita que `TipoComprobante` se agregue sin
 * actualizar las 4+ páginas que lo listan. Si el enum crece, aquí
 * se actualiza y TypeScript señala cualquier olvido.
 *
 * El código numérico depende de la serie:
 *   - serie B (impreso): usa el código "interno" de abajo.
 *   - serie E (e-CF):    usa el código "ecf".
 * El SQL `obtener_proximo_ncf` replica este mapeo server-side.
 */
export const TIPO_COMPROBANTE_META: Record<
  TipoComprobante,
  {
    /** Etiqueta larga para UI detallada. */
    nombre: string;
    /** Abreviación corta para tablas y filtros. */
    corto: string;
    /** Código DGII para serie B (impreso). */
    codigoB: string;
    /** Código DGII para serie E (e-CF). `null` si no existe e-CF formal. */
    codigoE: string | null;
    /** Texto listo para UI: "Crédito fiscal (01 / E31)". */
    label: string;
  }
> = {
  factura_credito_fiscal: {
    nombre: "Crédito fiscal",
    corto: "Crédito",
    codigoB: "01",
    codigoE: "31",
    label: "Crédito fiscal (01 / E31)",
  },
  factura_consumo: {
    nombre: "Consumo",
    corto: "Consumo",
    codigoB: "02",
    codigoE: "32",
    label: "Consumo (02 / E32)",
  },
  nota_debito: {
    nombre: "Nota de débito",
    corto: "Nota déb.",
    codigoB: "03",
    codigoE: "33",
    label: "Nota de débito (03 / E33)",
  },
  nota_credito: {
    nombre: "Nota de crédito",
    corto: "Nota créd.",
    codigoB: "04",
    codigoE: "34",
    label: "Nota de crédito (04 / E34)",
  },
  compra: {
    nombre: "Compra al público",
    corto: "Compra",
    codigoB: "11",
    codigoE: "41",
    label: "Compra al público (11 / E41)",
  },
  gastos_menores: {
    nombre: "Gastos menores",
    corto: "Gastos men.",
    codigoB: "12",
    codigoE: "43",
    label: "Gastos menores (12 / E43)",
  },
  registro_especial: {
    nombre: "Registro especial",
    corto: "Reg. especial",
    codigoB: "13",
    codigoE: null,
    label: "Registro especial (13)",
  },
  regimen_especial: {
    nombre: "Régimen especial",
    corto: "Rég. especial",
    codigoB: "14",
    codigoE: "44",
    label: "Régimen especial (14 / E44)",
  },
  gubernamental: {
    nombre: "Gubernamental",
    corto: "Gubernamental",
    codigoB: "15",
    codigoE: "45",
    label: "Gubernamental (15 / E45)",
  },
  exportaciones: {
    nombre: "Exportaciones",
    corto: "Exportación",
    codigoB: "16",
    codigoE: "46",
    label: "Exportaciones (16 / E46)",
  },
  pagos_exterior: {
    nombre: "Pagos al exterior",
    corto: "Pagos ext.",
    codigoB: "17",
    codigoE: "47",
    label: "Pagos al exterior (17 / E47)",
  },
};

export const TIPOS_COMPROBANTE: TipoComprobante[] = Object.keys(
  TIPO_COMPROBANTE_META,
) as TipoComprobante[];

export function etiquetaTipoComprobante(tipo: TipoComprobante): string {
  return TIPO_COMPROBANTE_META[tipo].label;
}

export function nombreTipoComprobante(tipo: TipoComprobante): string {
  return TIPO_COMPROBANTE_META[tipo].nombre;
}
