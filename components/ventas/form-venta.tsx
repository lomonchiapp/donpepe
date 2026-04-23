"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatearDOP } from "@/lib/format";
import { registrarVenta } from "@/app/(app)/ventas/actions";
import type { Articulo } from "@/lib/supabase/types";

interface Props {
  articulo: Articulo;
  precio_sugerido: number;
}

export function FormVenta({ articulo, precio_sugerido }: Props) {
  const [precio, setPrecio] = useState(precio_sugerido);
  const [metodo, setMetodo] = useState("efectivo");
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (precio <= 0) {
      toast.error("Precio inválido");
      return;
    }
    const fd = new FormData();
    fd.set("articulo_id", articulo.id);
    fd.set("precio_venta", String(precio));
    fd.set("metodo", metodo);
    if (nombre) fd.set("comprador_nombre", nombre);
    if (cedula) fd.set("comprador_cedula", cedula);
    if (telefono) fd.set("comprador_telefono", telefono);
    if (notas) fd.set("notas", notas);

    startTransition(async () => {
      const res = await registrarVenta(fd);
      if (res && "error" in res && res.error) toast.error(res.error);
    });
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <Card>
        <CardContent className="py-4 text-sm space-y-1">
          <p className="font-semibold">{articulo.descripcion}</p>
          <p className="text-xs text-muted-foreground">
            {articulo.valor_tasado != null
              ? `Tasado en ${formatearDOP(Number(articulo.valor_tasado))}`
              : "Sin tasación registrada"}
            {articulo.kilataje && articulo.peso_gramos && (
              <> · {articulo.kilataje}K · {articulo.peso_gramos}g</>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label className="text-base">Precio de venta</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={precio || ""}
          onChange={(e) => setPrecio(Number(e.target.value))}
          className="h-14 text-2xl font-bold tabular-nums"
        />
        {precio !== precio_sugerido && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setPrecio(precio_sugerido)}
          >
            Usar sugerido: {formatearDOP(precio_sugerido)}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label>Método de pago</Label>
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

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Datos del comprador (opcional)
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Cédula</Label>
              <Input
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className="h-11 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                inputMode="tel"
                className="h-11"
              />
            </div>
          </div>
        </div>
      </details>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </div>

      <Button type="submit" size="lg" className="w-full h-12 gap-1.5" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-4 w-4" />
        )}
        Registrar venta
      </Button>
    </motion.form>
  );
}
