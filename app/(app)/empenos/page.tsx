import Link from "next/link";
import { History, Plus } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BadgeEstado } from "@/components/empeno/badge-estado";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  diasHastaVencimiento,
  semaforoVencimiento,
} from "@/lib/calc/intereses";
import { formatearDOP, formatearFechaCorta, relativoDias } from "@/lib/format";
import type { EstadoPrestamo } from "@/lib/supabase/types";

export const metadata = { title: "Empeños" };

type Filtro = "activos" | "vence_pronto" | "vencidos" | "propiedad" | "todos";

interface Props {
  searchParams: Promise<{ filtro?: Filtro }>;
}

interface Row {
  id: string;
  codigo: string;
  monto_prestado: number;
  fecha_vencimiento: string;
  fecha_inicio: string;
  estado: EstadoPrestamo;
  clientes: { nombre_completo: string; cedula: string } | null;
  articulos: { descripcion: string; tipo: string; fotos_urls: string[] } | null;
}

async function fetchPrestamos(filtro: Filtro): Promise<Row[]> {
  const supabase = await createClient();
  let q = supabase
    .from("prestamos")
    .select(
      "id, codigo, monto_prestado, fecha_vencimiento, fecha_inicio, estado, clientes(nombre_completo, cedula), articulos(descripcion, tipo, fotos_urls)",
    )
    .order("fecha_vencimiento", { ascending: true });

  const hoy = new Date().toISOString().slice(0, 10);
  const en7 = new Date();
  en7.setDate(en7.getDate() + 7);
  const en7Str = en7.toISOString().slice(0, 10);

  switch (filtro) {
    case "activos":
      q = q.eq("estado", "activo");
      break;
    case "vence_pronto":
      q = q.eq("estado", "activo").gte("fecha_vencimiento", hoy).lte("fecha_vencimiento", en7Str);
      break;
    case "vencidos":
      q = q
        .in("estado", ["activo", "vencido_a_cobro"])
        .lt("fecha_vencimiento", hoy);
      break;
    case "propiedad":
      q = q.eq("estado", "propiedad_casa");
      break;
    case "todos":
      break;
  }

  const { data } = await q.limit(200);
  return (data ?? []) as unknown as Row[];
}

export default async function EmpenosPage({ searchParams }: Props) {
  const { filtro = "activos" } = await searchParams;
  const prestamos = await fetchPrestamos(filtro);

  const tabs: { value: Filtro; label: string }[] = [
    { value: "activos", label: "Activos" },
    { value: "vence_pronto", label: "Vence pronto" },
    { value: "vencidos", label: "Vencidos" },
    { value: "propiedad", label: "Propiedad casa" },
    { value: "todos", label: "Todos" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Empeños
            </h1>
            <p className="text-sm text-muted-foreground">
              {prestamos.length} {prestamos.length === 1 ? "ticket" : "tickets"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/empenos/registrar-existente"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
              )}
              title="Para empeños que ya venían corriendo en papel"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Registrar existente</span>
              <span className="sm:hidden">Existente</span>
            </Link>
            <Link
              href="/empenos/nuevo"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "gap-1.5",
              )}
            >
              <Plus className="h-4 w-4" /> Nuevo
            </Link>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <nav className="mb-6 flex w-full overflow-x-auto rounded-xl bg-muted/50 p-1">
          {tabs.map((t) => {
            const activo = t.value === filtro;
            return (
              <Link
                key={t.value}
                href={`/empenos?filtro=${t.value}`}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
                  activo
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </FadeIn>

      {prestamos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No hay empeños en esta vista.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {prestamos.map((p, i) => {
            const dias = diasHastaVencimiento(p.fecha_vencimiento);
            const sem = semaforoVencimiento(p.fecha_vencimiento);
            const cliente = p.clientes?.nombre_completo ?? "Cliente";
            const cedula = p.clientes?.cedula ?? "";
            const descripcion = p.articulos?.descripcion ?? "—";
            return (
              <FadeIn key={p.id} delay={i * 0.02}>
                <Link href={`/empenos/${p.id}`}>
                  <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex items-start gap-4 py-4">
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold",
                          sem === "vencido" && "bg-destructive/15 text-destructive",
                          sem === "vence_hoy" && "bg-warning/25 text-warning-foreground",
                          sem === "vence_pronto" && "bg-accent/20 text-accent-foreground",
                          sem === "activo" && "bg-success/15 text-success",
                        )}
                      >
                        <span className="text-base">
                          {sem === "vencido" ? "!" : dias}
                        </span>
                        <span>
                          {sem === "vencido" ? "VCDO" : dias === 0 ? "HOY" : "DÍAS"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {p.codigo}
                          </p>
                          <BadgeEstado estado={p.estado} />
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold">{cliente}</p>
                        <p className="truncate text-xs text-muted-foreground font-mono">
                          {cedula}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {descripcion}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-base font-bold tabular-nums">
                            {formatearDOP(Number(p.monto_prestado))}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Vence {formatearFechaCorta(p.fecha_vencimiento)} ·{" "}
                            {relativoDias(dias)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </FadeIn>
            );
          })}
        </ul>
      )}
    </div>
  );
}
