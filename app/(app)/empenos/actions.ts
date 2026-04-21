"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { obtenerAppUserId } from "@/lib/supabase/current-user";
import {
  calcularDeuda,
  calcularFechaVencimiento,
} from "@/lib/calc/intereses";
import {
  crearPagoConRecibo,
  tipoReciboParaPagoEmpeno,
} from "@/lib/pagos/crear";
import type {
  Articulo,
  Cliente,
  Pago,
  Prestamo,
  ReciboItem,
} from "@/lib/supabase/types";

const TipoArticuloSchema = z.enum(["joya_oro", "electrodomestico", "tenis", "otro"]);

const CrearEmpenoSchema = z.object({
  cliente_id: z.uuid(),
  tipo: TipoArticuloSchema,
  descripcion: z.string().min(3).max(200),
  kilataje: z.coerce.number().int().optional().nullable(),
  peso_gramos: z.coerce.number().positive().optional().nullable(),
  valor_tasado: z.coerce.number().positive(),
  monto_prestado: z.coerce.number().positive(),
  tasa_interes_mensual: z.coerce.number().min(0).max(1),
  plazo_meses: z.coerce.number().int().min(1).max(12),
  fotos_urls: z.array(z.string().url()).optional(),
  notas: z.string().optional().nullable(),
});

export async function crearEmpeno(formData: FormData) {
  const raw = {
    cliente_id: formData.get("cliente_id")?.toString() ?? "",
    tipo: formData.get("tipo")?.toString() ?? "",
    descripcion: formData.get("descripcion")?.toString() ?? "",
    kilataje: formData.get("kilataje")?.toString() || null,
    peso_gramos: formData.get("peso_gramos")?.toString() || null,
    valor_tasado: formData.get("valor_tasado")?.toString() ?? "",
    monto_prestado: formData.get("monto_prestado")?.toString() ?? "",
    tasa_interes_mensual: formData.get("tasa_interes_mensual")?.toString() ?? "",
    plazo_meses: formData.get("plazo_meses")?.toString() ?? "",
    notas: formData.get("notas")?.toString() || null,
    fotos_urls: formData.getAll("fotos_urls").map((v) => v.toString()).filter(Boolean),
  };

  const parsed = CrearEmpenoSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") };
  }

  const d = parsed.data;
  if (d.monto_prestado > d.valor_tasado) {
    return { error: "El monto prestado no puede superar el valor tasado." };
  }

  const supabase = await createClient();

  const { data: articulo, error: errArt } = await supabase
    .from("articulos")
    .insert({
      cliente_id: d.cliente_id,
      tipo: d.tipo,
      descripcion: d.descripcion,
      kilataje: d.kilataje ?? null,
      peso_gramos: d.peso_gramos ?? null,
      valor_tasado: d.valor_tasado,
      fotos_urls: d.fotos_urls ?? [],
      estado: "empenado",
    })
    .select("id")
    .single();

  if (errArt || !articulo) {
    return { error: errArt?.message ?? "No se pudo crear el artículo" };
  }

  const fechaInicio = new Date();
  const fechaVenc = calcularFechaVencimiento({
    fecha_inicio: fechaInicio,
    plazo_meses: d.plazo_meses,
  });

  const { data: codigoData } = await supabase.rpc("generar_codigo_prestamo");
  const codigo = (codigoData as unknown as string) ?? `DP-${Date.now()}`;

  const { data: prestamo, error: errPrest } = await supabase
    .from("prestamos")
    .insert({
      codigo,
      cliente_id: d.cliente_id,
      articulo_id: articulo.id,
      monto_prestado: d.monto_prestado,
      tasa_interes_mensual: d.tasa_interes_mensual,
      plazo_meses: d.plazo_meses,
      fecha_inicio: fechaInicio.toISOString().slice(0, 10),
      fecha_vencimiento: fechaVenc.toISOString().slice(0, 10),
      estado: "activo",
      notas: d.notas,
    })
    .select("id")
    .single();

  if (errPrest || !prestamo) {
    return { error: errPrest?.message ?? "No se pudo crear el préstamo" };
  }

  revalidatePath("/empenos");
  revalidatePath("/");
  redirect(`/empenos/${prestamo.id}?nuevo=1`);
}

