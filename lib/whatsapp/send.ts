/**
 * Envío de mensajes WhatsApp vía Meta Cloud API.
 * Ver https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

import { LENGUAJE } from "./templates";

const BASE_URL = "https://graph.facebook.com/v22.0";

export interface EnviarPlantillaInput {
  telefono: string; // E.164, ej "18095551234"
  plantilla: string;
  parametros: string[];
}

export interface ResultadoEnvio {
  ok: boolean;
  message_id?: string;
  error?: string;
}

function normalizarTelefono(tel: string): string {
  const clean = tel.replace(/\D/g, "");
  // Si empieza con "1" y tiene 11 dígitos → ya es DR formato internacional
  if (clean.length === 11 && clean.startsWith("1")) return clean;
  // Si tiene 10 dígitos → agregar prefijo de RD "1"
  if (clean.length === 10) return `1${clean}`;
  return clean;
}

export async function enviarPlantilla({
  telefono,
  plantilla,
  parametros,
}: EnviarPlantillaInput): Promise<ResultadoEnvio> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp no configurado (falta ACCESS_TOKEN o PHONE_NUMBER_ID)" };
  }

  const destino = normalizarTelefono(telefono);

  const body = {
    messaging_product: "whatsapp",
    to: destino,
    type: "template",
    template: {
      name: plantilla,
      language: { code: LENGUAJE },
      components: [
        {
          type: "body",
          parameters: parametros.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  try {
    const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }

    return { ok: true, message_id: json.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}
