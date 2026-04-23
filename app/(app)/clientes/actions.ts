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
  // Campos opcionales para el libro de compraventa (migración 009)
  edad: z
    .union([z.coerce.number().int().min(0).max(120), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
  color: z.string().max(60).optional().nullable(),
  nacionalidad: z.string().max(60).optional().nullable(),
  estado_civil: z.string().max(40).optional().nullable(),
  oficio_profesion: z.string().max(120).optional().nullable(),
});

/** Extrae los campos del libro de compraventa desde un FormData. */
function camposLibroDesdeFormData(formData: FormData) {
  return {
    edad: formData.get("edad")?.toString() || "",
    color: formData.get("color")?.toString() || null,
    nacionalidad: formData.get("nacionalidad")?.toString() || null,
    estado_civil: formData.get("estado_civil")?.toString() || null,
    oficio_profesion: formData.get("oficio_profesion")?.toString() || null,
  };
}

export type ClienteFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** true cuando la action terminó exitosamente (solo edición). */
  ok?: boolean;
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
    ...camposLibroDesdeFormData(formData),
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
      edad: parsed.data.edad,
      color: parsed.data.color,
      nacionalidad: parsed.data.nacionalidad,
      estado_civil: parsed.data.estado_civil,
      oficio_profesion: parsed.data.oficio_profesion,
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

/**
 * Elimina un cliente del sistema.
 *
 * Reglas de negocio — FK en `supabase/migrations/001_schema.sql`:
 *   - `prestamos.cliente_id` → `on delete restrict`: si tiene empeños
 *     (activos o históricos) hay que borrarlos/transferirlos primero.
 *   - `compras_oro.cliente_id` → `on delete restrict`: si tiene compras
 *     de oro se bloquea por integridad del historial comercial.
 *   - `articulos.cliente_id`, `pagos.cliente_id`, `recibos.cliente_id`,
 *     `facturas.cliente_id` → `on delete set null`: pierden la
 *     referencia pero el registro sobrevive. Esto es intencional para
 *     no romper historial fiscal/operativo huérfano.
 *
 * RLS: `clientes` usa `es_staff()` para todas las operaciones, así que
 * cualquier usuario autenticado de la app puede borrar — no hace falta
 * ser `dueno` como con recibos/facturas.
 */
const EliminarClienteSchema = z.object({
  cliente_id: z.uuid(),
});

export async function eliminarCliente(input: { cliente_id: string }) {
  const parsed = EliminarClienteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { cliente_id } = parsed.data;

  const supabase = await createClient();

  // 1. Confirmar que el cliente existe (también para mostrar el nombre
  //    en el toast de éxito si hiciera falta).
  const { data: clienteData, error: errCli } = await supabase
    .from("clientes")
    .select("id, nombre_completo")
    .eq("id", cliente_id)
    .maybeSingle();

  if (errCli) return { error: errCli.message };
  if (!clienteData) return { error: "Cliente no encontrado" };

  // 2. Bloquear si tiene préstamos — FK `on delete restrict`.
  const { count: prestamosCount, error: errPrest } = await supabase
    .from("prestamos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", cliente_id);
  if (errPrest) return { error: errPrest.message };
  if ((prestamosCount ?? 0) > 0) {
    return {
      error: `Este cliente tiene ${prestamosCount} empeño${prestamosCount === 1 ? "" : "s"} registrado${prestamosCount === 1 ? "" : "s"}. Elimínalos desde /empenos antes de borrar el cliente.`,
    };
  }

  // 3. Bloquear si tiene compras de oro — FK `on delete restrict`.
  const { count: comprasCount, error: errCompras } = await supabase
    .from("compras_oro")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", cliente_id);
  if (errCompras) return { error: errCompras.message };
  if ((comprasCount ?? 0) > 0) {
    return {
      error: `Este cliente tiene ${comprasCount} compra${comprasCount === 1 ? "" : "s"} de oro registrada${comprasCount === 1 ? "" : "s"}. No se puede eliminar: forma parte del historial comercial.`,
    };
  }

  // 4. Eliminar. Artículos/pagos/recibos/facturas se desvinculan por FK
  //    (`on delete set null`) — no hay que tocarlos manualmente.
  const { error: errDel } = await supabase
    .from("clientes")
    .delete()
    .eq("id", cliente_id);

  if (errDel) {
    return { error: `No se pudo eliminar el cliente: ${errDel.message}` };
  }

  revalidatePath("/clientes");
  revalidatePath("/");

  redirect("/clientes");
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
    ...camposLibroDesdeFormData(formData),
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
      edad: parsed.data.edad,
      color: parsed.data.color,
      nacionalidad: parsed.data.nacionalidad,
      estado_civil: parsed.data.estado_civil,
      oficio_profesion: parsed.data.oficio_profesion,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Wrapper con firma `useActionState` para editar un cliente desde un
 * formulario cliente (lee el id de un campo oculto `__id`).
 */
export async function actualizarClienteAction(
  _prev: ClienteFormState | undefined,
  formData: FormData,
): Promise<ClienteFormState> {
  const id = formData.get("__id")?.toString();
  if (!id) return { error: "Falta el ID del cliente" };
  return actualizarCliente(id, formData);
}
