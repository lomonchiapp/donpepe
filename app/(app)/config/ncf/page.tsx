import { FileStack } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearFechaCorta } from "@/lib/format";
import type { NcfRango } from "@/lib/supabase/types";

import { Section } from "../section";
import { FormCargarRango } from "./form-cargar-rango";
import { RangoAcciones } from "./rango-acciones";

export const metadata = { title: "Rangos NCF — Configuración" };

const LABEL_TIPO = {
  factura_credito_fiscal: "Crédito fiscal (01)",
  factura_consumo: "Consumo (02)",
  nota_debito: "Nota débito (03)",
  nota_credito: "Nota crédito (04)",
  compra: "Compra al público (11)",
  regimen_especial: "Régimen especial (14)",
  gubernamental: "Gubernamental (15)",
} as const;

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

  return (
    <div className="space-y-6">
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
                          {LABEL_TIPO[r.tipo_comprobante]}
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
