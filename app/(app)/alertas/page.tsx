import Link from "next/link";
import { Bell, AlertCircle } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  diasHastaVencimiento,
  semaforoVencimiento,
} from "@/lib/calc/intereses";
import { formatearDOP, formatearFechaCorta, relativoDias } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Alertas" };

interface Row {
  id: string;
  codigo: string;
  monto_prestado: number;
  fecha_vencimiento: string;
  estado: string;
  clientes: { nombre_completo: string; telefono: string | null } | null;
}

export default async function AlertasPage() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const en7 = new Date();
  en7.setDate(en7.getDate() + 7);
  const en7Str = en7.toISOString().slice(0, 10);

  const [vencidosRes, proximosRes] = await Promise.all([
    supabase
      .from("prestamos")
      .select("id, codigo, monto_prestado, fecha_vencimiento, estado, clientes(nombre_completo, telefono)")
      .in("estado", ["activo", "vencido_a_cobro"])
      .lt("fecha_vencimiento", hoy)
      .order("fecha_vencimiento", { ascending: true }),
    supabase
      .from("prestamos")
      .select("id, codigo, monto_prestado, fecha_vencimiento, estado, clientes(nombre_completo, telefono)")
      .eq("estado", "activo")
      .gte("fecha_vencimiento", hoy)
      .lte("fecha_vencimiento", en7Str)
      .order("fecha_vencimiento", { ascending: true }),
  ]);

  const vencidos = (vencidosRes.data ?? []) as unknown as Row[];
  const proximos = (proximosRes.data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Bell className="h-7 w-7" /> Alertas
          </h1>
          <p className="text-sm text-muted-foreground">
            Empeños que vencen pronto o ya vencieron.
          </p>
        </div>
      </FadeIn>

      {vencidos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-destructive">
            <AlertCircle className="h-4 w-4" /> Vencidos ({vencidos.length})
          </h2>
          <ul className="space-y-2">
            {vencidos.map((r, i) => (
              <FilaAlerta key={r.id} row={r} delay={i * 0.02} tono="destructive" />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Próximos 7 días ({proximos.length})
        </h2>
        {proximos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              🎉 No hay empeños por vencer esta semana.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {proximos.map((r, i) => (
              <FilaAlerta key={r.id} row={r} delay={i * 0.02} tono="warning" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilaAlerta({
  row,
  delay,
  tono,
}: {
  row: Row;
  delay: number;
  tono: "destructive" | "warning";
}) {
  const dias = diasHastaVencimiento(row.fecha_vencimiento);
  return (
    <FadeIn delay={delay}>
      <Link href={`/empenos/${row.id}`}>
        <Card
          className={cn(
            "transition-all hover:-translate-y-0.5 hover:shadow-md",
            tono === "destructive" && "border-destructive/40 bg-destructive/5",
            tono === "warning" && "border-warning/40 bg-warning/5",
          )}
        >
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-muted-foreground">{row.codigo}</p>
              </div>
              <p className="mt-1 truncate text-sm font-semibold">
                {row.clientes?.nombre_completo ?? "Cliente"}
              </p>
              {row.clientes?.telefono && (
                <a
                  href={`https://wa.me/1${row.clientes.telefono.replace(/\D/g, "").slice(-10)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-xs text-success hover:underline"
                >
                  WhatsApp: {row.clientes.telefono}
                </a>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold tabular-nums">
                {formatearDOP(Number(row.monto_prestado))}
              </p>
              <p
                className={cn(
                  "text-[11px]",
                  tono === "destructive" ? "text-destructive font-semibold" : "text-muted-foreground",
                )}
              >
                Venció {formatearFechaCorta(row.fecha_vencimiento)} · {relativoDias(dias)}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </FadeIn>
  );
}
