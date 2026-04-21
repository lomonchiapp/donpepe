"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfigNegocio } from "@/lib/supabase/types";

import { actualizarEmpenos } from "../actions";
import { SaveButton } from "../save-button";

export function FormEmpenos({ config }: { config: ConfigNegocio }) {
  const [pending, start] = useTransition();

  async function onSubmit(formData: FormData) {
    start(async () => {
      const res = await actualizarEmpenos(formData);
      if (res?.error) toast.error(res.error);
      else toast.success("Parámetros de empeños actualizados");
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={config.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPorcentaje
          label="Tasa de interés mensual"
          name="tasa_interes_default"
          defaultValue={config.tasa_interes_default}
          hint="Porcentaje que se cobra por cada mes del préstamo."
        />
        <CampoNumero
          label="Plazo por defecto"
          name="plazo_meses_default"
          defaultValue={config.plazo_meses_default}
          suffix="meses"
          min={1}
          max={12}
        />
        <CampoPorcentaje
          label="% del préstamo sobre la tasación"
          name="porcentaje_prestamo_default"
          defaultValue={config.porcentaje_prestamo_default}
          hint="Si el oro vale $10,000 y el % es 60%, se presta $6,000."
        />
        <CampoNumero
          label="Días de gracia tras vencimiento"
          name="dias_gracia_vencimiento"
          defaultValue={config.dias_gracia_vencimiento}
          suffix="días"
          min={0}
          max={30}
          hint="Tiempo extra antes de que el artículo pase a propiedad de la casa."
        />
      </div>

      <div className="pt-1">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

/**
 * Input de porcentaje que muestra % al usuario pero guarda decimal (0-1)
 * en el FormData (vía hidden field).
 */
function CampoPorcentaje({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  hint?: string;
}) {
  const [pct, setPct] = useState(() => Math.round(defaultValue * 10000) / 100);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 pr-8 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          %
        </span>
        <input
          type="hidden"
          name={name}
          value={(pct / 100).toFixed(4)}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CampoNumero({
  label,
  name,
  defaultValue,
  suffix,
  min,
  max,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  suffix?: string;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="1"
          min={min}
          max={max}
          name={name}
          defaultValue={String(defaultValue)}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 pr-14 tabular-nums"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
