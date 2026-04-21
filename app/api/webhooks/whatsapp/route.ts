import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

/**
 * Webhook de Meta Cloud API.
 * - GET: verificación inicial del webhook (hub.challenge).
 * - POST: eventos (entrega, lectura, respuestas).
 */

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "invalid" }, { status: 403 });
}

interface StatusEvent {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
}

interface Value {
  statuses?: StatusEvent[];
}

interface Change {
  value?: Value;
  field?: string;
}

interface Entry {
  id?: string;
  changes?: Change[];
}

interface WebhookPayload {
  object?: string;
  entry?: Entry[];
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as WebhookPayload;
  const supabase = createServiceClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (status.status === "read") {
          await supabase
            .from("notificaciones")
            .update({ status: "leida" })
            .eq("meta_message_id", status.id);
        } else if (status.status === "failed") {
          await supabase
            .from("notificaciones")
            .update({ status: "fallida" })
            .eq("meta_message_id", status.id);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
