"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Coins,
  Shirt,
  Tv,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatearDOP } from "@/lib/format";
import {
  calcularFechaVencimiento,
  sugerirMontoPrestamo,
} from "@/lib/calc/intereses";
import { tasarOro, type Kilataje } from "@/lib/calc/oro";
import { crearEmpeno } from "@/app/(app)/empenos/actions";
import { BuscadorClienteConCedula } from "@/components/cliente/buscador-con-cedula";
import type { Cliente, TipoArticulo } from "@/lib/supabase/types";

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
  { value: "tenis", label: "Tenis de marca", icon: Shirt },
  { value: "otro", label: "Otro", icon: Package },
];

export function WizardNuevoEmpeno({
  cliente_preseleccionado,
  defaults,
  precios_oro,
}: Props) {
  const [paso, setPaso] = useState(cliente_preseleccionado ? 1 : 0);
  const [cliente, setCliente] = useState<Cliente | null>(cliente_preseleccionado ?? null);

  // Paso 2
  const [tipo, setTipo] = useState<TipoArticulo>("joya_oro");
  const [descripcion, setDescripcion] = useState("");
  const [kilataje, setKilataje] = useState<Kilataje>(18);
  const [peso, setPeso] = useState<number>(0);
  const [valorTasado, setValorTasado] = useState<number>(0);

  // Paso 3
  const [monto, setMonto] = useState<number>(0);
  const [tasa, setTasa] = useState<number>(defaults.tasa_interes_mensual);
  const [plazo, setPlazo] = useState<number>(defaults.plazo_meses);
  const [pending, startTransition] = useTransition();

  // Sugerir valor tasado automáticamente cuando es joya_oro
  const precioOroHoy = precios_oro[kilataje] ?? null;
  const valorSugerido = useMemo(() => {
    if (tipo === "joya_oro" && peso > 0 && precioOroHoy) {
      const t = tasarOro({
        kilataje,
        peso_gramos: peso,
        precio_dop_gramo: precioOroHoy,
      });
      return t.precio_final;
    }
    return 0;
  }, [tipo, peso, kilataje, precioOroHoy]);

  const montoSugerido = useMemo(
    () => (valorTasado > 0 ? sugerirMontoPrestamo(valorTasado, defaults.porcentaje_prestamo) : 0),
    [valorTasado, defaults.porcentaje_prestamo],
  );

  const fechaVenc = useMemo(
    () => calcularFechaVencimiento({ fecha_inicio: new Date(), plazo_meses: plazo }),
    [plazo],
  );

  function avanzar() {
    if (paso === 0 && !cliente) {
      toast.error("Selecciona un cliente primero.");
      return;
    }
    if (paso === 1) {
      if (descripcion.trim().length < 3) {
        toast.error("Describe el artículo.");
        return;
      }
      if (valorTasado <= 0) {
        toast.error("Ingresa el valor tasado.");
        return;
      }
      if (monto === 0) setMonto(sugerirMontoPrestamo(valorTasado, defaults.porcentaje_prestamo));
    }
    setPaso((p) => Math.min(p + 1, 2));
  }

  function retroceder() {
    setPaso((p) => Math.max(p - 1, 0));
  }

  async function handleSubmit() {
    if (!cliente) return;
    if (monto <= 0 || monto > valorTasado) {
      toast.error("Monto inválido.");
      return;
    }

    const fd = new FormData();
    fd.set("cliente_id", cliente.id);
    fd.set("tipo", tipo);
    fd.set("descripcion", descripcion);
    if (tipo === "joya_oro") {
      fd.set("kilataje", String(kilataje));
      fd.set("peso_gramos", String(peso));
    }
    fd.set("valor_tasado", String(valorTasado));
    fd.set("monto_prestado", String(monto));
    fd.set("tasa_interes_mensual", String(tasa));
    fd.set("plazo_meses", String(plazo));

    startTransition(async () => {
      const res = await crearEmpeno(fd);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      }
      // En éxito, crearEmpeno hace redirect, no necesitamos toast aquí.
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Stepper activo={paso} />

      <AnimatePresence mode="wait">
        {paso === 0 && (
          <motion.div
            key="paso-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
          >
            <h2 className="mb-4 text-xl font-bold">¿Quién trae el artículo?</h2>
            <BuscadorClienteConCedula
              value={cliente}
              onSelect={setCliente}
              placeholder="Nombre o cédula del cliente"
            />
          </motion.div>
        )}

        {paso === 1 && (
          <motion.div
            key="paso-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="space-y-5"
          >
            <h2 className="text-xl font-bold">¿Qué trae?</h2>

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

            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-base">Descripción</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder={
                  tipo === "joya_oro"
                    ? "Cadena de oro 18K con dije"
                    : tipo === "electrodomestico"
                      ? "Televisor Samsung 42 pulgadas"
                      : "Describe el artículo"
                }
                className="text-base"
              />
            </div>

            {tipo === "joya_oro" && (
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-accent/10 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kilataje</Label>
                  <Select value={String(kilataje)} onValueChange={(v) => v && setKilataje(Number(v) as Kilataje)}>
                    <SelectTrigger className="h-11">
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
                  <Label className="text-xs">Peso (gramos)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={peso || ""}
                    onChange={(e) => setPeso(Number(e.target.value))}
                    className="h-11 text-base"
                  />
                </div>
                {precioOroHoy ? (
                  <p className="col-span-2 text-xs text-accent-foreground/80">
                    Precio hoy {kilataje}K: {formatearDOP(precioOroHoy)}/g
                    {valorSugerido > 0 && (
                      <>
                        {" · "}
                        Valor sugerido:{" "}
                        <button
                          type="button"
                          onClick={() => setValorTasado(valorSugerido)}
                          className="font-semibold underline"
                        >
                          {formatearDOP(valorSugerido)}
                        </button>
                      </>
                    )}
                  </p>
                ) : (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    ⚠️ No hay precio registrado para {kilataje}K hoy.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="valor" className="text-base">Valor tasado (RD$)</Label>
              <Input
                id="valor"
                type="number"
                inputMode="numeric"
                min="0"
                value={valorTasado || ""}
                onChange={(e) => setValorTasado(Number(e.target.value))}
                placeholder="10,000"
                className="h-12 text-lg font-semibold"
              />
            </div>
          </motion.div>
        )}

        {paso === 2 && (
          <motion.div
            key="paso-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="space-y-5"
          >
            <h2 className="text-xl font-bold">¿Cuánto y por cuánto tiempo?</h2>

            <Card className="bg-muted/30">
              <CardContent className="py-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold">{cliente?.nombre_completo}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Valor tasado</span>
                  <span className="font-semibold">{formatearDOP(valorTasado)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="monto" className="text-base">Monto a prestar</Label>
              <Input
                id="monto"
                type="number"
                inputMode="numeric"
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
                className="h-14 text-2xl font-bold tabular-nums"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Sugerido: {formatearDOP(montoSugerido)}
                </span>
                <button
                  type="button"
                  onClick={() => setMonto(montoSugerido)}
                  className="text-primary font-medium hover:underline"
                >
                  Usar sugerido
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Plazo (meses)</Label>
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
                <Label className="text-xs">Interés mensual</Label>
                <Select value={String(tasa)} onValueChange={(v) => v && setTasa(Number(v))}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.05, 0.08, 0.1, 0.12, 0.15].map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {(t * 100).toFixed(0)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="wine-gradient text-wine-foreground">
              <CardContent className="py-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="opacity-90">Vencimiento</span>
                  <span className="font-semibold">
                    {fechaVenc.toLocaleDateString("es-DO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-90">Interés/mes</span>
                  <span className="font-semibold">
                    {formatearDOP(monto * tasa)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/20 pt-1.5">
                  <span className="opacity-90">Total a cobrar al vencer</span>
                  <span className="text-lg font-bold">
                    {formatearDOP(monto + monto * tasa * plazo)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navegación */}
      <div className="mt-8 flex items-center justify-between gap-3">
        {paso > 0 ? (
          <Button variant="ghost" onClick={retroceder} disabled={pending}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Atrás
          </Button>
        ) : (
          <span />
        )}

        {paso < 2 ? (
          <Button onClick={avanzar} size="lg" className="gap-1.5">
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={pending}
            size="lg"
            className="gap-1.5 min-w-40"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Crear empeño
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ activo }: { activo: number }) {
  const labels = ["Cliente", "Artículo", "Préstamo"];
  return (
    <ol className="mb-6 flex items-center gap-2">
      {labels.map((label, i) => {
        const estado = i === activo ? "actual" : i < activo ? "pasado" : "futuro";
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <motion.div
              layout
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                estado === "actual" && "bg-primary text-primary-foreground",
                estado === "pasado" && "bg-success text-success-foreground",
                estado === "futuro" && "bg-muted text-muted-foreground",
              )}
            >
              {estado === "pasado" ? <Check className="h-4 w-4" /> : i + 1}
            </motion.div>
            <span
              className={cn(
                "flex-1 text-xs font-medium",
                estado === "actual" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span className="h-px flex-1 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

