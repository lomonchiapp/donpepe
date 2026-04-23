import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { GeneradorReporte } from "../generador-reporte";
import { previewReporte608, generarTxt608, generarCsv608 } from "./actions";
import { TIPOS_ANULACION_608 } from "@/lib/dgii/formato-608";
import type { ReporteDgiiGenerado } from "@/lib/supabase/types";

export const metadata = { title: "608 · Anulados — DGII" };

export default async function Reporte608Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = sp.periodo ?? periodoActual();

  const preview = await previewReporte608(periodo);

  const supabase = await createClient();
  const { data: historial } = await supabase
    .from("reportes_dgii_generados")
    .select("*")
    .eq("formato", "608")
    .order("generado_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/contabilidad"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contabilidad
      </Link>

      <FadeIn>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <FileSpreadsheet className="h-7 w-7" /> Formato 608 — Anulados
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          NCF anulados en el periodo. El motivo se infiere desde el texto
          de la anulación; revisa la columna &quot;Tipo&quot; antes de enviar.
        </p>
      </FadeIn>

      <GeneradorReporte
        formato="608"
        periodoInicial={periodo}
        onGenerarTxt={generarTxt608}
        onGenerarCsv={generarCsv608}
      />

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat titulo="Anulados" valor={`${preview.cantidad}`} />
        <Stat titulo="Periodo" valor={periodo} />
      </section>

      <Card className="mt-6">
        <CardContent className="overflow-x-auto p-0">
          {preview.registros.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No hay NCF anulados en este periodo. Todo en orden.
            </p>
          ) : (
            <table className="w-full min-w-[600px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                  <th className="p-2">NCF</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {preview.registros.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-mono">{r.ncf}</td>
                    <td className="p-2">
                      {String(r.fechaComprobante).slice(0, 10)}
                    </td>
                    <td className="p-2 font-mono">{r.tipoAnulacion}</td>
                    <td className="p-2">
                      {TIPOS_ANULACION_608[r.tipoAnulacion]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Historial historial={(historial as ReporteDgiiGenerado[] | null) ?? []} />
    </div>
  );
}

function Stat({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-base font-semibold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}

function Historial({ historial }: { historial: ReporteDgiiGenerado[] }) {
  if (historial.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Historial — últimos generados
      </h2>
      <Card>
        <CardContent className="py-0">
          <ul className="divide-y text-sm">
            {historial.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2">
                <span>
                  {h.periodo} · {h.conteo_registros} anulados
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.generado_at).toLocaleString("es-DO")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
