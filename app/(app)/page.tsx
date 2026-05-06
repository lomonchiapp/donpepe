import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Coins,
  FileText,
  AlertOctagon,
  Wallet,
  ShoppingCart,
  Gem,
  CalendarClock,
} from "lucide-react";

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
} from "@/lib/calc/intereses";
import { cn } from "@/lib/utils";

interface PrestamoRow {
  id: string;
  codigo: string;
  monto_prestado: number;
  fecha_vencimiento: string;
  estado: string;
  clientes: { nombre_completo: string; cedula: string } | null;
  articulos: { descripcion: string; fotos_urls: string[] } | null;
}

async function fetchDashboard() {
  const supabase = await createClient();
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);
  const en7 = new Date(hoy);
  en7.setDate(en7.getDate() + 7);
  const en7ISO = en7.toISOString().slice(0, 10);
  const mañana = new Date(hoy);
  mañana.setDate(mañana.getDate() + 1);
  const mañanaISO = mañana.toISOString().slice(0, 10);

  const [
    activosRes,
    venceHoyRes,
    vencidosRes,
    venceSemanaRes,
    oroHoyRes,
    propiedadCasaRes,
    pagosHoyRes,
    ventasHoyRes,
    piezasDisponiblesRes,
  ] = await Promise.all([
    // Activos: count + sum capital
    supabase
      .from("prestamos")
      .select("monto_prestado", { count: "exact" })
      .eq("estado", "activo"),
    // Vence hoy exactamente (estado activo)
    supabase
      .from("prestamos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "activo")
      .eq("fecha_vencimiento", hoyISO),
    // Vencidos: estado activo o vencido_a_cobro con fecha_vencimiento < hoy
    supabase
      .from("prestamos")
      .select(
        "id, codigo, monto_prestado, fecha_vencimiento, estado, clientes(nombre_completo, cedula), articulos(descripcion, fotos_urls)",
      )
      .in("estado", ["activo", "vencido_a_cobro"])
      .lt("fecha_vencimiento", hoyISO)
      .order("fecha_vencimiento", { ascending: true })
      .limit(50),
    // Vence esta semana: activos entre mañana y +7 días
    supabase
      .from("prestamos")
      .select(
        "id, codigo, monto_prestado, fecha_vencimiento, estado, clientes(nombre_completo, cedula), articulos(descripcion, fotos_urls)",
      )
      .eq("estado", "activo")
      .gte("fecha_vencimiento", hoyISO)
      .lte("fecha_vencimiento", en7ISO)
      .order("fecha_vencimiento", { ascending: true })
      .limit(50),
    // Oro comprado hoy
    supabase
      .from("compras_oro")
      .select("total_pagado")
      .gte("created_at", `${hoyISO}T00:00:00`)
      .lt("created_at", `${mañanaISO}T00:00:00`),
    // Propiedad casa: count + sum
    supabase
      .from("prestamos")
      .select("monto_prestado", { count: "exact" })
      .eq("estado", "propiedad_casa"),
    // Pagos del día (ingresos)
    supabase
      .from("pagos")
      .select("monto", { count: "exact" })
      .eq("direccion", "ingreso")
      .eq("fecha", hoyISO)
      .is("anulado_at", null),
    // Ventas del día
    supabase
      .from("ventas")
      .select("precio_venta", { count: "exact" })
      .gte("created_at", `${hoyISO}T00:00:00`)
      .lt("created_at", `${mañanaISO}T00:00:00`),
    // Piezas joyería disponibles
    supabase
      .from("piezas_joyeria")
      .select("id", { count: "exact", head: true })
      .eq("estado", "disponible"),
  ]);

  const activos = (activosRes.data ?? []) as Array<{ monto_prestado: number }>;
  const vencidos = (vencidosRes.data ?? []) as unknown as PrestamoRow[];
  const venceSemana = (venceSemanaRes.data ?? []) as unknown as PrestamoRow[];
  const oroHoy = (oroHoyRes.data ?? []) as Array<{ total_pagado: number }>;
  const propCasa = (propiedadCasaRes.data ?? []) as Array<{ monto_prestado: number }>;
  const pagosHoy = (pagosHoyRes.data ?? []) as Array<{ monto: number }>;
  const ventasHoy = (ventasHoyRes.data ?? []) as Array<{ precio_venta: number }>;

  return {
    capital: activos.reduce((s, p) => s + Number(p.monto_prestado ?? 0), 0),
    activosCount: activosRes.count ?? activos.length,
    venceHoyCount: venceHoyRes.count ?? 0,
    vencidos,
    vencidosTotal: vencidos.reduce((s, p) => s + Number(p.monto_prestado ?? 0), 0),
    venceSemana,
    venceSemanaTotal: venceSemana.reduce((s, p) => s + Number(p.monto_prestado ?? 0), 0),
    oroComprado: oroHoy.reduce((s, c) => s + Number(c.total_pagado ?? 0), 0),
    oroCount: oroHoy.length,
    propiedadCasa: propiedadCasaRes.count ?? propCasa.length,
    propiedadCasaTotal: propCasa.reduce((s, p) => s + Number(p.monto_prestado ?? 0), 0),
    ingresosHoy: pagosHoy.reduce((s, p) => s + Number(p.monto ?? 0), 0),
    ingresosCount: pagosHoyRes.count ?? pagosHoy.length,
    ventasHoyTotal: ventasHoy.reduce((s, v) => s + Number(v.precio_venta ?? 0), 0),
    ventasHoyCount: ventasHoyRes.count ?? ventasHoy.length,
    piezasDisponibles: piezasDisponiblesRes.count ?? 0,
  };
}

