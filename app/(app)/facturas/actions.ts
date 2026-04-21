"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { obtenerAppUserId } from "@/lib/supabase/current-user";
import {
  desglosarItem,
  totalizarFactura,
  type DesgloseItem,
} from "@/lib/calc/itbis";
import { fechaLocalRD } from "@/lib/format";
import type {
  ConfigNegocio,
  EstadoFactura,
  Recibo,
} from "@/lib/supabase/types";

const TIPO_COMPROBANTE = z.enum([
  "factura_credito_fiscal",
  "factura_consumo",
  "nota_debito",
  "nota_credito",
  "compra",
  "regimen_especial",
  "gubernamental",
]);

const ItemSchema = z.object({
  descripcion: z.string().min(1).max(200),
  cantidad: z.coerce.number().positive(),
  precio_unitario_bruto: z.coerce.number().positive(),
  descuento_unitario: z.coerce.number().min(0).default(0),
  itbis_aplica: z.boolean().default(true),
  itbis_tasa: z.coerce.number().min(0).max(100).default(18),
  codigo: z.string().optional().nullable(),
  unidad: z.string().optional().nullable(),
});

const EmitirFacturaSchema = z
  .object({
    recibo_id: z.uuid().optional().nullable(),
    tipo_comprobante: TIPO_COMPROBANTE,
    rnc_receptor: z.string().optional().nullable(),
    cedula_receptor: z.string().optional().nullable(),
    nombre_receptor: z.string().min(2).max(200),
    direccion_receptor: z.string().optional().nullable(),
    email_receptor: z.union([z.email(), z.literal("")]).optional().nullable(),
    telefono_receptor: z.string().optional().nullable(),
    cliente_id: z.uuid().optional().nullable(),
    notas: z.string().optional().nullable(),
    items: z.array(ItemSchema).min(1),
  })
  .refine(
    (d) =>
      d.tipo_comprobante !== "factura_credito_fiscal" ||
      (d.rnc_receptor && d.rnc_receptor.length >= 9),
    {
      message: "RNC requerido para factura de crédito fiscal",
      path: ["rnc_receptor"],
    },
  );

