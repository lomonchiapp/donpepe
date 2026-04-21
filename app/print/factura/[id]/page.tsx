import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import type {
  ConfigNegocio,
  EstadoFactura,
  FacturaItem,
  TipoComprobante,
} from "@/lib/supabase/types";

export const metadata = { title: "Factura" };

const LABEL_TIPO: Record<TipoComprobante, string> = {
  factura_credito_fiscal: "FACTURA CON CRÉDITO FISCAL",
  factura_consumo: "FACTURA DE CONSUMO",
  nota_debito: "NOTA DE DÉBITO",
  nota_credito: "NOTA DE CRÉDITO",
  compra: "COMPROBANTE DE COMPRA",
  regimen_especial: "COMPROBANTE RÉGIMEN ESPECIAL",
  gubernamental: "COMPROBANTE GUBERNAMENTAL",
};

const CODIGO_DGII: Record<TipoComprobante, string> = {
  factura_credito_fiscal: "01",
  factura_consumo: "02",
  nota_debito: "03",
  nota_credito: "04",
  compra: "11",
  regimen_especial: "14",
  gubernamental: "15",
};

interface FacturaPrintRow {
  id: string;
  codigo_interno: string;
  ncf: string | null;
  tipo_comprobante: TipoComprobante;
  estado: EstadoFactura;
  rnc_emisor: string | null;
  razon_social_emisor: string | null;
  direccion_emisor: string | null;
  rnc_receptor: string | null;
  cedula_receptor: string | null;
  nombre_receptor: string;
  direccion_receptor: string | null;
  email_receptor: string | null;
  telefono_receptor: string | null;
  subtotal: number;
  descuento: number;
  base_itbis: number;
  base_exenta: number;
  itbis_monto: number;
  total: number;
  fecha_emision: string | null;
  fecha_vencimiento_ncf: string | null;
  codigo_seguridad: string | null;
  notas: string | null;
  created_at: string;
  anulada_at: string | null;
  factura_items: FacturaItem[];
  recibos: { codigo: string } | null;
}

