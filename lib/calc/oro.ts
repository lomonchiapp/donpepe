/**
 * Tasación de oro para compraventas dominicanas.
 *
 * El precio por gramo se registra diariamente por kilataje (10K, 14K, 18K, 24K).
 * La "pureza" de cada kilataje (K/24) convierte el precio spot del oro puro
 * al valor de la pieza usada (joyería comercial).
 */

export const KILATAJES = [10, 14, 18, 22, 24] as const;
export type Kilataje = (typeof KILATAJES)[number];

const PUREZA_POR_KILATAJE: Record<Kilataje, number> = {
  10: 10 / 24,
  14: 14 / 24,
  18: 18 / 24,
  22: 22 / 24,
  24: 1,
};

export function purezaDeKilataje(k: Kilataje): number {
  return PUREZA_POR_KILATAJE[k];
}

export interface TasarOroInput {
  kilataje: Kilataje;
  peso_gramos: number;
  /**
   * Precio de referencia por gramo para el kilataje específico (DOP).
   * Se lee de la tabla `precios_oro` del día.
   */
  precio_dop_gramo: number;
  /**
   * Descuento aplicado al cliente (ej: 0.1 = 10% menos del precio de mercado).
   */
  descuento?: number;
}

export interface TasacionOroResultado {
  precio_bruto: number;
  descuento_aplicado: number;
  precio_final: number;
  pureza: number;
}

export function tasarOro(input: TasarOroInput): TasacionOroResultado {
  const descuento = input.descuento ?? 0;
  const bruto = input.peso_gramos * input.precio_dop_gramo;
  const final = bruto * (1 - descuento);
  return {
    precio_bruto: redondear(bruto),
    descuento_aplicado: redondear(bruto - final),
    precio_final: redondear(final),
    pureza: PUREZA_POR_KILATAJE[input.kilataje],
  };
}

/**
 * Dado el precio spot del oro 24K por gramo, deriva el precio por gramo
 * para cada kilataje aplicando un margen comercial del negocio (descuento
 * típico 20-35% bajo spot al comprar al público).
 */
export interface DerivarPreciosInput {
  precio_spot_24k_gramo: number;
  margen_compra?: number; // default 0.25 (compramos 25% bajo spot)
}

export function derivarPreciosPorKilataje(input: DerivarPreciosInput) {
  const margen = input.margen_compra ?? 0.25;
  const tabla: Record<Kilataje, number> = {} as Record<Kilataje, number>;
  for (const k of KILATAJES) {
    const precio = input.precio_spot_24k_gramo * PUREZA_POR_KILATAJE[k] * (1 - margen);
    tabla[k] = redondear(precio);
  }
  return tabla;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