export async function emitirFactura(input: unknown) {
  const parsed = EmitirFacturaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", "),
    };
  }
  const d = parsed.data;
  const supabase = await createClient();

  // 1. Config negocio (datos del emisor)
  const { data: cfgData } = await supabase
    .from("config_negocio")
    .select("*")
    .limit(1)
    .maybeSingle();
  const config = cfgData as ConfigNegocio | null;

  // 2. Si viene recibo_id, validar que no esté ya facturado (salvo anulada)
  let recibo: Recibo | null = null;
  if (d.recibo_id) {
    const { data: rcb } = await supabase
      .from("recibos")
      .select("*")
      .eq("id", d.recibo_id)
      .maybeSingle();
    recibo = rcb as Recibo | null;
    if (!recibo) return { error: "Recibo no encontrado" };
    if (recibo.anulado_at) {
      return { error: "No se puede facturar un recibo anulado" };
    }
    // Si ya tiene factura, solo permitir reemitir si la anterior está anulada
    if (recibo.factura_id) {
      const { data: facExist } = await supabase
        .from("facturas")
        .select("estado")
        .eq("id", recibo.factura_id)
        .maybeSingle();
      const estado = (facExist as { estado: EstadoFactura } | null)?.estado;
      if (estado && estado !== "anulada") {
        return { error: "El recibo ya tiene factura emitida" };
      }
    }
  }

  // 3. Desglosar items y totalizar
  let desgloses: DesgloseItem[];
  try {
    desgloses = d.items.map((it) =>
      desglosarItem({
        precio_unitario_bruto: it.precio_unitario_bruto,
        cantidad: it.cantidad,
        itbis_aplica: it.itbis_aplica,
        itbis_tasa: it.itbis_tasa,
        descuento_unitario: it.descuento_unitario,
      }),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al desglosar items" };
  }

  const totales = totalizarFactura(desgloses);

  const appUserId = await obtenerAppUserId();

  // 4. Insertar factura en estado borrador
  const { data: facData, error: errFac } = await supabase
    .from("facturas")
    .insert({
      tipo_comprobante: d.tipo_comprobante,
      estado: "borrador" as EstadoFactura,
      rnc_emisor: config?.rnc ?? null,
      razon_social_emisor: config?.razon_social ?? config?.nombre_comercial ?? null,
      direccion_emisor: config?.direccion_fiscal ?? config?.direccion ?? null,
      cliente_id: d.cliente_id ?? null,
      rnc_receptor: d.rnc_receptor ?? null,
      cedula_receptor: d.cedula_receptor ?? null,
      nombre_receptor: d.nombre_receptor,
      direccion_receptor: d.direccion_receptor ?? null,
      email_receptor: d.email_receptor ?? null,
      telefono_receptor: d.telefono_receptor ?? null,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      base_itbis: totales.base_itbis,
      base_exenta: totales.base_exenta,
      itbis_monto: totales.itbis_monto,
      total: totales.total,
      pago_id: recibo?.pago_id ?? null,
      notas: d.notas ?? null,
      emitida_por: appUserId,
    })
    .select("id, codigo_interno")
    .single();

  if (errFac || !facData) {
    return { error: errFac?.message ?? "No se pudo crear la factura" };
  }
  const factura = facData as { id: string; codigo_interno: string };

  // 5. Insertar items
  const itemsRows = d.items.map((it, i) => {
    const g = desgloses[i];
    return {
      factura_id: factura.id,
      orden: i + 1,
      codigo: it.codigo ?? null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidad: it.unidad ?? null,
      precio_unitario: g.precio_unitario,
      precio_unitario_bruto: it.precio_unitario_bruto,
      descuento_unitario: it.descuento_unitario,
      itbis_aplica: g.itbis_aplica,
      itbis_tasa: g.itbis_tasa,
      subtotal: g.subtotal,
      itbis_monto: g.itbis_monto,
      total: g.total,
    };
  });
  const { error: errItems } = await supabase
    .from("factura_items")
    .insert(itemsRows);

  if (errItems) {
    // Rollback best-effort
    await supabase.from("facturas").delete().eq("id", factura.id);
    return { error: `No se pudieron insertar items: ${errItems.message}` };
  }

  // 6. Obtener NCF del rango activo (for update skip locked en Postgres)
  const { data: ncfData, error: errNcf } = await supabase.rpc(
    "obtener_proximo_ncf",
    { p_tipo: d.tipo_comprobante },
  );
  if (errNcf || !ncfData) {
    // Factura queda en borrador; staff puede reintentar o cargar rango.
    return {
      error: errNcf?.message ?? "No hay rango NCF activo para este tipo",
      factura_id: factura.id,
      estado: "borrador" as EstadoFactura,
    };
  }
  const ncf = ncfData as unknown as string;

  // 7. Marcar como emitida + asignar NCF
  //    fecha_emision es columna `date` → usar fecha local RD (UTC-4) para
  //    que facturas emitidas después de 8 PM RD no salten al día siguiente UTC.
  const ahora = new Date();
  const { error: errUpd } = await supabase
    .from("facturas")
    .update({
      estado: "emitida" as EstadoFactura,
      ncf,
      fecha_emision: fechaLocalRD(ahora),
      emitida_at: ahora.toISOString(),
    })
    .eq("id", factura.id);
  if (errUpd) {
    return { error: `Factura sin NCF: ${errUpd.message}`, factura_id: factura.id };
  }

  // 8. Ligar recibo
  if (recibo) {
    await supabase
      .from("recibos")
      .update({ factura_id: factura.id })
      .eq("id", recibo.id);
  }

  revalidatePath("/facturas");
  revalidatePath("/recibos");
  if (recibo) revalidatePath(`/recibos/${recibo.id}`);
  revalidatePath("/");
  redirect(`/facturas/${factura.id}?emitida=1`);
}

const AnularFacturaSchema = z.object({
  factura_id: z.uuid(),
  motivo: z.string().min(3).max(500),
});

export async function anularFactura(input: unknown) {
  const parsed = AnularFacturaSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { factura_id, motivo } = parsed.data;
  const supabase = await createClient();

  // Buscar recibo asociado antes de anular para poder revalidarlo
  const { data: reciboData } = await supabase
    .from("recibos")
    .select("id")
    .eq("factura_id", factura_id)
    .maybeSingle();
  const reciboId = (reciboData as { id: string } | null)?.id ?? null;

  const { error } = await supabase
    .from("facturas")
    .update({
      estado: "anulada" as EstadoFactura,
      anulada_at: new Date().toISOString(),
      anulada_motivo: motivo,
    })
    .eq("id", factura_id);

  if (error) return { error: error.message };

  revalidatePath(`/facturas/${factura_id}`);
  revalidatePath("/facturas");
  revalidatePath("/recibos");
  if (reciboId) revalidatePath(`/recibos/${reciboId}`);
  return { ok: true };
}