export default async function FacturaPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [facRes, cfgRes] = await Promise.all([
    supabase
      .from("facturas")
      .select(
        "*, factura_items(*), recibos!recibos_factura_id_fkey(codigo)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("config_negocio").select("*").limit(1).maybeSingle(),
  ]);

  if (!facRes.data) notFound();

  const f = facRes.data as unknown as FacturaPrintRow;
  const config = (cfgRes.data as ConfigNegocio | null) ?? null;
  const items = [...(f.factura_items ?? [])].sort((a, b) => a.orden - b.orden);

  const titulo = LABEL_TIPO[f.tipo_comprobante];
  const codigoDgii = CODIGO_DGII[f.tipo_comprobante];
  const esCompra = f.tipo_comprobante === "compra";

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-10 text-black print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { margin: 0; background: white; }
        }
      `}</style>

      {/* Header: emisor + título */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-bold">
            {config?.razon_social ??
              config?.nombre_comercial ??
              f.razon_social_emisor ??
              "Don Pepe"}
          </h1>
          {(config?.direccion_fiscal ?? config?.direccion ?? f.direccion_emisor) && (
            <p className="text-xs leading-snug">
              {config?.direccion_fiscal ?? config?.direccion ?? f.direccion_emisor}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {(config?.rnc ?? f.rnc_emisor) && (
              <span>
                <strong>RNC:</strong> {config?.rnc ?? f.rnc_emisor}
              </span>
            )}
            {config?.telefono && (
              <span>
                <strong>Tel:</strong> {config.telefono}
              </span>
            )}
            {config?.email_fiscal && (
              <span>
                <strong>Email:</strong> {config.email_fiscal}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="rounded-md border-2 border-black p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest">
              Comprobante {codigoDgii}
            </p>
            <p className="text-sm font-bold leading-tight">{titulo}</p>
            <div className="mt-2 border-t border-black pt-1">
              <p className="text-[10px] uppercase text-black/70">NCF</p>
              <p className="font-mono text-base font-bold">
                {f.ncf ?? "— sin asignar —"}
              </p>
            </div>
            {f.fecha_vencimiento_ncf && (
              <p className="mt-1 text-[10px] text-black/70">
                Vence NCF: {formatearFechaCorta(f.fecha_vencimiento_ncf)}
              </p>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] text-black/70">
            Interno: {f.codigo_interno}
          </p>
        </div>
      </header>

      {/* Estado anulado */}
      {f.estado === "anulada" && (
        <div className="my-3 rounded border-2 border-destructive p-2 text-center text-sm font-bold uppercase text-destructive">
          Factura anulada
        </div>
      )}
      {f.estado === "borrador" && (
        <div className="my-3 rounded border-2 border-dashed border-black/40 p-2 text-center text-xs uppercase tracking-widest text-black/60">
          Borrador — pendiente de asignación de NCF
        </div>
      )}

      {/* Receptor + fecha */}
      <section className="mt-4 grid grid-cols-[1fr_auto] gap-6 border-b border-black/40 pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-black/60">
            {esCompra ? "Vendedor" : "Facturar a"}
          </p>
          <p className="text-sm font-bold">{f.nombre_receptor}</p>
          <div className="mt-0.5 text-xs">
            {f.rnc_receptor && (
              <p>
                <strong>RNC:</strong> {f.rnc_receptor}
              </p>
            )}
            {f.cedula_receptor && (
              <p>
                <strong>Cédula:</strong> {f.cedula_receptor}
              </p>
            )}
            {f.direccion_receptor && <p>{f.direccion_receptor}</p>}
            {f.telefono_receptor && (
              <p>
                <strong>Tel:</strong> {f.telefono_receptor}
              </p>
            )}
            {f.email_receptor && (
              <p>
                <strong>Email:</strong> {f.email_receptor}
              </p>
            )}
          </div>
        </div>
        <div className="text-right text-xs">
          <p>
            <strong>Fecha de emisión:</strong>{" "}
            {f.fecha_emision
              ? formatearFechaCorta(f.fecha_emision)
              : formatearFechaCorta(f.created_at)}
          </p>
          {f.recibos && (
            <p className="mt-0.5 text-black/70">
              Recibo asociado: {f.recibos.codigo}
            </p>
          )}
        </div>
      </section>

      {/* Items */}
      <section className="mt-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Descripción</th>
              <th className="py-2 px-2 text-right font-semibold">Cant</th>
              <th className="py-2 px-2 text-right font-semibold">
                P. unit
                <br />
                <span className="text-[9px] font-normal">(c/ITBIS)</span>
              </th>
              <th className="py-2 px-2 text-right font-semibold">Base</th>
              <th className="py-2 px-2 text-right font-semibold">ITBIS</th>
              <th className="py-2 pl-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className="border-b border-black/20 align-top">
                <td className="py-1.5 pr-2 tabular-nums">{idx + 1}</td>
                <td className="py-1.5 pr-2">
                  <p>{it.descripcion}</p>
                  {!it.itbis_aplica && (
                    <span className="text-[9px] uppercase text-black/60">
                      Exento
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {Number(it.cantidad) % 1 === 0
                    ? it.cantidad
                    : Number(it.cantidad).toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {formatearDOP(Number(it.precio_unitario_bruto), true)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {formatearDOP(Number(it.subtotal), true)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {formatearDOP(Number(it.itbis_monto), true)}
                </td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                  {formatearDOP(Number(it.total), true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totales */}
      <section className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-xs">
          <Fila l="Subtotal gravado" v={Number(f.base_itbis)} />
          {Number(f.base_exenta) > 0 && (
            <Fila l="Subtotal exento" v={Number(f.base_exenta)} />
          )}
          {Number(f.descuento) > 0 && (
            <Fila l="Descuento" v={-Number(f.descuento)} />
          )}
          <Fila l="ITBIS 18%" v={Number(f.itbis_monto)} />
          <div className="border-t-2 border-black pt-1">
            <Fila l="TOTAL A PAGAR" v={Number(f.total)} bold />
          </div>
        </div>
      </section>

      {/* Código de seguridad (e-CF) */}
      {f.codigo_seguridad && (
        <section className="mt-6 border-t border-black/30 pt-3 text-[10px]">
          <p>
            <strong>Código de seguridad:</strong>{" "}
            <span className="font-mono">{f.codigo_seguridad}</span>
          </p>
        </section>
      )}

      {/* Notas */}
      {f.notas && (
        <section className="mt-4 border-t border-black/30 pt-3 text-xs">
          <p className="text-[10px] uppercase tracking-widest text-black/60">
            Notas
          </p>
          <p>{f.notas}</p>
        </section>
      )}

      {/* Texto legal + firmas */}
      <footer className="mt-10 text-[10px] leading-tight text-black/70">
        <p>
          {esCompra
            ? "El vendedor declara ser el legítimo propietario de los bienes entregados y haber recibido el monto indicado en esta operación. Comprobante emitido conforme a la Norma General 05-2019 de la DGII."
            : "Comprobante fiscal emitido de acuerdo con el Reglamento 293-11 y normativas vigentes de la DGII. Válido como crédito fiscal únicamente para el tipo 01."}
        </p>
        <div className="mt-10 grid grid-cols-2 gap-12">
          <div className="text-center">
            <div className="mb-1 h-10 border-b border-black/70" />
            {esCompra ? "Firma vendedor" : "Firma cliente"}
          </div>
          <div className="text-center">
            <div className="mb-1 h-10 border-b border-black/70" />
            Firma autorizada
          </div>
        </div>
      </footer>
    </div>
  );
}

function Fila({
  l,
  v,
  bold,
}: {
  l: string;
  v: number;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={bold ? "font-bold" : "text-black/70"}>{l}</span>
      <span
        className={`tabular-nums ${bold ? "text-base font-bold" : "font-medium"}`}
      >
        {formatearDOP(v, true)}
      </span>
    </div>
  );
}
