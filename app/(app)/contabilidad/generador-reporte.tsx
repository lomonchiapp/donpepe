"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Componente genérico para las páginas 606/607/608:
 * - Selector de periodo (YYYY-MM)
 * - Botones para generar TXT DGII y exportar CSV
 * - Los handlers reales los provee la página (server actions importadas
 *   en el wrapper que llama a este componente).
 */
export function GeneradorReporte({
  formato,
  periodoInicial,
  onGenerarTxt,
  onGenerarCsv,
}: {
  formato: "606" | "607" | "608";
  periodoInicial: string;
  onGenerarTxt: (
    periodo: string,
  ) => Promise<{ filename: string; contenido: string }>;
  onGenerarCsv: (
    periodo: string,
  ) => Promise<{ filename: string; contenido: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [pending, startTransition] = useTransition();

  function cambiarPeriodo() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("periodo", periodo);
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  }

  function descargar(contenido: string, filename: string, mime: string) {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleTxt() {
    startTransition(async () => {
      try {
        const { filename, contenido } = await onGenerarTxt(periodo);
        descargar(contenido, filename, "text/plain;charset=iso-8859-1");
        toast.success(`${formato} generado. Registro guardado.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error generando TXT");
      }
    });
  }

  function handleCsv() {
    startTransition(async () => {
      try {
        const { filename, contenido } = await onGenerarCsv(periodo);
        descargar(contenido, filename, "text/csv;charset=utf-8");
        toast.success("Excel/CSV descargado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error generando CSV");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="periodo">Periodo (YYYY-MM)</Label>
        <Input
          id="periodo"
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          onBlur={cambiarPeriodo}
          className="h-10 w-40"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleTxt} disabled={pending} size="sm">
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Generar TXT DGII
        </Button>
        <Button
          onClick={handleCsv}
          disabled={pending}
          size="sm"
          variant="secondary"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel/CSV
        </Button>
      </div>
    </div>
  );
}
