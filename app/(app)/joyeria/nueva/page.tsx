import Link from "next/link";
import { ArrowLeft, Gem } from "lucide-react";

import { FormNuevaPieza } from "@/components/joyeria/form-nueva-pieza";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaJoyeria, PrecioOro } from "@/lib/supabase/types";
import type { Kilataje } from "@/lib/calc/oro";

export const metadata = { title: "Nueva pieza de joyería" };

export default async function NuevaPiezaPage() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [categoriasRes, preciosRes] = await Promise.all([
    supabase
      .from("categorias_joyeria")
      .select("*")
      .eq("activo", true)
      .order("orden"),
    supabase.from("precios_oro").select("*").eq("fecha", hoy),
  ]);

  const categorias = (categoriasRes.data ?? []) as CategoriaJoyeria[];
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
        href="/joyeria"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Joyería
      </Link>
      <FadeIn>
        <div className="mb-1 flex items-center gap-2">
          <Gem className="h-6 w-6 text-chart-3" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Nueva pieza
          </h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Registra una pieza individual (anillo, cadena, reloj) o un lote (varias
          unidades iguales — ideal para plata barata).
        </p>
      </FadeIn>

      <FormNuevaPieza categorias={categorias} precios_oro={preciosOro} />
    </div>
  );
}
