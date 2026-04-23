/**
 * Wrapper sobre MetalpriceAPI (https://metalpriceapi.com).
 *
 * Devuelve precios spot de metales preciosos convertidos a
 * DOP/gramo. El plan gratuito da ~100 requests/mes, suficiente
 * para consultarlo una vez al día vía cron y cachear en
 * `spot_metales_diario`.
 *
 * MetalpriceAPI devuelve tasas en la forma: 1 USD = X onza,
 * es decir que `rates.XAU` es cuánto oro compras con 1 USD.
 * Para convertir a USD/oz se hace 1 / rates.XAU.
 *
 * Una onza troy = 31.1034768 gramos.
 */
const GRAMS_PER_TROY_OZ = 31.1034768;
const API_BASE = "https://api.metalpriceapi.com/v1";

export type MetalSimbolo = "XAU" | "XAG" | "XPT" | "XPD";

export interface SpotPreciosRaw {
  /** Mapa simbolo → USD/oz */
  usd_oz: Record<MetalSimbolo, number | null>;
  /** USD→DOP según MetalpriceAPI (si viene). */
  usd_dop: number | null;
  /** Fecha que reportó la API (ISO date). */
  fecha: string;
  /** Respuesta cruda para auditoría. */
  raw: Record<string, unknown>;
}

export interface SpotPreciosDop {
  /** DOP por gramo, por metal. */
  dop_gramo: Record<MetalSimbolo, number | null>;
  /** USD por onza, por metal. */
  usd_oz: Record<MetalSimbolo, number | null>;
  /** Tasa USD→DOP usada (puede ser de la API o override). */
  usd_dop: number;
  /** Fecha reportada por la API. */
  fecha: string;
  /** Respuesta cruda. */
  raw: Record<string, unknown>;
}

/**
 * Consulta MetalpriceAPI. Devuelve null para los metales que la
 * respuesta no incluyó (p.ej. si el plan gratuito limita).
 */
export async function obtenerSpotMetales(options: {
  /** API key. Lee `METALPRICE_API_KEY` si no se pasa. */
  apiKey?: string;
  /** Override opcional del USD→DOP (si no se provee, se pide a la API). */
  usdDopOverride?: number;
}): Promise<SpotPreciosRaw> {
  const apiKey = options.apiKey ?? process.env.METALPRICE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta METALPRICE_API_KEY (agregar en Vercel → Settings → Env)",
    );
  }

  // Pedimos los 4 metales + DOP en la misma llamada.
  const simbolos: MetalSimbolo[] = ["XAU", "XAG", "XPT", "XPD"];
  const currencies = [...simbolos, "DOP"].join(",");
  const url = `${API_BASE}/latest?api_key=${encodeURIComponent(
    apiKey,
  )}&base=USD&currencies=${currencies}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // No cache — siempre pedimos fresco en el cron.
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MetalpriceAPI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    success?: boolean;
    base?: string;
    rates?: Record<string, number>;
    timestamp?: number;
    date?: string;
    error?: { code?: number; message?: string };
  };

  if (body.success === false || !body.rates) {
    throw new Error(
      `MetalpriceAPI error: ${body.error?.message ?? "respuesta inválida"}`,
    );
  }

  const rates = body.rates;

  const usdOz: Record<MetalSimbolo, number | null> = {
    XAU: null,
    XAG: null,
    XPT: null,
    XPD: null,
  };
  for (const sym of simbolos) {
    const r = rates[sym];
    if (typeof r === "number" && r > 0) {
      usdOz[sym] = 1 / r; // rates.XAU = onzas por USD ⇒ USD/oz = 1/rate
    }
  }

  const usdDop =
    options.usdDopOverride ??
    (typeof rates.DOP === "number" && rates.DOP > 0 ? rates.DOP : null);

  const fecha = body.date ?? new Date().toISOString().slice(0, 10);

  return {
    usd_oz: usdOz,
    usd_dop: usdDop,
    fecha,
    raw: body as unknown as Record<string, unknown>,
  };
}

/**
 * Convierte USD/oz → DOP/gramo.
 *
 *   DOP/g = (USD/oz) × (USD→DOP) / 31.1034768
 */
export function usdOzADopGramo(
  usdOz: number | null,
  usdDop: number,
): number | null {
  if (usdOz == null || usdOz <= 0) return null;
  if (!usdDop || usdDop <= 0) return null;
  return (usdOz * usdDop) / GRAMS_PER_TROY_OZ;
}

export function normalizarSpotADop(
  raw: SpotPreciosRaw,
  usdDopFallback = 60,
): SpotPreciosDop {
  const usdDop = raw.usd_dop ?? usdDopFallback;

  const dopGramo: Record<MetalSimbolo, number | null> = {
    XAU: usdOzADopGramo(raw.usd_oz.XAU, usdDop),
    XAG: usdOzADopGramo(raw.usd_oz.XAG, usdDop),
    XPT: usdOzADopGramo(raw.usd_oz.XPT, usdDop),
    XPD: usdOzADopGramo(raw.usd_oz.XPD, usdDop),
  };

  return {
    dop_gramo: dopGramo,
    usd_oz: raw.usd_oz,
    usd_dop: usdDop,
    fecha: raw.fecha,
    raw: raw.raw,
  };
}
