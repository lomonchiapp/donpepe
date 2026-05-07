import Link from "next/link";
import { Bell, BellOff, Phone, MessageCircle } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import {
  ListGroup,
  ListSection,
  SettingsGlyph,
} from "@/components/ui/list-group";
import { createClient } from "@/lib/supabase/server";
import { diasHastaVencimiento } from "@/lib/calc/intereses";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Alertas" };

interface Row {
  id: string;
  codigo: string;
  monto_prestado: number;
  fecha_vencimiento: string;
  estado: string;
  clientes: { nombre_completo: string; telefono: string | null } | null;
  articulos: { descripcion: string } | null;
}

export default async function AlertasPage() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const en7 = new Date();
  en7.setDate(en7.getDate() + 7);
  const en7Str = en7.toISOString().slice(0, 10);

  const [vencidosRes, proximosRes] = await Promise.all([
    supabase
      .from("prestamos")
      .select(
        "id, codigo, monto_prestado, fecha_vencimiento, estado, clientes(nombre_completo, telefono), articulos(descripcion)",
      )
      .in("estado", ["activo", "vencido_a_cobro"])
      .lt("fecha_vencimiento", hoy)
      .order("fecha_vencimiento", { ascending: true }),
    supabase
      .from("prestamos")
      .select(
        "id, codigo, monto_prestado, fecha_vencimiento, estado, clientes(nombre_completo, telefono), articulos(descripcion)",
      )
      .eq("estado", "activo")
      .gte("fecha_vencimiento", hoy)
      .lte("fecha_vencimiento", en7Str)
      .order("fecha_vencimiento", { ascending: true }),
  ]);

  const vencidos = (vencidosRes.data ?? []) as unknown as Row[];
  const proximos = (proximosRes.data ?? []) as unknown as Row[];

  const totalAlertas = vencidos.length + proximos.length;
  const totalVencido = vencidos.reduce(
    (s, r) => s + Number(r.monto_prestado ?? 0),
    0,
  );
  const totalProximo = proximos.reduce(
    (s, r) => s + Number(r.monto_prestado ?? 0),
    0,
  );

  const venceHoy = proximos.filter((p) => diasHastaVencimiento(p.fecha_vencimiento) === 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8 space-y-7">
      <FadeIn>
        <header>
          <p className="text-[13px] text-muted-foreground tracking-[-0.005em]">
            Centro de alertas
          </p>
          <h1 className="mt-1 flex items-center gap-2.5 text-[28px] md:text-[34px] font-[700] leading-[1.05] tracking-[-0.026em]">
            <Bell className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.8} />
            Alertas
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground tracking-[-0.005em]">
            {totalAlertas === 0
              ? "Todo al día — no hay vencimientos urgentes."
              : `${totalAlertas} ${
                  totalAlertas === 1 ? "préstamo necesita" : "préstamos necesitan"
                } atención.`}
          </p>
        </header>
      </FadeIn>

      {/* Resumen rápido — 2 mini cards */}
      {totalAlertas > 0 && (
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 gap-3">
            <ResumenCard
              tone="red"
              titulo="Vencidos"
              valor={vencidos.length}
              total={totalVencido}
              urgente={vencidos.length > 0}
            />
            <ResumenCard
              tone="orange"
              titulo="Próximos 7 días"
              valor={proximos.length}
              total={totalProximo}
              extra={
                venceHoy.length > 0
                  ? `${venceHoy.length} ${venceHoy.length === 1 ? "vence" : "vencen"} hoy`
                  : undefined
              }
            />
          </div>
        </FadeIn>
      )}

      {/* VENCIDOS */}
      {vencidos.length > 0 && (
        <FadeIn delay={0.1}>
          <ListSection
            title={
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                Vencidos
                <span className="text-muted-foreground/70 font-[510]">
                  · {vencidos.length}
                </span>
              </span>
            }
            description="Toca una fila para abrir el préstamo, o usa los botones para llamar / enviar WhatsApp."
          >
            <ListGroup>
              {vencidos.map((r) => (
                <FilaAlerta key={r.id} row={r} variant="vencido" />
              ))}
            </ListGroup>
          </ListSection>
        </FadeIn>
      )}

      {/* PRÓXIMOS */}
      {proximos.length > 0 && (
        <FadeIn delay={0.15}>
          <ListSection
            title={
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                Próximos 7 días
                <span className="text-muted-foreground/70 font-[510]">
                  · {proximos.length}
                </span>
              </span>
            }
          >
            <ListGroup>
              {proximos.map((r) => (
                <FilaAlerta key={r.id} row={r} variant="proximo" />
              ))}
            </ListGroup>
          </ListSection>
        </FadeIn>
      )}

      {/* Empty state */}
      {totalAlertas === 0 && (
        <FadeIn delay={0.1}>
          <div
            className={cn(
              "rounded-[14px] border border-border/60 bg-card shadow-card",
              "px-6 py-12 text-center",
            )}
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/[0.14]">
              <BellOff className="h-6 w-6 text-success" strokeWidth={1.5} />
            </div>
            <p className="text-[16px] font-[600] tracking-[-0.014em]">
              Todo al día
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground tracking-[-0.005em]">
              No hay préstamos vencidos ni próximos a vencer en los siguientes 7 días.
            </p>
            <Link
              href="/empenos"
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-[510] text-primary hover:underline"
            >
              Ver todos los empeños →
            </Link>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

// ---------------------------------------------------------------

function ResumenCard({
  tone,
  titulo,
  valor,
  total,
  urgente = false,
  extra,
}: {
  tone: "red" | "orange";
  titulo: string;
  valor: number;
  total: number;
  urgente?: boolean;
  extra?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[14px] bg-card",
        "border border-border/60 shadow-card",
        "p-4",
        urgente && "ring-1 ring-destructive/30",
      )}
    >
      {urgente && <span className="absolute inset-x-0 top-0 h-[2px] bg-destructive" />}
      <div className="text-[11.5px] font-[510] text-muted-foreground uppercase tracking-[0.04em]">
        {titulo}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[28px] font-[700] leading-tight tracking-[-0.022em] tabular-nums",
          tone === "red" && valor > 0 && "text-destructive",
        )}
      >
        {valor}
      </div>
      <div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
        {formatearDOP(total)}
      </div>
      {extra && (
        <div className="mt-1 text-[11px] font-[590] text-warning">{extra}</div>
      )}
    </div>
  );
}

