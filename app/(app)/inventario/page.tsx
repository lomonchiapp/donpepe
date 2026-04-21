import Link from "next/link";
import { Gem, Package, ShoppingCart } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import type { Articulo } from "@/lib/supabase/types";

export const metadata = { title: "Inventario" };

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articulos")
    .select("*")
    .eq("estado", "vencido_propio")
    .order("updated_at", { ascending: false });

  const articulos = (data ?? []) as Articulo[];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Package className="h-7 w-7 text-accent" /> Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            {articulos.length} artículos propiedad de la casa, listos para vender.
          </p>
        </div>
      </FadeIn>

      {articulos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No hay artículos disponibles en inventario.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articulos.map((a, i) => (
            <FadeIn key={a.id} delay={i * 0.03}>
              <Card className="overflow-hidden">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{a.descripcion}</p>
                      {a.kilataje && a.peso_gramos && (
                        <Badge variant="outline" className="mt-1">
                          {a.kilataje}K · {a.peso_gramos}g
                        </Badge>
                      )}
                    </div>
                    <Badge className="bg-accent/30 text-accent-foreground ring-1 ring-accent/50">
                      Propiedad casa
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Tasado en</p>
                      <p className="text-lg font-bold tabular-nums">
                        {formatearDOP(Number(a.valor_tasado))}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Link
                        href={`/ventas/nueva?articulo=${a.id}`}
                        className={cn(
                          buttonVariants({ variant: "default", size: "sm" }),
                          "gap-1.5",
                        )}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Vender tal cual
                      </Link>
                      {a.tipo === "joya_oro" && (
                        <Link
                          href={`/joyeria/convertir/${a.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "gap-1.5 text-xs",
                          )}
                          title="Pasa a la joyería con SKU, precio y ubicación"
                        >
                          <Gem className="h-3.5 w-3.5" />
                          Convertir a pieza
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Desde {formatearFechaCorta(a.updated_at)}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
