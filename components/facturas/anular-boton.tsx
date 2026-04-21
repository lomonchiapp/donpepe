"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { anularFactura } from "@/app/(app)/facturas/actions";

interface Props {
  facturaId: string;
  numero: string;
}

export function AnularFacturaBoton({ facturaId, numero }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAnular() {
    if (motivo.trim().length < 3) {
      toast.error("Ingresa un motivo (al menos 3 caracteres).");
      return;
    }
    startTransition(async () => {
      const res = await anularFactura({
        factura_id: facturaId,
        motivo: motivo.trim(),
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Factura ${numero} anulada`);
      setAbierto(false);
    });
  }

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
          <DialogTitle>Anular factura {numero}</DialogTitle>
          <DialogDescription>
            La factura queda marcada como anulada pero se conserva en el libro
            de ventas (requisito DGII). El NCF no se reutiliza.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motivo-anular">Motivo</Label>
          <Textarea
            id="motivo-anular"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ej: Error en RNC del receptor"
            maxLength={500}
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
            onClick={handleAnular}
            disabled={pending || motivo.trim().length < 3}
          >
            {pending ? "Anulando…" : "Confirmar anulación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
