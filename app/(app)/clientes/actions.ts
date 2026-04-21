"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { esCedulaValida, formatearCedula } from "@/lib/validaciones/cedula-do";

const ClienteSchema = z.object({
  cedula: z
    .string()
    .min(11)
    .refine(esCedulaValida, { message: "Cédula dominicana inválida" }),
  nombre_completo: z.string().min(3).max(120),
  telefono: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

export type ClienteFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function crearCliente(
  _prev: ClienteFormState | undefined,
  formData: FormData,
): Promise<ClienteFormState> {
  const raw = {
    cedula: formData.get("cedula")?.toString() ?? "",
    nombre_completo: formData.get("nombre_completo")?.toString() ?? "",
    telefono: formData.get("telefono")?.toString() || null,
    direccion: formData.get("direccion")?.toString() || null,
    notas: formData.get("notas")?.toString() || null,
  };

  const parsed = ClienteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const cedulaFmt = formatearCedula(parsed.data.cedula);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      cedula: cedulaFmt,
      nombre_completo: parsed.data.nombre_completo,
      telefono: parsed.data.telefono,
      direccion: parsed.data.direccion,
      notas: parsed.data.notas,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { cedula: "Ya existe un cliente con esa cédula" } };
    }
    return { error: error.message };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

/**
 * Variante de `crearCliente` para uso inline desde otros formularios
 * (wizard de empeño, flujo de oro). No redirecciona: devuelve el cliente creado
 * para que el caller pueda continuar el flujo.
 */
export async function crearClienteRapido(
  input: {
    cedula: string;
    nombre_completo: string;
    telefono?: string | null;
  },
): Promise<
  | { ok: true; cliente: { id: string; cedula: string; nombre_completo: string; telefono: string | null } }
  | { ok: false; error: string }
> {
  const parsed = ClienteSchema.safeParse({
    cedula: input.cedula,
    nombre_completo: input.nombre_completo,
    telefono: input.telefono ?? null,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Datos inválidos" };
  }

  const cedulaFmt = formatearCedula(parsed.data.cedula);

  const supabase = await createClient();

  // Si ya existe, devolverlo en vez de duplicar.
  const { data: existente } = await supabase
    .from("clientes")
    .select("id, cedula, nombre_completo, telefono")
    .eq("cedula", cedulaFmt)
    .maybeSingle();

  if (existente) {
    return {
      ok: true,
      cliente: existente as {
        id: string;
        cedula: string;
        nombre_completo: string;
        telefono: string | null;
      },
    };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      cedula: cedulaFmt,
      nombre_completo: parsed.data.nombre_completo,
      telefono: parsed.data.telefono,
    })
    .select("id, cedula, nombre_completo, telefono")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/clientes");
  return {
    ok: true,
    cliente: data as {
      id: string;
      cedula: string;
      nombre_completo: string;
      telefono: string | null;
    },
  };
}

export async function actualizarCliente(
  id: string,
  formData: FormData,
): Promise<ClienteFormState> {
  const raw = {
    cedula: formData.get("cedula")?.toString() ?? "",
    nombre_completo: formData.get("nombre_completo")?.toString() ?? "",
    telefono: formData.get("telefono")?.toString() || null,
    direccion: formData.get("direccion")?.toString() || null,
    notas: formData.get("notas")?.toString() || null,
  };

  const parsed = ClienteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join("."), i.message]),
      ),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({
      cedula: formatearCedula(parsed.data.cedula),
      nombre_completo: parsed.data.nombre_completo,
      telefono: parsed.data.telefono,
      direccion: parsed.data.direccion,
      notas: parsed.data.notas,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return {};
}