/**
 * Registra un empeño que ya venía corriendo fuera del sistema (papel y lápiz).
 *
 * Diferencias vs `crearEmpeno`:
 *  - `fecha_inicio` y `fecha_vencimiento` pueden estar en el pasado.
 *  - Permite inyectar un historial de pagos previos (intereses, abonos, renovaciones).
 *  - Calcula el estado resultante a partir de la fecha de vencimiento efectiva.
 *
 * No toca `crearEmpeno` — son dos caminos independientes por diseño.
 */
const PagoHistoricoSchema = z.object({
  fecha: z.iso.date(),
  tipo: z.enum(["interes", "abono_capital", "renovacion"]),
  monto: z.coerce.number().positive(),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta"]).default("efectivo"),
  notas: z.string().optional().nullable(),
});

const RegistrarExistenteSchema = z.object({
  cliente_id: z.uuid(),
  tipo: TipoArticuloSchema,
  descripcion: z.string().min(3).max(200),
  kilataje: z.coerce.number().int().optional().nullable(),
  peso_gramos: z.coerce.number().positive().optional().nullable(),
  valor_tasado: z.coerce.number().positive(),
  monto_prestado: z.coerce.number().positive(),
  tasa_interes_mensual: z.coerce.number().min(0).max(1),
  plazo_meses: z.coerce.number().int().min(1).max(12),
  fecha_inicio: z.iso.date(),
  fotos_urls: z.array(z.string().url()).optional(),
  notas: z.string().optional().nullable(),
  pagos_previos: z.array(PagoHistoricoSchema).optional().default([]),
});

