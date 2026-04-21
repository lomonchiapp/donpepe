import { BarChart3 } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Counter } from "@/components/motion/counter";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP } from "@/lib/format";

export const metadata = { title: "Reportes" };

export default async function ReportesPage() {
  const supabase = await createClient();

  const hoy = new Date();
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const [pagos30Res, oros30Res, ventas30Res, prestamos30Res] = await Promise.all([
    supabase
      .from("pagos")
      .select("monto, tipo")
      .gte("created_at", hace30.toISOString()),
    supabase
      .from("compras_oro")
      .select("total_pagado")
      .gte("created_at", hace30.toISOString()),
    supabase
      .from("ventas")
      .select("precio_venta")
      .gte("created_at", hace30.toISOString()),
    supabase
      .from("prestamos")
      .select("monto_prestado")
      .gte("created_at", hace30.toISOString()),
  ]);

  const pagos = (pagos30Res.data ?? []) as Array<{ monto: number; tipo: string }>;
  const oros = (oros30Res.data ?? []) as Array<{ total_pagado: number }>;
  const ventas = (ventas30Res.data ?? []) as Array<{ precio_venta: number }>;
  const nuevos = (prestamos30Res.data ?? []) as Array<{ monto_prestado: number }>;

  const totalIntereses = pagos
    .filter((p) => p.tipo === "interes" || p.tipo === "renovacion")
    .reduce((s, p) => s + Number(p.monto), 0);
  const totalVentas = ventas.reduce((s, v) => s + Number(v.precio_venta), 0);
  const totalOro = oros.reduce((s, o) => s + Number(o.total_pagado), 0);
  const totalPrestado = nuevos.reduce((s, n) => s + Number(n.monto_prestado), 0);

  const ingresos = totalIntereses + totalVentas;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <BarChart3 className="h-7 w-7" /> Reportes
          </h1>
          <p className="text-sm text-muted-foreground">
            Últimos 30 días (hasta {hoy.toLocaleDateString("es-DO")}).
          </p>
        </div>
      </FadeIn>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiBig titulo="Ingresos" valor={ingresos} descripcion="Intereses + ventas" tono="wine" />
        <KpiBig titulo="Intereses cobrados" valor={totalIntereses} descripcion={`${pagos.length} pagos`} />
        <KpiBig titulo="Ventas" valor={totalVentas} descripcion={`${ventas.length} transacciones`} />
        <KpiBig titulo="Oro comprado" valor={totalOro} descripcion={`${oros.length} compras`} tono="gold" />
      </section>

      <FadeIn delay={0.2} className="mt-6">
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">
              En los últimos 30 días se prestó{" "}
              <strong className="text-foreground">{formatearDOP(totalPrestado)}</strong>{" "}
              distribuido en <strong className="text-foreground">{nuevos.length}</strong>{" "}
              nuevos empeños.
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function KpiBig({
  titulo,
  valor,
  descripcion,
  tono,
}: {
  titulo: string;
  valor: number;
  descripcion?: string;
  tono?: "wine" | "gold";
}) {
  return (
    <FadeIn>
      <Card
        className={
          tono === "wine"
            ? "wine-gradient text-wine-foreground"
            : tono === "gold"
              ? "gold-gradient text-gold-foreground"
              : undefined
        }
      >
        <CardContent className="p-4">
          <p className="text-xs opacity-80">{titulo}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums md:text-3xl">
            <Counter value={valor} moneda />
          </p>
          {descripcion && <p className="mt-1 text-xs opacity-80">{descripcion}</p>}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
