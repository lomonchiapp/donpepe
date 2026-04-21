"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { obtenerAppUserId } from "@/lib/supabase/current-user";
import { crearPagoConRecibo } from "@/lib/pagos/crear";
import type { PiezaJoyeria, ReciboItem } from "@/lib/supabase/types";

// -------------------------------------------
// Schemas
// -------------------------------------------

const MaterialSchema = z.enum(["oro", "plata", "mixto"]);
const TipoRegistroSchema = z.enum(["pieza", "lote"]);
const EstadoPiezaSchema = z.enum([
  "disponible",
  "reservada",
  "vendida",
  "en_reparacion",
  "baja",
  "agotado",
]);
const OrigenSchema = z.enum([
  "taller",
  "compra_oro",
  "articulo_propiedad",
  "proveedor_externo",
]);

// Oro: 10/14/18/22/24, Plata: 800/925/950/999
const KilatajeSchema = z.coerce
  .number()
  .int()
  .refine((n) => [10, 14, 18, 22, 24, 800, 925, 950, 999].includes(n), {
    message: "Kilataje inválido",
  });

const PiedraSchema = z.object({
  tipo: z.string().min(1),
  cantidad: z.coerce.number().int().positive().optional(),
  quilates: z.coerce.number().positive().optional(),
  color: z.string().optional(),
  notas: z.string().optional(),
});

const PiezaBaseSchema = z.object({
  tipo_registro: TipoRegistroSchema.default("pieza"),
  categoria_id: z.uuid().optional().nullable(),
  nombre: z.string().min(2).max(120),
  material: MaterialSchema,
  kilataje: KilatajeSchema.optional().nullable(),

  // Individuales
  peso_gramos: z.coerce.number().positive().optional().nullable(),
  medida: z.string().optional().nullable(),
  tejido: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
  piedras: z.array(PiedraSchema).optional().default([]),

  // Lotes
  unidades_totales: z.coerce.number().int().min(1).default(1),
  peso_gramos_total: z.coerce.number().positive().optional().nullable(),

  // Costo y precio
  costo_material: z.coerce.number().min(0).default(0),
  costo_mano_obra: z.coerce.number().min(0).default(0),
  precio_venta: z.coerce.number().positive(),
  precio_minimo: z.coerce.number().min(0).optional().nullable(),

  // Fotos / ubicación
  fotos_urls: z.array(z.string().url()).optional().default([]),
  ubicacion: z.string().optional().nullable(),

  // Origen
  origen: OrigenSchema.default("taller"),
  origen_ref: z.uuid().optional().nullable(),
  proveedor: z.string().optional().nullable(),

  fecha_adquisicion: z.iso.date().optional(),
  notas: z.string().optional().nullable(),
});

const CrearPiezaSchema = PiezaBaseSchema
  .refine((d) => d.precio_minimo == null || d.precio_minimo <= d.precio_venta, {
    message: "El precio mínimo no puede superar al precio de venta",
    path: ["precio_minimo"],
  })
  .refine((d) => d.tipo_registro === "lote" || d.unidades_totales === 1, {
    message: "Las piezas individuales tienen 1 unidad",
    path: ["unidades_totales"],
  });

export async function crearPiezaJoyeria(input: unknown) {
  const parsed = CrearPiezaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
    };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const unidadesDisponibles =
    d.tipo_registro === "lote" ? d.unidades_totales : 1;

  const piedras = d.piedras.length > 0 ? d.piedras : null;

  const insertPayload = {
    tipo_registro: d.tipo_registro,
    categoria_id: d.categoria_id ?? null,
    nombre: d.nombre,
    material: d.material,
    kilataje: d.kilataje ?? null,
    peso_gramos: d.peso_gramos ?? null,
    medida: d.medida ?? null,
    tejido: d.tejido ?? null,
    marca: d.marca ?? null,
    piedras,
    unidades_totales: d.tipo_registro === "lote" ? d.unidades_totales : 1,
    unidades_disponibles: unidadesDisponibles,
    peso_gramos_total: d.peso_gramos_total ?? null,
    costo_material: d.costo_material,
    costo_mano_obra: d.costo_mano_obra,
    precio_venta: d.precio_venta,
    precio_minimo: d.precio_minimo ?? null,
    fotos_urls: d.fotos_urls,
    ubicacion: d.ubicacion ?? null,
    origen: d.origen,
    origen_ref: d.origen_ref ?? null,
    proveedor: d.proveedor ?? null,
    fecha_adquisicion: d.fecha_adquisicion ?? null,
    notas: d.notas ?? null,
  };

  const { data, error } = await supabase
    .from("piezas_joyeria")
    .insert(insertPayload)
    .select("id, sku")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear la pieza" };
  }

  revalidatePath("/joyeria");
  revalidatePath("/");
  redirect(`/joyeria/${data.id}?nuevo=1`);
}

