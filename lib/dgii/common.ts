/**
 * Helpers comunes para generar reportes DGII (606/607/608).
 *
 * Todas las funciones son PURAS — reciben data y devuelven strings.
 * El llamador (server action) es quien hace las queries a Supabase.
 *
 * Spec: https://dgii.gov.do/ — "Formatos de envío" (606/607/608).
 * El formato es un TXT pipe-delimited, un registro por línea, encoding
 * ISO-8859-1 (latin1). Usamos el `|` como separador; la DGII espera
 * exactamente ese carácter.
 */

/** Separador oficial DGII entre campos. */
export const SEP = "|";

/**
 * Convierte una fecha (Date o "YYYY-MM-DD") a el formato DGII `YYYYMMDD`.
 * Devuelve string vacío si la fecha es null/undefined.
 */
export function fechaDGII(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseYMD(d) : d;
  if (!date || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

/**
 * Parsea "YYYY-MM-DD" como fecha LOCAL (no UTC) — igual que
 * `lib/calc/intereses.ts`. RD = UTC-4, no queremos saltar días.
 */
function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Formatea un monto numérico con 2 decimales, punto como separador.
 * La DGII acepta el formato "1234.56" sin separador de miles.
 */
export function montoDGII(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "0.00";
  const num = typeof n === "string" ? Number(n) : n;
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

/**
 * Limpia RNC/cédula: deja solo dígitos. La DGII quiere los números
 * sin guiones ni espacios.
 */
export function limpiarRncCedula(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\D/g, "");
}

/**
 * Determina el tipo de identificación DGII a partir de la longitud:
 *   - 9 dígitos → RNC ("1")
 *   - 11 dígitos → Cédula ("2")
 */
export function tipoIdDGII(rncCedula: string): "1" | "2" | "" {
  const clean = limpiarRncCedula(rncCedula);
  if (clean.length === 9) return "1";
  if (clean.length === 11) return "2";
  return "";
}

/**
 * Valida que un periodo tenga formato "YYYY-MM" y devuelve el rango
 * [inicio, fin) como fechas locales.
 */
export function rangoPeriodo(periodo: string): {
  inicio: Date;
  fin: Date;
} | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const inicio = new Date(year, month - 1, 1);
  const fin = new Date(year, month, 1); // primer día del mes siguiente
  return { inicio, fin };
}

/**
 * Trim + max length, evitando que un campo rompa el formato.
 * Reemplaza el `|` por espacio — ese caracter está reservado como
 * separador y no puede aparecer dentro del contenido.
 */
export function campo(s: string | null | undefined, maxLen?: number): string {
  if (!s) return "";
  const clean = String(s).replace(/\|/g, " ").trim();
  return maxLen ? clean.slice(0, maxLen) : clean;
}

/**
 * Construye un registro DGII concatenando los campos con `|`.
 * Los valores null/undefined se convierten a string vacío.
 */
export function registro(campos: (string | number | null | undefined)[]): string {
  return campos
    .map((c) => (c === null || c === undefined ? "" : String(c)))
    .join(SEP);
}

/** Envuelve un body con el CRLF que espera la DGII. */
export function finalizar(lineas: string[]): string {
  return lineas.join("\r\n") + "\r\n";
}

/**
 * Genera un CSV con BOM UTF-8 (para que Excel abra los acentos bien).
 * Los valores se escapan con reglas RFC 4180:
 *   - Si contienen `,`, `"` o `\n`, se envuelven en comillas.
 *   - Las comillas internas se duplican.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines: string[] = [];
  lines.push(headers.map(esc).join(","));
  for (const row of rows) {
    lines.push(row.map(esc).join(","));
  }
  // BOM UTF-8 para que Excel detecte el encoding correctamente
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
