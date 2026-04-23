import { AlertTriangle, FileStack } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearFechaCorta } from "@/lib/format";
import { TIPO_COMPROBANTE_META } from "@/lib/facturacion/tipos-comprobante";
import type { NcfRango } from "@/lib/supabase/types";

import { Section } from "../section";
import { BotonMarcarVencidos } from "../numeraciones/boton-marcar-vencidos";
import { FormCargarRango } from "./form-cargar-rango";
import { RangoAcciones } from "./rango-acciones";

export const metadata = { title: "Rangos NCF — Configuración" };

const UMBRAL_DIAS_ALERTA = 30;
const UMBRAL_PCT_ALERTA = 80;

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha + "T00:00:00");
  return Math.floor(
    (objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );
}

const TONO_ESTADO = {
  activo: "bg-success/15 text-success",
  agotado: "bg-warning/20 text-warning-foreground",
  vencido: "bg-destructive/15 text-destructive",
  anulado: "bg-muted text-muted-foreground line-through",
} as const;

export default async function ConfigNcfPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ncf_rangos")
    .select("*")
    .order("created_at", { ascending: false });
  const rangos = (data ?? []) as NcfRango[];

  // Alertas: rangos activos con <30 días para vencer o ≥80% consumidos.
  const alertas = rangos.filter((r) => {
    if (r.estado !== "activo") return false;
    const dias = diasHasta(r.fecha_vencimiento);
    if (dias !== null && dias <= UMBRAL_DIAS_ALERTA) return true;
    const total = r.secuencia_hasta - r.secuencia_desde + 1;
    const usados = r.secuencia_actual - r.secuencia_desde;
    const pct = total > 0 ? (usados / total) * 100 : 0;
    return pct >= UMBRAL_PCT_ALERTA;
  });

  return (
    <div className="space-y-6">
      {alertas.length > 0 && (
        <FadeIn>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  {alertas.length === 1
                    ? "1 rango requiere atención"
                    : `${alertas.length} rangos requieren atención`}
                </p>
                <ul className="space-y-0.5 text-xs text-destructive/90">
                  {alertas.map((r) => {
                    const dias = diasHasta(r.fecha_vencimiento);
                    const total = r.secuencia_hasta - r.secuencia_desde + 1;
                    const usados = r.secuencia_actual - r.secuencia_desde;
                    const pct = total > 0 ? Math.round((usados / total) * 100) : 0;
                    return (
                      <li key={r.id}>
                        <span className="font-medium">
                          {TIPO_COMPROBANTE_META[r.tipo_comprobante].label}
                        </span>{" "}
                        · serie {r.serie} · {pct}% usado
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
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div className="flex justify-end">
        <BotonMarcarVencidos />
      </div>

      <Section
        icon={<FileStack className="h-5 w-5" />}
        titulo="Cargar nuevo rango NCF"
        descripcion="Ingresa aquí los rangos autorizados por la DGII. Al emitir facturas se consume el rango activo del tipo correspondiente."
      >
        <FormCargarRango />
      </Section>

      <FadeIn delay={0.1}>
        <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Rangos cargados
        </h2>
        {rangos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No hay rangos cargados aún.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {rangos.map((r) => {
              const total = r.secuencia_hasta - r.secuencia_desde + 1;
              const usados = r.secuencia_actual - r.secuencia_desde;
              const disponibles = total - usados;
              const pct = Math.min(
                100,
                Math.round((usados / Math.max(total, 1)) * 100),
              );
              return (
                <Card key={r.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                            TONO_ESTADO[r.estado],
                          )}
                        >
                          {r.estado}
                        </span>
                        <span className="text-xs font-medium">
                          {TIPO_COMPROBANTE_META[r.tipo_comprobante].label}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          serie {r.serie}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-sm">
                        {r.secuencia_desde.toString().padStart(8, "0")} —{" "}
                        {r.secuencia_hasta.toString().padStart(8, "0")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <span>
                          {disponibles.toLocaleString()} disponibles de{" "}
                          {total.toLocaleString()}
                        </span>
                        <span>Próx: {r.secuencia_actual.toLocaleString()}</span>
                        {r.fecha_vencimiento && (
                          <span>
                            Vence {formatearFechaCorta(r.fecha_vencimiento)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            pct >= 90
                              ? "bg-destructive"
                              : pct >= 70
                              ? "bg-warning"
                              : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {r.notas && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {r.notas}
                        </p>
                      )}
                    </div>
                    <RangoAcciones rango={r} />
                  </CardContent>
                </Card>
              );
            })}
          </ul>
        )}
      </FadeIn>
    </div>
  );
}
