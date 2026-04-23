import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Printer,
  User,
  Clock,
  Hash,
  Banknote,
} from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { BadgeEstado } from "@/components/empeno/badge-estado";
import { AccionesPago } from "@/components/empeno/acciones-pago";
import { BotonEliminarEmpeno } from "@/components/empeno/boton-eliminar";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  calcularDeuda,
  diasHastaVencimiento,
  semaforoVencimiento,
} from "@/lib/calc/intereses";
import {
  formatearDOP,
  formatearFechaCorta,
  formatearFechaLarga,
  relativoDias,
} from "@/lib/format";
import type { Articulo, Cliente, Pago, Prestamo } from "@/lib/supabase/types";

export default async function EmpenoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [prestRes, pagosRes] = await Promise.all([
    supabase
      .from("prestamos")
      .select("*, clientes(*), articulos(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("pagos")
      .select("*")
      .eq("prestamo_id", id)
      .order("fecha", { ascending: false }),
  ]);

  if (!prestRes.data) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prest = prestRes.data as any as Prestamo & {
    clientes: Cliente | null;
    articulos: Articulo | null;
  };
  const pagos = (pagosRes.data ?? []) as Pago[];

  const deuda = calcularDeuda({
    monto_prestado: Number(prest.monto_prestado),
    tasa_interes_mensual: Number(prest.tasa_interes_mensual),
    fecha_inicio: prest.fecha_inicio,
    pagos: pagos
      .filter(
        (p) =>
          p.tipo === "interes" ||
          p.tipo === "abono_capital" ||
          p.tipo === "saldo_total" ||
          p.tipo === "renovacion",
      )
      .map((p) => ({
        fecha: p.fecha,
        tipo: p.tipo as
          | "interes"
          | "abono_capital"
          | "saldo_total"
          | "renovacion",
        monto: Number(p.monto),
      })),
  });

  const interesMensual = Number(prest.monto_prestado) * Number(prest.tasa_interes_mensual);
  const dias = diasHastaVencimiento(prest.fecha_vencimiento);
  const sem = semaforoVencimiento(prest.fecha_vencimiento);
  const estadoFinal = prest.estado === "pagado" || prest.estado === "propiedad_casa";

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 md:px-6 md:py-6">
      <Link
        href="/empenos"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Empeños
      </Link>

      <FadeIn>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-mono font-bold tracking-tight md:text-2xl">
            {prest.codigo}
          </h1>
          <BadgeEstado estado={prest.estado} />
          <Link
            href={`/print/recibo/${prest.id}`}
            target="_blank"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "ml-auto gap-1.5",
            )}
          >
            <Printer className="h-4 w-4" /> Imprimir recibo
          </Link>
          <BotonEliminarEmpeno
            prestamo_id={prest.id}
            codigo={prest.codigo}
            totalPagos={pagos.length}
          />
        </div>
      </FadeIn>

      <div className="grid gap-4 md:grid-cols-5">
        <FadeIn delay={0.05} className="md:col-span-3 space-y-4">
          {/* Cliente + artículo */}
          <Card>
            <CardContent className="py-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {prest.clientes ? (
                  <Link
                    href={`/clientes/${prest.clientes.id}`}
                    className="font-semibold hover:underline"
                  >
                    {prest.clientes.nombre_completo}
                  </Link>
                ) : (
                  <span>—</span>
                )}
                {prest.clientes && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {prest.clientes.cedula}
                  </span>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Artículo
                </p>
                <p className="mt-1 text-sm">{prest.articulos?.descripcion}</p>
                {prest.articulos?.kilataje && prest.articulos.peso_gramos && (
                  <Badge variant="outline" className="mt-2">
                    {prest.articulos.kilataje}K · {prest.articulos.peso_gramos}g
                  </Badge>
                )}
                {prest.articulos?.valor_tasado != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tasado en{" "}
                    <span className="font-semibold text-foreground">
                      {formatearDOP(Number(prest.articulos.valor_tasado))}
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline de pagos */}
          <Card>
            <CardContent className="py-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Movimientos ({pagos.length})
              </h2>
              {pagos.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin pagos aún.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pagos.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {p.tipo.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatearFechaCorta(p.fecha)} · {p.metodo}
                        </p>
                      </div>
                      <span className="font-mono font-semibold">
                        {formatearDOP(Number(p.monto))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1} className="md:col-span-2 space-y-4">
          {/* Resumen financiero */}
          <Card
            className={cn(
              "overflow-hidden",
              sem === "vencido" && !estadoFinal && "ring-2 ring-destructive animate-pulse",
            )}
          >
            <div className="wine-gradient px-5 py-4 text-wine-foreground">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Debe al día de hoy
              </p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums">
                {formatearDOP(deuda.deuda_total)}
              </p>
              <p className="mt-1 text-xs opacity-80">
                Capital {formatearDOP(deuda.capital_pendiente)} + Intereses{" "}
                {formatearDOP(deuda.intereses_acumulados - deuda.intereses_pagados)}
              </p>
            </div>
            <CardContent className="space-y-2 py-4 text-sm">
              <Fila
                icon={<Banknote className="h-4 w-4" />}
                label="Monto prestado"
                valor={formatearDOP(Number(prest.monto_prestado))}
              />
              <Fila
                icon={<Clock className="h-4 w-4" />}
                label="Interés"
                valor={`${(Number(prest.tasa_interes_mensual) * 100).toFixed(0)}% mensual`}
              />
              <Fila
                icon={<Calendar className="h-4 w-4" />}
                label="Inicio"
                valor={formatearFechaCorta(prest.fecha_inicio)}
              />
              <Fila
                icon={<Calendar className="h-4 w-4" />}
                label="Vencimiento"
                valor={`${formatearFechaLarga(prest.fecha_vencimiento)} · ${relativoDias(dias)}`}
                destacar={sem === "vencido" || sem === "vence_hoy"}
              />
              <Fila
                icon={<Hash className="h-4 w-4" />}
                label="Plazo"
                valor={`${prest.plazo_meses} meses`}
              />

              {!estadoFinal && (
                <>
                  <Separator className="my-2" />
                  <AccionesPago
                    prestamo={prest}
                    interes_mensual_actual={interesMensual}
                    deuda_total={deuda.deuda_total}
                    deshabilitado={estadoFinal}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

function Fila({
  icon,
  label,
  valor,
  destacar,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  destacar?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("font-medium", destacar && "text-destructive")}>
        {valor}
      </span>
    </div>
  );
}