export async function registrarEmpenoExistente(input: unknown) {
  const parsed = RegistrarExistenteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
    };
  }

  const d = parsed.data;

  // Validaciones de coherencia temporal
  const hoy = new Date().toISOString().slice(0, 10);
  if (d.fecha_inicio > hoy) {
    return {
      error: "Para empeños futuros usa el flujo de 'Nuevo empeño'.",
    };
  }
  if (d.monto_prestado > d.valor_tasado) {
    return { error: "El monto prestado no puede superar el valor tasado." };
  }
  for (const p of d.pagos_previos) {
    if (p.fecha < d.fecha_inicio) {
      return { error: `Hay un pago del ${p.fecha} anterior al inicio (${d.fecha_inicio}).` };
    }
    if (p.fecha > hoy) {
      return { error: `Hay un pago fechado en el futuro (${p.fecha}).` };
    }
  }

  // La fecha de vencimiento efectiva es: última renovación + plazo, o inicio + plazo.
  const renovacionesOrdenadas = [...d.pagos_previos]
    .filter((p) => p.tipo === "renovacion")
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const ultimaRenovacion = renovacionesOrdenadas.at(-1);

  const fechaBaseVenc = ultimaRenovacion?.fecha ?? d.fecha_inicio;
  const fechaVenc = calcularFechaVencimiento({
    fecha_inicio: fechaBaseVenc,
    plazo_meses: d.plazo_meses,
  });
  const fechaVencStr = fechaVenc.toISOString().slice(0, 10);

  // Estado inicial según vencimiento efectivo
  const estadoInicial: Prestamo["estado"] =
    fechaVencStr < hoy ? "vencido_a_cobro" : "activo";

  const supabase = await createClient();

  const { data: articulo, error: errArt } = await supabase
    .from("articulos")
    .insert({
      cliente_id: d.cliente_id,
      tipo: d.tipo,
      descripcion: d.descripcion,
      kilataje: d.kilataje ?? null,
      peso_gramos: d.peso_gramos ?? null,
      valor_tasado: d.valor_tasado,
      fotos_urls: d.fotos_urls ?? [],
      estado: "empenado",
    })
    .select("id")
    .single();

  if (errArt || !articulo) {
    return { error: errArt?.message ?? "No se pudo crear el artículo" };
  }

  const { data: codigoData } = await supabase.rpc("generar_codigo_prestamo");
  const codigo = (codigoData as unknown as string) ?? `DP-${Date.now()}`;

  const notasLegado = d.notas
    ? `[Registrado retroactivamente] ${d.notas}`
    : "[Registrado retroactivamente]";

  const { data: prestamo, error: errPrest } = await supabase
    .from("prestamos")
    .insert({
      codigo,
      cliente_id: d.cliente_id,
      articulo_id: articulo.id,
      monto_prestado: d.monto_prestado,
      tasa_interes_mensual: d.tasa_interes_mensual,
      plazo_meses: d.plazo_meses,
      fecha_inicio: d.fecha_inicio,
      fecha_vencimiento: fechaVencStr,
      estado: estadoInicial,
      notas: notasLegado,
    })
    .select("id")
    .single();

  if (errPrest || !prestamo) {
    return { error: errPrest?.message ?? "No se pudo crear el préstamo" };
  }

  // Insertar historial de pagos (en orden cronológico).
  // Se enrutan por `crearPagoConRecibo` para que cada pago quede con su recibo
  // y respete la misma invariante que el resto del sistema (pago⇔recibo 1:1).
  // Los recibos quedan con `emitido_at = now()` (son retroactivos); la fecha
  // histórica sólo se persiste en `pagos.fecha`.
  if (d.pagos_previos.length > 0) {
    const pagosOrdenados = [...d.pagos_previos].sort((a, b) =>
      a.fecha < b.fecha ? -1 : 1,
    );

    // Necesitamos el snapshot del cliente para los recibos.
    const { data: clienteData } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", d.cliente_id)
      .single();
    const cliente = clienteData as Cliente | null;
    if (!cliente) {
      return {
        error: `Préstamo creado pero no se encontró el cliente para los pagos históricos`,
        prestamo_id: prestamo.id,
      };
    }

    const etiquetaHistorico: Record<
      (typeof pagosOrdenados)[number]["tipo"],
      string
    > = {
      interes: "Pago de interés",
      abono_capital: "Abono a capital",
      renovacion: "Renovación",
    };

    const appUserId = await obtenerAppUserId();

    for (const p of pagosOrdenados) {
      const isRenovacion = p.tipo === "renovacion";
      const nuevaVenc = isRenovacion
        ? calcularFechaVencimiento({
            fecha_inicio: p.fecha,
            plazo_meses: d.plazo_meses,
          })
            .toISOString()
            .slice(0, 10)
        : null;

      const etiqueta = etiquetaHistorico[p.tipo];
      const concepto = `${etiqueta} — Empeño ${codigo} [retroactivo ${p.fecha}]`;
      const items: ReciboItem[] = [
        { descripcion: etiqueta, cantidad: 1, monto: p.monto },
      ];

      const notasPago = p.notas
        ? `[Retroactivo ${p.fecha}] ${p.notas}`
        : `[Retroactivo ${p.fecha}]`;

      const resultado = await crearPagoConRecibo({
        supabase,
        prestamo_id: prestamo.id,
        direccion: "ingreso",
        tipo: p.tipo,
        monto: p.monto,
        metodo: p.metodo,
        concepto,
        notas: notasPago,
        nueva_fecha_vencimiento: nuevaVenc,
        fecha: p.fecha,
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre_completo,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
        },
        tipo_recibo: tipoReciboParaPagoEmpeno(p.tipo),
        concepto_recibo: concepto,
        items,
        app_user_id: appUserId,
      });

      if (!resultado.ok) {
        return {
          error: `Préstamo creado pero falló el historial de pagos en ${p.fecha}: ${resultado.error}`,
          prestamo_id: prestamo.id,
        };
      }
    }
  }

  revalidatePath("/empenos");
  revalidatePath("/");
  redirect(`/empenos/${prestamo.id}?registrado=1`);
}

// Pagos sobre un préstamo existente
const PagoSchema = z.object({
  prestamo_id: z.uuid(),
  tipo: z.enum(["interes", "abono_capital", "saldo_total", "renovacion"]),
  monto: z.coerce.number().positive(),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta"]).default("efectivo"),
  notas: z.string().optional().nullable(),
});

