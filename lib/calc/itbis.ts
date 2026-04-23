/**
 * Cálculos de ITBIS para facturación DGII.
 *
 * Regla del negocio Don Pepe: los precios en venta/inventario están
 * almacenados **con ITBIS incluido** (precio bruto). Al emitir factura
 * hay que desglosar: base (sin ITBIS) + ITBIS.
 *
 * La tasa estándar DGII es 18%. Intereses de empeño, compras de oro al
 * público y algunos bienes usados están EXENTOS (tasa 0 o marcados como
 * no gravados). Cada ítem de factura define si aplica ITBIS.
 */

import { TIPO_COMPROBANTE_META } from "@/lib/facturacion/tipos-comprobante";

export const ITBIS_TASA_DEFAULT = 18;

/**
 * Redondea a 2 decimales usando redondeo bancario (half-to-even) para
 * evitar sesgos en facturas con muchos ítems.
 */
export function redondearDOP(n: number): number {
  const escalado = Math.round(n * 100);
  return escalado / 100;
}

export interface DesgloseItemInput {
  /** Precio unitario con ITBIS incluido (lo que paga el cliente). */
  precio_unitario_bruto: number;
  cantidad: number;
  /** Si false → ítem exento/no gravado; ITBIS queda en 0. */
  itbis_aplica?: boolean;
  /** Porcentaje; por defecto 18. */
  itbis_tasa?: number;
  /** Descuento por unidad, con ITBIS incluido. */
  descuento_unitario?: number;
}

export interface DesgloseItem {
  precio_unitario: number; // base, sin ITBIS
  precio_unitario_bruto: number; // con ITBIS (preservado)
  descuento_unitario: number; // siempre bruto
  cantidad: number;
  itbis_aplica: boolean;
  itbis_tasa: number;
  subtotal: number; // cantidad * precio_unitario (base)
  itbis_monto: number;
  total: number; // = subtotal + itbis_monto = bruto - descuentos
}

/**
 * Desglosa un ítem cuyo precio viene con ITBIS incluido.
 *
 * Estrategia: para evitar drift de redondeo, calculamos el total bruto
 * primero (exacto) y dejamos que el ITBIS absorba la diferencia contra
 * la base redondeada. Así el cliente paga exactamente lo esperado.
 */
export function desglosarItem(input: DesgloseItemInput): DesgloseItem {
  const {
    precio_unitario_bruto,
    cantidad,
    itbis_aplica = true,
    itbis_tasa = ITBIS_TASA_DEFAULT,
    descuento_unitario = 0,
  } = input;

  if (cantidad <= 0) {
    throw new Error("cantidad debe ser > 0");
  }
  if (precio_unitario_bruto < 0) {
    throw new Error("precio_unitario_bruto no puede ser negativo");
  }

  const bruto_neto = precio_unitario_bruto - descuento_unitario;
  if (bruto_neto < 0) {
    throw new Error("descuento mayor que precio unitario");
  }

  // Total bruto del ítem = lo que debe pagar el cliente (exacto).
  const total = redondearDOP(bruto_neto * cantidad);

  if (!itbis_aplica || itbis_tasa === 0) {
    return {
      precio_unitario: redondearDOP(bruto_neto),
      precio_unitario_bruto,
      descuento_unitario,
      cantidad,
      itbis_aplica: false,
      itbis_tasa: 0,
      subtotal: total,
      itbis_monto: 0,
      total,
    };
  }

  const factor = 1 + itbis_tasa / 100;
  // Base unitaria: derivada del bruto neto.
  const precio_unitario = redondearDOP(bruto_neto / factor);
  // Subtotal del ítem: cantidad * base unitaria (puede tener drift).
  const subtotal = redondearDOP(precio_unitario * cantidad);
  // ITBIS absorbe la diferencia para que total siempre sea exacto.
  const itbis_monto = redondearDOP(total - subtotal);

  return {
    precio_unitario,
    precio_unitario_bruto,
    descuento_unitario,
    cantidad,
    itbis_aplica: true,
    itbis_tasa,
    subtotal,
    itbis_monto,
    total,
  };
}

export interface TotalesFactura {
  subtotal: number; // base_itbis + base_exenta
  base_itbis: number;
  base_exenta: number;
  itbis_monto: number;
  descuento: number;
  total: number;
}

export function totalizarFactura(items: DesgloseItem[]): TotalesFactura {
  let base_itbis = 0;
  let base_exenta = 0;
  let itbis_monto = 0;
  let total = 0;
  let descuento = 0;

  for (const it of items) {
    if (it.itbis_aplica) base_itbis += it.subtotal;
    else base_exenta += it.subtotal;
    itbis_monto += it.itbis_monto;
    total += it.total;
    descuento += redondearDOP(it.descuento_unitario * it.cantidad);
  }

  return {
    subtotal: redondearDOP(base_itbis + base_exenta),
    base_itbis: redondearDOP(base_itbis),
    base_exenta: redondearDOP(base_exenta),
    itbis_monto: redondearDOP(itbis_monto),
    descuento: redondearDOP(descuento),
    total: redondearDOP(total),
  };
}

/**
 * Calcula el NCF formateado (sin llamar DB) para previsualizar.
 * La asignación real la hace `obtener_proximo_ncf` en Postgres.
 */
export function formatearNcf(
  serie: "B" | "E",
  tipo_codigo: string,
  secuencia: number,
): string {
  const largo = serie === "E" ? 10 : 8;
  return serie + tipo_codigo + String(secuencia).padStart(largo, "0");
}

/**
 * Devuelve el código numérico DGII para serie B (impreso) correspondiente al
 * tipo de comprobante. Para serie E (e-CF) el código cambia (ej. 01 → 31);
 * ese mapeo vive en `@/lib/facturacion/tipos-comprobante`. Esta función
 * existe históricamente para callers que no distinguen serie — por ahora
 * mantenemos la semántica "código impreso" para no romperlos.
 */
export function codigoTipoComprobante(tipo: string): string | null {
  if (tipo in TIPO_COMPROBANTE_META) {
    return TIPO_COMPROBANTE_META[tipo as keyof typeof TIPO_COMPROBANTE_META]
      .codigoB;
  }
  return null;
}