export default async function InicioPage() {
  const data = await fetchDashboard();

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

      {/* KPI grid — 4×2 desktop, 2×4 mobile */}
      <FadeIn delay={0.05}>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            href="/empenos?filtro=activos"
            icon={<FileText className="h-[15px] w-[15px]" />}
            tone="blue"
            titulo="Capital prestado"
            valor={<Counter value={data.capital} moneda />}
            detalle={`${data.activosCount} ${pluralizar(data.activosCount, "activo", "activos")}`}
          />
          <KpiCard
            href="/empenos?filtro=vencidos"
            icon={<AlertOctagon className="h-[15px] w-[15px]" />}
            tone="red"
            titulo="Vencidos"
            valor={<Counter value={data.vencidos.length} />}
            detalle={data.vencidos.length > 0
              ? `${formatearDOP(data.vencidosTotal)} en cobro`
              : "Todo al día"}
            urgente={data.vencidos.length > 0}
          />
          <KpiCard
            href="/empenos?filtro=vence_pronto"
            icon={<AlertTriangle className="h-[15px] w-[15px]" />}
            tone="orange"
            titulo="Vencen en 7 días"
            valor={<Counter value={data.venceSemana.length} />}
            detalle={data.venceHoyCount > 0
              ? `${data.venceHoyCount} ${pluralizar(data.venceHoyCount, "hoy mismo", "hoy mismo")}`
              : `${formatearDOP(data.venceSemanaTotal)}`}
          />
          <KpiCard
            href="/empenos?filtro=propiedad"
            icon={<TrendingUp className="h-[15px] w-[15px]" />}
            tone="green"
            titulo="Propiedad casa"
            valor={<Counter value={data.propiedadCasa} />}
            detalle={data.propiedadCasa > 0
              ? `${formatearDOP(data.propiedadCasaTotal)} listos`
              : "Sin stock"}
          />
          <KpiCard
            href="/pagos"
            icon={<Wallet className="h-[15px] w-[15px]" />}
            tone="indigo"
            titulo="Ingresos hoy"
            valor={<Counter value={data.ingresosHoy} moneda />}
            detalle={`${data.ingresosCount} ${pluralizar(data.ingresosCount, "pago", "pagos")}`}
          />
          <KpiCard
            href="/ventas"
            icon={<ShoppingCart className="h-[15px] w-[15px]" />}
            tone="purple"
            titulo="Ventas hoy"
            valor={<Counter value={data.ventasHoyTotal} moneda />}
            detalle={`${data.ventasHoyCount} ${pluralizar(data.ventasHoyCount, "venta", "ventas")}`}
          />
          <KpiCard
            href="/oro/compra"
            icon={<Coins className="h-[15px] w-[15px]" />}
            tone="gold"
            titulo="Oro comprado hoy"
            valor={<Counter value={data.oroComprado} moneda />}
            detalle={`${data.oroCount} ${pluralizar(data.oroCount, "compra", "compras")}`}
          />
          <KpiCard
            href="/joyeria"
            icon={<Gem className="h-[15px] w-[15px]" />}
            tone="pink"
            titulo="Piezas joyería"
            valor={<Counter value={data.piezasDisponibles} />}
            detalle="disponibles"
          />
        </section>
      </FadeIn>

      {/* Vencidos — rojo, prioridad máxima */}
      {data.vencidos.length > 0 && (
        <FadeIn delay={0.12}>
          <ListSection
            title={
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                <span>Vencidos a cobro</span>
                <span className="text-muted-foreground/70 font-[510]">
                  · {data.vencidos.length}
                </span>
              </span>
            }
            description="Estos préstamos pasaron su fecha de vencimiento. Llamar al cliente o aplicar gracia."
          >
            <ListGroup>
              {data.vencidos.slice(0, 5).map((p) => (
                <PrestamoRowItem key={p.id} prestamo={p} variant="vencido" />
              ))}
            </ListGroup>
            {data.vencidos.length > 5 && (
              <div className="px-4 pt-1">
                <Link
                  href="/empenos?filtro=vencidos"
                  className="inline-flex items-center gap-1 text-[13px] font-[510] text-destructive hover:underline"
                >
                  Ver los {data.vencidos.length} vencidos
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </ListSection>
        </FadeIn>
      )}

      {/* Vence esta semana — amarillo */}
      {data.venceSemana.length > 0 && (
        <FadeIn delay={0.18}>
          <ListSection
            title={
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span>Vencen en los próximos 7 días</span>
                <span className="text-muted-foreground/70 font-[510]">
                  · {data.venceSemana.length}
                </span>
              </span>
            }
            description={
              data.venceHoyCount > 0
                ? `${data.venceHoyCount} ${pluralizar(data.venceHoyCount, "vence hoy mismo", "vencen hoy mismo")}, avisa al cliente.`
                : "Buen momento para enviar recordatorios."
            }
          >
            <ListGroup>
              {data.venceSemana.slice(0, 5).map((p) => (
                <PrestamoRowItem key={p.id} prestamo={p} variant="proximo" />
              ))}
            </ListGroup>
            {data.venceSemana.length > 5 && (
              <div className="px-4 pt-1">
                <Link
                  href="/empenos?filtro=vence_pronto"
                  className="inline-flex items-center gap-1 text-[13px] font-[510] text-primary hover:underline"
                >
                  Ver todos · {data.venceSemana.length}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </ListSection>
        </FadeIn>
      )}

      {/* Estado feliz — si no hay nada urgente */}
      {data.vencidos.length === 0 && data.venceSemana.length === 0 && (
        <FadeIn delay={0.12}>
          <div
            className={cn(
              "rounded-[14px] border border-border/60 bg-card shadow-card",
              "px-6 py-10 text-center",
            )}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/[0.14]">
              <CalendarClock className="h-5 w-5 text-success" strokeWidth={1.6} />
            </div>
            <p className="text-[15px] font-[590] tracking-[-0.014em]">
              Todo al día
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground tracking-[-0.005em]">
              No hay vencimientos urgentes esta semana.
            </p>
          </div>
        </FadeIn>
      )}

      {/* Acciones rápidas */}
      <FadeIn delay={0.25}>
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
    </div>
  );
}

// ---------------------------------------------------------------
// Componentes locales
// ---------------------------------------------------------------

function KpiCard({
  href,
  titulo,
  valor,
  detalle,
  icon,
  tone,
  urgente = false,
}: {
  href?: string;
  titulo: string;
  valor: React.ReactNode;
  detalle?: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "orange" | "red" | "gold" | "indigo" | "purple" | "pink";
  urgente?: boolean;
}) {
  const inner = (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        "[transition-timing-function:var(--ease-ios)]",
        href && "hover:-translate-y-0.5 hover:shadow-elevated",
        urgente && "ring-1 ring-destructive/30",
      )}
    >
      {urgente && (
        <span className="absolute inset-x-0 top-0 h-[2px] bg-destructive" />
      )}
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-[510] text-muted-foreground uppercase tracking-[0.04em]">
            {titulo}
          </span>
          <SettingsGlyph color={tone} size={24}>
            {icon}
          </SettingsGlyph>
        </div>
        <div
          className={cn(
            "mt-2 text-[24px] md:text-[28px] font-[700] leading-tight tracking-[-0.022em] tabular-nums",
            urgente && "text-destructive",
          )}
        >
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
  return href ? (
    <Link href={href} className="block no-tap-highlight press-ios">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function PrestamoRowItem({
  prestamo,
  variant,
}: {
  prestamo: PrestamoRow;
  variant: "vencido" | "proximo";
}) {
  const dias = diasHastaVencimiento(prestamo.fecha_vencimiento);
  const cliente = prestamo.clientes?.nombre_completo ?? "Cliente";
  const descripcion = prestamo.articulos?.descripcion ?? "Artículo";

  const glyphColor = variant === "vencido" ? "red" : dias === 0 ? "orange" : "yellow";
  const labelTop = variant === "vencido"
    ? `${Math.abs(dias)}d`
    : dias === 0 ? "HOY" : `${dias}d`;

  return (
    <ListRow
      href={`/empenos/${prestamo.id}`}
      icon={
        <SettingsGlyph color={glyphColor} size={32}>
          <span className="text-[10.5px] font-[700] tracking-[-0.005em] tabular-nums">
            {labelTop}
          </span>
        </SettingsGlyph>
      }
      title={cliente}
      subtitle={
        <span className="flex items-center gap-1.5 truncate">
          <span className="truncate">{descripcion}</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/70 shrink-0">
            {variant === "vencido"
              ? `vencido ${formatearFechaCorta(prestamo.fecha_vencimiento)}`
              : `vence ${formatearFechaCorta(prestamo.fecha_vencimiento)}`}
          </span>
        </span>
      }
      trailing={
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={cn(
              "font-[600] tabular-nums",
              variant === "vencido" ? "text-destructive" : "text-foreground",
            )}
          >
            {formatearDOP(Number(prestamo.monto_prestado))}
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {prestamo.codigo}
          </Badge>
        </div>
      }
    />
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
    <Link href={href} className="group no-tap-highlight">
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
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between p-5">
          <div>
            <h3 className="text-[17px] font-[600] tracking-[-0.022em] leading-tight">
              {titulo}
            </h3>
            <p className="mt-0.5 text-[12.5px] opacity-80 tracking-[-0.005em]">
              {descripcion}
            </p>
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
