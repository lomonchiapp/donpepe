"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { eliminarGasto } from "./actions";

export function BotonEliminarGasto({
  id,
  concepto,
}: {
  id: string;
  concepto: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`¿Eliminar gasto "${concepto}"?`)) return;
    startTransition(async () => {
      const res = await eliminarGasto(id);
      if (res.error) toast.error(res.error);
      else toast.success("Gasto eliminado");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label="Eliminar gasto"
      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
