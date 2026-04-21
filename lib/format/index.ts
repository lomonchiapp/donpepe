/**
 * Formateadores para UI dominicana (DOP, fechas, plurales).
 */

const DOP_FORMATTER = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const DOP_FORMATTER_DECIMAL = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatearDOP(valor: number, decimales = false): string {
  return decimales ? DOP_FORMATTER_DECIMAL.format(valor) : DOP_FORMATTER.format(valor);
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-DO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FECHA_RELATIVA = new Intl.RelativeTimeFormat("es-DO", { numeric: "auto" });

export function formatearFechaCorta(d: Date | string): string {
  return FECHA_CORTA.format(new Date(d));
}

export function formatearFechaLarga(d: Date | string): string {
  return FECHA_LARGA.format(new Date(d));
}

export function relativoDias(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  return FECHA_RELATIVA.format(dias, "day");
}

export function saludoDelDia(fecha: Date = new Date()): string {
  const h = fecha.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function formatearTelefono(tel: string): string {
  const clean = tel.replace(/\D/g, "");
  const m = clean.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (!m) return tel;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

export function pluralizar(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/**
 * Devuelve la fecha local de República Dominicana (UTC-4) en formato
 * YYYY-MM-DD. Útil para columnas Postgres `date` donde `toISOString()`
 * daría la fecha UTC y saltaría al día siguiente después de las 8 PM RD.
 */
export function fechaLocalRD(d: Date = new Date()): string {
  // RD está en UTC-4 todo el año (sin horario de verano)
  const offsetMs = -4 * 60 * 60 * 1000;
  const local = new Date(d.getTime() + offsetMs);
  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
