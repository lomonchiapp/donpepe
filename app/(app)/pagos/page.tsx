import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Receipt, Wallet } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DireccionPago } from "@/lib/supabase/types";

export const metadata = { title: "Pagos" };

const FILTROS: Array<{ key: "todos" | DireccionPago; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "ingreso", label: "Ingresos" },
  { key: "egreso", label: "Egresos" },
];

interface PagoRow {
  id: string;
  codigo: string;
  direccion: DireccionPago;
  tipo: string;
  monto: number;
  metodo: string;
  concepto: string | null;
  fecha: string;
  created_at: string;
  anulado_at: string | null;
  prestamo_id: string | null;
  venta_id: string | null;
  compra_oro_id: string | null;
  clientes: { id: string; nombre_completo: string } | null;
  recibos: { id: string; codigo: string } | null;
  prestamos: { codigo: string } | null;
  ventas: { codigo: string } | null;
  compras_oro: { codigo: string } | null;
}

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroRaw } = await searchParams;
  const filtro = (FILTROS.find((f) => f.key === filtroRaw)?.key ??
    "todos") as (typeof FILTROS)[number]["key"];

  const supabase = await createClient();

  let query = supabase
    .from("pagos")
    .select(
      "id, codigo, direccion, tipo, monto, metodo, concepto, fecha, created_at, anulado_at, prestamo_id, venta_id, compra_oro_id, clientes(id, nombre_completo), recibos!recibos_pago_id_fkey(id, codigo), prestamos(codigo), ventas(codigo), compras_oro(codigo)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filtro === "ingreso" || filtro === "egreso") {
    query = query.eq("direccion", filtro);
  }

  const { data } = await query;
  const pagos = (data ?? []) as unknown as PagoRow[];

  const totalIngresos = pagos
    .filter((p) => p.direccion === "ingreso" && !p.anulado_at)
    .reduce((s, p) => s + Number(p.monto), 0);
  const totalEgresos = pagos
    .filter((p) => p.direccion === "egreso" && !p.anulado_at)
    .reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Wallet className="h-7 w-7" /> Pagos
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresos {formatearDOP(totalIngresos)} · Egresos{" "}
            {formatearDOP(totalEgresos)} · Neto{" "}
            {formatearDOP(totalIngresos - totalEgresos)}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <nav className="mb-4 flex gap-1 overflow-x-auto">
          {FILTROS.map((f) => {
            const activo = f.key === filtro;
            return (
              <Link
                key={f.key}
                href={f.key === "todos" ? "/pagos" : `/pagos?filtro=${f.key}`}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
      </FadeIn>

      {pagos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No hay pagos registrados para este filtro.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {pagos.map((p, i) => {
            const esIngreso = p.direccion === "ingreso";
            const origenHref =
              p.prestamo_id != null
                ? `/empenos/${p.prestamo_id}`
                : p.venta_id != null
                  ? `/ventas`
                  : p.compra_oro_id != null
                    ? `/oro`
                    : undefined;
            const origenCodigo =
              p.prestamos?.codigo ??
              p.ventas?.codigo ??
              p.compras_oro?.codigo ??
              null;
            const clienteNombre = p.clientes?.nombre_completo ?? null;

            return (
              <FadeIn key={p.id} delay={Math.min(i, 10) * 0.02}>
                <Card className={cn(p.anulado_at && "opacity-60")}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        esIngreso
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {esIngreso ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.codigo}
                        </span>
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px]"
                        >
                          {p.tipo.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px]"
                        >
                          {p.metodo}
                        </Badge>
                        {p.anulado_at && (
                          <Badge
                            variant="destructive"
                            className="text-[10px]"
                          >
                            Anulado
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold">
                        {p.concepto ?? "Sin concepto"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {clienteNombre ?? "—"}
                        {origenCodigo && (
                          <>
                            {" · "}
                            {origenHref ? (
                              <Link
                                href={origenHref}
                                className="font-mono hover:underline"
                              >
                                {origenCodigo}
                              </Link>
                            ) : (
                              <span className="font-mono">{origenCodigo}</span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          esIngreso ? "text-success" : "text-destructive",
                        )}
                      >
                        {esIngreso ? "+" : "−"}
                        {formatearDOP(Number(p.monto))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatearFechaCorta(p.created_at)}
                      </p>
                      {p.recibos && (
                        <Link
                          href={`/recibos/${p.recibos.id}`}
                          className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                        >
                          <Receipt className="h-3 w-3" />
                          {p.recibos.codigo}
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </ul>
      )}
    </div>
  );
}
