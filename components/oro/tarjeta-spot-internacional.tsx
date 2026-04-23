import { Coins, TrendingUp } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP } from "@/lib/format";
import type { SpotMetalesDiario } from "@/lib/supabase/types";

/**
 * Tarjeta con los precios spot internacionales de los 4 metales
 * preciosos. La información es INFORMATIVA — no bloquea el flujo
 * de compra, solo es una referencia para que el dueño negocie.
 *
 * Los precios se actualizan una vez al día vía cron desde
 * MetalpriceAPI (ver `/api/cron/spot-metales`). Si nunca se corrió
 * el cron, la tarjeta muestra un estado vacío con instrucciones.
 */
export async function TarjetaSpotInternacional() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spot_metales_diario")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const spot = (data as SpotMetalesDiario | null) ?? null;

  return (
    <FadeIn delay={0.15}>
      <Card className="border-blue-500/30 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20">
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold">
                Spot internacional · referencia
              </h3>
            </div>
            {spot?.fecha && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {new Date(spot.fecha).toLocaleDateString("es-DO", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            )}
          </div>

          {!spot ? (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-3 text-xs text-muted-foreground">
              Todavía no hay datos. El cron corre a las 9:00 AM RD. Si tu
              admin configuró <code>METALPRICE_API_KEY</code> en Vercel,
              mañana aparecerán aquí los precios de oro, plata, platino y
              paladio. Estos valores son <strong>informativos</strong> —
              los precios locales los fijas tú.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metal
                  etiqueta="Oro 24K"
                  dopG={spot.oro_24k_dop_gramo}
                  usdOz={spot.oro_usd_oz}
                  icon={<Coins className="h-3.5 w-3.5 text-amber-500" />}
                />
                <Metal
                  etiqueta="Plata"
                  dopG={spot.plata_dop_gramo}
                  usdOz={spot.plata_usd_oz}
                  icon={<Coins className="h-3.5 w-3.5 text-slate-400" />}
                />
                <Metal
                  etiqueta="Platino"
                  dopG={spot.platino_dop_gramo}
                  usdOz={spot.platino_usd_oz}
                  icon={<Coins className="h-3.5 w-3.5 text-zinc-300" />}
                />
                <Metal
                  etiqueta="Paladio"
                  dopG={spot.paladio_dop_gramo}
                  usdOz={spot.paladio_usd_oz}
                  icon={<Coins className="h-3.5 w-3.5 text-stone-400" />}
                />
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Fuente: {spot.fuente} · USD/DOP{" "}
                {spot.usd_dop != null ? Number(spot.usd_dop).toFixed(2) : "—"}.
                Los precios locales que la casa paga siguen siendo los de
                cada tarjeta de arriba — esto es solo la referencia
                internacional.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function Metal({
  etiqueta,
  dopG,
  usdOz,
  icon,
}: {
  etiqueta: string;
  dopG: number | null;
  usdOz: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-background/60 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {etiqueta}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {dopG != null ? `${formatearDOP(Number(dopG), true)}/g` : "—"}
      </p>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {usdOz != null ? `US$ ${Number(usdOz).toFixed(2)}/oz` : ""}
      </p>
    </div>
  );
}
