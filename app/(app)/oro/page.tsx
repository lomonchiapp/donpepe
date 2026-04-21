import Link from "next/link";
import { Coins, ShoppingCart } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TarjetaPrecioOro } from "@/components/oro/tarjeta-precio";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearFechaLarga } from "@/lib/format";
import { KILATAJES, type Kilataje } from "@/lib/calc/oro";
import type { PrecioOro } from "@/lib/supabase/types";

export const metadata = { title: "Oro" };

export default async function OroPage() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("precios_oro")
    .select("*")
    .eq("fecha", hoy);

  const precios: Record<Kilataje, number | null> = {
    10: null,
    14: null,
    18: null,
    22: null,
    24: null,
  };
  for (const r of (data ?? []) as PrecioOro[]) {
    if ((KILATAJES as readonly number[]).includes(r.kilataje)) {
      precios[r.kilataje as Kilataje] = Number(r.precio_dop_gramo);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
              <Coins className="h-7 w-7 text-accent" /> Oro
            </h1>
            <p className="text-sm text-muted-foreground">
              Precios del {formatearFechaLarga(new Date())}
            </p>
          </div>
          <Link
            href="/oro/compra"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "gap-1.5")}
          >
            <ShoppingCart className="h-4 w-4" />
            Comprar oro
          </Link>
        </div>
      </FadeIn>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
        {KILATAJES.map((k, i) => (
          <FadeIn key={k} delay={i * 0.05}>
            <TarjetaPrecioOro kilataje={k} precio={precios[k]} fecha={hoy} />
          </FadeIn>
        ))}
      </section>

      <FadeIn delay={0.3} className="mt-8">
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="py-5 text-sm">
            <p className="font-semibold">💡 Cómo se calcula el precio</p>
            <p className="mt-2 text-muted-foreground">
              El precio por gramo que pagamos al cliente depende del kilataje
              (pureza) y del precio spot del oro 24K del día, menos el margen
              comercial de la casa. Puedes editar cada tarjeta si los precios
              cambian en el mercado internacional.
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
