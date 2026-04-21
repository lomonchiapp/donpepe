"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Loader2, RotateCcw, Banknote, Zap } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatearDOP } from "@/lib/format";
import { registrarPago } from "@/app/(app)/empenos/actions";
import type { Prestamo, TipoPagoEmpeno } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  prestamo: Prestamo;
  interes_mensual_actual: number; // monto en DOP
  deuda_total: number;
  deshabilitado?: boolean;
}

export function AccionesPago({
  prestamo,
  interes_mensual_actual,
  deuda_total,
  deshabilitado,
}: Props) {
  const [accion, setAccion] = useState<TipoPagoEmpeno | null>(null);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Boton
          onClick={() => setAccion("saldo_total")}
          disabled={deshabilitado}
          label="Saldar todo"
          sub={formatearDOP(deuda_total)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="primary"
        />
        <Boton
          onClick={() => setAccion("interes")}
          disabled={deshabilitado}
          label="Pagar intereses"
          sub={formatearDOP(interes_mensual_actual)}
          icon={<Banknote className="h-5 w-5" />}
          tone="secondary"
        />
        <Boton
          onClick={() => setAccion("renovacion")}
          disabled={deshabilitado}
          label="Renovar"
          sub="Extender plazo otro mes"
          icon={<RotateCcw className="h-5 w-5" />}
          tone="accent"
        />
      </div>

      <DrawerPago
        abierto={accion !== null}
        onCerrar={() => setAccion(null)}
        tipo={accion}
        prestamo={prestamo}
        montoSugerido={
          accion === "saldo_total"
            ? deuda_total
            : accion === "interes" || accion === "renovacion"
              ? interes_mensual_actual
              : 0
        }
      />
    </>
  );
}

function Boton({
  onClick,
  disabled,
  label,
  sub,
  icon,
  tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  tone: "primary" | "secondary" | "accent";
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-14 w-full items-center gap-3 rounded-xl px-4 text-left transition-all disabled:opacity-50",
        tone === "primary" && "bg-primary text-primary-foreground hover:brightness-110",
        tone === "secondary" && "bg-secondary text-secondary-foreground hover:brightness-95",
        tone === "accent" && "bg-accent text-accent-foreground hover:brightness-95",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{label}</p>
        {sub && <p className="truncate text-xs opacity-90">{sub}</p>}
      </div>
    </motion.button>
  );
}

function DrawerPago({
  abierto,
  onCerrar,
  tipo,
  prestamo,
  montoSugerido,
}: {
  abierto: boolean;
  onCerrar: () => void;
  tipo: TipoPagoEmpeno | null;
  prestamo: Prestamo;
  montoSugerido: number;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState<number>(montoSugerido);
  const [metodo, setMetodo] = useState<string>("efectivo");
  const [notas, setNotas] = useState("");
  const [pending, startTransition] = useTransition();

  // Sincroniza sugerido cuando cambia tipo
  if (abierto && monto === 0 && montoSugerido > 0) {
    setMonto(montoSugerido);
  }

  const titulos: Record<TipoPagoEmpeno, { titulo: string; desc: string }> = {
    interes: {
      titulo: "Pagar intereses",
      desc: "El plazo de vencimiento no cambia.",
    },
    abono_capital: {
      titulo: "Abono a capital",
      desc: "Reduce el capital del préstamo.",
    },
    renovacion: {
      titulo: "Renovar préstamo",
      desc: "Cobra los intereses y reinicia el plazo desde hoy.",
    },
    saldo_total: {
      titulo: "Saldar préstamo",
      desc: "Cobra capital e intereses; el artículo se devuelve al cliente.",
    },
  };

  async function confirmar() {
    if (!tipo) return;
    const fd = new FormData();
    fd.set("prestamo_id", prestamo.id);
    fd.set("tipo", tipo);
    fd.set("monto", String(monto));
    fd.set("metodo", metodo);
    if (notas) fd.set("notas", notas);

    startTransition(async () => {
      const res = await registrarPago(fd);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        tipo === "saldo_total"
          ? "Préstamo saldado ✓"
          : tipo === "renovacion"
            ? "Préstamo renovado"
            : "Pago registrado",
      );
      setMonto(0);
      setNotas("");
      onCerrar();
      router.refresh();
    });
  }

  if (!tipo) return null;
  const cfg = titulos[tipo];

  return (
    <Drawer open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{cfg.titulo}</DrawerTitle>
          <DrawerDescription>{cfg.desc}</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="monto" className="text-base">Monto</Label>
            <Input
              id="monto"
              type="number"
              inputMode="numeric"
              autoFocus
              value={monto || ""}
              onChange={(e) => setMonto(Number(e.target.value))}
              className="h-14 text-2xl font-bold tabular-nums"
            />
            {montoSugerido > 0 && monto !== montoSugerido && (
              <button
                type="button"
                onClick={() => setMonto(montoSugerido)}
                className="text-xs text-primary hover:underline"
              >
                Usar sugerido: {formatearDOP(montoSugerido)}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base">Método</Label>
            <Select value={metodo} onValueChange={(v) => v && setMetodo(v)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DrawerFooter>
          <Button size="lg" onClick={confirmar} disabled={pending || monto <= 0}>
            {pending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Zap className="mr-2 h-5 w-5" />
            )}
            Confirmar {formatearDOP(monto)}
          </Button>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
