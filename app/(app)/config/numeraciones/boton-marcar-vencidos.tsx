"use client";

import { useTransition } from "react";
import { CalendarX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { marcarRangosVencidos } from "./actions";

/**
 * Dispara `marcar_rangos_ncf_vencidos()` en Postgres. El cron diario
 * también lo hace, pero el dueño puede querer forzarlo tras cargar un
 * rango nuevo o después de que expire uno.
 */
export function BotonMarcarVencidos() {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await marcarRangosVencidos();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const n = "count" in res ? res.count : 0;
      if (n === 0) {
        toast.success("No hay rangos para marcar como vencidos.");
      } else if (n === 1) {
        toast.success("1 rango marcado como vencido.");
      } else {
        toast.success(`${n} rangos marcados como vencidos.`);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="gap-1.5"
    >
      <CalendarX className="h-4 w-4" />
      {pending ? "Revisando…" : "Marcar vencidos"}
    </Button>
  );
}
