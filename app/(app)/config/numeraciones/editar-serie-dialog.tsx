"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { NumeracionSerie } from "@/lib/supabase/types";

import { actualizarSerieNumeracion } from "./actions";

/**
 * Dialog para editar una serie interna. Deliberadamente NO expone
 * `contador` ni `año_actual` — ver `actions.ts` para el razonamiento.
 *
 * La preview del formato se calcula del lado del cliente para dar feedback
 * inmediato; la autoridad final la tiene `siguiente_numero()` en Postgres.
 */
export function EditarSerieDialog({ serie }: { serie: NumeracionSerie }) {
  const [abierto, setAbierto] = useState(false);
  const [etiqueta, setEtiqueta] = useState(serie.etiqueta);
  const [prefijo, setPrefijo] = useState(serie.prefijo);
  const [ancho, setAncho] = useState<number>(serie.ancho_secuencia);
  const [formato, setFormato] = useState(serie.formato);
  const [resetAnual, setResetAnual] = useState(serie.reset_anual);
  const [activa, setActiva] = useState(serie.activa);
  const [descripcion, setDescripcion] = useState(serie.descripcion ?? "");
  const [pending, startTransition] = useTransition();

  function previsualizar(): string {
    const año = new Date().getFullYear();
    const siguiente = serie.contador + 1;
    const numStr = String(siguiente).padStart(Math.max(ancho, 1), "0");
    return formato
      .replace(/\{prefijo\}/g, prefijo)
      .replace(/\{año\}/g, String(año))
      .replace(/\{YYYY\}/g, String(año))
      .replace(/\{numero\}/g, numStr)
      .replace(/\{NNNNN\}/g, numStr);
  }

  function onGuardar() {
    if (!/\{numero\}|\{NNNNN\}/.test(formato)) {
      toast.error("El formato debe incluir {numero} o {NNNNN}.");
      return;
    }
    startTransition(async () => {
      const res = await actualizarSerieNumeracion({
        id: serie.id,
        etiqueta: etiqueta.trim(),
        prefijo: prefijo.trim().toUpperCase(),
        ancho_secuencia: ancho,
        formato: formato.trim(),
        reset_anual: resetAnual,
        activa,
        descripcion: descripcion.trim() || null,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Serie actualizada.");
      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar serie — {serie.etiqueta}</DialogTitle>
          <DialogDescription>
            El contador ({serie.contador.toLocaleString()}) y el año (
            {serie.año_actual}) los maneja la base automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="etiqueta">Nombre visible</Label>
            <Input
              id="etiqueta"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prefijo">Prefijo</Label>
              <Input
                id="prefijo"
                value={prefijo}
                onChange={(e) =>
                  setPrefijo(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                  )
                }
                maxLength={10}
                placeholder="Ej: DP"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ancho">Ancho secuencia</Label>
              <Input
                id="ancho"
                type="number"
                min={3}
                max={10}
                value={ancho}
                onChange={(e) => setAncho(Number(e.target.value) || 5)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="formato">Formato</Label>
            <Input
              id="formato"
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              className="font-mono"
              placeholder="{prefijo}-{año}-{numero}"
            />
            <p className="text-[11px] text-muted-foreground">
              Placeholders: <code>{"{prefijo}"}</code>,{" "}
              <code>{"{año}"}</code> o <code>{"{YYYY}"}</code>,{" "}
              <code>{"{numero}"}</code> o <code>{"{NNNNN}"}</code>.
            </p>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
              {previsualizar()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>
                Reset anual
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Contador vuelve a 1 cada año fiscal.
                </span>
              </span>
              <Switch checked={resetAnual} onCheckedChange={setResetAnual} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>
                Activa
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Si se desactiva, no se generan códigos nuevos.
                </span>
              </span>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setAbierto(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
