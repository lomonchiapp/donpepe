/**
 * Validación de cédula dominicana emitida por la JCE.
 *
 * Formato: 000-0000000-0 (11 dígitos).
 * Algoritmo: Luhn modificado con pesos alternados [1, 2].
 */

const FORMATO_RAW = /^\d{11}$/;
const FORMATO_GUION = /^(\d{3})-?(\d{7})-?(\d{1})$/;

export function limpiarCedula(cedula: string): string {
  return (cedula ?? "").replace(/\D/g, "");
}

export function formatearCedula(cedula: string): string {
  const clean = limpiarCedula(cedula);
  const m = clean.match(/^(\d{3})(\d{7})(\d{1})$/);
  if (!m) return cedula;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function esCedulaValida(cedula: string): boolean {
  const clean = limpiarCedula(cedula);
  if (!FORMATO_RAW.test(clean)) return false;
  if (!FORMATO_GUION.test(formatearCedula(clean))) return false;

  const digitos = clean.split("").map(Number);
  const verificador = digitos[10];

  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const peso = i % 2 === 0 ? 1 : 2;
    let prod = digitos[i] * peso;
    if (prod > 9) prod -= 9;
    suma += prod;
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  return digitoCalculado === verificador;
}

/**
 * Valida formato y dígito verificador. Retorna el error específico
 * para mostrar mensajes claros en UI.
 */
export type ResultadoValidacionCedula =
  | { ok: true; formato: string }
  | { ok: false; error: "vacia" | "largo" | "digito_verificador" };

export function validarCedula(cedula: string): ResultadoValidacionCedula {
  if (!cedula || cedula.trim().length === 0) {
    return { ok: false, error: "vacia" };
  }
  const clean = limpiarCedula(cedula);
  if (clean.length !== 11) {
    return { ok: false, error: "largo" };
  }
  if (!esCedulaValida(clean)) {
    return { ok: false, error: "digito_verificador" };
  }
  return { ok: true, formato: formatearCedula(clean) };
}

export const MENSAJES_ERROR_CEDULA: Record<
  Exclude<ResultadoValidacionCedula & { ok: false }, { ok: true }>["error"],
  string
> = {
  vacia: "Ingrese la cédula",
  largo: "La cédula debe tener 11 dígitos",
  digito_verificador: "Cédula inválida (dígito verificador incorrecto)",
};
