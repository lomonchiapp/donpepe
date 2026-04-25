/**
 * Helper central para crear un `pago` con su `recibo` asociado en una sola
 * operación. Cada movimiento de dinero en Don Pepe (ingresos de empeño,
 * ventas, compras de oro) debe pasar por aquí para:
 *
 *   1. Generar un `codigo` único de pago (trigger en DB).
 *   2. Emitir un recibo no fiscal con items y concepto.
 *   3. Dejar el camino libre para promover el recibo a factura más tarde
 *      (factura electrónica e-CF en el roadmap).
 *
 * Atomicidad: Supabase-JS no expone transacciones multi-sentencia, así que
 * insertamos pago → recibo y si el recibo falla, eliminamos el pago (rollback
 * a mejor esfuerzo). Si ambas insertes fallan, se devuelve el error al caller.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DireccionPago,
  MetodoPago,
  ReciboItem,
  TipoPago,
  TipoPagoEmpeno,
  TipoRecibo,
} from "@/lib/supabase/types";

export interface ClienteSnapshot {
  /** Si se conoce el cliente registrado; opcional para caminos anónimos (venta sin cliente). */
  id?: string | null;
  nombre: string;
  cedula?: string | null;
  telefono?: string | null;
}

export interface CrearPagoConReciboInput {
  supabase: SupabaseClient;
  /** Mutuamente excluyentes: solo uno debe venir poblado. */
  prestamo_id?: string | null;
  venta_id?: string | null;
  compra_oro_id?: string | null;

  direccion: DireccionPago;
  tipo: TipoPago;
  monto: number;
  metodo: MetodoPago;
  concepto?: string | null;
  notas?: string | null;
  /** Solo relevante para `tipo=renovacion`. */
  nueva_fecha_vencimiento?: string | null;
  /**
   * Fecha `YYYY-MM-DD` del pago. Si no se provee, DB default = `current_date`.
   * Usar sólo para registros retroactivos (p. ej. importar empeños existentes);
   * el recibo mantiene `emitido_at = now()` para trazar el momento de carga.
   */
  fecha?: string | null;

  /** Datos del cliente que recibe (ingreso) o entrega dinero (egreso). */
  cliente: ClienteSnapshot;

  /** Información del recibo. */
  tipo_recibo: TipoRecibo;
  concepto_recibo: string;
  items: ReciboItem[];

  /** `app_users.id` del empleado que registró el pago (trazabilidad). */
  app_user_id?: string | null;
}

export interface CrearPagoConReciboResult {
  pago_id: string;
  pago_codigo: string;
  recibo_id: string;
  recibo_codigo: string;
}

export async function crearPagoConRecibo(
  input: CrearPagoConReciboInput,
): Promise<
  | { ok: true; data: CrearPagoConReciboResult }
  | { ok: false; error: string }
> {
  const {
    supabase,
    prestamo_id = null,
    venta_id = null,
    compra_oro_id = null,
    direccion,
    tipo,
    monto,
    metodo,
    concepto = null,
    notas = null,
    nueva_fecha_vencimiento = null,
    fecha = null,
    cliente,
    tipo_recibo,
    concepto_recibo,
    items,
    app_user_id = null,
  } = input;

  // El check de DB (chk_pago_origen) garantiza la invariante, pero atajamos
  // acá para dar un mensaje más claro.
  const origenes = [prestamo_id, venta_id, compra_oro_id].filter(Boolean);
  if (origenes.length > 1) {
    return {
      ok: false,
      error: "Un pago sólo puede tener un origen (prestamo/venta/compra_oro).",
    };
  }

  // Totales del recibo: suma de items.
  const subtotal = items.reduce(
    (s, it) => s + Number(it.monto) * Number(it.cantidad ?? 1),
    0,
  );
  const total = Math.round(subtotal * 100) / 100;

  const pagoInsert: Record<string, unknown> = {
    prestamo_id,
    venta_id,
    compra_oro_id,
    cliente_id: cliente.id ?? null,
    direccion,
    tipo,
    monto,
    metodo,
    concepto,
    notas,
    nueva_fecha_vencimiento,
    recibido_por: app_user_id,
  };
  if (fecha) pagoInsert.fecha = fecha;

  const { data: pagoData, error: errPago } = await supabase
    .from("pagos")
    .insert(pagoInsert)
    .select("id, codigo")
    .single();

  if (errPago || !pagoData) {
    const raw = errPago?.message ?? "No se pudo registrar el pago";
    const lower = raw.toLowerCase();
    const hintNumeracion =
      lower.includes("serie de numeración") ||
      lower.includes("numeración no configurada") ||
      lower.includes("p0002");
    return {
      ok: false,
      error: hintNumeracion
        ? `${raw} Revisá Configuración → Numeraciones (serie “pago”). Si ya está, ejecutá en Supabase la migración SQL \`011_numeracion_siguiente_definer.sql\` del repo.`
        : raw,
    };
  }
  const pago = pagoData as { id: string; codigo: string };

  const { data: reciboData, error: errRecibo } = await supabase
    .from("recibos")
    .insert({
      pago_id: pago.id,
      tipo: tipo_recibo,
      cliente_id: cliente.id ?? null,
      cliente_nombre: cliente.nombre,
      cliente_cedula: cliente.cedula ?? null,
      cliente_telefono: cliente.telefono ?? null,
      concepto: concepto_recibo,
      items,
      subtotal: total,
      total,
      metodo,
      emitido_por: app_user_id,
    })
    .select("id, codigo")
    .single();

  if (errRecibo || !reciboData) {
    // Rollback best-effort: si no podemos borrar el pago el caller se
    // entera por el mensaje; queda huérfano pero visible en /pagos.
    await supabase.from("pagos").delete().eq("id", pago.id);
    const raw = errRecibo?.message ?? "No se pudo emitir el recibo";
    const lower = raw.toLowerCase();
    const hintNumeracion =
      lower.includes("serie de numeración") ||
      lower.includes("numeración no configurada") ||
      lower.includes("p0002");
    return {
      ok: false,
      error: hintNumeracion
        ? `${raw} Revisá Configuración → Numeraciones (series “pago” y “recibo”). Si ya están, ejecutá en Supabase la migración SQL \`011_numeracion_siguiente_definer.sql\` del repo.`
        : raw,
    };
  }
  const recibo = reciboData as { id: string; codigo: string };

  return {
    ok: true,
    data: {
      pago_id: pago.id,
      pago_codigo: pago.codigo,
      recibo_id: recibo.id,
      recibo_codigo: recibo.codigo,
    },
  };
}

/**
 * Mapeo TipoPagoEmpeno → TipoRecibo para los pagos sobre préstamos.
 * Utilizado por `registrarPago` de empeños.
 */
export function tipoReciboParaPagoEmpeno(tipo: TipoPagoEmpeno): TipoRecibo {
  switch (tipo) {
    case "interes":
    case "abono_capital":
      return "pago_empeno";
    case "saldo_total":
      return "saldo_empeno";
    case "renovacion":
      return "renovacion";
  }
}
