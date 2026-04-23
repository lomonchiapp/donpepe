"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Filtro de rango de fechas del libro de compraventa.
 * Actualiza los searchParams para re-renderizar el server component.
 */
export function FiltroRango({
  desdeInicial,
  hastaInicial,
}: {
  desdeInicial: string;
  hastaInicial: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [pending, startTransition] = useTransition();

  function aplicar() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("desde", desde);
    sp.set("hasta", hasta);
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={desde}
        onChange={(e) => setDesde(e.target.value)}
        className="h-9 w-36"
        aria-label="Desde"
      />
      <span className="text-xs text-muted-foreground">→</span>
      <Input
        type="date"
        value={hasta}
        onChange={(e) => setHasta(e.target.value)}
        className="h-9 w-36"
        aria-label="Hasta"
      />
      <Button size="sm" onClick={aplicar} disabled={pending} variant="secondary">
        Filtrar
      </Button>
    </div>
  );
}
