"use client";

import { useState, useTransition } from "react";
import { Ban, CheckCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { NcfRango } from "@/lib/supabase/types";

import { cambiarEstadoRangoNcf } from "./actions";

export function RangoAcciones({ rango }: { rango: NcfRango }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  function anular() {
    if (motivo.trim().length < 3) {
      toast.error("Ingresa un motivo (al menos 3 caracteres).");
      return;
    }
    startTransition(async () => {
      const res = await cambiarEstadoRangoNcf({
        rango_id: rango.id,
        estado: "anulado",
        motivo: motivo.trim(),
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Rango anulado");
      setAbierto(false);
    });
  }

  function reactivar() {
    startTransition(async () => {
      const res = await cambiarEstadoRangoNcf({
        rango_id: rango.id,
        estado: "activo",
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Rango reactivado");
    });
  }

  if (rango.estado === "anulado") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={reactivar}
        disabled={pending}
        className="gap-1"
      >
        <CheckCircle className="h-4 w-4" />
        Reactivar
      </Button>
    );
  }

  if (rango.estado !== "activo") return null;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1">
            <Ban className="h-4 w-4" />
            Anular
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular rango NCF</DialogTitle>
          <DialogDescription>
            Deja de consumirse. Las facturas con NCF ya emitidos no se
            modifican. Puedes reactivar el rango luego si fue un error.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motivo-rango">Motivo</Label>
          <Textarea
            id="motivo-rango"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Ej: Rango reemplazado por nueva autorización"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setAbierto(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={anular}
            disabled={pending || motivo.trim().length < 3}
          >
            {pending ? "Anulando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
