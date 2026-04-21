"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatearDOP } from "@/lib/format";
import {
  desglosarItem,
  totalizarFactura,
  type DesgloseItem,
} from "@/lib/calc/itbis";
import { emitirFactura } from "@/app/(app)/facturas/actions";
import type { ReciboItem, TipoComprobante, TipoRecibo } from "@/lib/supabase/types";

const TIPOS: Array<{ key: TipoComprobante; label: string; hint: string }> = [
  {
    key: "factura_consumo",
    label: "Consumo (02)",
    hint: "Para cliente sin RNC",
  },
  {
    key: "factura_credito_fiscal",
    label: "Crédito fiscal (01)",
    hint: "Requiere RNC del receptor",
  },
  {
    key: "compra",
    label: "Compra al público (11)",
    hint: "Para compras de oro / insumos a personas físicas",
  },
];

interface ItemEditable {
  uid: string;
  descripcion: string;
  cantidad: number;
  precio_unitario_bruto: number;
  descuento_unitario: number;
  itbis_aplica: boolean;
}

interface ReciboInicial {
  id: string;
  tipo: TipoRecibo;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_cedula: string | null;
  cliente_telefono: string | null;
  concepto: string;
  items: ReciboItem[];
}

interface Props {
  recibo: ReciboInicial | null;
  tiposNcfActivos: string[];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function FormEmitirFactura({ recibo, tiposNcfActivos }: Props) {
  const tipoInicial: TipoComprobante = useMemo(() => {
    if (recibo?.tipo === "compra_oro") return "compra";
    return "factura_consumo";
  }, [recibo]);

  const [tipo, setTipo] = useState<TipoComprobante>(tipoInicial);
  const [rnc, setRnc] = useState("");
  const [cedula, setCedula] = useState(recibo?.cliente_cedula ?? "");
  const [nombre, setNombre] = useState(
    recibo?.cliente_nombre ?? "Cliente no identificado",
  );
  const [direccion, setDireccion] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState(recibo?.cliente_telefono ?? "");
  const [notas, setNotas] = useState("");

  const [items, setItems] = useState<ItemEditable[]>(() => {
    if (recibo && recibo.items.length > 0) {
      // itbis_aplica default: false para compra_oro (DGII tipo 11), true para lo demás
      const aplicaDefault = recibo.tipo !== "compra_oro";
      return recibo.items.map((it) => ({
        uid: uid(),
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad ?? 1),
        precio_unitario_bruto: Number(it.monto),
        descuento_unitario: 0,
        itbis_aplica: aplicaDefault,
      }));
    }
    return [
      {
        uid: uid(),
        descripcion: "",
        cantidad: 1,
        precio_unitario_bruto: 0,
        descuento_unitario: 0,
        itbis_aplica: true,
      },
    ];
  });

  const [pending, startTransition] = useTransition();

  // Cálculo de totales en vivo (misma lógica que el server)
  const { desgloses, totales, errorDesglose } = useMemo(() => {
    try {
      const g: DesgloseItem[] = items.map((it) =>
        desglosarItem({
          precio_unitario_bruto: it.precio_unitario_bruto,
          cantidad: it.cantidad,
          itbis_aplica: it.itbis_aplica,
          descuento_unitario: it.descuento_unitario,
        }),
      );
      return { desgloses: g, totales: totalizarFactura(g), errorDesglose: null };
    } catch (e) {
      return {
        desgloses: null,
        totales: null,
        errorDesglose: e instanceof Error ? e.message : String(e),
      };
    }
  }, [items]);

  function actualizar(id: string, patch: Partial<ItemEditable>) {
    setItems((prev) => prev.map((it) => (it.uid === id ? { ...it, ...patch } : it)));
  }

  function agregar() {
    setItems((prev) => [
      ...prev,
      {
        uid: uid(),
        descripcion: "",
        cantidad: 1,
        precio_unitario_bruto: 0,
        descuento_unitario: 0,
        itbis_aplica: tipo !== "compra",
      },
    ]);
  }

