import { NextResponse } from "next/server";

import { lookupCedula } from "@/lib/api/cedula-lookup";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cedula/[cedula]
 *
 * Valida una cédula contra OGTIC/Megaplus y devuelve los datos del ciudadano.
 * Protegido por el proxy: solo usuarios autenticados de la app pueden llamarlo,
 * así evitamos que terceros usen el endpoint para scrapear el padrón.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cedula: string }> },
) {
  // Doble-chequeo de sesión (aunque proxy ya la exige) — defensa en profundidad.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ valid: false, message: "No autenticado" }, { status: 401 });
  }

  const { cedula } = await params;
  const result = await lookupCedula(cedula);

  return NextResponse.json(result, {
    status: result.valid ? 200 : 404,
    headers: {
      // Cache corto del lado del servidor — mismo ciudadano no cambia seguido
      // pero tampoco queremos resultados demasiado rancios.
      "Cache-Control": "private, max-age=300",
    },
  });
}
