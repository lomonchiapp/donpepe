import Link from "next/link";
import { FileText } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EstadoFactura, TipoComprobante } from "@/lib/supabase/types";

export const metadata = { title: "Facturas" };

const LABEL_TIPO: Record<TipoComprobante, string> = {
  factura_credito_fiscal: "Crédito fiscal",
  factura_consumo: "Consumo",
  nota_debito: "Nota débito",
  nota_credito: "Nota crédito",
  compra: "Compra",
  regimen_especial: "Régimen especial",
  gubernamental: "Gubernamental",
};

const TONO_ESTADO: Record<EstadoFactura, string> = {
  borrador: "bg-muted text-muted-foreground",
  emitida: "bg-primary/15 text-primary",
  firmada: "bg-primary/15 text-primary",
  aceptada: "bg-success/15 text-success",
  rechazada: "bg-destructive/15 text-destructive",
  anulada: "bg-destructive/15 text-destructive line-through",
  fallida: "bg-destructive/15 text-destructive",
};

const FILTROS: Array<{ key: "todos" | EstadoFactura; label: string }> = [
  { key: "todos", label: "Todas" },
  { key: "borrador", label: "Borrador" },
  { key: "emitida", label: "Emitidas" },
  { key: "anulada", label: "Anuladas" },
];

interface FacturaRow {
  id: string;
  codigo_interno: string;
  ncf: string | null;
  tipo_comprobante: TipoComprobante;
  estado: EstadoFactura;
  nombre_receptor: string;
  rnc_receptor: string | null;
  total: number;
  itbis_monto: number;
  fecha_emision: string;
  created_at: string;
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroRaw } = await searchParams;
  const filtroActivo = (FILTROS.find((f) => f.key === filtroRaw)?.key ??
    "todos") as (typeof FILTROS)[number]["key"];

  const supabase = await createClient();

  let query = supabase
    .from("facturas")
    .select(
      "id, codigo_interno, ncf, tipo_comprobante, estado, nombre_receptor, rnc_receptor, total, itbis_monto, fecha_emision, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filtroActivo !== "todos") {
    query = query.eq("estado", filtroActivo);
  }

  const { data } = await query;
  const facturas = (data ?? []) as FacturaRow[];

  const totalEmitidas = facturas
    .filter((f) => f.estado === "emitida" || f.estado === "aceptada")
    .reduce((s, f) => s + Number(f.total), 0);
  const totalItbis = facturas
    .filter((f) => f.estado === "emitida" || f.estado === "aceptada")
    .reduce((s, f) => s + Number(f.itbis_monto), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <FileText className="h-7 w-7" /> Facturas
          </h1>
          <p className="text-sm text-muted-foreground">
            {facturas.length} facturas · Válidas {formatearDOP(totalEmitidas)} ·
            ITBIS {formatearDOP(totalItbis)}
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
                  f.key === "todos"
                    ? "/facturas"
                    : `/facturas?filtro=${f.key}`
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

      {facturas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No hay facturas para este filtro.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {facturas.map((f, i) => (
            <FadeIn key={f.id} delay={Math.min(i, 10) * 0.02}>
              <Link href={`/facturas/${f.id}`} className="block">
                <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs">
                          {f.ncf ?? f.codigo_interno}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {LABEL_TIPO[f.tipo_comprobante]}
                        </Badge>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                            TONO_ESTADO[f.estado],
                          )}
                        >
                          {f.estado}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold">
                        {f.nombre_receptor}
                      </p>
                      {f.rnc_receptor && (
                        <p className="font-mono text-xs text-muted-foreground">
                          RNC {f.rnc_receptor}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {formatearDOP(Number(f.total))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ITBIS {formatearDOP(Number(f.itbis_monto))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatearFechaCorta(f.fecha_emision ?? f.created_at)}
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
