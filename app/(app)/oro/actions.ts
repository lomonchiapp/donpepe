"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { obtenerAppUserId } from "@/lib/supabase/current-user";
import { KILATAJES } from "@/lib/calc/oro";
import { formatearDOP } from "@/lib/format";
import { crearPagoConRecibo } from "@/lib/pagos/crear";
import type { Cliente, ReciboItem } from "@/lib/supabase/types";

const PrecioSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kilataje: z.coerce.number().refine((k) => (KILATAJES as readonly number[]).includes(k), {
    message: "Kilataje inválido",
  }),
  precio_dop_gramo: z.coerce.number().positive(),
  precio_venta_dop_gramo: z.coerce.number().positive().optional().nullable(),
});

export async function guardarPrecioOro(formData: FormData) {
  const parsed = PrecioSchema.safeParse({
    fecha: formData.get("fecha")?.toString() ?? "",
    kilataje: formData.get("kilataje")?.toString() ?? "",
    precio_dop_gramo: formData.get("precio_dop_gramo")?.toString() ?? "",
    precio_venta_dop_gramo: formData.get("precio_venta_dop_gramo")?.toString() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("precios_oro")
    .upsert(
      {
        fecha: d.fecha,
        kilataje: d.kilataje,
        precio_dop_gramo: d.precio_dop_gramo,
        precio_venta_dop_gramo: d.precio_venta_dop_gramo ?? null,
        fuente: "manual",
      },
      { onConflict: "fecha,kilataje" },
    );

  if (error) return { error: error.message };

  revalidatePath("/oro");
  return { ok: true };
}

const CompraOroSchema = z.object({
  cliente_id: z.uuid(),
  kilataje: z.coerce.number().refine((k) => (KILATAJES as readonly number[]).includes(k)),
  peso_gramos: z.coerce.number().positive(),
  precio_gramo: z.coerce.number().positive(),
  total_pagado: z.coerce.number().positive(),
  notas: z.string().optional().nullable(),
});

export async function registrarCompraOro(formData: FormData) {
  const parsed = CompraOroSchema.safeParse({
    cliente_id: formData.get("cliente_id")?.toString() ?? "",
    kilataje: formData.get("kilataje")?.toString() ?? "",
    peso_gramos: formData.get("peso_gramos")?.toString() ?? "",
    precio_gramo: formData.get("precio_gramo")?.toString() ?? "",
    total_pagado: formData.get("total_pagado")?.toString() ?? "",
    notas: formData.get("notas")?.toString() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // Cliente (vendedor del oro) para snapshot en el recibo.
  const { data: clienteData } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", d.cliente_id)
    .single();
  const cliente = clienteData as Cliente | null;
  if (!cliente) return { error: "Cliente no encontrado" };

  const { data: codigoData } = await supabase.rpc("generar_codigo_compra_oro");
  const codigo = (codigoData as unknown as string) ?? `OR-${Date.now()}`;

  const { data, error } = await supabase
    .from("compras_oro")
    .insert({
      codigo,
      cliente_id: d.cliente_id,
      kilataje: d.kilataje,
      peso_gramos: d.peso_gramos,
      precio_gramo: d.precio_gramo,
      total_pagado: d.total_pagado,
      notas: d.notas,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "No se pudo registrar" };
  const compraOro = data as { id: string };

  const concepto = `Compra de oro ${codigo} — ${d.peso_gramos}g ${d.kilataje}K`;
  // Un ítem con monto = total pagado evita que subtotal del recibo difiera del
  // pago cuando el operador negocia el total (peso × precio/g ≠ total).
  const items: ReciboItem[] = [
    {
      descripcion: `Oro ${d.kilataje}K · ${d.peso_gramos} g (${formatearDOP(d.precio_gramo)}/g)`,
      cantidad: 1,
      monto: d.total_pagado,
    },
  ];

  const appUserId = await obtenerAppUserId();

  const resultado = await crearPagoConRecibo({
    supabase,
    compra_oro_id: compraOro.id,
    direccion: "egreso",
    tipo: "compra_oro",
    monto: d.total_pagado,
    metodo: "efectivo",
    concepto,
    notas: d.notas ?? null,
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre_completo,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
    },
    tipo_recibo: "compra_oro",
    concepto_recibo: concepto,
    items,
    app_user_id: appUserId,
  });

  revalidatePath("/oro");
  revalidatePath("/recibos");
  revalidatePath("/pagos");
  revalidatePath("/");
  revalidatePath("/inventario");
  revalidatePath(`/clientes/${d.cliente_id}`);

  // Siempre salimos del formulario: la compra ya está en `compras_oro`. Si el recibo
  // falla, el usuario ve aviso en la ficha del cliente (?recibo_fallido=1).
  if (!resultado.ok) {
    redirect(`/clientes/${d.cliente_id}?compra_oro=ok&recibo_fallido=1`);
  }

  redirect(`/clientes/${d.cliente_id}?compra_oro=ok`);
}
