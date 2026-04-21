import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { enviarPlantilla } from "@/lib/whatsapp/send";
import { TEMPLATES } from "@/lib/whatsapp/templates";
import { formatearDOP } from "@/lib/format";
import type { AppUser, ConfigNegocio, Prestamo } from "@/lib/supabase/types";

/**
 * Cron diario (configurado en vercel.json) que:
 * 1. Mueve empeños vencidos a "vencido_a_cobro".
 * 2. Mueve empeños con fecha_vencimiento + días_gracia vencida a "propiedad_casa".
 * 3. Envía WhatsApp al dueño con resumen de vencimientos del día y de la semana.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("secret");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const hoy = new Date();
  const hoyStr = hoy.toISOString().slice(0, 10);

  // Cargar config
  const configRes = await supabase.from("config_negocio").select("*").limit(1).maybeSingle();
  const config = (configRes.data as ConfigNegocio | null) ?? null;
  const diasGracia = config?.dias_gracia_vencimiento ?? 7;

  const fechaCorte = new Date(hoy);
  fechaCorte.setDate(fechaCorte.getDate() - diasGracia);
  const fechaCorteStr = fechaCorte.toISOString().slice(0, 10);

  const en7 = new Date(hoy);
  en7.setDate(en7.getDate() + 7);
  const en7Str = en7.toISOString().slice(0, 10);

  // 1. Marcar como vencido_a_cobro
  const { data: activosVencidos } = await supabase
    .from("prestamos")
    .select("id")
    .eq("estado", "activo")
    .lt("fecha_vencimiento", hoyStr);

  const idsAVencer = ((activosVencidos ?? []) as { id: string }[]).map((p) => p.id);
  if (idsAVencer.length > 0) {
    await supabase
      .from("prestamos")
      .update({ estado: "vencido_a_cobro" })
      .in("id", idsAVencer);
  }

  // 2. Marcar como propiedad_casa los que pasaron el periodo de gracia
  const { data: vencidosAntiguos } = await supabase
    .from("prestamos")
    .select("id, articulo_id")
    .eq("estado", "vencido_a_cobro")
    .lt("fecha_vencimiento", fechaCorteStr);

  const aPropiedad = (vencidosAntiguos ?? []) as Array<{ id: string; articulo_id: string }>;
  if (aPropiedad.length > 0) {
    const idsPrest = aPropiedad.map((p) => p.id);
    const idsArt = aPropiedad.map((p) => p.articulo_id);
    await supabase.from("prestamos").update({ estado: "propiedad_casa" }).in("id", idsPrest);
    await supabase.from("articulos").update({ estado: "vencido_propio" }).in("id", idsArt);
  }

  // 3. Compilar resumen
  const [hoyRes, semanaRes] = await Promise.all([
    supabase
      .from("prestamos")
      .select("monto_prestado")
      .eq("estado", "activo")
      .eq("fecha_vencimiento", hoyStr),
    supabase
      .from("prestamos")
      .select("monto_prestado")
      .eq("estado", "activo")
      .gte("fecha_vencimiento", hoyStr)
      .lte("fecha_vencimiento", en7Str),
  ]);

  const vencenHoy = ((hoyRes.data ?? []) as Pick<Prestamo, "monto_prestado">[]);
  const vencenSemana = ((semanaRes.data ?? []) as Pick<Prestamo, "monto_prestado">[]);

  const totalHoy = vencenHoy.reduce((s, p) => s + Number(p.monto_prestado), 0);

  // 4. Notificar a los dueños con recibir_alertas = true
  const { data: duenosData } = await supabase
    .from("app_users")
    .select("*")
    .eq("activo", true)
    .eq("recibir_alertas", true)
    .not("telefono_whatsapp", "is", null);

  const duenos = (duenosData ?? []) as AppUser[];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://don-pepe.app";

  const resultados: Array<{ destinatario: string; ok: boolean; error?: string }> = [];

  for (const dueno of duenos) {
    if (!dueno.telefono_whatsapp) continue;

    const res = await enviarPlantilla({
      telefono: dueno.telefono_whatsapp,
      plantilla: TEMPLATES.RESUMEN_DIARIO,
      parametros: [
        String(vencenHoy.length),
        formatearDOP(totalHoy),
        String(vencenSemana.length),
        appUrl,
      ],
    });

    await supabase.from("notificaciones").insert({
      destinatario_user_id: dueno.id,
      tipo: "resumen_diario",
      contenido: {
        vencen_hoy: vencenHoy.length,
        total_hoy: totalHoy,
        vencen_semana: vencenSemana.length,
      },
      status: res.ok ? "enviada" : "fallida",
      enviada_at: res.ok ? new Date().toISOString() : null,
      meta_message_id: res.message_id ?? null,
      error: res.error ?? null,
    });

    resultados.push({
      destinatario: dueno.email,
      ok: res.ok,
      error: res.error,
    });
  }

  return NextResponse.json({
    ok: true,
    procesados: {
      a_vencido: idsAVencer.length,
      a_propiedad: aPropiedad.length,
    },
    resumen: {
      vencen_hoy: vencenHoy.length,
      total_hoy: totalHoy,
      vencen_semana: vencenSemana.length,
    },
    notificaciones: resultados,
  });
}
