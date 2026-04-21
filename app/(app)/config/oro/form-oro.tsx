"use client";

import { useState, useTransition } from "react";
import { TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearDOP } from "@/lib/format";
import type { ConfigNegocio } from "@/lib/supabase/types";

import { actualizarOro } from "../actions";
import { SaveButton } from "../save-button";

export function FormOro({ config }: { config: ConfigNegocio }) {
  const [pending, start] = useTransition();
  const [margenPct, setMargenPct] = useState(
    () => Math.round(config.margen_compra_oro * 10000) / 100,
  );

  // Simulación con spot ficticio de 4,000 DOP/g 18K para dar intuición
  const spotEjemplo = 4000;
  const pagoEjemplo = spotEjemplo * (1 - margenPct / 100);

  async function onSubmit(formData: FormData) {
    start(async () => {
      const res = await actualizarOro(formData);
      if (res?.error) toast.error(res.error);
      else toast.success("Margen de compra actualizado");
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={config.id} />

      <div className="space-y-2">
        <Label htmlFor="margen_pct">Margen sobre el spot</Label>
        <div className="relative max-w-xs">
          <Input
            id="margen_pct"
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={margenPct}
            onChange={(e) => setMargenPct(Number(e.target.value))}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 pr-8 text-base tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            %
          </span>
          <input
            type="hidden"
            name="margen_compra_oro"
            value={(margenPct / 100).toFixed(4)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Cuánto menos del spot se paga al cliente. Ej: 25% significa pagar el 75% del precio spot.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5" />
          Ejemplo con spot de {formatearDOP(spotEjemplo)}/g
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {formatearDOP(pagoEjemplo)}
          </span>
          <span className="text-xs text-muted-foreground">por gramo</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ahorro por gramo: {formatearDOP(spotEjemplo - pagoEjemplo)}
        </p>
      </div>

      <div className="pt-1">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}
