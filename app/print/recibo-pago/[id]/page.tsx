import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaLarga } from "@/lib/format";
import type {
  ConfigNegocio,
  MetodoPago,
  ReciboItem,
  TipoRecibo,
} from "@/lib/supabase/types";

export const metadata = { title: "Recibo" };

const LABEL_TIPO: Record<TipoRecibo, string> = {
  pago_empeno: "RECIBO DE PAGO",
  saldo_empeno: "RECIBO DE SALDO",
  renovacion: "RECIBO DE RENOVACIÓN",
  venta_compraventa: "RECIBO DE VENTA",
  venta_joyeria: "RECIBO DE VENTA",
  compra_oro: "COMPROBANTE DE COMPRA DE ORO",
  otro: "RECIBO",
};

interface ReciboPrintRow {
  id: string;
  codigo: string;
  tipo: TipoRecibo;
  cliente_nombre: string;
  cliente_cedula: string | null;
  cliente_telefono: string | null;
  concepto: string;
  items: ReciboItem[];
  subtotal: number;
  total: number;
  metodo: MetodoPago;
  emitido_at: string;
  anulado_at: string | null;
  pagos: { codigo: string } | null;
  facturas: { codigo_interno: string; ncf: string | null } | null;
}

export default async function ReciboPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [reciboRes, configRes] = await Promise.all([
    supabase
      .from("recibos")
      .select(
        "*, pagos(codigo), facturas(codigo_interno, ncf)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("config_negocio").select("*").limit(1).maybeSingle(),
  ]);

  if (!reciboRes.data) notFound();

  const r = reciboRes.data as unknown as ReciboPrintRow;
  const config = (configRes.data as ConfigNegocio | null) ?? null;

  const esEgreso = r.tipo === "compra_oro";
  const titulo = LABEL_TIPO[r.tipo];

  return (
    <div className="mx-auto max-w-md bg-white p-6 text-black print:p-0">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { margin: 0; background: white; }
        }
      `}</style>
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold">
          {config?.nombre_comercial ?? "Don Pepe"}
        </h1>
        {config?.direccion && <p className="text-xs">{config.direccion}</p>}
        {config?.telefono && <p className="text-xs">Tel: {config.telefono}</p>}
        {config?.rnc && <p className="text-xs">RNC {config.rnc}</p>}
        <div className="my-3 border-t border-dashed border-black/40" />
        <h2 className="text-sm font-bold">{titulo}</h2>
        <p className="font-mono text-xs">{r.codigo}</p>
        {r.facturas && (
          <p className="mt-1 font-mono text-[10px] text-black/70">
            NCF: {r.facturas.ncf ?? r.facturas.codigo_interno}
          </p>
        )}
      </div>

      {r.anulado_at && (
        <div className="my-3 rounded border-2 border-destructive p-2 text-center text-xs font-bold uppercase text-destructive">
          Recibo anulado
        </div>
      )}

      <div className="my-4 space-y-1.5 text-xs">
        <Line l="Fecha" v={formatearFechaLarga(r.emitido_at)} />
        <Line l={esEgreso ? "Vendedor" : "Cliente"} v={r.cliente_nombre} />
        {r.cliente_cedula && <Line l="Cédula" v={r.cliente_cedula} />}
        {r.cliente_telefono && <Line l="Teléfono" v={r.cliente_telefono} />}
        <Line l="Método" v={capitalizar(r.metodo)} />
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <div className="space-y-1.5 text-xs">
        <p className="font-bold">CONCEPTO</p>
        <p>{r.concepto}</p>
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <div className="space-y-1.5 text-xs">
        <p className="font-bold">DETALLE</p>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-dashed border-black/40 text-left">
              <th className="py-1 font-semibold">Descripción</th>
              <th className="py-1 text-right font-semibold">Cant</th>
              <th className="py-1 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it, i) => {
              const cantidad = Number(it.cantidad ?? 1);
              const monto = Number(it.monto);
              return (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-1">{it.descripcion}</td>
                  <td className="py-1 text-right tabular-nums">
                    {cantidad % 1 === 0 ? cantidad : cantidad.toFixed(2)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatearDOP(cantidad * monto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <div className="space-y-1 text-xs">
        <Line l="Subtotal" v={formatearDOP(Number(r.subtotal))} />
        <Line l="TOTAL" v={formatearDOP(Number(r.total))} bold />
      </div>

      <div className="my-3 border-t border-dashed border-black/40" />

      <p className="text-center text-[10px] leading-tight text-black/70">
        {esEgreso
          ? "El vendedor declara ser el legítimo propietario del oro entregado y haber recibido el monto indicado en pago."
          : "Gracias por su preferencia. Conserve este recibo."}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 text-[10px]">
        <div className="text-center">
          <div className="mb-1 h-8 border-b border-black/60" />
          {esEgreso ? "Firma vendedor" : "Firma cliente"}
        </div>
        <div className="text-center">
          <div className="mb-1 h-8 border-b border-black/60" />
          Firma empleado
        </div>
      </div>
    </div>
  );
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Line({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-black/70">{l}</span>
      <span className={bold ? "text-sm font-bold" : "font-medium"}>{v}</span>
    </div>
  );
}
