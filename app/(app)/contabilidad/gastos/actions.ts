"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAcceso, getAppUser } from "@/lib/permisos/check";
import type {
  FormaPagoDgii,
  GastoOperativo,
  TipoGastoDgii,
} from "@/lib/supabase/types";

const TIPO_GASTO = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
] as const;

const FORMA_PAGO = ["01", "02", "03", "04", "05", "06", "07"] as const;

const GastoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  concepto: z.string().trim().min(2, "Concepto muy corto"),
  monto: z.coerce.number().positive(),
  categoria: z.enum(TIPO_GASTO),
  rnc_proveedor: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s === "" || s.length === 9 || s.length === 11, {
      message: "RNC (9) o Cédula (11)",
    })
    .optional()
    .nullable(),
  nombre_proveedor: z.string().trim().max(200).optional().nullable(),
  tipo_id_proveedor: z.enum(["1", "2"]).optional().nullable(),
  ncf: z.string().trim().max(19).optional().nullable(),
  ncf_modificado: z.string().trim().max(19).optional().nullable(),
  itbis_facturado: z.coerce.number().min(0).default(0),
  itbis_retenido: z.coerce.number().min(0).default(0),
  forma_pago: z.enum(FORMA_PAGO),
  notas: z.string().trim().max(500).optional().nullable(),
});

function parseForm(formData: FormData) {
  const raw = {
    fecha: formData.get("fecha")?.toString() ?? "",
    concepto: formData.get("concepto")?.toString() ?? "",
    monto: formData.get("monto")?.toString() ?? "",
    categoria: formData.get("categoria")?.toString() ?? "02",
    rnc_proveedor: formData.get("rnc_proveedor")?.toString() || null,
    nombre_proveedor: formData.get("nombre_proveedor")?.toString() || null,
    tipo_id_proveedor: formData.get("tipo_id_proveedor")?.toString() || null,
    ncf: formData.get("ncf")?.toString() || null,
    ncf_modificado: formData.get("ncf_modificado")?.toString() || null,
    itbis_facturado: formData.get("itbis_facturado")?.toString() ?? "0",
    itbis_retenido: formData.get("itbis_retenido")?.toString() ?? "0",
    forma_pago: formData.get("forma_pago")?.toString() ?? "01",
    notas: formData.get("notas")?.toString() || null,
  };
  return GastoSchema.safeParse(raw);
}

export async function crearGasto(formData: FormData) {
  await requireAcceso("contabilidad");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;
  const me = await getAppUser();

  const supabase = await createClient();
  const { error } = await supabase.from("gastos_operativos").insert({
    fecha: d.fecha,
    concepto: d.concepto,
    monto: d.monto,
    categoria: d.categoria as TipoGastoDgii,
    rnc_proveedor: d.rnc_proveedor ? d.rnc_proveedor : null,
    nombre_proveedor: d.nombre_proveedor ?? null,
    tipo_id_proveedor:
      d.tipo_id_proveedor ??
      (d.rnc_proveedor
        ? d.rnc_proveedor.length === 11
          ? "2"
          : "1"
        : null),
    ncf: d.ncf ?? null,
    ncf_modificado: d.ncf_modificado ?? null,
    itbis_facturado: d.itbis_facturado,
    itbis_retenido: d.itbis_retenido,
    forma_pago: d.forma_pago as FormaPagoDgii,
    notas: d.notas ?? null,
    registrado_por: me?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/gastos");
  revalidatePath("/contabilidad/libro-compraventa");
  revalidatePath("/contabilidad/606");
  return { ok: true };
}

export async function eliminarGasto(id: string) {
  await requireAcceso("contabilidad");
  const supabase = await createClient();
  const { error } = await supabase.from("gastos_operativos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contabilidad/gastos");
  revalidatePath("/contabilidad/libro-compraventa");
  revalidatePath("/contabilidad/606");
  return { ok: true };
}

export async function listarGastos(input: {
  desde?: string;
  hasta?: string;
  categoria?: TipoGastoDgii;
}): Promise<GastoOperativo[]> {
  await requireAcceso("contabilidad");
  const supabase = await createClient();
  let q = supabase.from("gastos_operativos").select("*");
  if (input.desde) q = q.gte("fecha", input.desde);
  if (input.hasta) q = q.lte("fecha", input.hasta);
  if (input.categoria) q = q.eq("categoria", input.categoria);
  q = q.order("fecha", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[listarGastos]", error);
    return [];
  }
  return (data as GastoOperativo[] | null) ?? [];
}
