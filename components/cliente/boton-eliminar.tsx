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
import { eliminarCliente } from "@/app/(app)/clientes/actions";

interface Props {
  cliente_id: string;
  nombre: string;
  /** Cantidad de empeños del cliente. Si >0, el server action rechaza. */
  totalEmpenos: number;
  /** Cantidad de compras de oro. Si >0, el server action rechaza. */
  totalCompras: number;
}

/**
 * Botón con confirmación para eliminar un cliente.
 *
 * Reglas de negocio están en el server action `eliminarCliente`:
 *  - Bloquea si tiene empeños o compras de oro (FK `on delete restrict`).
 *  - Artículos/pagos/recibos/facturas se desvinculan automáticamente
 *    (`on delete set null` en el schema).
 */
export function BotonEliminarCliente({
  cliente_id,
  nombre,
  totalEmpenos,
  totalCompras,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  const tieneHistorial = totalEmpenos > 0 || totalCompras > 0;

  function confirmar() {
    startTransition(async () => {
      try {
        const res = await eliminarCliente({ cliente_id });
        if (res && "error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Cliente ${nombre} eliminado`);
        setAbierto(false);
      } catch (err) {
        // `redirect()` de Next lanza NEXT_REDIRECT — se deja propagar.
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
          err instanceof Error ? err.message : "Error al eliminar el cliente",
        );
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="lg" className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar cliente</DialogTitle>
          <DialogDescription>
            {tieneHistorial ? (
              <>
                <strong>{nombre}</strong> tiene{" "}
                {totalEmpenos > 0 && (
                  <>
                    {totalEmpenos} empeño{totalEmpenos === 1 ? "" : "s"}
                  </>
                )}
                {totalEmpenos > 0 && totalCompras > 0 && " y "}
                {totalCompras > 0 && (
                  <>
                    {totalCompras} compra{totalCompras === 1 ? "" : "s"} de oro
                  </>
                )}
                {" "}registrado{totalEmpenos + totalCompras === 1 ? "" : "s"}.
                No se puede eliminar hasta remover esos registros primero.
              </>
            ) : (
              <>
                Se eliminará al cliente <strong>{nombre}</strong>. Si tiene
                artículos, pagos, recibos o facturas históricas, estos
                sobreviven pero pierden la referencia al cliente. Esta acción
                no se puede deshacer.
              </>
            )}
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
            disabled={pending || tieneHistorial}
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
