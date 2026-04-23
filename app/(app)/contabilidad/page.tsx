import Link from "next/link";
import {
  Calculator,
  BookOpen,
  FileSpreadsheet,
  Receipt,
  ShoppingBag,
  TrendingUp,
  XCircle,
  ArrowRight,
} from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contabilidad" };

export default async function ContabilidadHomePage() {
  const supabase = await createClient();

  // Dashboard: últimos reportes generados + totales del mes
  const ahora = new Date();
  const periodoActual = `${ahora.getFullYear()}-${String(
    ahora.getMonth() + 1,
  ).padStart(2, "0")}`;
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const [reportesRes, comprasRes, facturasRes, anuladasRes, gastosRes] =
    await Promise.all([
      supabase
        .from("reportes_dgii_generados")
        .select("*")
        .order("generado_at", { ascending: false })
        .limit(5),
      supabase
        .from("compras_oro")
        .select("total_pagado", { count: "exact" })
        .gte("created_at", inicioMes.toISOString()),
      supabase
        .from("facturas")
        .select("total", { count: "exact" })
        .gte("fecha_emision", inicioMes.toISOString().slice(0, 10))
        .in("estado", ["emitida", "firmada", "aceptada"]),
      supabase
        .from("facturas")
        .select("id", { count: "exact", head: true })
        .gte("fecha_emision", inicioMes.toISOString().slice(0, 10))
        .eq("estado", "anulada"),
      supabase
        .from("gastos_operativos")
        .select("monto", { count: "exact" })
        .gte("fecha", inicioMes.toISOString().slice(0, 10)),
    ]);

  const reportes = reportesRes.data ?? [];
  const comprasCount = comprasRes.count ?? 0;
  const comprasTotal = (comprasRes.data ?? []).reduce(
    (s, r: { total_pagado: number }) => s + Number(r.total_pagado ?? 0),
    0,
  );
  const facturasCount = facturasRes.count ?? 0;
  const facturasTotal = (facturasRes.data ?? []).reduce(
    (s, r: { total: number }) => s + Number(r.total ?? 0),
    0,
  );
  const anuladasCount = anuladasRes.count ?? 0;
  const gastosCount = gastosRes.count ?? 0;
  const gastosTotal = (gastosRes.data ?? []).reduce(
    (s, r: { monto: number }) => s + Number(r.monto ?? 0),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Calculator className="h-7 w-7" /> Contabilidad
          </h1>
          <p className="text-sm text-muted-foreground">
            Libro de compraventa y reportes DGII (606 · 607 · 608). Periodo
            actual:{" "}
            <strong className="text-foreground">{periodoActual}</strong>.
          </p>
        </div>
      </FadeIn>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          titulo="Compras del mes"
          valor={`${comprasCount}`}
          sub={formatearDOP(comprasTotal)}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <Kpi
          titulo="Gastos del mes"
          valor={`${gastosCount}`}
          sub={formatearDOP(gastosTotal)}
          icon={<Receipt className="h-5 w-5" />}
        />
        <Kpi
          titulo="Facturas del mes"
          valor={`${facturasCount} emitidas`}
          sub={formatearDOP(facturasTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <Kpi
          titulo="Facturas anuladas"
          valor={`${anuladasCount}`}
          sub={anuladasCount === 0 ? "Sin anulaciones este mes" : "Revisar"}
          icon={<XCircle className="h-5 w-5" />}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ModuloCard
          href="/contabilidad/libro-compraventa"
          titulo="Libro de compraventa"
          descripcion="Reemplazo digital del libro físico. Compras de oro + gastos operativos en una sola tabla, con datos del cliente y del proveedor. Exportable a Excel."
          icon={<BookOpen className="h-5 w-5" />}
        />
        <ModuloCard
          href="/contabilidad/gastos"
          titulo="Gastos operativos"
          descripcion="Registra cada gasto del negocio (alquiler, luz, personal, suministros). Los que tienen RNC + NCF entran automáticamente al 606. Catálogo DGII completo (01–11)."
          icon={<Receipt className="h-5 w-5" />}
        />
        <ModuloCard
          href="/contabilidad/606"
          titulo="Formato 606 — Compras"
          descripcion="Reporte mensual de compras (oro + gastos con NCF) en formato TXT DGII, listo para subir al portal. Vista previa y exportación a Excel."
          icon={<FileSpreadsheet className="h-5 w-5" />}
        />
        <ModuloCard
          href="/contabilidad/607"
          titulo="Formato 607 — Ventas"
          descripcion="Reporte mensual de ventas con NCF. Desglose por forma de pago. TXT DGII + Excel."
          icon={<FileSpreadsheet className="h-5 w-5" />}
        />
        <ModuloCard
          href="/contabilidad/608"
          titulo="Formato 608 — Anulados"
          descripcion="Reporte mensual de NCF anulados con su motivo. TXT DGII + Excel."
          icon={<FileSpreadsheet className="h-5 w-5" />}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Últimos reportes generados
        </h2>
        {reportes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Todavía no se ha generado ningún reporte DGII.
          </p>
        ) : (
          <Card>
            <CardContent className="py-0">
              <ul className="divide-y">
                {reportes.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm">
                        <span className="font-mono font-semibold">
                          {r.formato}
                        </span>{" "}
                        · {r.periodo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.conteo_registros} registros · {formatearDOP(
                          Number(r.total_monto),
                        )}{" "}
                        · {new Date(r.generado_at).toLocaleString("es-DO")}
                      </p>
                    </div>
                    <Link
                      href={`/contabilidad/${r.formato}?periodo=${r.periodo}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function formatearDOP(n: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(n);
}

function Kpi({
  titulo,
  valor,
  sub,
  icon,
}: {
  titulo: string;
  valor: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <FadeIn>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{titulo}</span>
            {icon}
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function ModuloCard({
  href,
  titulo,
  descripcion,
  icon,
}: {
  href: string;
  titulo: string;
  descripcion: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {icon}
              {titulo}
            </div>
            <p className="text-xs text-muted-foreground">{descripcion}</p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
