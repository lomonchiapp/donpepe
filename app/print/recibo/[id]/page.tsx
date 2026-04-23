import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaLarga } from "@/lib/format";
import type { Articulo, Cliente, ConfigNegocio, Prestamo } from "@/lib/supabase/types";

export const metadata = { title: "Recibo" };

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [prestRes, configRes] = await Promise.all([
    supabase
      .from("prestamos")
      .select("*, clientes(*), articulos(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("config_negocio").select("*").limit(1).maybeSingle(),
  ]);

  if (!prestRes.data) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prestRes.data as any as Prestamo & {
    clientes: Cliente | null;
    articulos: Articulo | null;
  };
  const config = (configRes.data as ConfigNegocio | null) ?? null;

  const interesMensual = Number(p.monto_prestado) * Number(p.tasa_interes_mensual);
  const totalAlVencer = Number(p.monto_prestado) + interesMensual * p.plazo_meses;

  return (
    <div className="mx-auto max-w-md bg-white p-6 text-black print:p-0">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { margin: 0; background: white; }
        }
      `}</style>
      <div className="text-center">
        <h1 className="text-2xl font-bold font-serif">
          {config?.nombre_comercial ?? "Don Pepe"}
        </h1>
        {config?.direccion && (
          <p className="text-xs">{config.direccion}</p>
        )}
        {config?.telefono && (
          <p className="text-xs">Tel: {config.telefono}</p>
        )}
        {config?.rnc && <p className="text-xs">RNC {config.rnc}</p>}
        <div className="my-3 border-t border-dashed border-black/40" />
        <h2 className="text-sm font-bold">RECIBO DE EMPEÑO</h2>
        <p className="text-xs font-mono">{p.codigo}</p>
      </div>

      <div className="my-4 space-y-1.5 text-xs">
        <Line l="Fecha" v={formatearFechaLarga(p.fecha_inicio)} />
        <Line l="Vence" v={formatearFechaLarga(p.fecha_vencimiento)} />
        <Line l="Cliente" v={p.clientes?.nombre_completo ?? "—"} />
        <Line l="Cédula" v={p.clientes?.cedula ?? "—"} />
        {p.clientes?.telefono && <Line l="Teléfono" v={p.clientes.telefono} />}
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <div className="space-y-1.5 text-xs">
        <p className="font-bold">ARTÍCULO</p>
        <p>{p.articulos?.descripcion}</p>
        {p.articulos?.kilataje && p.articulos.peso_gramos && (
          <p className="text-muted-foreground">
            {p.articulos.kilataje}K · {p.articulos.peso_gramos}g
          </p>
        )}
        {p.articulos?.valor_tasado != null && (
          <Line l="Tasado en" v={formatearDOP(Number(p.articulos.valor_tasado))} />
        )}
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <div className="space-y-1.5 text-xs">
        <Line l="Monto prestado" v={formatearDOP(Number(p.monto_prestado))} bold />
        <Line
          l="Interés mensual"
          v={`${(Number(p.tasa_interes_mensual) * 100).toFixed(0)}% (${formatearDOP(interesMensual)})`}
        />
        <Line l="Plazo" v={`${p.plazo_meses} meses`} />
        <Line l="Total al vencer" v={formatearDOP(totalAlVencer)} bold />
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <p className="text-[10px] leading-tight text-center">
        Si no se cancela el préstamo o renueva antes de la fecha de vencimiento,
        el artículo pasará a ser propiedad de la casa según Ley 387 de 1932.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 text-[10px]">
        <div className="text-center">
          <div className="mb-1 h-8 border-b border-black/60" />
          Firma cliente
        </div>
        <div className="text-center">
          <div className="mb-1 h-8 border-b border-black/60" />
          Firma empleado
        </div>
      </div>
    </div>
  );
}

function Line({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-black/70">{l}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{v}</span>
    </div>
  );
}
