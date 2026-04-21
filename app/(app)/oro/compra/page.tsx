import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { FlujoCompraOro } from "@/components/oro/flujo-compra";
import { createClient } from "@/lib/supabase/server";
import { KILATAJES, type Kilataje } from "@/lib/calc/oro";
import type { Cliente, PrecioOro } from "@/lib/supabase/types";

export const metadata = { title: "Comprar oro" };

interface Props {
  searchParams: Promise<{ cliente?: string }>;
}

export default async function CompraOroPage({ searchParams }: Props) {
  const { cliente: clienteId } = await searchParams;
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [clienteRes, preciosRes] = await Promise.all([
    clienteId
      ? supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("precios_oro").select("*").eq("fecha", hoy),
  ]);

  const cliente = (clienteRes.data as Cliente | null) ?? null;
  const precios = (preciosRes.data ?? []) as PrecioOro[];

  const preciosOro: Record<Kilataje, number | null> = {
    10: null,
    14: null,
    18: null,
    22: null,
    24: null,
  };
  for (const r of precios) {
    if ((KILATAJES as readonly number[]).includes(r.kilataje)) {
      preciosOro[r.kilataje as Kilataje] = Number(r.precio_dop_gramo);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/oro"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Oro
      </Link>
      <FadeIn>
        <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">
          Comprar oro
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Compra directa — sin empeño. Pagamos el precio del día por kilataje.
        </p>
      </FadeIn>
      <FlujoCompraOro
        cliente_preseleccionado={cliente}
        precios_oro={preciosOro}
      />
    </div>
  );
}
