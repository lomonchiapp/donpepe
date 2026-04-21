import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WizardNuevoEmpeno } from "@/components/empeno/wizard-nuevo";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, ConfigNegocio, PrecioOro } from "@/lib/supabase/types";
import type { Kilataje } from "@/lib/calc/oro";

export const metadata = { title: "Nuevo empeño" };

interface Props {
  searchParams: Promise<{ cliente?: string }>;
}

export default async function NuevoEmpenoPage({ searchParams }: Props) {
  const { cliente: clienteId } = await searchParams;
  const supabase = await createClient();

  const hoy = new Date().toISOString().slice(0, 10);

  const [clienteRes, configRes, preciosRes] = await Promise.all([
    clienteId
      ? supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("config_negocio").select("*").limit(1).maybeSingle(),
    supabase.from("precios_oro").select("*").eq("fecha", hoy),
  ]);

  const cliente = (clienteRes.data as Cliente | null) ?? null;
  const config = (configRes.data as ConfigNegocio | null) ?? null;
  const precios = (preciosRes.data ?? []) as PrecioOro[];

  const preciosOro: Record<Kilataje, number | null> = {
    10: null,
    14: null,
    18: null,
    22: null,
    24: null,
  };
  for (const p of precios) {
    if ([10, 14, 18, 22, 24].includes(p.kilataje)) {
      preciosOro[p.kilataje as Kilataje] = Number(p.precio_dop_gramo);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/empenos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Empeños
      </Link>
      <FadeIn>
        <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">
          Nuevo empeño
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Registra un préstamo prendario en 3 pasos.
        </p>
      </FadeIn>

      <WizardNuevoEmpeno
        cliente_preseleccionado={cliente}
        defaults={{
          tasa_interes_mensual: Number(config?.tasa_interes_default ?? 0.1),
          plazo_meses: config?.plazo_meses_default ?? 3,
          porcentaje_prestamo: Number(config?.porcentaje_prestamo_default ?? 0.6),
        }}
        precios_oro={preciosOro}
      />
    </div>
  );
}
