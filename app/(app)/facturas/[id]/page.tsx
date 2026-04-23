import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Printer, Receipt as ReceiptIcon } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaLarga } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  EstadoFactura,
  FacturaItem,
  TipoComprobante,
} from "@/lib/supabase/types";
import { AnularFacturaBoton } from "@/components/facturas/anular-boton";
import { TIPO_COMPROBANTE_META } from "@/lib/facturacion/tipos-comprobante";

const TONO_ESTADO: Record<EstadoFactura, string> = {
  borrador: "bg-muted text-muted-foreground",
  emitida: "bg-primary/15 text-primary",
  firmada: "bg-primary/15 text-primary",
  aceptada: "bg-success/15 text-success",
  rechazada: "bg-destructive/15 text-destructive",
  anulada: "bg-destructive/15 text-destructive",
  fallida: "bg-destructive/15 text-destructive",
};

interface FacturaRow {
  id: string;
  codigo_interno: string;
  ncf: string | null;
  tipo_comprobante: TipoComprobante;
  estado: EstadoFactura;
  rnc_emisor: string | null;
  razon_social_emisor: string | null;
  direccion_emisor: string | null;
  cliente_id: string | null;
  rnc_receptor: string | null;
  cedula_receptor: string | null;
  nombre_receptor: string;
  direccion_receptor: string | null;
  email_receptor: string | null;
  telefono_receptor: string | null;
  subtotal: number;
  descuento: number;
  base_itbis: number;
  base_exenta: number;
  itbis_monto: number;
  total: number;
  fecha_emision: string | null;
  anulada_at: string | null;
  anulada_motivo: string | null;
  notas: string | null;
  created_at: string;
  factura_items: FacturaItem[];
  recibos: { id: string; codigo: string } | null;
}

export default async function FacturaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("facturas")
    .select("*, factura_items(*), recibos!recibos_factura_id_fkey(id, codigo)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const f = data as unknown as FacturaRow;
  const items = [...(f.factura_items ?? [])].sort((a, b) => a.orden - b.orden);
  const puedeAnular =
    f.estado === "emitida" || f.estado === "borrador" || f.estado === "firmada";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/facturas"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Facturas
          </Link>
          <div className="flex gap-2">
            {puedeAnular && (
              <AnularFacturaBoton facturaId={f.id} numero={f.ncf ?? f.codigo_interno} />
            )}
            <Link
              href={`/print/factura/${f.id}`}
              target="_blank"
              className={cn(buttonVariants({ size: "sm" }), "gap-1")}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Link>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-bold tracking-tight">
                    {f.ncf ?? f.codigo_interno}
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  {TIPO_COMPROBANTE_META[f.tipo_comprobante].label}
                </p>
                {f.fecha_emision && (
                  <p className="text-xs text-muted-foreground">
                    Emitida el {formatearFechaLarga(f.fecha_emision)}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                  TONO_ESTADO[f.estado],
                )}
              >
                {f.estado}
              </span>
            </div>

            {f.estado === "anulada" && f.anulada_motivo && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                Motivo de anulación: {f.anulada_motivo}
              </div>
            )}

            {f.estado === "borrador" && !f.ncf && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                Borrador sin NCF asignado — probablemente no había rango activo.
                Cárgalo en{" "}
                <Link href="/config/ncf" className="underline">
                  Configuración → NCF
                </Link>{" "}
                y vuelve a reenviar.
              </div>
            )}

            <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Emisor
                </p>
                <p className="text-sm font-semibold">
                  {f.razon_social_emisor ?? "—"}
                </p>
                {f.rnc_emisor && (
                  <p className="font-mono text-xs text-muted-foreground">
                    RNC {f.rnc_emisor}
                  </p>
                )}
                {f.direccion_emisor && (
                  <p className="text-xs text-muted-foreground">
                    {f.direccion_emisor}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Receptor
                </p>
                <p className="text-sm font-semibold">{f.nombre_receptor}</p>
                {f.rnc_receptor && (
                  <p className="font-mono text-xs text-muted-foreground">
                    RNC {f.rnc_receptor}
                  </p>
                )}
                {f.cedula_receptor && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {f.cedula_receptor}
                  </p>
                )}
                {f.direccion_receptor && (
                  <p className="text-xs text-muted-foreground">
                    {f.direccion_receptor}
                  </p>
                )}
                {f.cliente_id && (
                  <Link
                    href={`/clientes/${f.cliente_id}`}
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    Ver cliente →
                  </Link>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Detalle
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-2 text-left font-semibold">
                        Descripción
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        Cant
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        P. unit (c/ITBIS)
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        Base
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        ITBIS
                      </th>
                      <th className="py-2 pl-2 text-right font-semibold">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b align-top">
                        <td className="py-2 pr-2">
                          <p>{it.descripcion}</p>
                          {!it.itbis_aplica && (
                            <Badge
                              variant="outline"
                              className="mt-0.5 text-[9px]"
                            >
                              Exento
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {Number(it.cantidad) % 1 === 0
                            ? it.cantidad
                            : Number(it.cantidad).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatearDOP(Number(it.precio_unitario_bruto))}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatearDOP(Number(it.subtotal))}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatearDOP(Number(it.itbis_monto))}
                        </td>
                        <td className="py-2 pl-2 text-right font-semibold tabular-nums">
                          {formatearDOP(Number(it.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t pt-4">
              <dl className="ml-auto max-w-xs space-y-1 text-sm">
                <Fila l="Base gravada" v={Number(f.base_itbis)} />
                {Number(f.base_exenta) > 0 && (
                  <Fila l="Base exenta" v={Number(f.base_exenta)} />
                )}
                <Fila l="ITBIS 18%" v={Number(f.itbis_monto)} />
                {Number(f.descuento) > 0 && (
                  <Fila l="Descuento" v={-Number(f.descuento)} />
                )}
                <div className="border-t pt-1" />
                <Fila l="Total" v={Number(f.total)} bold />
              </dl>
            </div>

            {f.recibos && (
              <div className="border-t pt-4">
                <Link
                  href={`/recibos/${f.recibos.id}`}
                  className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Recibo asociado
                    </p>
                    <p className="font-mono text-sm">{f.recibos.codigo}</p>
                  </div>
                </Link>
              </div>
            )}

            {f.notas && (
              <div className="border-t pt-4 text-sm">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Notas
                </p>
                <p>{f.notas}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function Fila({ l, v, bold }: { l: string; v: number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{l}</dt>
      <dd
        className={cn(
          "tabular-nums",
          bold ? "text-lg font-bold" : "font-medium",
        )}
      >
        {formatearDOP(v)}
      </dd>
    </div>
  );
}
