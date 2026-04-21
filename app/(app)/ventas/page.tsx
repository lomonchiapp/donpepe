import Link from "next/link";
import { Gem, Package, ShoppingCart } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import type { Venta } from "@/lib/supabase/types";

export const metadata = { title: "Ventas" };

interface VentaRow extends Venta {
  articulos: { descripcion: string; kilataje: number | null; peso_gramos: number | null } | null;
  piezas_joyeria: { id: string; nombre: string; sku: string } | null;
}

export default async function VentasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ventas")
    .select(
      "*, articulos(descripcion, kilataje, peso_gramos), piezas_joyeria(id, nombre, sku)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const ventas = (data ?? []) as unknown as VentaRow[];
  const total = ventas.reduce((s, v) => s + Number(v.precio_venta), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <ShoppingCart className="h-7 w-7" /> Ventas
          </h1>
          <p className="text-sm text-muted-foreground">
            {ventas.length} ventas · Total {formatearDOP(total)}
          </p>
        </div>
      </FadeIn>

      {ventas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Aún no se han registrado ventas.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {ventas.map((v, i) => {
            const esPieza = !!v.piezas_joyeria;
            const titulo = esPieza
              ? v.piezas_joyeria?.nombre
              : (v.articulos?.descripcion ?? "Artículo");
            const subCodigo = esPieza ? v.piezas_joyeria?.sku : null;
            const href = esPieza
              ? `/joyeria/${v.piezas_joyeria?.id}`
              : undefined;

            const cardContent = (
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs text-muted-foreground">{v.codigo}</p>
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] capitalize"
                      >
                        {esPieza ? (
                          <>
                            <Gem className="h-2.5 w-2.5" /> Joyería
                          </>
                        ) : (
                          <>
                            <Package className="h-2.5 w-2.5" /> Compraventa
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {v.metodo}
                      </Badge>
                      {v.cantidad > 1 && (
                        <Badge variant="outline" className="text-[10px]">
                          ×{v.cantidad}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">{titulo}</p>
                    {subCodigo && (
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {subCodigo}
                      </p>
                    )}
                    {v.comprador_nombre && (
                      <p className="truncate text-xs text-muted-foreground">
                        {v.comprador_nombre}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold tabular-nums">
                      {formatearDOP(Number(v.precio_venta))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatearFechaCorta(v.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            return (
              <FadeIn key={v.id} delay={Math.min(i, 10) * 0.02}>
                {href ? <Link href={href}>{cardContent}</Link> : cardContent}
              </FadeIn>
            );
          })}
        </ul>
      )}
    </div>
  );
}