export async function registrarPago(formData: FormData) {
  const parsed = PagoSchema.safeParse({
    prestamo_id: formData.get("prestamo_id")?.toString() ?? "",
    tipo: formData.get("tipo")?.toString() ?? "",
    monto: formData.get("monto")?.toString() ?? "",
    metodo: formData.get("metodo")?.toString() || undefined,
    notas: formData.get("notas")?.toString() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // Traemos préstamo + cliente + artículo en una sola consulta para poder
  // redactar el concepto y los snapshots del recibo.
  const { data: prestamoData, error } = await supabase
    .from("prestamos")
    .select("*, clientes(*), articulos(*)")
    .eq("id", d.prestamo_id)
    .single();

  if (error || !prestamoData) return { error: "Préstamo no encontrado" };

  const prestamoRow = prestamoData as Prestamo & {
    clientes: Cliente | null;
    articulos: Articulo | null;
  };
  const prestamo: Prestamo = prestamoRow;
  const cliente = prestamoRow.clientes;
  const articulo = prestamoRow.articulos;

  if (!cliente) return { error: "El préstamo no tiene cliente asociado" };

  let nuevaFechaVenc: string | null = null;
  let nuevoEstado: Prestamo["estado"] = prestamo.estado;

  if (d.tipo === "renovacion") {
    const venc = calcularFechaVencimiento({
      fecha_inicio: new Date(),
      plazo_meses: prestamo.plazo_meses,
    });
    nuevaFechaVenc = venc.toISOString().slice(0, 10);
    nuevoEstado = "activo";
  } else if (d.tipo === "saldo_total") {
    nuevoEstado = "pagado";
  }

  const articuloDesc = articulo?.descripcion ?? "artículo";
  const etiquetaTipo: Record<typeof d.tipo, string> = {
    interes: "Pago de interés",
    abono_capital: "Abono a capital",
    saldo_total: "Saldo total (retiro)",
    renovacion: "Renovación",
  };
  const etiqueta = etiquetaTipo[d.tipo];
  const concepto = `${etiqueta} — Empeño ${prestamo.codigo} (${articuloDesc})`;

  const items: ReciboItem[] = [
    { descripcion: etiqueta, cantidad: 1, monto: d.monto },
  ];

  const appUserId = await obtenerAppUserId();

  const resultado = await crearPagoConRecibo({
    supabase,
    prestamo_id: d.prestamo_id,
    direccion: "ingreso",
    tipo: d.tipo,
    monto: d.monto,
    metodo: d.metodo,
    concepto,
    notas: d.notas,
    nueva_fecha_vencimiento: nuevaFechaVenc,
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre_completo,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
    },
    tipo_recibo: tipoReciboParaPagoEmpeno(d.tipo),
    concepto_recibo: concepto,
    items,
    app_user_id: appUserId,
  });

  if (!resultado.ok) return { error: resultado.error };

  const updates: Partial<Prestamo> = {};
  if (nuevaFechaVenc) updates.fecha_vencimiento = nuevaFechaVenc;
  if (nuevoEstado !== prestamo.estado) updates.estado = nuevoEstado;

  if (Object.keys(updates).length > 0) {
    await supabase.from("prestamos").update(updates).eq("id", d.prestamo_id);
  }

  if (d.tipo === "saldo_total") {
    await supabase
      .from("articulos")
      .update({ estado: "retirado" })
      .eq("id", prestamo.articulo_id);
  }

  revalidatePath(`/empenos/${d.prestamo_id}`);
  revalidatePath("/empenos");
  revalidatePath("/recibos");
  revalidatePath("/pagos");
  revalidatePath("/");
  return { ok: true, recibo_id: resultado.data.recibo_id };
}

/**
 * Calcula la deuda actual de un préstamo considerando todos sus pagos.
 * Útil para la vista de detalle.
 */
export async function fetchDeudaActual(prestamo_id: string) {
  const supabase = await createClient();

  const [prestamoRes, pagosRes] = await Promise.all([
    supabase.from("prestamos").select("*").eq("id", prestamo_id).single(),
    supabase.from("pagos").select("*").eq("prestamo_id", prestamo_id),
  ]);

  const prestamo = prestamoRes.data as Prestamo | null;
  if (!prestamo) return null;

  const pagos = (pagosRes.data ?? []) as Pago[];

  return calcularDeuda({
    monto_prestado: Number(prestamo.monto_prestado),
    tasa_interes_mensual: Number(prestamo.tasa_interes_mensual),
    fecha_inicio: prestamo.fecha_inicio,
    pagos: pagos
      .filter(
        (p) =>
          p.tipo === "interes" ||
          p.tipo === "abono_capital" ||
          p.tipo === "saldo_total" ||
          p.tipo === "renovacion",
      )
      .map((p) => ({
        fecha: p.fecha,
        tipo: p.tipo as
          | "interes"
          | "abono_capital"
          | "saldo_total"
          | "renovacion",
        monto: Number(p.monto),
      })),
  });
}
