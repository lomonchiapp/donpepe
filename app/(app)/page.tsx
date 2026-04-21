import Link from "next/link";
import { ArrowRight, TrendingUp, AlertTriangle, Coins, FileText } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Counter } from "@/components/motion/counter";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  formatearDOP,
  formatearFechaCorta,
  pluralizar,
  relativoDias,
  saludoDelDia,
} from "@/lib/format";
import {
  diasHastaVencimiento,
  semaforoVencimiento,
} from "@/lib/calc/intereses";
import { cn } from "@/lib/utils";

interface VenceHoyRow {
  id: string;
  codigo: string;
  monto_prestado: number;
  fecha_vencimiento: string;
  clientes: { nombre_completo: string; cedula: string } | null;
  articulos: { descripcion: string; fotos_urls: string[] } | null;
}

async function fetchKpis() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [activosRes, venceHoyRes, oroHoyRes, propiedadCasaRes] = await Promise.all([
    supabase.from("prestamos").select("monto_prestado").eq("estado", "activo"),
    supabase
      .from("prestamos")
      .select(
        "id, codigo, monto_prestado, fecha_vencimiento, clientes(nombre_completo, cedula), articulos(descripcion, fotos_urls)",
      )
      .eq("estado", "activo")
      .lte("fecha_vencimiento", hoy)
      .order("fecha_vencimiento", { ascending: true })
      .limit(6),
    supabase
      .from("compras_oro")
      .select("total_pagado")
      .gte("created_at", `${hoy}T00:00:00`)
      .lte("created_at", `${hoy}T23:59:59`),
    supabase
      .from("prestamos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "propiedad_casa"),
  ]);

  const activos = (activosRes.data ?? []) as Array<{ monto_prestado: number }>;
  const venceHoy = (venceHoyRes.data ?? []) as unknown as VenceHoyRow[];
  const oroHoy = (oroHoyRes.data ?? []) as Array<{ total_pagado: number }>;

  const capital = activos.reduce((sum, p) => sum + Number(p.monto_prestado ?? 0), 0);
  const oroComprado = oroHoy.reduce((sum, c) => sum + Number(c.total_pagado ?? 0), 0);

  return {
    capital,
    activosCount: activos.length,
    venceHoy,
    oroComprado,
    propiedadCasa: propiedadCasaRes.count ?? 0,
  };
}

export default async function InicioPage() {
  const { capital, activosCount, venceHoy, oroComprado, propiedadCasa } = await fetchKpis();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <header className="mb-6 md:mb-8">
          <p className="text-sm text-muted-foreground">
            {saludoDelDia()}, {formatearFechaCorta(new Date())}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            Don Pepe
          </h1>
        </header>
      </FadeIn>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiCard
          delay={0.05}
          icon={<FileText className="h-4 w-4" />}
          tone="wine"
          titulo="Capital prestado"
          valor={<Counter value={capital} moneda />}
          detalle={`${activosCount} ${pluralizar(activosCount, "empeño", "empeños")} activos`}
        />
        <KpiCard
          delay={0.1}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
          titulo="Vence hoy"
          valor={<Counter value={venceHoy.length} />}
          detalle="Revisar y avisar"
        />
        <KpiCard
          delay={0.15}
          icon={<Coins className="h-4 w-4" />}
          tone="gold"
          titulo="Oro comprado hoy"
          valor={<Counter value={oroComprado} moneda />}
          detalle="Compras directas"
        />
        <KpiCard
          delay={0.2}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
          titulo="Propiedad casa"
          valor={<Counter value={propiedadCasa} />}
          detalle="Listos para vender"
        />
      </section>

      <FadeIn delay={0.25} className="mt-6 grid gap-3 md:mt-8 md:grid-cols-2 md:gap-4">
        <AccesoRapido
          href="/empenos/nuevo"
          titulo="Nuevo empeño"
          descripcion="Crear un ticket de préstamo en 3 pasos."
          tone="wine"
        />
        <AccesoRapido
          href="/inventario"
          titulo="Nueva venta"
          descripcion="Elige un artículo del inventario para vender."
          tone="gold"
        />
      </FadeIn>

      <FadeIn delay={0.3} className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Vence hoy o antes</h2>
          <Link
            href="/empenos?filtro=vencidos"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
          >
            Ver todo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {venceHoy.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                🎉 No hay empeños venciendo hoy.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {venceHoy.map((p) => {
              const dias = diasHastaVencimiento(p.fecha_vencimiento);
              const estado = semaforoVencimiento(p.fecha_vencimiento);
              const cliente = p.clientes?.nombre_completo ?? "Cliente";
              const descripcion = p.articulos?.descripcion ?? "Artículo";
              return (
                <li key={p.id}>
                  <Link href={`/empenos/${p.id}`} className="block">
                    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CardContent className="flex items-center gap-4 py-4">
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                            estado === "vencido" && "bg-destructive/15 text-destructive animate-pulse",
                            estado === "vence_hoy" && "bg-warning/20 text-warning-foreground",
                            estado === "vence_pronto" && "bg-accent/20 text-accent-foreground",
                          )}
                        >
                          {estado === "vencido" ? "VCDO" : estado === "vence_hoy" ? "HOY" : `${dias}d`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{cliente}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {descripcion}
                          </p>
                          <p className="mt-0.5 text-sm font-mono tabular-nums">
                            {formatearDOP(Number(p.monto_prestado))}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.codigo}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </FadeIn>

    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  detalle,
  icon,
  tone,
  delay,
}: {
  titulo: string;
  valor: React.ReactNode;
  detalle?: string;
  icon: React.ReactNode;
  tone: "wine" | "gold" | "success" | "warning";
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <Card className="relative overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                tone === "wine" && "bg-primary/10 text-primary",
                tone === "gold" && "bg-accent/20 text-accent-foreground",
                tone === "success" && "bg-success/15 text-success",
                tone === "warning" && "bg-warning/25 text-warning-foreground",
              )}
            >
              {icon}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums md:text-3xl">
            {valor}
          </div>
          {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function AccesoRapido({
  href,
  titulo,
  descripcion,
  tone,
}: {
  href: string;
  titulo: string;
  descripcion: string;
  tone: "wine" | "gold";
}) {
  return (
    <Link href={href} className="group">
      <Card
        className={cn(
          "relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg",
          tone === "wine" && "wine-gradient text-wine-foreground",
          tone === "gold" && "gold-gradient text-gold-foreground",
        )}
      >
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h3 className="text-lg font-bold">{titulo}</h3>
            <p className="text-sm opacity-90">{descripcion}</p>
          </div>
          <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
        </CardContent>
      </Card>
    </Link>
  );
}
