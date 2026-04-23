"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Server actions del panel de numeraciones (series internas).
 *
 * **Qué SE puede editar:** etiqueta, prefijo, ancho de secuencia, formato,
 * reset anual, estado (activa/inactiva), descripción.
 *
 * **Qué NO se puede editar desde la UI:**
 *   - `contador` y `año_actual` — los gestiona `siguiente_numero()` en
 *     Postgres bajo `SELECT FOR UPDATE`. Si un humano los toca a mano
 *     puede romper la secuencia (huecos, duplicados, choques con PKs).
 *     Si hay que corregir un desfase real, se hace por SQL con un
 *     comentario explicando el motivo.
 *   - `scope` — es parte del contrato con los triggers SQL
 *     (`generar_codigo_prestamo` llama `siguiente_numero('empeno')`).
 *     Renombrarlo rompería la generación de códigos.
 *
 * Solo el dueño puede llamar estas acciones (RLS lo obliga, además).
 */

/**
 * Placeholders válidos en el formato. Si el formato no contiene
 * `{numero}` o `{NNNNN}` el código generado no incluiría la secuencia —
 * eso sería un error grave (todos los documentos quedarían con el
 * mismo código). Rechazamos el input.
 */
const PLACEHOLDER_NUMERO = /\{numero\}|\{NNNNN\}/;

const EditarSerieSchema = z.object({
  id: z.uuid(),
  etiqueta: z.string().trim().min(2).max(60),
  prefijo: z
    .string()
    .trim()
    .max(10)
    .regex(/^[A-Z0-9-]*$/, "Prefijo solo acepta A-Z, 0-9 y guiones"),
  ancho_secuencia: z.coerce.number().int().min(3).max(10),
  formato: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .refine(
      (f) => PLACEHOLDER_NUMERO.test(f),
      "El formato debe incluir {numero} o {NNNNN}",
    ),
  reset_anual: z.boolean(),
  activa: z.boolean(),
  descripcion: z.string().trim().max(200).optional().nullable(),
});

export async function actualizarSerieNumeracion(input: unknown) {
  const parsed = EditarSerieSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
        .join(", "),
    };
  }
  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("numeracion_series")
    .update({
      etiqueta: d.etiqueta,
      prefijo: d.prefijo,
      ancho_secuencia: d.ancho_secuencia,
      formato: d.formato,
      reset_anual: d.reset_anual,
      activa: d.activa,
      descripcion: d.descripcion ?? null,
    })
    .eq("id", d.id);

  if (error) return { error: error.message };

  revalidatePath("/config/numeraciones");
  return { ok: true };
}

/**
 * Marca como `vencido` todos los rangos NCF cuya `fecha_vencimiento` ya
 * pasó. Se expone como botón para que el dueño pueda disparar la
 * limpieza manualmente; el cron diario también la corre.
 */
export async function marcarRangosVencidos() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marcar_rangos_ncf_vencidos");
  if (error) return { error: error.message };

  revalidatePath("/config/ncf");
  revalidatePath("/config/numeraciones");
  return { ok: true, count: Number(data ?? 0) };
}
