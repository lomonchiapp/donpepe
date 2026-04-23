import Link from "next/link";
import { ArrowLeft, BookOpen, Download } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";

import { leerLibroCompraventa } from "./actions";
import { DescargarLibroBtn } from "./descargar-btn";
import { FiltroRango } from "./filtro-rango";

export const metadata = { title: "Libro de compraventa — Contabilidad" };

export default async function LibroCompraventaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const desde = sp.desde ?? primerDiaDelMes();
  const hasta = sp.hasta ?? hoy();

  const filas = await leerLibroCompraventa({ desde, hasta });
  const total = filas.reduce((s, f) => s + Number(f.valor), 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/contabilidad"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contabilidad
      </Link>

      <FadeIn>
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
              <BookOpen className="h-7 w-7" /> Libro de compraventa
            </h1>
            <p className="text-sm text-muted-foreground">
              Reemplaza la libreta física. Cada fila es una compra con todos
              los datos del cliente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiltroRango desdeInicial={desde} hastaInicial={hasta} />
            <DescargarLibroBtn desde={desde} hasta={hasta}>
              <Download className="mr-2 h-4 w-4" /> Excel/CSV
            </DescargarLibroBtn>
          </div>
        </div>
      </FadeIn>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          titulo="Compras de oro"
          valor={`${filas.filter((f) => f.origen === "compra_oro").length}`}
        />
        <Stat
          titulo="Gastos"
          valor={`${filas.filter((f) => f.origen === "gasto").length}`}
        />
        <Stat titulo="Total (DOP)" valor={formatearDOP(total)} />
        <Stat
          titulo="Rango"
          valor={`${formatearFechaCorta(desde)} — ${formatearFechaCorta(hasta)}`}
        />
      </section>

      <Card className="mt-6">
        <CardContent className="overflow-x-auto p-0">
          {filas.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No hay compras registradas en ese rango.
            </p>
          ) : (
            <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                  <Th>Tipo</Th>
                  <Th>Cédula/RNC</Th>
                  <Th>Fecha</Th>
                  <Th>Nombre</Th>
                  <Th>Edad</Th>
                  <Th>Nacionalidad</Th>
                  <Th>Oficio</Th>
                  <Th>Domicilio</Th>
                  <Th>Orden/NCF</Th>
                  <Th>Categoría</Th>
                  <Th>Efectos/Concepto</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={`${f.origen}-${f.registro_id}`} className="border-t">
                    <Td>
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          f.origen === "compra_oro"
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                            : "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                        }`}
                      >
                        {f.origen === "compra_oro" ? "Oro" : "Gasto"}
                      </span>
                    </Td>
                    <Td className="font-mono">{f.cedula || "—"}</Td>
                    <Td>{formatearFechaCorta(f.fecha)}</Td>
                    <Td className="font-medium">{f.nombre}</Td>
                    <Td>{f.edad ?? "—"}</Td>
                    <Td>{f.nacionalidad ?? "—"}</Td>
                    <Td>{f.oficio_profesion ?? "—"}</Td>
                    <Td className="max-w-xs truncate">{f.domicilio ?? "—"}</Td>
                    <Td className="font-mono">{f.orden_numero}</Td>
                    <Td>{f.categoria}</Td>
                    <Td className="max-w-sm truncate">{f.efectos}</Td>
                    <Td className="text-right tabular-nums font-semibold">
                      {formatearDOP(Number(f.valor))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Las columnas vacías (edad, color, nacionalidad, etc.) se completan
        desde la ficha del cliente. Abre el cliente y edítalo para rellenar
        los datos faltantes.
      </p>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap p-2 font-medium ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap p-2 ${className ?? ""}`}>{children}</td>;
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

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
