import Link from "next/link";
import { FileText, Receipt } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TipoRecibo } from "@/lib/supabase/types";

export const metadata = { title: "Recibos" };

const FILTROS: Array<{ key: "todos" | TipoRecibo; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "pago_empeno", label: "Pago empeño" },
  { key: "saldo_empeno", label: "Saldo empeño" },
  { key: "renovacion", label: "Renovación" },
  { key: "venta_compraventa", label: "Venta" },
  { key: "venta_joyeria", label: "Joyería" },
  { key: "compra_oro", label: "Compra oro" },
];

const LABEL_TIPO: Record<TipoRecibo, string> = {
  pago_empeno: "Pago empeño",
  saldo_empeno: "Saldo empeño",
  renovacion: "Renovación",
  venta_compraventa: "Venta",
  venta_joyeria: "Joyería",
  compra_oro: "Compra oro",
  otro: "Otro",
};

interface ReciboRow {
  id: string;
  codigo: string;
  tipo: TipoRecibo;
  cliente_nombre: string;
  concepto: string;
  total: number;
  metodo: string;
  emitido_at: string;
  anulado_at: string | null;
  factura_id: string | null;
  pagos: { codigo: string } | null;
  facturas: { codigo_interno: string; ncf: string | null } | null;
}

export default async function RecibosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroRaw } = await searchParams;
  const filtroActivo = (FILTROS.find((f) => f.key === filtroRaw)?.key ??
    "todos") as (typeof FILTROS)[number]["key"];

  const supabase = await createClient();

  let query = supabase
    .from("recibos")
    .select(
      "id, codigo, tipo, cliente_nombre, concepto, total, metodo, emitido_at, anulado_at, factura_id, pagos(codigo), facturas(codigo_interno, ncf)",
    )
    .order("emitido_at", { ascending: false })
    .limit(100);

  if (filtroActivo !== "todos") {
    query = query.eq("tipo", filtroActivo);
  }

  const { data } = await query;
  const recibos = (data ?? []) as unknown as ReciboRow[];

  const total = recibos
    .filter((r) => !r.anulado_at)
    .reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Receipt className="h-7 w-7" /> Recibos
          </h1>
          <p className="text-sm text-muted-foreground">
            {recibos.length} recibos · Total válido {formatearDOP(total)}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <nav className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {FILTROS.map((f) => {
            const activo = f.key === filtroActivo;
            return (
              <Link
                key={f.key}
                href={
                  f.key === "todos" ? "/recibos" : `/recibos?filtro=${f.key}`
                }
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
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

      {recibos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No hay recibos para este filtro.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {recibos.map((r, i) => (
            <FadeIn key={r.id} delay={Math.min(i, 10) * 0.02}>
              <Link href={`/recibos/${r.id}`} className="block">
                <Card
                  className={cn(
                    "transition-all hover:-translate-y-0.5 hover:shadow-md",
                    r.anulado_at && "opacity-60",
                  )}
                >
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.codigo}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {LABEL_TIPO[r.tipo]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px]"
                        >
                          {r.metodo}
                        </Badge>
                        {r.facturas && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-primary/40 bg-primary/10 text-primary text-[10px]"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            {r.facturas.ncf ?? r.facturas.codigo_interno}
                          </Badge>
                        )}
                        {r.anulado_at && (
                          <Badge variant="destructive" className="text-[10px]">
                            Anulado
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold">
                        {r.cliente_nombre}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.concepto}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {formatearDOP(Number(r.total))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatearFechaCorta(r.emitido_at)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
