import Link from "next/link";
import { AlertTriangle, Hash, Info } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatearFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  NumeracionSerie,
  ResumenNumeracion,
} from "@/lib/supabase/types";

import { Section } from "../section";
import { BotonMarcarVencidos } from "./boton-marcar-vencidos";
import { EditarSerieDialog } from "./editar-serie-dialog";

export const metadata = { title: "Numeraciones — Configuración" };

/**
 * Panel maestro de numeraciones.
 *
 * Hay dos familias:
 *
 *   1. **Series internas** (`numeracion_series`) — empeño, venta, compra de
 *      oro, pago, recibo, factura interna. Cada una tiene prefijo, formato
 *      y reset anual editables por el dueño.
 *
 *   2. **Rangos NCF** (`ncf_rangos`) — comprobantes fiscales autorizados por
 *      DGII. La carga manual sigue viviendo en /config/ncf; aquí mostramos
 *      un resumen con alertas (vencimientos cercanos, porcentaje consumido).
 *
 * La vista `v_resumen_numeraciones` unifica ambas.
 */

const UMBRAL_DIAS_ALERTA = 30;

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha + "T00:00:00");
  return Math.floor(
    (objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default async function ConfigNumeracionesPage() {
  const supabase = await createClient();

  const [resumenRes, seriesRes] = await Promise.all([
    supabase
      .from("v_resumen_numeraciones")
      .select("*")
      .order("categoria", { ascending: true })
      .order("etiqueta", { ascending: true }),
    supabase
      .from("numeracion_series")
      .select("*")
      .order("etiqueta", { ascending: true }),
  ]);

  const resumen = (resumenRes.data ?? []) as ResumenNumeracion[];
  const series = (seriesRes.data ?? []) as NumeracionSerie[];

  const internas = resumen.filter((r) => r.categoria === "interna");
  const ncf = resumen.filter((r) => r.categoria === "ncf");

  // Alertas NCF: rangos activos con <30 días para vencer o con ≥80% usado.
  const alertas = ncf.filter((r) => {
    if (r.ncf_estado !== "activo") return false;
    const dias = diasHasta(r.proxima_expiracion);
    if (dias !== null && dias <= UMBRAL_DIAS_ALERTA) return true;
    // Cuando rango_disponible viene de un rango, "consumido" = total - disponible.
    // No tenemos total directo aquí, así que usamos rango_disponible como señal
    // relativa: si cae bajo 200 es alarma independientemente del tamaño.
    if (r.rango_disponible !== null && r.rango_disponible <= 200) return true;
    return false;
  });

  const seriesByScope = new Map(series.map((s) => [s.scope, s]));

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Gestiona los códigos internos (empeños, ventas, pagos…) y
              revisa el estado de tus rangos NCF.
            </p>
          </div>
          <BotonMarcarVencidos />
        </div>
      </FadeIn>

      {alertas.length > 0 && (
        <FadeIn delay={0.05}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  {alertas.length === 1
                    ? "1 rango NCF requiere atención"
                    : `${alertas.length} rangos NCF requieren atención`}
                </p>
                <ul className="space-y-0.5 text-xs text-destructive/90">
                  {alertas.map((a) => {
                    const dias = diasHasta(a.proxima_expiracion);
                    return (
                      <li key={a.scope}>
                        <span className="font-medium">{a.etiqueta}</span> ·{" "}
                        {a.rango_disponible ?? 0} disponibles
                        {dias !== null && (
                          <>
                            {" · "}
                            {dias < 0
                              ? `vencido hace ${Math.abs(dias)}d`
                              : dias === 0
                              ? "vence hoy"
                              : `vence en ${dias}d`}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href="/config/ncf"
                  className="mt-1 inline-block text-xs font-semibold text-destructive underline underline-offset-2"
                >
                  Cargar nuevos rangos →
                </Link>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <Section
        icon={<Hash className="h-5 w-5" />}
        titulo="Series internas"
        descripcion="Códigos que usa Don Pepe internamente (empeños, ventas, recibos, pagos...). El prefijo y el formato son editables; el contador lo gestiona la base de datos."
      >
        {internas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay series configuradas. Corre la migración 007.
          </p>
        ) : (
          <ul className="divide-y">
            {internas.map((r) => {
              const serie = seriesByScope.get(r.scope);
              return (
                <li
                  key={r.scope}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {r.etiqueta}
                      </span>
                      {!r.activa && (
                        <Badge variant="outline" className="text-[10px]">
                          inactiva
                        </Badge>
                      )}
                      {r.reset_anual && (
                        <Badge variant="outline" className="text-[10px]">
                          reset anual
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                      <span>
                        Próximo:{" "}
                        <span className="font-mono">
                          {ejemploCodigo(r)}
                        </span>
                      </span>
                      <span>
                        Último emitido:{" "}
                        <span className="tabular-nums">
                          {r.ultimo_numero.toLocaleString()}
                        </span>
                      </span>
                      {r.año_actual !== null && (
                        <span>Año: {r.año_actual}</span>
                      )}
                    </div>
                  </div>
                  {serie && <EditarSerieDialog serie={serie} />}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        icon={<Info className="h-5 w-5" />}
        titulo="Rangos NCF activos"
        descripcion="Comprobantes fiscales autorizados por DGII. La carga de rangos y su anulación se hacen en la pestaña “Rangos NCF”."
      >
        {ncf.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay rangos NCF cargados.{" "}
            <Link href="/config/ncf" className="underline">
              Cargar el primero
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y">
            {ncf.map((r) => {
              const dias = diasHasta(r.proxima_expiracion);
              const porVencer =
                dias !== null && dias <= UMBRAL_DIAS_ALERTA && dias >= 0;
              const vencido = dias !== null && dias < 0;
              return (
                <li
                  key={r.scope}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {r.etiqueta}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize",
                          r.ncf_estado === "activo" &&
                            "border-success/40 text-success",
                          r.ncf_estado === "vencido" &&
                            "border-destructive/40 text-destructive",
                        )}
                      >
                        {r.ncf_estado ?? "—"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                      <span>
                        Próximo:{" "}
                        <span className="font-mono">{r.prefijo}</span>
                      </span>
                      {r.rango_disponible !== null && (
                        <span>
                          Disponibles:{" "}
                          <span className="tabular-nums">
                            {r.rango_disponible.toLocaleString()}
                          </span>
                        </span>
                      )}
                      {r.proxima_expiracion && (
                        <span
                          className={cn(
                            vencido && "font-medium text-destructive",
                            porVencer && "font-medium text-warning-foreground",
                          )}
                        >
                          {vencido
                            ? `Vencido hace ${Math.abs(dias ?? 0)}d`
                            : `Vence ${formatearFechaCorta(r.proxima_expiracion)}`}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="text-center">
        <Link
          href="/config/ncf"
          className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
        >
          Administrar rangos NCF →
        </Link>
      </div>
    </div>
  );
}

/**
 * Renderiza un código de ejemplo "próximo a emitir" usando el formato de
 * la serie. Esto da al dueño una idea visual inmediata de cómo se verán
 * los nuevos códigos sin tener que generar uno real.
 */
function ejemploCodigo(r: ResumenNumeracion): string {
  if (!r.formato) return String(r.proximo_numero);
  const año = r.año_actual ?? new Date().getFullYear();
  const ancho = Math.max(
    String(r.proximo_numero).length,
    // Heurística: si el formato usa NNNNN contamos Ns.
    (r.formato.match(/N/g)?.length ?? 5),
  );
  const numStr = String(r.proximo_numero).padStart(ancho, "0");
  return r.formato
    .replace(/\{prefijo\}/g, r.prefijo)
    .replace(/\{año\}/g, String(año))
    .replace(/\{YYYY\}/g, String(año))
    .replace(/\{numero\}/g, numStr)
    .replace(/\{NNNNN\}/g, numStr);
}