// -------------------------------------------
// Editar pieza
// -------------------------------------------

const EditarPiezaSchema = PiezaBaseSchema.partial().extend({ id: z.uuid() });

export async function editarPiezaJoyeria(input: unknown) {
  const parsed = EditarPiezaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
    };
  }
  const { id, ...rest } = parsed.data;

  const supabase = await createClient();
  const updatePayload: Record<string, unknown> = { ...rest };

  // No permitir cambiar tipo_registro de pieza ↔ lote (evita inconsistencias con ventas)
  delete updatePayload.tipo_registro;

  const { error } = await supabase
    .from("piezas_joyeria")
    .update(updatePayload)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/joyeria/${id}`);
  revalidatePath("/joyeria");
  return { ok: true };
}

// -------------------------------------------
// Cambiar estado (reservar / liberar / reparar / dar de baja)
// -------------------------------------------

const CambiarEstadoSchema = z.object({
  id: z.uuid(),
  estado: EstadoPiezaSchema,
  notas: z.string().optional().nullable(),
});

export async function cambiarEstadoPieza(input: unknown) {
  const parsed = CambiarEstadoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("piezas_joyeria")
    .update({ estado: d.estado })
    .eq("id", d.id);

  if (error) return { error: error.message };

  if (d.notas) {
    await supabase.from("movimientos_joyeria").insert({
      pieza_id: d.id,
      tipo: "cambio_estado",
      datos_despues: { estado: d.estado },
      notas: d.notas,
    });
  }

  revalidatePath(`/joyeria/${d.id}`);
  revalidatePath("/joyeria");
  return { ok: true };
}

// -------------------------------------------
// Vender pieza (crea Venta + descuenta stock)
// -------------------------------------------

const VenderPiezaSchema = z.object({
  pieza_id: z.uuid(),
  cantidad: z.coerce.number().int().min(1).default(1),
  precio_venta: z.coerce.number().positive(),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta"]).default("efectivo"),
  comprador_nombre: z.string().optional().nullable(),
  comprador_cedula: z.string().optional().nullable(),
  comprador_telefono: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

export async function venderPiezaJoyeria(input: unknown) {
  const parsed = VenderPiezaSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: piezaData, error: errPieza } = await supabase
    .from("piezas_joyeria")
    .select("*")
    .eq("id", d.pieza_id)
    .single();

  if (errPieza || !piezaData) {
    return { error: "Pieza no encontrada" };
  }
  const pieza = piezaData as PiezaJoyeria;

  if (pieza.estado === "vendida" || pieza.estado === "agotado") {
    return { error: "La pieza ya no está disponible." };
  }
  if (pieza.estado === "baja") {
    return { error: "La pieza está dada de baja." };
  }
  if (d.cantidad > pieza.unidades_disponibles) {
    return {
      error: `Sólo quedan ${pieza.unidades_disponibles} unidades disponibles.`,
    };
  }
  if (pieza.precio_minimo != null && d.precio_venta < Number(pieza.precio_minimo)) {
    return {
      error: `El precio está por debajo del mínimo permitido (${pieza.precio_minimo}).`,
    };
  }

  const { data: codigoData } = await supabase.rpc("generar_codigo_venta");
  const codigo = (codigoData as unknown as string) ?? `VT-${Date.now()}`;

  const { data: ventaData, error: errVenta } = await supabase
    .from("ventas")
    .insert({
      codigo,
      articulo_id: null,
      pieza_joyeria_id: d.pieza_id,
      cantidad: d.cantidad,
      comprador_nombre: d.comprador_nombre ?? null,
      comprador_cedula: d.comprador_cedula ?? null,
      comprador_telefono: d.comprador_telefono ?? null,
      precio_venta: d.precio_venta,
      metodo: d.metodo,
      notas: d.notas ?? null,
    })
    .select("id")
    .single();
  if (errVenta || !ventaData) {
    return { error: errVenta?.message ?? "No se pudo registrar la venta" };
  }
  const venta = ventaData as { id: string };

  // Actualizar stock y estado
  const nuevasDisp = pieza.unidades_disponibles - d.cantidad;
  const updates: Record<string, unknown> = {
    unidades_disponibles: nuevasDisp,
  };
  if (pieza.tipo_registro === "pieza" || nuevasDisp === 0) {
    updates.estado = pieza.tipo_registro === "pieza" ? "vendida" : "agotado";
  }

  const { error: errUpdate } = await supabase
    .from("piezas_joyeria")
    .update(updates)
    .eq("id", d.pieza_id);
  if (errUpdate) return { error: errUpdate.message };

  // Log explícito de venta (los triggers ya registran cambio de estado/unidades,
  // pero dejamos constancia directa del evento "venta" con datos del comprador)
  await supabase.from("movimientos_joyeria").insert({
    pieza_id: d.pieza_id,
    tipo: "venta",
    datos_despues: {
      codigo_venta: codigo,
      cantidad: d.cantidad,
      precio_venta: d.precio_venta,
      metodo: d.metodo,
    },
    notas: d.notas ?? null,
  });

  // Pago + recibo de la venta de joyería
  const concepto = `Venta ${codigo} — ${pieza.nombre}${d.cantidad > 1 ? ` (x${d.cantidad})` : ""}`;
  const items: ReciboItem[] = [
    {
      descripcion: pieza.nombre,
      cantidad: d.cantidad,
      monto: d.precio_venta / d.cantidad,
    },
  ];

  const appUserId = await obtenerAppUserId();

  const resultado = await crearPagoConRecibo({
    supabase,
    venta_id: venta.id,
    direccion: "ingreso",
    tipo: "venta",
    monto: d.precio_venta,
    metodo: d.metodo,
    concepto,
    notas: d.notas ?? null,
    cliente: {
      id: null,
      nombre: d.comprador_nombre ?? "Cliente no identificado",
      cedula: d.comprador_cedula ?? null,
      telefono: d.comprador_telefono ?? null,
    },
    tipo_recibo: "venta_joyeria",
    concepto_recibo: concepto,
    items,
    app_user_id: appUserId,
  });

  if (!resultado.ok) {
    return {
      error: `Venta registrada pero falló el recibo: ${resultado.error}`,
    };
  }

  revalidatePath(`/joyeria/${d.pieza_id}`);
  revalidatePath("/joyeria");
  revalidatePath("/ventas");
  revalidatePath("/recibos");
  revalidatePath("/pagos");
  revalidatePath("/");
  return { ok: true, codigo, recibo_id: resultado.data.recibo_id };
}

// -------------------------------------------
// Convertir artículo vencido_propio → pieza de joyería
// -------------------------------------------

const ConvertirArticuloSchema = z.object({
  articulo_id: z.uuid(),
  nombre: z.string().min(2).max(120),
  categoria_id: z.uuid().optional().nullable(),
  material: MaterialSchema.default("oro"),
  precio_venta: z.coerce.number().positive(),
  precio_minimo: z.coerce.number().min(0).optional().nullable(),
  costo_mano_obra: z.coerce.number().min(0).default(0),
  ubicacion: z.string().optional().nullable(),
  medida: z.string().optional().nullable(),
  tejido: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
  piedras: z.array(PiedraSchema).optional().default([]),
  notas: z.string().optional().nullable(),
});

export async function convertirArticuloAPieza(input: unknown) {
  const parsed = ConvertirArticuloSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: articulo, error: errArt } = await supabase
    .from("articulos")
    .select("id, tipo, descripcion, kilataje, peso_gramos, valor_tasado, fotos_urls, estado")
    .eq("id", d.articulo_id)
    .single();

  if (errArt || !articulo) return { error: "Artículo no encontrado" };
  if (articulo.estado !== "vencido_propio") {
    return { error: "Sólo se pueden convertir artículos que pasaron a propiedad de la casa." };
  }

  const { data: pieza, error: errPieza } = await supabase
    .from("piezas_joyeria")
    .insert({
      tipo_registro: "pieza",
      categoria_id: d.categoria_id ?? null,
      nombre: d.nombre,
      material: d.material,
      kilataje: articulo.kilataje ?? null,
      peso_gramos: articulo.peso_gramos ?? null,
      medida: d.medida ?? null,
      tejido: d.tejido ?? null,
      marca: d.marca ?? null,
      piedras: d.piedras.length > 0 ? d.piedras : null,
      costo_material: Number(articulo.valor_tasado),
      costo_mano_obra: d.costo_mano_obra,
      precio_venta: d.precio_venta,
      precio_minimo: d.precio_minimo ?? null,
      fotos_urls: articulo.fotos_urls ?? [],
      ubicacion: d.ubicacion ?? null,
      origen: "articulo_propiedad",
      origen_ref: articulo.id,
      notas: d.notas
        ? `${d.notas}\n[Proviene del artículo "${articulo.descripcion}"]`
        : `[Proviene del artículo "${articulo.descripcion}"]`,
    })
    .select("id, sku")
    .single();

  if (errPieza || !pieza) return { error: errPieza?.message ?? "No se pudo crear la pieza" };

  // Marcar el artículo como convertido
  const { error: errUpdArt } = await supabase
    .from("articulos")
    .update({ estado: "convertido_a_joyeria" })
    .eq("id", articulo.id);
  if (errUpdArt) {
    return {
      error: `Pieza creada (${pieza.sku}) pero no se pudo actualizar el artículo: ${errUpdArt.message}`,
      pieza_id: pieza.id,
    };
  }

  revalidatePath("/joyeria");
  revalidatePath("/inventario");
  revalidatePath("/empenos");
  redirect(`/joyeria/${pieza.id}?convertido=1`);
}

// -------------------------------------------
// Ajuste manual de stock (para lotes: recepciones, mermas)
// -------------------------------------------

const AjustarStockSchema = z.object({
  id: z.uuid(),
  delta: z.coerce.number().int(),
  motivo: z.string().min(3),
});

export async function ajustarStockPieza(input: unknown) {
  const parsed = AjustarStockSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { data: piezaData, error } = await supabase
    .from("piezas_joyeria")
    .select("tipo_registro, unidades_totales, unidades_disponibles")
    .eq("id", d.id)
    .single();
  if (error || !piezaData) return { error: "Pieza no encontrada" };

  if (piezaData.tipo_registro !== "lote") {
    return { error: "Sólo se puede ajustar stock en piezas registradas como lote." };
  }

  const nuevasDisp = piezaData.unidades_disponibles + d.delta;
  if (nuevasDisp < 0) return { error: "El stock no puede quedar negativo." };

  const nuevasTotales =
    d.delta > 0 && nuevasDisp > piezaData.unidades_totales
      ? nuevasDisp
      : piezaData.unidades_totales;

  const { error: errUpd } = await supabase
    .from("piezas_joyeria")
    .update({
      unidades_disponibles: nuevasDisp,
      unidades_totales: nuevasTotales,
    })
    .eq("id", d.id);
  if (errUpd) return { error: errUpd.message };

  await supabase.from("movimientos_joyeria").insert({
    pieza_id: d.id,
    tipo: "ajuste_unidades",
    datos_antes: {
      unidades_disponibles: piezaData.unidades_disponibles,
      unidades_totales: piezaData.unidades_totales,
    },
    datos_despues: {
      unidades_disponibles: nuevasDisp,
      unidades_totales: nuevasTotales,
    },
    notas: d.motivo,
  });

  revalidatePath(`/joyeria/${d.id}`);
  revalidatePath("/joyeria");
  return { ok: true };
}
