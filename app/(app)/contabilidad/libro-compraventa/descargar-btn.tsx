"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { exportarLibroCsv } from "./actions";

/**
 * Botón que llama a la server action `exportarLibroCsv` y dispara
 * la descarga del CSV en el browser.
 */
export function DescargarLibroBtn({
  desde,
  hasta,
  children,
}: {
  desde?: string;
  hasta?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const { filename, contenido } = await exportarLibroCsv({ desde, hasta });
        const blob = new Blob([contenido], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Libro descargado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error descargando");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={pending}>
      {children}
    </Button>
  );
}
