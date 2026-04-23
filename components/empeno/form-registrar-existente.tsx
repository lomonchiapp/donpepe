"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Banknote,
  Check,
  Clock,
  Coins,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Shirt,
  Trash2,
  Tv,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuscadorClienteConCedula } from "@/components/cliente/buscador-con-cedula";
import { cn } from "@/lib/utils";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import {
  calcularDeuda,
  calcularFechaVencimiento,
  calcularTasaInteres,
  diasHastaVencimiento,
} from "@/lib/calc/intereses";
import { tasarOro, type Kilataje } from "@/lib/calc/oro";
import { registrarEmpenoExistente } from "@/app/(app)/empenos/actions";
import type {
  Cliente,
  TipoArticulo,
  TipoPagoEmpeno,
} from "@/lib/supabase/types";

interface Props {
  cliente_preseleccionado?: Cliente | null;
  defaults: {
    tasa_interes_mensual: number;
    plazo_meses: number;
    porcentaje_prestamo: number;
  };
  precios_oro: Record<Kilataje, number | null>;
}

const TIPOS: Array<{ value: TipoArticulo; label: string; icon: typeof Coins }> = [
  { value: "joya_oro", label: "Joya / Oro", icon: Coins },
  { value: "electrodomestico", label: "Electrodoméstico", icon: Tv },
  { value: "tenis", label: "Tenis", icon: Shirt },
  { value: "otro", label: "Otro", icon: Package },
];

interface PagoPrevio {
  uid: string;
  fecha: string;
  tipo: Exclude<TipoPagoEmpeno, "saldo_total">;
  monto: number;
  metodo: "efectivo" | "transferencia" | "tarjeta";
  notas: string;
}

const hoyStr = () => new Date().toISOString().slice(0, 10);

