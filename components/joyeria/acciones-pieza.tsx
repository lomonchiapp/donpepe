"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShoppingCart,
  Wrench,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cambiarEstadoPieza,
  venderPiezaJoyeria,
} from "@/app/(app)/joyeria/actions";
import type { EstadoPiezaJoyeria, PiezaJoyeria } from "@/lib/supabase/types";
import { formatearDOP } from "@/lib/format";

interface Props {
  pieza: PiezaJoyeria;
}

type Modal = null | "vender" | "reservar" | "reparar" | "baja";

export function AccionesPieza({ pieza }: Props) {
  const [modal, setModal] = useState<Modal>(null);
  const [pending, startTransition] = useTransition();

  // Form state para vender
  const [cantidad, setCantidad] = useState<number>(1);
  const [precio, setPrecio] = useState<number>(Number(pieza.precio_venta));
  const [metodo, setMetodo] = useState<"efectivo" | "transferencia" | "tarjeta">(
    "efectivo",
  );
  const [compradorNombre, setCompradorNombre] = useState("");
  const [compradorCedula, setCompradorCedula] = useState("");
  const [compradorTel, setCompradorTel] = useState("");
  const [notasVenta, setNotasVenta] = useState("");

  // Form state para estado
  const [notasEstado, setNotasEstado] = useState("");

  function cerrar() {
    setModal(null);
    setNotasEstado("");
    setNotasVenta("");
  }

  async function onVender() {
    if (cantidad < 1 || cantidad > pieza.unidades_disponibles) {
      toast.error(
        `Cantidad inválida (máx ${pieza.unidades_disponibles} disponibles).`,
      );
      return;
    }
    if (precio <= 0) {
      toast.error("Ingresa el precio de venta.");
      return;
    }
    startTransition(async () => {
      const res = await venderPiezaJoyeria({
        pieza_id: pieza.id,
        cantidad,
        precio_venta: precio,
        metodo,
        comprador_nombre: compradorNombre.trim() || null,
        comprador_cedula: compradorCedula.trim() || null,
        comprador_telefono: compradorTel.trim() || null,
        notas: notasVenta.trim() || null,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Venta registrada (${res.codigo}).`);
      cerrar();
    });
  }

  async function onCambiarEstado(estado: EstadoPiezaJoyeria) {
    startTransition(async () => {
      const res = await cambiarEstadoPieza({
        id: pieza.id,
        estado,
        notas: notasEstado.trim() || null,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pieza marcada como ${estado.replace(/_/g, " ")}.`);
      cerrar();
    });
  }

  const puedeVender =
    pieza.estado === "disponible" || pieza.estado === "reservada";

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="w-full gap-1.5 text-sm leading-tight"
          disabled={!puedeVender}
          onClick={() => setModal("vender")}
        >
          <ShoppingCart className="h-4 w-4" />
          Vender pieza
        </Button>
        <div className="grid grid-cols-3 gap-2">
          {pieza.estado !== "reservada" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setModal("reservar")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reservar
            </Button>
          )}
          {pieza.estado === "reservada" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => onCambiarEstado("disponible")}
              disabled={pending}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Liberar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setModal("reparar")}
          >
            <Wrench className="h-3.5 w-3.5" />
            Reparar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={() => setModal("baja")}
          >
            <XCircle className="h-3.5 w-3.5" />
            Baja
          </Button>
        </div>
      </div>

      {/* Vender */}
      <Dialog open={modal === "vender"} onOpenChange={(o) => !o && cerrar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vender {pieza.nombre}</DialogTitle>
            <DialogDescription>
              SKU {pieza.sku} · Precio lista {formatearDOP(Number(pieza.precio_venta))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {pieza.tipo_registro === "lote" && (
              <div className="space-y-1.5">
                <Label>Cantidad (máx {pieza.unidades_disponibles})</Label>
                <Input
                  type="number"
                  min="1"
                  max={pieza.unidades_disponibles}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Precio de venta (RD$)</Label>
              <Input
                type="number"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(Number(e.target.value))}
                className="text-base font-semibold tabular-nums"
              />
              {pieza.precio_minimo != null && (
                <p className="text-[11px] text-muted-foreground">
                  Mínimo {formatearDOP(Number(pieza.precio_minimo))}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select
                value={metodo}
                onValueChange={(v) =>
                  v && setMetodo(v as "efectivo" | "transferencia" | "tarjeta")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Comprador (opcional)</Label>
                <Input
                  value={compradorNombre}
                  onChange={(e) => setCompradorNombre(e.target.value)}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cédula</Label>
                <Input
                  value={compradorCedula}
                  onChange={(e) => setCompradorCedula(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Teléfono</Label>
                <Input
                  value={compradorTel}
                  onChange={(e) => setCompradorTel(e.target.value)}
                  inputMode="tel"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                value={notasVenta}
                onChange={(e) => setNotasVenta(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button onClick={onVender} disabled={pending} className="gap-1.5">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              Registrar venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservar */}
      <ModalEstado
        open={modal === "reservar"}
        onClose={cerrar}
        titulo="Reservar pieza"
        desc="El cliente pagó seña o pidió apartar la pieza."
        pending={pending}
        notas={notasEstado}
        setNotas={setNotasEstado}
        onConfirm={() => onCambiarEstado("reservada")}
      />

      {/* Reparar */}
      <ModalEstado
        open={modal === "reparar"}
        onClose={cerrar}
        titulo="Enviar a reparación"
        desc="La pieza sale temporalmente del inventario disponible."
        pending={pending}
        notas={notasEstado}
        setNotas={setNotasEstado}
        onConfirm={() => onCambiarEstado("en_reparacion")}
        icon={<Wrench className="h-4 w-4" />}
        confirmLabel="Marcar en reparación"
      />

      {/* Baja */}
      <ModalEstado
        open={modal === "baja"}
        onClose={cerrar}
        titulo="Dar de baja"
        desc="Marca la pieza como perdida, dañada o retirada definitivamente."
        pending={pending}
        notas={notasEstado}
        setNotas={setNotasEstado}
        onConfirm={() => onCambiarEstado("baja")}
        icon={<AlertCircle className="h-4 w-4" />}
        confirmLabel="Dar de baja"
        destructive
      />
    </>
  );
}

function ModalEstado({
  open,
  onClose,
  titulo,
  desc,
  pending,
  notas,
  setNotas,
  onConfirm,
  icon,
  confirmLabel = "Confirmar",
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  desc: string;
  pending: boolean;
  notas: string;
  setNotas: (v: string) => void;
  onConfirm: () => void;
  icon?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Notas (opcional)</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            variant={destructive ? "destructive" : "default"}
            className="gap-1.5"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
