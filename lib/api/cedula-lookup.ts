/**
 * Validador de cédula dominicana — versión simplificada.
 *
 * Ya no intentamos traer el nombre del padrón. Las APIs públicas (OGTIC,
 * MegaPlus, Cognitio) son inconsistentes: unas solo dan nombres con RNC,
 * otras están detrás de keys/CORS, otras no resuelven desde el egress
 * de Vercel. El nombre lo captura el operador manualmente.
 *
 * Cascada actual:
 *   1. Luhn local — verifica dígito verificador (offline, instantáneo).
 *   2. OGTIC /validate — confirma que la cédula existe en el padrón
 *      JCE. Si responde OK, marcamos `source: "padron"`. Si está caída
 *      o bloqueada, caemos a `source: "luhn"` silenciosamente.
 *
 * Se ejecuta en el servidor (Route Handler) para evitar CORS.
 * Timeout 5s por call.
 */

import {
  esCedulaValida,
  formatearCedula,
  limpiarCedula,
} from "@/lib/validaciones/cedula-do";

const OGTIC_URL = "https://api.digital.gob.do/v3/cedulas";
const TIMEOUT_MS = 5000;

export type CedulaLookupResult =
  | {
      valid: true;
      cedula: string;
      /**
       * `padron`: OGTIC confirmó que existe en el padrón JCE.
       * `luhn`: solo pasó la validación de dígito verificador (offline
       * o OGTIC no respondió).
       */
      source: "padron" | "luhn";
    }
  | { valid: false; message: string };

export async function lookupCedula(input: string): Promise<CedulaLookupResult> {
  const clean = limpiarCedula(input);

  if (clean.length !== 11) {
    return { valid: false, message: "La cédula debe tener 11 dígitos" };
  }

  // Paso 1 — Luhn local. Si falla, ni siquiera tocamos la red.
  if (!esCedulaValida(clean)) {
    return {
      valid: false,
      message: "Cédula inválida (dígito verificador)",
    };
  }

  // Paso 2 — OGTIC /validate como confirmación del padrón. Best-effort.
  try {
    const res = await fetch(`${OGTIC_URL}/${clean}/validate`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      return {
        valid: false,
        message: "La cédula no existe en el padrón de la JCE",
      };
    }

    if (res.ok) {
      const data = (await res.json()) as { valid?: boolean };
      if (data.valid === false) {
        return {
          valid: false,
          message: "Cédula no válida según el padrón",
        };
      }
      if (data.valid === true) {
        return {
          valid: true,
          cedula: formatearCedula(clean),
          source: "padron",
        };
      }
    }
  } catch {
    // Timeout o bloqueo de egress — caemos al fallback offline.
  }

  // Paso 3 — Si OGTIC no respondió, confiamos en Luhn.
  return {
    valid: true,
    cedula: formatearCedula(clean),
    source: "luhn",
  };
}
