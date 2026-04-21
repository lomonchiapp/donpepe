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
  MetodoPago,
  Pago,
  ReciboItem,
  TipoRecibo,
} from "@/lib/supabase/types";

const LABEL_TIPO: Record<TipoRecibo, string> = {
  pago_empeno: "Pago de empeño",
  saldo_empeno: "Saldo total de empeño",
  renovacion: "Renovación de empeño",
  venta_compraventa: "Venta de artículo",
  venta_joyeria: "Venta de joyería",
  compra_oro: "Compra de oro",
  otro: "Otro",
};

interface ReciboRow {
  id: string;
  codigo: string;
  pago_id: string | null;
  tipo: TipoRecibo;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_cedula: string | null;
  cliente_telefono: string | null;
  concepto: string;
  items: ReciboItem[];
  subtotal: number;
  total: number;
  metodo: MetodoPago;
  factura_id: string | null;
  emitido_at: string;
  anulado_at: string | null;
  anulado_motivo: string | null;
  pagos: Pago | null;
  facturas: {
    id: string;
    codigo_interno: string;
    ncf: string | null;
    total: number;
    estado: EstadoFactura;
  } | null;
}

export default async function ReciboDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("recibos")
    .select(
      "*, pagos(*), facturas(id, codigo_interno, ncf, total, estado)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const recibo = data as unknown as ReciboRow;
  const pago = recibo.pagos;

  const origenHref =
    pago?.prestamo_id != null
      ? `/empenos/${pago.prestamo_id}`
      : pago?.venta_id != null
        ? "/ventas"
        : pago?.compra_oro_id != null
          ? "/oro"
          : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/recibos"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
          >
            <ArrowLeft className="h-4 w-4" />
            Recibos
          </Link>
          <Link
            href={`/print/recibo-pago/${recibo.id}`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1")}
            target="_blank"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ReceiptIcon className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-bold tracking-tight">
                    Recibo {recibo.codigo}
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  {LABEL_TIPO[recibo.tipo]} ·{" "}
                  {formatearFechaLarga(recibo.emitido_at)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className="capitalize">
                  {recibo.metodo}
                </Badge>
                {recibo.anulado_at && (
                  <Badge variant="destructive">Anulado</Badge>
                )}
              </div>
            </div>

            {recibo.anulado_at && recibo.anulado_motivo && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                Motivo de anulación: {recibo.anulado_motivo}
              </div>
            )}

            <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Cliente
                </p>
                <p className="text-sm font-semibold">{recibo.cliente_nombre}</p>
                {recibo.cliente_cedula && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {recibo.cliente_cedula}
                  </p>
                )}
                {recibo.cliente_telefono && (
                  <p className="text-xs text-muted-foreground">
                    {recibo.cliente_telefono}
                  </p>
                )}
                {recibo.cliente_id && (
                  <Link
                    href={`/clientes/${recibo.cliente_id}`}
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    Ver cliente →
                  </Link>
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Concepto
                </p>
                <p className="text-sm">{recibo.concepto}</p>
                {pago && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pago{" "}
                    <span className="font-mono">{pago.codigo}</span>
                    {origenHref ? (
                      <>
                        {" · "}
                        <Link
                          href={origenHref}
                          className="text-primary hover:underline"
                        >
                          Ver origen
                        </Link>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Detalle
              </p>
              <ul className="divide-y">
                {recibo.items.map((it, i) => {
                  const cantidad = Number(it.cantidad ?? 1);
                  const monto = Number(it.monto);
                  const totalLinea = cantidad * monto;
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{it.descripcion}</p>
                        {cantidad !== 1 && (
                          <p className="text-xs text-muted-foreground">
                            {cantidad} × {formatearDOP(monto)}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatearDOP(totalLinea)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t pt-3 text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold tabular-nums">
                {formatearDOP(Number(recibo.total))}
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
              {recibo.facturas ? (
                <>
                  <Link
                    href={`/facturas/${recibo.facturas.id}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
                      recibo.facturas.estado === "anulada"
                        ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                        : "bg-primary/5 hover:bg-primary/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText
                        className={cn(
                          "h-4 w-4",
                          recibo.facturas.estado === "anulada"
                            ? "text-destructive"
                            : "text-primary",
                        )}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">
                            Factura {recibo.facturas.ncf ?? recibo.facturas.codigo_interno}
                          </p>
                          {recibo.facturas.estado === "anulada" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Anulada
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Total facturado {formatearDOP(Number(recibo.facturas.total))}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {recibo.facturas.estado === "anulada" && !recibo.anulado_at && (
                    <Link
                      href={`/facturas/nueva?recibo=${recibo.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full gap-2",
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Emitir nueva factura
                    </Link>
                  )}
                </>
              ) : !recibo.anulado_at ? (
                <Link
                  href={`/facturas/nueva?recibo=${recibo.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full gap-2",
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Emitir factura
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
