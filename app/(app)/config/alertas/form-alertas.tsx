"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ConfigNegocio } from "@/lib/supabase/types";

import { actualizarAlertas } from "../actions";
import { SaveButton } from "../save-button";

// Sugerencias para un click rápido
const SUGERENCIAS_DIAS = [0, 1, 3, 7, 15];

export function FormAlertas({ config }: { config: ConfigNegocio }) {
  const [pending, start] = useTransition();

  // Normaliza la hora que viene de Postgres `time` (p.ej. "07:00:00") a "HH:MM"
  const horaInicial = useMemo(() => {
    const [h = "07", m = "00"] = (config.hora_alerta_whatsapp ?? "07:00").split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  }, [config.hora_alerta_whatsapp]);

  const [hora, setHora] = useState(horaInicial);
  const [dias, setDias] = useState<number[]>(() =>
    Array.isArray(config.dias_alerta_previa) ? [...config.dias_alerta_previa] : [],
  );

  function toggleDia(d: number) {
    setDias((prev) =>
      prev.includes(d)
        ? prev.filter((x) => x !== d)
        : [...prev, d].sort((a, b) => b - a),
    );
  }

  async function onSubmit(formData: FormData) {
    start(async () => {
      const res = await actualizarAlertas(formData);
      if (res?.error) toast.error(res.error);
      else toast.success("Alertas actualizadas");
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <input type="hidden" name="id" value={config.id} />

      {/* Hora */}
      <div className="space-y-2">
        <Label htmlFor="hora_alerta_whatsapp">Hora del resumen diario</Label>
        <div className="flex items-center gap-3">
          <div className="relative max-w-[160px]">
            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="hora_alerta_whatsapp"
              name="hora_alerta_whatsapp"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className="h-11 pl-9 tabular-nums"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Hora local RD. El cron real corre a las 12:00 UTC; cambia el campo si ajustas el cron.
          </p>
        </div>
      </div>

      {/* Días previos */}
      <div className="space-y-3">
        <div>
          <Label>Avisar cuando un empeño vence en…</Label>
          <p className="text-xs text-muted-foreground">
            Selecciona uno o varios. Se avisa cada uno de esos días antes del vencimiento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS_DIAS.map((d) => {
            const activo = dias.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDia(d)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {d === 0 ? "El día" : d === 1 ? "1 día antes" : `${d} días antes`}
              </button>
            );
          })}
        </div>

        {dias.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Seleccionados
            </span>
            {dias.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-medium"
              >
                {d === 0 ? "día del vencimiento" : `${d} día${d === 1 ? "" : "s"} antes`}
                <button
                  type="button"
                  onClick={() => toggleDia(d)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Quitar ${d}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input type="hidden" name="dias_alerta_previa" value={dias.join(",")} />
      </div>

      <div className="pt-1">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}
