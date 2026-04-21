"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { eliminarEmpeno } from "@/app/(app)/empenos/actions";

interface Props {
  prestamo_id: string;
  codigo: string;
  /** Cantidad de pagos ya registrados; si >0 se avisa al usuario. */
  totalPagos: number;
}

/**
 * Botón con confirmación para eliminar un empeño completo
 * (préstamo + pagos + recibos + artículo).
 *
 * El server action se encarga de validar que no haya facturas fiscales
 * emitidas y de respetar RLS; acá sólo surfaceamos el error si aparece.
 */
export function BotonEliminarEmpeno({
  prestamo_id,
  codigo,
  totalPagos,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      try {
        const res = await eliminarEmpeno({ prestamo_id });
        // Si el server action redirigió, esta línea no corre.
        if (res && "error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Empeño ${codigo} eliminado`);
        setAbierto(false);
      } catch (err) {
        // `redirect()` en Next lanza NEXT_REDIRECT — lo dejamos propagar.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest?: string }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        toast.error(
          err instanceof Error ? err.message : "Error al eliminar el empeño",
        );
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm" className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar empeño {codigo}</DialogTitle>
          <DialogDescription>
            Se eliminarán el préstamo, su artículo, y
            {totalPagos > 0
              ? ` los ${totalPagos} pago${totalPagos === 1 ? "" : "s"} con sus recibos.`
              : " no hay pagos registrados."}
            {" "}Esta acción no se puede deshacer. Si existe una factura
            fiscal emitida para alguno de los pagos, la operación será
            rechazada.
          </DialogDescription>
        </DialogHeader>
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
            onClick={confirmar}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Sí, eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
