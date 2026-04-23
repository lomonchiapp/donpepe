import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { normalizarSpotADop, obtenerSpotMetales } from "@/lib/metales/spot";

/**
 * Cron diario que refresca `spot_metales_diario`.
 *
 * Configurado en `vercel.json` — se ejecuta una vez al día.
 * Autenticado con `CRON_SECRET` (header `Authorization: Bearer …`
 * o querystring `?secret=`). Vercel Cron añade el header por nosotros.
 *
 * Es idempotente: hace upsert por `fecha` (PK). Si se corre dos veces
 * el mismo día, simplemente actualiza los precios.
 *
 * Esta información es REFERENCIAL — los precios locales de compra
 * siguen controlados manualmente por el dueño en `precios_oro`.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("secret");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw;
  try {
    raw = await obtenerSpotMetales({});
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const spot = normalizarSpotADop(raw);

  const supabase = createServiceClient();
  const fechaHoy = new Date().toISOString().slice(0, 10);

  const payload = {
    fecha: fechaHoy,
    oro_24k_dop_gramo: spot.dop_gramo.XAU,
    plata_dop_gramo: spot.dop_gramo.XAG,
    platino_dop_gramo: spot.dop_gramo.XPT,
    paladio_dop_gramo: spot.dop_gramo.XPD,
    oro_usd_oz: spot.usd_oz.XAU,
    plata_usd_oz: spot.usd_oz.XAG,
    platino_usd_oz: spot.usd_oz.XPT,
    paladio_usd_oz: spot.usd_oz.XPD,
    usd_dop: spot.usd_dop,
    fuente: "metalpriceapi",
    actualizado_at: new Date().toISOString(),
    notas: spot.fecha !== fechaHoy ? `API reportó ${spot.fecha}` : null,
  };

  const { error } = await supabase
    .from("spot_metales_diario")
    .upsert(payload, { onConflict: "fecha" });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, intento: payload },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    fecha: fechaHoy,
    precios: spot.dop_gramo,
    usd_dop: spot.usd_dop,
  });
}
