"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatearDOP } from "@/lib/format";
import { guardarPrecioOro } from "@/app/(app)/oro/actions";
import type { Kilataje } from "@/lib/calc/oro";

interface Props {
  kilataje: Kilataje;
  precio: number | null;
  fecha: string;
}

export function TarjetaPrecioOro({ kilataje, precio, fecha }: Props) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<number>(precio ?? 0);
  const [pending, startTransition] = useTransition();

  async function guardar() {
    if (valor <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }
    const fd = new FormData();
    fd.set("fecha", fecha);
    fd.set("kilataje", String(kilataje));
    fd.set("precio_dop_gramo", String(valor));

    startTransition(async () => {
      const res = await guardarPrecioOro(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Precio ${kilataje}K actualizado`);
      setEditando(false);
    });
  }

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="overflow-hidden">
        <div className="gold-gradient px-4 py-2 text-center">
          <span className="font-serif text-sm font-bold text-gold-foreground">
            {kilataje}K
          </span>
        </div>
        <CardContent className="py-4">
          {!editando ? (
            <>
              <p className="text-2xl font-bold tabular-nums">
                {precio !== null ? formatearDOP(precio) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">por gramo</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full gap-1"
                onClick={() => {
                  setValor(precio ?? 0);
                  setEditando(true);
                }}
              >
                <Pencil className="h-3 w-3" />
                {precio !== null ? "Editar" : "Definir"}
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <Input
                type="number"
                autoFocus
                value={valor || ""}
                onChange={(e) => setValor(Number(e.target.value))}
                className="h-10 text-base font-semibold"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={guardar}
                  disabled={pending}
                  className="flex-1 gap-1"
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditando(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
