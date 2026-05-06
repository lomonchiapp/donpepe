import Link from "next/link";
import { ArrowRight, TrendingUp, AlertTriangle, Coins, FileText } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Counter } from "@/components/motion/counter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ListGroup,
  ListRow,
  ListSection,
  SettingsGlyph,
} from "@/components/ui/list-group";
import { createClient } from "@/lib/supabase/server";
import {
  formatearDOP,
  formatearFechaCorta,
  pluralizar,
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10 space-y-7">
      <FadeIn>
        <header>
          <p className="text-[13px] text-muted-foreground tracking-[-0.005em]">
            {saludoDelDia()}, {formatearFechaCorta(new Date())}
          </p>
          <h1 className="mt-1 text-[28px] md:text-[34px] font-[700] leading-[1.05] tracking-[-0.026em]">
            Don Pepe
          </h1>
        </header>
      </FadeIn>

      {/* KPI section — iOS dashboard style */}
      <FadeIn delay={0.05}>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            icon={<FileText className="h-[15px] w-[15px]" />}
            tone="blue"
            titulo="Capital prestado"
            valor={<Counter value={capital} moneda />}
            detalle={`${activosCount} ${pluralizar(activosCount, "empeño", "empeños")} activos`}
          />
          <KpiCard
            icon={<AlertTriangle className="h-[15px] w-[15px]" />}
            tone="orange"
            titulo="Vence hoy"
            valor={<Counter value={venceHoy.length} />}
            detalle="Revisar y avisar"
          />
          <KpiCard
            icon={<Coins className="h-[15px] w-[15px]" />}
            tone="gold"
            titulo="Oro comprado hoy"
            valor={<Counter value={oroComprado} moneda />}
            detalle="Compras directas"
          />
          <KpiCard
            icon={<TrendingUp className="h-[15px] w-[15px]" />}
            tone="green"
            titulo="Propiedad casa"
            valor={<Counter value={propiedadCasa} />}
            detalle="Listos para vender"
          />
        </section>
      </FadeIn>

      {/* Acciones rápidas — iOS Settings style sin perder los gradientes brand */}
      <FadeIn delay={0.12}>
        <ListSection title="Acciones rápidas">
          <div className="grid gap-3 md:grid-cols-2">
            <AccesoRapido
              href="/empenos/nuevo"
              titulo="Nuevo empeño"
              descripcion="Crear un ticket de préstamo en 3 pasos."
              tone="graphite"
            />
            <AccesoRapido
              href="/inventario"
              titulo="Nueva venta"
              descripcion="Elige un artículo del inventario para vender."
              tone="champagne"
            />
          </div>
        </ListSection>
      </FadeIn>

      {/* Vence hoy — Inset Grouped List iOS */}
      <FadeIn delay={0.18}>
        <ListSection
          title="Vence hoy o antes"
          description={
            venceHoy.length === 0
              ? undefined
              : "Toca una fila para abrir el préstamo."
          }
        >
          {venceHoy.length === 0 ? (
            <div
              className={cn(
                "rounded-[14px] border border-border/60 bg-card shadow-card",
                "px-4 py-8 text-center text-[13.5px] text-muted-foreground",
              )}
            >
              No hay empeños venciendo hoy.
            </div>
          ) : (
            <ListGroup>
              {venceHoy.map((p) => {
                const dias = diasHastaVencimiento(p.fecha_vencimiento);
                const estado = semaforoVencimiento(p.fecha_vencimiento);
                const cliente = p.clientes?.nombre_completo ?? "Cliente";
                const descripcion = p.articulos?.descripcion ?? "Artículo";
                const tone =
                  estado === "vencido"
                    ? "red"
                    : estado === "vence_hoy"
                      ? "orange"
                      : "yellow";
                const label =
                  estado === "vencido" ? "VCDO" : estado === "vence_hoy" ? "HOY" : `${dias}d`;

                return (
                  <ListRow
                    key={p.id}
                    href={`/empenos/${p.id}`}
                    icon={
                      <SettingsGlyph color={tone} size={32}>
                        <span className="text-[10.5px] font-[700] tracking-[-0.005em] tabular-nums">
                          {label}
                        </span>
                      </SettingsGlyph>
                    }
                    title={cliente}
                    subtitle={descripcion}
                    trailing={
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-[600] text-foreground tabular-nums">
                          {formatearDOP(Number(p.monto_prestado))}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.codigo}
                        </Badge>
                      </div>
                    }
                  />
                );
              })}
            </ListGroup>
          )}
          {venceHoy.length > 0 && (
            <div className="px-4 pt-1">
              <Link
                href="/empenos?filtro=vencidos"
                className="inline-flex items-center gap-1 text-[13px] font-[510] text-primary hover:underline"
              >
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </ListSection>
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
}: {
  titulo: string;
  valor: React.ReactNode;
  detalle?: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "orange" | "gold";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-[510] text-muted-foreground uppercase tracking-[0.04em]">
            {titulo}
          </span>
          <SettingsGlyph color={tone} size={24}>
            {icon}
          </SettingsGlyph>
        </div>
        <div className="mt-2 text-[24px] md:text-[28px] font-[700] leading-tight tracking-[-0.022em] tabular-nums">
          {valor}
        </div>
        {detalle && (
          <p className="mt-0.5 text-[11.5px] text-muted-foreground tracking-[-0.005em]">
            {detalle}
          </p>
        )}
      </CardContent>
    </Card>
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
  tone: "graphite" | "champagne";
}) {
  return (
    <Link href={href} className="group">
      <div
        className={cn(
          "relative overflow-hidden rounded-[14px] shadow-elevated",
          "border border-border/40",
          "transition-transform duration-200 [transition-timing-function:var(--ease-ios)] group-hover:-translate-y-0.5",
          "ring-1 ring-inset ring-white/[0.06]",
          tone === "graphite" && "wine-gradient text-wine-foreground",
          tone === "champagne" && "gold-gradient text-[oklch(0.2_0.04_70)]",
        )}
      >
        {/* Highlight superior interior — Apple Hardware metallic */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between p-5">
          <div>
            <h3 className="text-[17px] font-[600] tracking-[-0.022em] leading-tight">{titulo}</h3>
            <p className="mt-0.5 text-[12.5px] opacity-80 tracking-[-0.005em]">{descripcion}</p>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-white/15 backdrop-blur-sm",
              "transition-transform duration-200 [transition-timing-function:var(--ease-ios)] group-hover:translate-x-0.5",
            )}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </Link>
  );
}
