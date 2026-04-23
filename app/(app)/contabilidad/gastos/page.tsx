import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import {
  etiquetaFormaPago,
  etiquetaTipoGasto,
} from "@/lib/dgii/categorias";

import { FormGasto } from "./form-gasto";
import { listarGastos } from "./actions";
import { BotonEliminarGasto } from "./boton-eliminar";

export const metadata = { title: "Gastos operativos — Contabilidad" };

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const desde = sp.desde ?? primerDiaDelMes();
  const hasta = sp.hasta ?? hoy();

  const gastos = await listarGastos({ desde, hasta });
  const total = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const totalItbis = gastos.reduce((s, g) => s + Number(g.itbis_facturado ?? 0), 0);
  const conNcf = gastos.filter((g) => g.rnc_proveedor && g.ncf).length;
  const sinNcf = gastos.length - conNcf;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/contabilidad"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contabilidad
      </Link>

      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Receipt className="h-7 w-7" /> Gastos operativos
          </h1>
          <p className="text-sm text-muted-foreground">
            Registra cada gasto del negocio (alquiler, luz, sueldos,
            suministros…). Los gastos con RNC y NCF entran automáticamente
            al Formato 606 de la DGII. Los demás quedan solo en la
            contabilidad interna.
          </p>
        </div>
      </FadeIn>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat titulo="Registros" valor={`${gastos.length}`} />
        <Stat titulo="Total gastado" valor={formatearDOP(total)} />
        <Stat
          titulo="ITBIS deducible"
          valor={formatearDOP(totalItbis)}
          sub={`${conNcf} con NCF`}
        />
        <Stat
          titulo="Sin NCF"
          valor={`${sinNcf}`}
          sub="no entran al 606"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <FadeIn>
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Nuevo gasto
              </h2>
              <FormGasto />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {gastos.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No hay gastos registrados en este rango.
                </p>
              ) : (
                <table className="w-full min-w-[700px] text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                      <Th>Fecha</Th>
                      <Th>Concepto</Th>
                      <Th>Categoría</Th>
                      <Th>Proveedor</Th>
                      <Th>NCF</Th>
                      <Th className="text-right">Monto</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map((g) => (
                      <tr key={g.id} className="border-t align-top">
                        <Td>{formatearFechaCorta(g.fecha)}</Td>
                        <Td>
                          <div className="font-medium">{g.concepto}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {etiquetaFormaPago(g.forma_pago)}
                          </div>
                        </Td>
                        <Td>
                          <span className="font-mono text-[10px]">
                            {g.categoria}
                          </span>
                          <div className="text-[10px] text-muted-foreground">
                            {etiquetaTipoGasto(g.categoria)}
                          </div>
                        </Td>
                        <Td>
                          {g.nombre_proveedor ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {g.rnc_proveedor && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {g.rnc_proveedor}
                            </div>
                          )}
                        </Td>
                        <Td className="font-mono">
                          {g.ncf ?? <span className="text-muted-foreground">—</span>}
                        </Td>
                        <Td className="text-right tabular-nums font-semibold">
                          {formatearDOP(Number(g.monto))}
                          {Number(g.itbis_facturado) > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              +ITBIS {formatearDOP(Number(g.itbis_facturado))}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <BotonEliminarGasto id={g.id} concepto={g.concepto} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap p-2 font-medium ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-2 ${className ?? ""}`}>{children}</td>;
}

function Stat({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-base font-semibold tabular-nums">{valor}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