export function FormRegistrarExistente({
  cliente_preseleccionado,
  defaults,
  precios_oro,
}: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(cliente_preseleccionado ?? null);

  // Artículo
  const [tipo, setTipo] = useState<TipoArticulo>("joya_oro");
  const [descripcion, setDescripcion] = useState("");
  const [kilataje, setKilataje] = useState<Kilataje>(18);
  const [peso, setPeso] = useState<number>(0);

  // Préstamo
  const [fechaInicio, setFechaInicio] = useState<string>(hoyStr());
  const [monto, setMonto] = useState<number>(0);
  // Tasa retroactiva: permitimos override manual porque un empeño viejo
  // pudo haber sido cerrado con otra tasa. Si el usuario no toca el select,
  // usa la tasa derivada del monto (tabla vigente).
  const tasaAuto = useMemo(() => calcularTasaInteres(monto), [monto]);
  const [tasaOverride, setTasaOverride] = useState<number | null>(null);
  const tasa = tasaOverride ?? tasaAuto;
  const [plazo, setPlazo] = useState<number>(defaults.plazo_meses);
  const [notas, setNotas] = useState<string>("");

  // Historial
  const [pagos, setPagos] = useState<PagoPrevio[]>([]);

  const [pending, startTransition] = useTransition();

  // Para joyas, mostramos el valor de mercado hoy solo como referencia
  // (no se persiste, `valor_tasado` fue eliminado en migración 006).
  const precioOroHoy = precios_oro[kilataje] ?? null;
  const valorOroHoy = useMemo(() => {
    if (tipo === "joya_oro" && peso > 0 && precioOroHoy) {
      return tasarOro({
        kilataje,
        peso_gramos: peso,
        precio_dop_gramo: precioOroHoy,
      }).precio_final;
    }
    return 0;
  }, [tipo, peso, kilataje, precioOroHoy]);

  // Vencimiento efectivo: última renovación + plazo, o inicio + plazo
  const preview = useMemo(() => {
    if (!fechaInicio || plazo <= 0) return null;
    const renovaciones = pagos
      .filter((p) => p.tipo === "renovacion")
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const baseVenc = renovaciones.at(-1)?.fecha ?? fechaInicio;
    const fechaVenc = calcularFechaVencimiento({
      fecha_inicio: baseVenc,
      plazo_meses: plazo,
    });
    const fechaVencStr = fechaVenc.toISOString().slice(0, 10);
    const dias = diasHastaVencimiento(fechaVenc);

    const deuda =
      monto > 0
        ? calcularDeuda({
            monto_prestado: monto,
            tasa_interes_mensual: tasa,
            fecha_inicio: fechaInicio,
            pagos: pagos.map((p) => ({
              fecha: p.fecha,
              tipo: p.tipo,
              monto: p.monto,
            })),
          })
        : null;

    return {
      fechaVencStr,
      dias,
      deuda,
      estado:
        fechaVencStr < hoyStr() ? ("vencido_a_cobro" as const) : ("activo" as const),
    };
  }, [fechaInicio, plazo, monto, tasa, pagos]);

  function addPago() {
    setPagos((ps) => [
      ...ps,
      {
        uid: crypto.randomUUID(),
        fecha: hoyStr(),
        tipo: "interes",
        monto: 0,
        metodo: "efectivo",
        notas: "",
      },
    ]);
  }

  function updatePago(uid: string, patch: Partial<PagoPrevio>) {
    setPagos((ps) => ps.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }

  function removePago(uid: string) {
    setPagos((ps) => ps.filter((p) => p.uid !== uid));
  }

  async function handleSubmit() {
    if (!cliente) {
      toast.error("Selecciona el cliente.");
      return;
    }
    if (!fechaInicio || fechaInicio > hoyStr()) {
      toast.error("La fecha de inicio debe estar en el pasado.");
      return;
    }
    if (descripcion.trim().length < 3) {
      toast.error("Describe el artículo.");
      return;
    }
    if (monto <= 0) {
      toast.error("Monto prestado inválido.");
      return;
    }
    for (const p of pagos) {
      if (p.monto <= 0) {
        toast.error("Hay un pago con monto en cero.");
        return;
      }
      if (p.fecha < fechaInicio || p.fecha > hoyStr()) {
        toast.error(`Pago del ${p.fecha} fuera del rango permitido.`);
        return;
      }
    }

    const payload = {
      cliente_id: cliente.id,
      tipo,
      descripcion: descripcion.trim(),
      kilataje: tipo === "joya_oro" ? kilataje : null,
      peso_gramos: tipo === "joya_oro" && peso > 0 ? peso : null,
      monto_prestado: monto,
      // Si el usuario hizo override, se envía; si no, la action la deriva.
      tasa_interes_mensual: tasaOverride ?? undefined,
      plazo_meses: plazo,
      fecha_inicio: fechaInicio,
      notas: notas.trim() || null,
      pagos_previos: pagos.map((p) => ({
        fecha: p.fecha,
        tipo: p.tipo,
        monto: p.monto,
        metodo: p.metodo,
        notas: p.notas.trim() || null,
      })),
    };

    startTransition(async () => {
      const res = await registrarEmpenoExistente(payload);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      }
      // En éxito la action hace redirect.
    });
  }

  return (
    <div className="space-y-6">
      <Aviso />

      {/* 1. Cliente */}
      <Section titulo="Cliente" numero="1">
        <BuscadorClienteConCedula
          value={cliente}
          onSelect={setCliente}
          placeholder="Nombre o cédula del cliente"
        />
      </Section>

      {/* 2. Fechas y préstamo original */}
      <Section titulo="Préstamo original" numero="2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fecha-inicio" className="text-sm">
              Fecha de inicio <Req />
            </Label>
            <Input
              id="fecha-inicio"
              type="date"
              max={hoyStr()}
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              La fecha real en que se acordó el préstamo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto" className="text-sm">
              Monto prestado (RD$) <Req />
            </Label>
            <Input
              id="monto"
              type="number"
              inputMode="numeric"
              min="0"
              value={monto || ""}
              onChange={(e) => setMonto(Number(e.target.value))}
              className="h-11 text-base tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Plazo (meses)</Label>
            <Select value={String(plazo)} onValueChange={(v) => v && setPlazo(Number(v))}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} {m === 1 ? "mes" : "meses"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Interés mensual</Label>
            <Select
              value={tasaOverride !== null ? String(tasaOverride) : "auto"}
              onValueChange={(v) => {
                if (!v) return;
                setTasaOverride(v === "auto" ? null : Number(v));
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto ({tasaAuto > 0 ? `${(tasaAuto * 100).toFixed(0)}%` : "—"})
                </SelectItem>
                {[0.04, 0.05, 0.08, 0.1, 0.12, 0.15].map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {(t * 100).toFixed(0)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Auto usa la tabla vigente; escoge otro % si el empeño viejo
              tenía una tasa distinta.
            </p>
          </div>
        </div>
      </Section>

      {/* 3. Artículo */}
      <Section titulo="Artículo" numero="3">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              const activo = tipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-medium transition-all",
                    activo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion" className="text-sm">
              Descripción <Req />
            </Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder={
                tipo === "joya_oro"
                  ? "Cadena de oro 18K con dije"
                  : "Describe el artículo"
              }
            />
          </div>

          {tipo === "joya_oro" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-accent/10 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kilataje</Label>
                <Select
                  value={String(kilataje)}
                  onValueChange={(v) => v && setKilataje(Number(v) as Kilataje)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 14, 18, 22, 24].map((k) => (
                      <SelectItem key={k} value={String(k)}>
                        {k}K
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Peso (g)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={peso || ""}
                  onChange={(e) => setPeso(Number(e.target.value))}
                  className="h-10"
                />
              </div>
              {valorOroHoy > 0 && (
                <p className="col-span-2 text-xs text-accent-foreground/80">
                  Valor de mercado hoy:{" "}
                  <span className="font-semibold">
                    {formatearDOP(valorOroHoy)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* 4. Pagos previos */}
      <Section
        titulo="Pagos ya cobrados (opcional)"
        numero="4"
        hint="Intereses, abonos o renovaciones que ya se cobraron en papel."
      >
        <div className="space-y-3">
          {pagos.length === 0 && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Sin pagos previos. Agrega uno si ya le cobraste intereses o
              recibiste abonos.
            </p>
          )}

          {pagos.map((p, idx) => (
            <motion.div
              key={p.uid}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Card className="border-muted">
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pago #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePago(p.uid)}
                      className="flex items-center gap-1 text-xs text-destructive hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Quitar
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha</Label>
                      <Input
                        type="date"
                        min={fechaInicio}
                        max={hoyStr()}
                        value={p.fecha}
                        onChange={(e) => updatePago(p.uid, { fecha: e.target.value })}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={p.tipo}
                        onValueChange={(v) =>
                          v && updatePago(p.uid, { tipo: v as PagoPrevio["tipo"] })
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interes">
                            <span className="inline-flex items-center gap-1.5">
                              <Banknote className="h-3.5 w-3.5" />
                              Interés
                            </span>
                          </SelectItem>
                          <SelectItem value="abono_capital">
                            <span className="inline-flex items-center gap-1.5">
                              <Wallet className="h-3.5 w-3.5" />
                              Abono a capital
                            </span>
                          </SelectItem>
                          <SelectItem value="renovacion">
                            <span className="inline-flex items-center gap-1.5">
                              <RotateCcw className="h-3.5 w-3.5" />
                              Renovación
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Monto (RD$)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={p.monto || ""}
                        onChange={(e) =>
                          updatePago(p.uid, { monto: Number(e.target.value) })
                        }
                        className="h-10 tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Método</Label>
                      <Select
                        value={p.metodo}
                        onValueChange={(v) =>
                          v && updatePago(p.uid, { metodo: v as PagoPrevio["metodo"] })
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                          <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addPago}
            className="w-full gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Agregar pago previo
          </Button>
        </div>
      </Section>

      {/* 5. Notas */}
      <Section titulo="Notas (opcional)" numero="5">
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Cualquier detalle del empeño en papel…"
        />
      </Section>

      {/* Preview live */}
      {preview && (
        <Card className="wine-gradient text-wine-foreground overflow-hidden">
          <CardContent className="space-y-3 py-5">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80">
                Situación al día de hoy
              </p>
              {preview.deuda ? (
                <p className="mt-0.5 text-3xl font-bold tabular-nums">
                  Debe {formatearDOP(preview.deuda.deuda_total)}
                </p>
              ) : (
                <p className="text-sm opacity-80">Ingresa el monto prestado.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoPreview
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Vence"
                valor={`${formatearFechaCorta(preview.fechaVencStr)} (${
                  preview.dias < 0
                    ? `hace ${Math.abs(preview.dias)} días`
                    : preview.dias === 0
                      ? "hoy"
                      : `en ${preview.dias} días`
                })`}
              />
              <InfoPreview
                icon={
                  preview.estado === "vencido_a_cobro" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )
                }
                label="Estado resultante"
                valor={
                  preview.estado === "vencido_a_cobro" ? "Vencido a cobro" : "Activo"
                }
              />
              {preview.deuda && (
                <>
                  <InfoPreview
                    icon={<Banknote className="h-3.5 w-3.5" />}
                    label="Capital pendiente"
                    valor={formatearDOP(preview.deuda.capital_pendiente)}
                  />
                  <InfoPreview
                    icon={<Banknote className="h-3.5 w-3.5" />}
                    label="Intereses acumulados"
                    valor={formatearDOP(
                      preview.deuda.intereses_acumulados -
                        preview.deuda.intereses_pagados,
                    )}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={pending}
          className="min-w-48 gap-1.5 shadow-lg"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Registrar empeño
        </Button>
      </div>
    </div>
  );
}

function Aviso() {
  return (
    <Card className="border-accent/40 bg-accent/10">
      <CardContent className="flex items-start gap-3 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
        <div className="space-y-0.5">
          <p className="font-semibold text-accent-foreground">
            Flujo retroactivo
          </p>
          <p className="text-xs text-muted-foreground">
            Solo úsalo para empeños que ya venían corriendo en papel. Para
            nuevos, usa{" "}
            <span className="font-medium text-foreground">+ Nuevo</span>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  titulo,
  numero,
  hint,
  children,
}: {
  titulo: string;
  numero: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {numero}
        </span>
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="pl-8">{children}</div>
    </section>
  );
}

function InfoPreview({
  icon,
  label,
  valor,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
}) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-75">
        {icon}
        {label}
      </p>
      <p className="font-medium tabular-nums">{valor}</p>
    </div>
  );
}

function Req() {
  return <span className="text-destructive">*</span>;
}
