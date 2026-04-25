"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Handshake,
  Loader2,
  Coins,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatearDOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KILATAJES, tasarOro, type Kilataje } from "@/lib/calc/oro";
import { registrarCompraOro } from "@/app/(app)/oro/actions";
import { BuscadorClienteConCedula } from "@/components/cliente/buscador-con-cedula";
import type { Cliente } from "@/lib/supabase/types";

interface Props {
  cliente_preseleccionado?: Cliente | null;
  precios_oro: Record<Kilataje, number | null>;
}

export function FlujoCompraOro({ cliente_preseleccionado, precios_oro }: Props) {
  const [paso, setPaso] = useState(cliente_preseleccionado ? 1 : 0);
  const [cliente, setCliente] = useState<Cliente | null>(cliente_preseleccionado ?? null);
  const [kilataje, setKilataje] = useState<Kilataje>(18);
  const [peso, setPeso] = useState<number>(0);
  // Precio del día (registrado en `precios_oro`). Puede ser null.
  const precioGramoRegistrado = precios_oro[kilataje] ?? null;
  // Override manual del precio por gramo (renegociación in situ o cuando no
  // hay precio del día). Si es null, se usa el registrado.
  const [precioGramoOverride, setPrecioGramoOverride] = useState<number | null>(null);
  // Override del total — sigue existiendo para cuando el operador prefiere
  // teclear el monto final directamente en lugar de precio/g × peso.
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [notas, setNotas] = useState("");
  const [pending, startTransition] = useTransition();

  // Precio/g efectivo = override manual > precio registrado > null
  const precioGramoEfectivo =
    precioGramoOverride !== null ? precioGramoOverride : precioGramoRegistrado;

  const totalSugerido = useMemo(() => {
    if (!precioGramoEfectivo || peso <= 0) return 0;
    return tasarOro({
      kilataje,
      peso_gramos: peso,
      precio_dop_gramo: precioGramoEfectivo,
    }).precio_final;
  }, [kilataje, peso, precioGramoEfectivo]);

  const precioNegociado = precioGramoOverride !== null;
  const totalNegociado = totalOverride !== null;
  const negociado = precioNegociado || totalNegociado;

  const total = totalOverride !== null ? totalOverride : totalSugerido;

  // Precio/g efectivo FINAL que se va a persistir: si el usuario editó el
  // total directamente, derivamos el precio/g de total/peso para mantener
  // consistencia.
  const precioGramoFinal = useMemo(() => {
    if (peso <= 0 || total <= 0) return precioGramoEfectivo ?? 0;
    return total / peso;
  }, [total, peso, precioGramoEfectivo]);

  function restaurarSugerido() {
    setTotalOverride(null);
    setPrecioGramoOverride(null);
  }

  function onEditarPrecioGramo(valor: number) {
    setPrecioGramoOverride(Number.isFinite(valor) && valor >= 0 ? valor : 0);
    // Al cambiar precio/g, descartamos override de total para recalcular con
    // el nuevo rate. Si el usuario quiere luego ajustar también el total,
    // puede hacerlo explícitamente.
    setTotalOverride(null);
  }

  function onEditarTotal(valor: number) {
    // `valor = 0` también cuenta como override — el operador podría estar
    // borrando el campo para teclear un nuevo número.
    setTotalOverride(Number.isFinite(valor) ? valor : 0);
  }

  const diferencia = totalNegociado ? total - totalSugerido : 0;
  const porcentajeDif =
    totalSugerido > 0 ? (diferencia / totalSugerido) * 100 : 0;

  function avanzar() {
    if (paso === 0 && !cliente) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (paso === 1) {
      if (peso <= 0) {
        toast.error("Ingresa el peso en gramos");
        return;
      }
      if (total <= 0) {
        toast.error("Ingresa un precio por gramo o un total a pagar");
        return;
      }
    }
    setPaso((p) => p + 1);
  }

  async function confirmar() {
    if (!cliente) return;
    if (total <= 0) {
      toast.error("Total inválido");
      return;
    }
    if (precioGramoFinal <= 0) {
      toast.error("Precio por gramo inválido");
      return;
    }
    const fd = new FormData();
    fd.set("cliente_id", cliente.id);
    fd.set("kilataje", String(kilataje));
    fd.set("peso_gramos", String(peso));
    fd.set("precio_gramo", String(precioGramoFinal));
    fd.set("total_pagado", String(total));
    if (notas) fd.set("notas", notas);

    startTransition(async () => {
      try {
        const res = await registrarCompraOro(fd);
        if (res && "error" in res && res.error) toast.error(res.error);
      } catch (e) {
        // `redirect()` en la server action lanza; no es un fallo real del formulario.
        const digest =
          typeof e === "object" && e !== null && "digest" in e
            ? String((e as { digest?: unknown }).digest)
            : "";
        if (digest.startsWith("NEXT_REDIRECT")) return;
        console.error(e);
        toast.error("No se pudo completar la compra. Intentá de nuevo.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <AnimatePresence mode="wait">
        {paso === 0 && (
          <motion.div
            key="0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="mb-4 text-xl font-bold">¿De quién es el oro?</h2>
            <BuscadorClienteConCedula
              value={cliente}
              onSelect={setCliente}
              placeholder="Nombre o cédula del vendedor"
            />
          </motion.div>
        )}

        {paso === 1 && (
          <motion.div
            key="1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <h2 className="text-xl font-bold">Tasación</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kilataje</Label>
                <Select value={String(kilataje)} onValueChange={(v) => v && setKilataje(Number(v) as Kilataje)}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KILATAJES.map((k) => (
                      <SelectItem key={k} value={String(k)}>
                        {k}K
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Peso (gramos)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={peso || ""}
                  onChange={(e) => setPeso(Number(e.target.value))}
                  className="h-12 text-lg font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="precio-gramo" className="text-xs">
                  Precio por gramo (RD$)
                </Label>
                {precioNegociado && precioGramoRegistrado && (
                  <button
                    type="button"
                    onClick={() => setPrecioGramoOverride(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar precio del día
                  </button>
                )}
              </div>
              <Input
                id="precio-gramo"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                value={precioGramoEfectivo ?? ""}
                onChange={(e) => onEditarPrecioGramo(Number(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
                placeholder={
                  precioGramoRegistrado
                    ? formatearDOP(precioGramoRegistrado)
                    : `Ingresa el precio por gramo de ${kilataje}K`
                }
                className="h-12 text-lg font-semibold tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                {precioGramoRegistrado ? (
                  <>
                    Precio del día {kilataje}K:{" "}
                    <span className="font-semibold">
                      {formatearDOP(precioGramoRegistrado)}
                    </span>
                    {precioNegociado && " · Estás usando un precio distinto"}
                  </>
                ) : (
                  <>
                    Sin precio del día registrado para {kilataje}K — teclea el
                    precio acordado con el cliente.
                  </>
                )}
              </p>
            </div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="gold-gradient relative rounded-2xl p-5 text-center text-gold-foreground shadow-lg"
            >
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs uppercase tracking-wider opacity-80">
                  A pagar
                </p>
                {negociado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    <Handshake className="h-3 w-3" /> Negociado
                  </span>
                )}
              </div>

              {/* Input editable: grande, tabular, centrado. Sin disable —
                  siempre permitimos teclear el total. */}
              <label
                htmlFor="oro-total"
                className="mt-1 flex cursor-text items-baseline justify-center gap-1"
              >
                <span className="text-2xl font-bold opacity-70">RD$</span>
                <input
                  id="oro-total"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min={0}
                  value={total || ""}
                  onChange={(e) => onEditarTotal(Number(e.target.value))}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="0"
                  aria-label="Monto a pagar por el oro"
                  className="w-[min(100%,14ch)] bg-transparent text-center text-4xl font-bold tabular-nums tracking-tight text-gold-foreground caret-gold-foreground outline-none placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-gold-foreground/40 rounded-md"
                />
              </label>

              <p className="mt-1 text-xs opacity-80">
                {precioGramoEfectivo
                  ? formatearDOP(precioGramoEfectivo)
                  : "—"}/g × {peso || 0}g
                {totalSugerido > 0 && (
                  <>
                    {" "}= <span className="font-semibold">{formatearDOP(totalSugerido)}</span>
                  </>
                )}
              </p>

              {totalNegociado && totalSugerido > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px]">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold tabular-nums",
                      diferencia < 0
                        ? "bg-destructive/15 text-destructive-foreground/90"
                        : "bg-gold-foreground/15",
                    )}
                  >
                    {diferencia > 0 ? "+" : ""}
                    {formatearDOP(diferencia)}
                    {Math.abs(porcentajeDif) >= 0.5 && (
                      <> ({porcentajeDif > 0 ? "+" : ""}{porcentajeDif.toFixed(1)}%)</>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={restaurarSugerido}
                    className="inline-flex items-center gap-1 rounded-full bg-gold-foreground/10 px-2 py-0.5 font-semibold hover:bg-gold-foreground/20"
                  >
                    <RotateCcw className="h-3 w-3" /> Restaurar
                  </button>
                </div>
              )}
            </motion.div>

            <p className="text-center text-xs text-muted-foreground">
              Puedes editar el <strong>precio por gramo</strong> o el{" "}
              <strong>total a pagar</strong> — lo que sea más cómodo para la
              negociación. El cambio solo afecta esta compra.
            </p>
          </motion.div>
        )}

        {paso === 2 && (
          <motion.div
            key="2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <h2 className="text-xl font-bold">Confirmar</h2>

            <Card>
              <CardContent className="space-y-2 py-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold">{cliente?.nombre_completo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Oro</span>
                  <span className="font-semibold">
                    {kilataje}K · {peso}g
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Precio/g usado
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatearDOP(precioGramoFinal)}
                    {precioNegociado && (
                      <span className="ml-1 text-[10px] font-medium uppercase text-primary">
                        · neg.
                      </span>
                    )}
                  </span>
                </div>
                {precioGramoRegistrado && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precio del día</span>
                    <span className="tabular-nums">
                      {formatearDOP(precioGramoRegistrado)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sugerido</span>
                  <span className="font-semibold tabular-nums">
                    {formatearDOP(totalSugerido)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="total-confirmar" className="text-base">
                  Total a pagar (RD$)
                </Label>
                {negociado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                    <Handshake className="h-3 w-3" /> Negociado
                  </span>
                )}
              </div>
              <Input
                id="total-confirmar"
                type="number"
                inputMode="decimal"
                step="1"
                min={0}
                value={total || ""}
                onChange={(e) => onEditarTotal(Number(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
                className="h-14 text-2xl font-bold tabular-nums"
              />
              {negociado && totalSugerido > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={restaurarSugerido}
                >
                  <RotateCcw className="h-3 w-3" />
                  Restaurar sugerido ({formatearDOP(totalSugerido)})
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder={
                  negociado
                    ? "Por ejemplo: precio negociado por compra en volumen, cliente frecuente…"
                    : ""
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-3">
        {paso > 0 ? (
          <Button variant="ghost" onClick={() => setPaso((p) => p - 1)} disabled={pending}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Atrás
          </Button>
        ) : (
          <span />
        )}

        {paso < 2 ? (
          <Button onClick={avanzar} size="lg" className="gap-1.5">
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={confirmar} disabled={pending} size="lg" className="gap-1.5">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            Confirmar compra
          </Button>
        )}
      </div>
    </div>
  );
}