function diasLabel(dias: number, variant: "vencido" | "proximo"): string {
  if (variant === "vencido") return `${Math.abs(dias)}d`;
  if (dias === 0) return "HOY";
  return `${dias}d`;
}

function FilaAlerta({
  row,
  variant,
}: {
  row: Row;
  variant: "vencido" | "proximo";
}) {
  const dias = diasHastaVencimiento(row.fecha_vencimiento);
  const cliente = row.clientes?.nombre_completo ?? "Cliente";
  const descripcion = row.articulos?.descripcion ?? "Artículo";
  const tel = row.clientes?.telefono ?? null;

  // Normalización del teléfono a E.164 dominicano (1 + 10 dígitos).
  const digitos = tel ? tel.replace(/\D/g, "").slice(-10) : null;
  const telE164 = digitos ? `1${digitos}` : null;

  const glyphColor = variant === "vencido" ? "red" : dias === 0 ? "orange" : "yellow";

  return (
    <div className="group flex items-stretch gap-0">
      {/* Tap area principal — abre el empeño */}
      <Link
        href={`/empenos/${row.id}`}
        className={cn(
          "flex-1 flex items-center gap-3 px-4 py-2.5",
          "transition-colors duration-100 active:bg-foreground/[0.04] dark:active:bg-foreground/[0.06]",
          "hover:bg-foreground/[0.025] dark:hover:bg-foreground/[0.04]",
          "no-tap-highlight press-ios",
        )}
      >
        <SettingsGlyph color={glyphColor} size={32}>
          <span className="text-[10.5px] font-[700] tracking-[-0.005em] tabular-nums">
            {diasLabel(dias, variant)}
          </span>
        </SettingsGlyph>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-[510] tracking-[-0.014em] truncate">
            {cliente}
          </div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground tracking-[-0.005em] truncate">
            <span className="truncate">{descripcion}</span>
            <span className="text-muted-foreground/50 shrink-0">·</span>
            <span
              className={cn(
                "shrink-0",
                variant === "vencido" && "text-destructive font-[510]",
              )}
            >
              {variant === "vencido"
                ? `vencido ${formatearFechaCorta(row.fecha_vencimiento)}`
                : `vence ${formatearFechaCorta(row.fecha_vencimiento)}`}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span
            className={cn(
              "text-[13.5px] font-[600] tabular-nums",
              variant === "vencido" && "text-destructive",
            )}
          >
            {formatearDOP(Number(row.monto_prestado))}
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.codigo}
          </Badge>
        </div>
      </Link>

      {/* Acciones rápidas — solo si hay teléfono */}
      {telE164 && (
        <div className="flex shrink-0 items-stretch border-l border-border/60">
          <a
            href={`https://wa.me/${telE164}?text=${encodeURIComponent(
              variant === "vencido"
                ? `Hola ${cliente.split(" ")[0]}, te escribo de Don Pepe — tu empeño ${row.codigo} venció el ${formatearFechaCorta(row.fecha_vencimiento)}. ¿Cuándo puedes pasar a renovar o liquidar?`
                : `Hola ${cliente.split(" ")[0]}, te escribo de Don Pepe — tu empeño ${row.codigo} vence el ${formatearFechaCorta(row.fecha_vencimiento)}. Recuerda pasar a renovar o pagar el interés.`,
            )}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp a ${cliente}`}
            className={cn(
              "flex items-center justify-center px-3.5",
              "text-[oklch(0.65_0.18_145)] hover:bg-success/[0.14]",
              "transition-colors no-tap-highlight",
            )}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
          </a>
          <a
            href={`tel:+${telE164}`}
            aria-label={`Llamar a ${cliente}`}
            className={cn(
              "flex items-center justify-center px-3.5 border-l border-border/60",
              "text-primary hover:bg-primary/[0.13]",
              "transition-colors no-tap-highlight",
            )}
          >
            <Phone className="h-4 w-4" strokeWidth={1.8} />
          </a>
        </div>
      )}
    </div>
  );
}
