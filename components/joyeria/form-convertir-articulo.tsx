"use client";

import { useState, useTransition } from "react";
import { Gem, Loader2 } from "lucide-react";
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
import { convertirArticuloAPieza } from "@/app/(app)/joyeria/actions";
import { formatearDOP } from "@/lib/format";
import type {
  Articulo,
  CategoriaJoyeria,
  MaterialJoyeria,
} from "@/lib/supabase/types";

interface Props {
  articulo: Articulo;
  categorias: CategoriaJoyeria[];
}

export function FormConvertirArticulo({ articulo, categorias }: Props) {
  const sugerenciaNombre =
    articulo.tipo === "joya_oro"
      ? articulo.descripcion
      : articulo.descripcion.slice(0, 80);

  const [nombre, setNombre] = useState<string>(sugerenciaNombre);
  const [categoriaId, setCategoriaId] = useState<string>(categorias[0]?.id ?? "");
  const [material, setMaterial] = useState<MaterialJoyeria>(
    articulo.tipo === "joya_oro" ? "oro" : "mixto",
  );
  // Si hay tasado histórico, sugerimos precio de venta con margen. Para
  // artículos nuevos sin tasado el operador los define a mano — es mejor
  // cero que un precio inventado.
  const baseTasado = articulo.valor_tasado != null
    ? Number(articulo.valor_tasado)
    : 0;
  const [precioVenta, setPrecioVenta] = useState<number>(
    baseTasado > 0 ? Math.round(baseTasado * 1.8) : 0,
  );
  const [precioMinimo, setPrecioMinimo] = useState<number>(
    baseTasado > 0 ? Math.round(baseTasado * 1.3) : 0,
  );
  const [manoObra, setManoObra] = useState<number>(0);
  const [ubicacion, setUbicacion] = useState("");
  const [medida, setMedida] = useState("");
  const [tejido, setTejido] = useState("");
  const [marca, setMarca] = useState("");
  const [notas, setNotas] = useState("");

  const [pending, startTransition] = useTransition();

  async function handleSubmit() {
    if (nombre.trim().length < 2) {
      toast.error("Dale un nombre descriptivo.");
      return;
    }
    if (precioVenta <= 0) {
      toast.error("Define el precio de venta.");
      return;
    }
    startTransition(async () => {
      const res = await convertirArticuloAPieza({
        articulo_id: articulo.id,
        nombre: nombre.trim(),
        categoria_id: categoriaId || null,
        material,
        precio_venta: precioVenta,
        precio_minimo: precioMinimo > 0 ? precioMinimo : null,
        costo_mano_obra: manoObra,
        ubicacion: ubicacion.trim() || null,
        medida: medida.trim() || null,
        tejido: tejido.trim() || null,
        marca: marca.trim() || null,
        notas: notas.trim() || null,
      });
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Artículo origen
        </p>
        <p className="font-semibold">{articulo.descripcion}</p>
        <p className="text-xs text-muted-foreground">
          {articulo.kilataje && `${articulo.kilataje}K · `}
          {articulo.peso_gramos && `${articulo.peso_gramos}g · `}
          {articulo.valor_tasado != null
            ? `Valorado en ${formatearDOP(Number(articulo.valor_tasado))}`
            : "Sin tasación registrada"}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Nombre comercial</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select
            value={categoriaId}
            onValueChange={(v) => setCategoriaId(v ?? "")}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Material</Label>
          <Select
            value={material}
            onValueChange={(v) => v && setMaterial(v as MaterialJoyeria)}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oro">Oro</SelectItem>
              <SelectItem value="plata">Plata</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tejido / modelo</Label>
          <Input
            value={tejido}
            onChange={(e) => setTejido(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Medida</Label>
          <Input
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Marca</Label>
          <Input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ubicación</Label>
          <Input
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Vitrina, caja fuerte…"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Mano de obra (RD$)</Label>
          <Input
            type="number"
            min="0"
            value={manoObra || ""}
            onChange={(e) => setManoObra(Number(e.target.value))}
            className="h-11 tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">
            Se suma al costo de material para el costo total de la pieza.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Precio de venta (RD$)</Label>
          <Input
            type="number"
            min="0"
            value={precioVenta || ""}
            onChange={(e) => setPrecioVenta(Number(e.target.value))}
            className="h-11 text-base font-semibold tabular-nums"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Precio mínimo (opcional)</Label>
          <Input
            type="number"
            min="0"
            value={precioMinimo || ""}
            onChange={(e) => setPrecioMinimo(Number(e.target.value))}
            className="h-11 tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Limpieza, reparación hecha, pulido, etc."
        />
      </div>

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
            <Gem className="h-4 w-4" />
          )}
          Convertir en pieza
        </Button>
      </div>
    </div>
  );
}
