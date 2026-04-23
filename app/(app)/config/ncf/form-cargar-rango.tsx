"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIPO_COMPROBANTE_META,
  TIPOS_COMPROBANTE,
} from "@/lib/facturacion/tipos-comprobante";
import type { TipoComprobante } from "@/lib/supabase/types";

import { cargarRangoNcf } from "./actions";

export function FormCargarRango() {
  const [tipo, setTipo] = useState<TipoComprobante>("factura_consumo");
  const [serie, setSerie] = useState<"B" | "E">("E");

  // Serie E solo permite tipos con codigoE. Si el dueño cambia a E estando
  // parado en un tipo sin e-CF (p. ej. registro_especial), lo rebotamos al
  // primero compatible para evitar enviar un valor inválido al server.
  const tiposVisibles = useMemo(
    () =>
      TIPOS_COMPROBANTE.filter((t) =>
        serie === "E" ? TIPO_COMPROBANTE_META[t].codigoE != null : true,
      ),
    [serie],
  );

  function onSerieChange(v: "B" | "E") {
    setSerie(v);
    const compat = TIPOS_COMPROBANTE.filter((t) =>
      v === "E" ? TIPO_COMPROBANTE_META[t].codigoE != null : true,
    );
    if (!compat.includes(tipo)) {
      setTipo(compat[0] ?? "factura_consumo");
    }
  }
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [notas, setNotas] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit() {
    const d = Number(desde);
    const h = Number(hasta);
    if (!Number.isFinite(d) || !Number.isFinite(h) || d <= 0 || h <= 0) {
      toast.error("Ingresa rango válido (números positivos).");
      return;
    }
    if (h < d) {
      toast.error("El 'hasta' debe ser ≥ 'desde'.");
      return;
    }

    startTransition(async () => {
      const res = await cargarRangoNcf({
        tipo_comprobante: tipo,
        serie,
        secuencia_desde: d,
        secuencia_hasta: h,
        fecha_vencimiento: vencimiento || null,
        notas: notas.trim() || null,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Rango cargado");
      setDesde("");
      setHasta("");
      setVencimiento("");
      setNotas("");
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label className="mb-1.5 block text-xs">Tipo de comprobante</Label>
        <Select
          value={tipo}
          onValueChange={(v) => setTipo(v as TipoComprobante)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tiposVisibles.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_COMPROBANTE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs">Serie</Label>
        <Select value={serie} onValueChange={(v) => onSerieChange(v as "B" | "E")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="E">E (electrónico)</SelectItem>
            <SelectItem value="B">B (impreso)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="venc" className="mb-1.5 block text-xs">
          Fecha vencimiento (opcional)
        </Label>
        <Input
          id="venc"
          type="date"
          value={vencimiento}
          onChange={(e) => setVencimiento(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="desde" className="mb-1.5 block text-xs">
          Secuencia desde
        </Label>
        <Input
          id="desde"
          type="number"
          min="1"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          placeholder="Ej: 1"
          inputMode="numeric"
        />
      </div>

      <div>
        <Label htmlFor="hasta" className="mb-1.5 block text-xs">
          Secuencia hasta
        </Label>
        <Input
          id="hasta"
          type="number"
          min="1"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          placeholder="Ej: 1000"
          inputMode="numeric"
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="notas-ncf" className="mb-1.5 block text-xs">
          Notas (opcional)
        </Label>
        <Textarea
          id="notas-ncf"
          rows={2}
          maxLength={300}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: Autorización DGII X, recibido por correo"
        />
      </div>

      <div className="md:col-span-2 flex justify-end">
        <Button onClick={onSubmit} disabled={pending}>
          {pending ? "Cargando…" : "Cargar rango"}
        </Button>
      </div>
    </div>
  );
}
