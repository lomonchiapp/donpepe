"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { obtenerAppUserId } from "@/lib/supabase/current-user";
import { crearPagoConRecibo } from "@/lib/pagos/crear";
import type { Articulo, ReciboItem } from "@/lib/supabase/types";

const VentaSchema = z.object({
  articulo_id: z.uuid(),
  comprador_nombre: z.string().optional().nullable(),
  comprador_cedula: z.string().optional().nullable(),
  comprador_telefono: z.string().optional().nullable(),
  precio_venta: z.coerce.number().positive(),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta"]).default("efectivo"),
  notas: z.string().optional().nullable(),
});

export async function registrarVenta(formData: FormData) {
  const parsed = VentaSchema.safeParse({
    articulo_id: formData.get("articulo_id")?.toString() ?? "",
    comprador_nombre: formData.get("comprador_nombre")?.toString() || null,
    comprador_cedula: formData.get("comprador_cedula")?.toString() || null,
    comprador_telefono: formData.get("comprador_telefono")?.toString() || null,
    precio_venta: formData.get("precio_venta")?.toString() ?? "",
    metodo: formData.get("metodo")?.toString() || undefined,
    notas: formData.get("notas")?.toString() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // Traemos el artículo para redactar el concepto del recibo.
  const { data: articuloData } = await supabase
    .from("articulos")
    .select("*")
    .eq("id", d.articulo_id)
    .single();
  const articulo = articuloData as Articulo | null;
  if (!articulo) return { error: "Artículo no encontrado" };

  const { data: codigoData } = await supabase.rpc("generar_codigo_venta");
  const codigo = (codigoData as unknown as string) ?? `VT-${Date.now()}`;

  const { data: ventaData, error } = await supabase
    .from("ventas")
    .insert({
      codigo,
      articulo_id: d.articulo_id,
      comprador_nombre: d.comprador_nombre,
      comprador_cedula: d.comprador_cedula,
      comprador_telefono: d.comprador_telefono,
      precio_venta: d.precio_venta,
      metodo: d.metodo,
      notas: d.notas,
    })
    .select("id")
    .single();

  if (error || !ventaData) return { error: error?.message ?? "No se pudo registrar la venta" };
  const venta = ventaData as { id: string };

  await supabase
    .from("articulos")
    .update({ estado: "vendido" })
    .eq("id", d.articulo_id);

  const concepto = `Venta ${codigo} — ${articulo.descripcion}`;
  const items: ReciboItem[] = [
    {
      descripcion: articulo.descripcion,
      cantidad: 1,
      monto: d.precio_venta,
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
      cedula: d.comprador_cedula,
      telefono: d.comprador_telefono,
    },
    tipo_recibo: "venta_compraventa",
    concepto_recibo: concepto,
    items,
    app_user_id: appUserId,
  });

  if (!resultado.ok) {
    // La venta ya se registró; no revertimos (el artículo pasó a "vendido").
    // El operador puede reconstruir el recibo manualmente desde /ventas.
    return {
      error: `Venta registrada pero falló el recibo: ${resultado.error}`,
    };
  }

  revalidatePath("/inventario");
  revalidatePath("/ventas");
  revalidatePath("/recibos");
  revalidatePath("/pagos");
  revalidatePath("/");
  redirect("/ventas?exito=1");
}
