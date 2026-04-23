/**
 * Motor de cálculo de intereses para préstamos prendarios dominicanos.
 *
 * Modelo: interés simple mensual acumulativo. La semana parcial se prorratea
 * por días (mes de 30 días). Esto refleja la práctica típica de las
 * compraventas dominicanas donde los intereses se cobran al renovar o saldar.
 */

/**
 * Subconjunto de `TipoPago` (ver `lib/supabase/types.ts`) que afecta el
 * cálculo de deuda de un préstamo. El enum en BD es más amplio (incluye
 * `venta`, `compra_oro`, `otro`) pero esos pagos no se mezclan con empeños.
 */
export type TipoPagoEmpeno =
  | "interes"
  | "abono_capital"
  | "saldo_total"
  | "renovacion";

export interface PagoHistorico {
  fecha: Date | string;
  tipo: TipoPagoEmpeno;
  monto: number;
}

export interface CalculoDeudaInput {
  monto_prestado: number;
  tasa_interes_mensual: number;
  fecha_inicio: Date | string;
  fecha_calculo?: Date | string;
  pagos?: PagoHistorico[];
}

export interface CalculoDeudaResultado {
  capital_pendiente: number;
  intereses_acumulados: number;
  intereses_pagados: number;
  deuda_total: number;
  dias_transcurridos: number;
  meses_transcurridos: number;
}

const DIAS_POR_MES = 30;

function toDate(d: Date | string): Date {
  if (d instanceof Date) return d;
  // Interpretamos "YYYY-MM-DD" como fecha local (no UTC) para evitar
  // saltos de día por zona horaria en República Dominicana (UTC-4).
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

function diffDias(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function redondeoDOP(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula la deuda actual de un préstamo considerando intereses devengados
 * y pagos realizados. Los abonos al capital reducen capital_pendiente;
 * los pagos de interés reducen los intereses acumulados.
 */
export function calcularDeuda(input: CalculoDeudaInput): CalculoDeudaResultado {
  const fechaInicio = toDate(input.fecha_inicio);
  const fechaCalculo = toDate(input.fecha_calculo ?? new Date());
  const pagos = input.pagos ?? [];

  const diasTotales = diffDias(fechaInicio, fechaCalculo);
  const mesesTranscurridos = diasTotales / DIAS_POR_MES;

  let capital = input.monto_prestado;
  let interesesPagados = 0;

  const ordenados = [...pagos].sort(
    (a, b) => toDate(a.fecha).getTime() - toDate(b.fecha).getTime(),
  );

  for (const pago of ordenados) {
    if (pago.tipo === "abono_capital") {
      capital = Math.max(0, capital - pago.monto);
    } else if (pago.tipo === "interes" || pago.tipo === "renovacion") {
      interesesPagados += pago.monto;
    } else if (pago.tipo === "saldo_total") {
      // Consideramos que el pago cubre primero intereses pendientes y luego capital.
      // Para fines de mostrar deuda histórica no modificamos aquí.
    }
  }

  const interesesAcumulados =
    capital * input.tasa_interes_mensual * mesesTranscurridos;
  const interesesPendientes = Math.max(0, interesesAcumulados - interesesPagados);
  const deudaTotal = capital + interesesPendientes;

  return {
    capital_pendiente: redondeoDOP(capital),
    intereses_acumulados: redondeoDOP(interesesAcumulados),
    intereses_pagados: redondeoDOP(interesesPagados),
    deuda_total: redondeoDOP(deudaTotal),
    dias_transcurridos: diasTotales,
    meses_transcurridos: Math.round(mesesTranscurridos * 100) / 100,
  };
}

export interface CalcularVencimientoInput {
  fecha_inicio: Date | string;
  plazo_meses: number;
}

/**
 * Calcula fecha de vencimiento sumando meses calendario (no 30 días fijos)
 * para que un empeño del 15 de enero por 3 meses venza el 15 de abril.
 */
export function calcularFechaVencimiento(input: CalcularVencimientoInput): Date {
  const base = toDate(input.fecha_inicio);
  const d = new Date(base);
  d.setMonth(d.getMonth() + input.plazo_meses);
  return d;
}

function normalizarMedianoche(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

/**
 * Días restantes hasta vencimiento. Negativo = vencido.
 * Compara a resolución de día (ignora hora) para evitar saltos por timezone.
 */
export function diasHastaVencimiento(
  fecha_vencimiento: Date | string,
  fecha_hoy: Date | string = new Date(),
): number {
  const venc = normalizarMedianoche(toDate(fecha_vencimiento));
  const hoy = normalizarMedianoche(toDate(fecha_hoy));
  const ms = venc.getTime() - hoy.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type SemaforoEstado = "activo" | "vence_pronto" | "vence_hoy" | "vencido";

/**
 * Clasifica un préstamo por urgencia para UI (colores del semáforo).
 */
export function semaforoVencimiento(
  fecha_vencimiento: Date | string,
  fecha_hoy: Date | string = new Date(),
): SemaforoEstado {
  const dias = diasHastaVencimiento(fecha_vencimiento, fecha_hoy);
  if (dias < 0) return "vencido";
  if (dias === 0) return "vence_hoy";
  if (dias <= 7) return "vence_pronto";
  return "activo";
}

/**
 * Sugiere monto de préstamo dado valor tasado y porcentaje (ej: 60%).
 * Redondea a múltiplos de 100 DOP para simplicidad operativa.
 */
export function sugerirMontoPrestamo(
  valor_tasado: number,
  porcentaje: number = 0.6,
): number {
  const raw = valor_tasado * porcentaje;
  return Math.floor(raw / 100) * 100;
}

/**
 * Tasa de interés mensual según el monto prestado — política vigente de
 * la compraventa:
 *
 *   Monto (RD$)        | Interés mensual
 *   ------------------ | ---------------
 *   ≤ 5,000            | 10%
 *   5,001 – 49,999     | 5%
 *   ≥ 50,000           | 4%
 *
 * La tabla original del dueño lista 5k→10%, 10k/15k/…/40k→5%, 50k→4%.
 * El rango 40,001–49,999 no aparece en la tabla; lo tratamos como 5%
 * porque el escalón del 4% solo aplica desde 50k.
 *
 * Retorna la tasa como decimal (0.10, 0.05, 0.04). Un `monto <= 0`
 * devuelve 0 — el caller debe tratar eso como "aún no definido".
 */
export function calcularTasaInteres(monto_prestado: number): number {
  if (!Number.isFinite(monto_prestado) || monto_prestado <= 0) return 0;
  if (monto_prestado <= 5000) return 0.1;
  if (monto_prestado >= 50000) return 0.04;
  return 0.05;
}