  function eliminar(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.uid !== id) : prev));
  }

  function onSubmit() {
    if (items.some((it) => !it.descripcion.trim() || it.precio_unitario_bruto <= 0)) {
      toast.error("Cada ítem necesita descripción y precio > 0.");
      return;
    }
    if (tipo === "factura_credito_fiscal" && rnc.trim().length < 9) {
      toast.error("RNC requerido para factura de crédito fiscal.");
      return;
    }
    if (!tiposNcfActivos.includes(tipo)) {
      toast.warning(
        "No hay rango NCF activo para este tipo. La factura quedará en borrador hasta que cargues un rango.",
      );
    }

    startTransition(async () => {
      const res = await emitirFactura({
        recibo_id: recibo?.id ?? null,
        tipo_comprobante: tipo,
        rnc_receptor: rnc.trim() || null,
        cedula_receptor: cedula.trim() || null,
        nombre_receptor: nombre.trim(),
        direccion_receptor: direccion.trim() || null,
        email_receptor: email.trim() || null,
        telefono_receptor: telefono.trim() || null,
        cliente_id: recibo?.cliente_id ?? null,
        notas: notas.trim() || null,
        items: items.map((it) => ({
          descripcion: it.descripcion.trim(),
          cantidad: it.cantidad,
          precio_unitario_bruto: it.precio_unitario_bruto,
          descuento_unitario: it.descuento_unitario,
          itbis_aplica: it.itbis_aplica,
          itbis_tasa: 18,
        })),
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tipo de comprobante */}
      <section>
        <Label className="mb-2 block">Tipo de comprobante</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TIPOS.map((t) => {
            const activo = tipo === t.key;
            const sinRango = !tiposNcfActivos.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTipo(t.key)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  activo
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t.label}</span>
                  {sinRango && (
                    <span className="text-[10px] text-warning-foreground">
                      sin rango
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.hint}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Receptor */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          {tipo === "compra" ? "Vendedor (persona que entrega)" : "Receptor"}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="rnc">
              RNC {tipo === "factura_credito_fiscal" && <span>*</span>}
            </Label>
            <Input
              id="rnc"
              value={rnc}
              onChange={(e) => setRnc(e.target.value)}
              placeholder="9 u 11 dígitos"
            />
          </div>
          <div>
            <Label htmlFor="cedula">Cédula</Label>
            <Input
              id="cedula"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Items</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={agregar}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>

        <ul className="space-y-2">
          {items.map((it, i) => {
            const g = desgloses?.[i];
            return (
              <li key={it.uid} className="rounded-lg border p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_80px_120px_auto]">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide">
                      Descripción
                    </Label>
                    <Input
                      value={it.descripcion}
                      onChange={(e) =>
                        actualizar(it.uid, { descripcion: e.target.value })
                      }
                      placeholder="Ej: Cadena de oro 18K"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide">
                      Cant
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.cantidad}
                      onChange={(e) =>
                        actualizar(it.uid, {
                          cantidad: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide">
                      P. unit (c/ITBIS)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.precio_unitario_bruto}
                      onChange={(e) =>
                        actualizar(it.uid, {
                          precio_unitario_bruto: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminar(it.uid)}
                      disabled={items.length === 1}
                      aria-label="Eliminar item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={it.itbis_aplica}
                      onCheckedChange={(v: boolean) =>
                        actualizar(it.uid, { itbis_aplica: v })
                      }
                    />
                    Aplica ITBIS (18%)
                  </label>
                  {g && (
                    <div className="text-right text-xs text-muted-foreground tabular-nums">
                      Base {formatearDOP(g.subtotal)} · ITBIS{" "}
                      {formatearDOP(g.itbis_monto)} · Total{" "}
                      <span className="font-semibold text-foreground">
                        {formatearDOP(g.total)}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Notas */}
      <section>
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          maxLength={500}
        />
      </section>

      {/* Totales */}
      <section className="rounded-lg border bg-muted/30 p-4">
        {errorDesglose ? (
          <p className="text-sm text-destructive">{errorDesglose}</p>
        ) : totales ? (
          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <Fila l="Base gravada" v={totales.base_itbis} />
            {totales.base_exenta > 0 && (
              <Fila l="Base exenta" v={totales.base_exenta} />
            )}
            <Fila l="ITBIS 18%" v={totales.itbis_monto} />
            <div className="border-t pt-1" />
            <Fila l="Total" v={totales.total} bold />
          </dl>
        ) : null}
      </section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={pending || !!errorDesglose}
          className="gap-1"
        >
          {pending ? "Emitiendo…" : "Emitir factura"}
        </Button>
      </div>
    </div>
  );
}

function Fila({ l, v, bold }: { l: string; v: number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{l}</dt>
      <dd
        className={`tabular-nums ${
          bold ? "text-lg font-bold text-foreground" : "font-medium"
        }`}
      >
        {formatearDOP(v)}
      </dd>
    </div>
  );
}
