/**
 * Servicio de lookup de cédula dominicana.
 *
 * Cascada:
 *   1. OGTIC (api.digital.gob.do) — valida existencia en el padrón.
 *   2. Megaplus (rnc.megaplus.com.do) — obtiene nombre desde DGII.
 *   3. Luhn local — fallback offline si ambas APIs fallan.
 *
 * Se ejecuta en el servidor (Route Handler) para evitar CORS y ocultar
 * las URLs de las APIs. Timeout 5s por call.
 */

import {
  esCedulaValida,
  formatearCedula,
  limpiarCedula,
} from "@/lib/validaciones/cedula-do";

const OGTIC_URL = "https://api.digital.gob.do/v3/cedulas";
const MEGAPLUS_URL = "https://rnc.megaplus.com.do/api/consulta";
const TIMEOUT_MS = 5000;

export type CedulaLookupResult =
  | {
      valid: true;
      cedula: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      source: "ogtic+megaplus" | "megaplus" | "ogtic" | "luhn";
    }
  | { valid: false; message: string };

export async function lookupCedula(input: string): Promise<CedulaLookupResult> {
  const clean = limpiarCedula(input);

  if (clean.length !== 11) {
    return { valid: false, message: "La cédula debe tener 11 dígitos" };
  }

  // Paso 1 — OGTIC
  let ogticValid: boolean | null = null;
  try {
    const res = await fetch(`${OGTIC_URL}/${clean}/validate`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const data = (await res.json()) as { valid?: boolean };
      ogticValid = data.valid === true;
    }
  } catch {
    // OGTIC caído: continuamos a Megaplus
  }

  if (ogticValid === false) {
    return { valid: false, message: "Cédula no válida según el padrón" };
  }

  // Paso 2 — Megaplus (nombre)
  let fullName = "";
  try {
    const res = await fetch(`${MEGAPLUS_URL}?rnc=${clean}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const data = (await res.json()) as { nombre_razon_social?: string };
      if (data.nombre_razon_social) {
        fullName = capitalizar(data.nombre_razon_social);
        if (ogticValid === null) ogticValid = true;
      }
    }
  } catch {
    // Megaplus caído
  }

  // Paso 3 — Fallback Luhn si ninguna API respondió
  if (ogticValid === null) {
    if (!esCedulaValida(clean)) {
      return { valid: false, message: "Cédula inválida (dígito verificador)" };
    }
    return {
      valid: true,
      cedula: formatearCedula(clean),
      source: "luhn",
    };
  }

  if (!ogticValid) {
    return { valid: false, message: "Cédula no encontrada" };
  }

  const { firstName, lastName } = partirNombre(fullName);

  return {
    valid: true,
    cedula: formatearCedula(clean),
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    source: fullName ? "ogtic+megaplus" : "ogtic",
  };
}

function capitalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function partirNombre(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: full, lastName: "" };
  // Heurística RD: primer token = nombre, resto = apellidos.
  // No es perfecto (nombres compuestos), pero es mejor que nada.
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" ") };
}
