"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Box,
  Check,
  Coins,
  Gem,
  Layers,
  Loader2,
  Plus,
  Trash2,
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
import { cn } from "@/lib/utils";
import { formatearDOP } from "@/lib/format";
import { tasarOro, type Kilataje } from "@/lib/calc/oro";
import { crearPiezaJoyeria } from "@/app/(app)/joyeria/actions";
import type {
  CategoriaJoyeria,
  KilatajeJoyeria,
  MaterialJoyeria,
  OrigenJoyeria,
  PiedraJoyeria,
  TipoRegistroJoyeria,
} from "@/lib/supabase/types";

interface Props {
  categorias: CategoriaJoyeria[];
  precios_oro: Record<Kilataje, number | null>;
}

interface PiedraState extends PiedraJoyeria {
  uid: string;
}

const KILATAJES_ORO: Kilataje[] = [10, 14, 18, 22, 24];
const LEYES_PLATA = [800, 925, 950, 999];

const hoyStr = () => new Date().toISOString().slice(0, 10);

export function FormNuevaPieza({ categorias, precios_oro }: Props) {
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistroJoyeria>("pieza");

  // Básico
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>(categorias[0]?.id ?? "");
  const [material, setMaterial] = useState<MaterialJoyeria>("oro");
  const [kilatajeOro, setKilatajeOro] = useState<Kilataje>(18);
  const [leyPlata, setLeyPlata] = useState<number>(925);

  // Pieza individual
  const [peso, setPeso] = useState<number>(0);
  const [medida, setMedida] = useState("");
  const [tejido, setTejido] = useState("");
  const [marca, setMarca] = useState("");
  const [piedras, setPiedras] = useState<PiedraState[]>([]);

  // Lote
  const [unidades, setUnidades] = useState<number>(10);
  const [pesoTotal, setPesoTotal] = useState<number>(0);

  // Costo y precio
  const [costoMaterial, setCostoMaterial] = useState<number>(0);
  const [costoManoObra, setCostoManoObra] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [precioMinimo, setPrecioMinimo] = useState<number>(0);

  // Meta
  const [origen, setOrigen] = useState<OrigenJoyeria>("taller");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [fechaAdq, setFechaAdq] = useState<string>(hoyStr());

  const [pending, startTransition] = useTransition();

  const kilajeActual: KilatajeJoyeria | null = useMemo(() => {
    if (material === "oro") return kilatajeOro as KilatajeJoyeria;
    if (material === "plata") return leyPlata as KilatajeJoyeria;
    return null;
  }, [material, kilatajeOro, leyPlata]);

  // Sugerencia de costo de material para oro usando precio del día
  const costoSugeridoOro = useMemo(() => {
    if (material !== "oro") return 0;
    const precio = precios_oro[kilatajeOro];
    if (!precio) return 0;
    const pesoUsado =
      tipoRegistro === "lote" ? pesoTotal : peso;
    if (pesoUsado <= 0) return 0;
    return tasarOro({
      kilataje: kilatajeOro,
      peso_gramos: pesoUsado,
      precio_dop_gramo: precio,
    }).precio_final;
  }, [material, kilatajeOro, peso, pesoTotal, tipoRegistro, precios_oro]);

  const costoTotal = costoMaterial + costoManoObra;
  const margen =
    precioVenta > 0 && costoTotal > 0
      ? ((precioVenta - costoTotal) / precioVenta) * 100
      : 0;

  function addPiedra() {
    setPiedras((ps) => [
      ...ps,
      { uid: crypto.randomUUID(), tipo: "", cantidad: 1 },
    ]);
  }
  function updatePiedra(uid: string, patch: Partial<PiedraState>) {
    setPiedras((ps) => ps.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }
  function removePiedra(uid: string) {
    setPiedras((ps) => ps.filter((p) => p.uid !== uid));
  }

  async function handleSubmit() {
    if (nombre.trim().length < 2) {
      toast.error("Dale un nombre descriptivo a la pieza.");
      return;
    }
    if (precioVenta <= 0) {
      toast.error("Define el precio de venta.");
      return;
    }
    if (precioMinimo > 0 && precioMinimo > precioVenta) {
      toast.error("El precio mínimo no puede superar al precio de venta.");
      return;
    }
    if (tipoRegistro === "lote" && unidades < 1) {
      toast.error("El lote debe tener al menos 1 unidad.");
      return;
    }

    const payload = {
      tipo_registro: tipoRegistro,
      categoria_id: categoriaId || null,
      nombre: nombre.trim(),
      material,
      kilataje: kilajeActual,

      peso_gramos: tipoRegistro === "pieza" && peso > 0 ? peso : null,
      medida: medida.trim() || null,
      tejido: tejido.trim() || null,
      marca: marca.trim() || null,
      piedras: piedras
        .filter((p) => p.tipo.trim().length > 0)
        .map((p) => ({
          tipo: p.tipo,
          cantidad: p.cantidad,
          quilates: p.quilates,
          color: p.color,
          notas: p.notas,
        })),

      unidades_totales: tipoRegistro === "lote" ? unidades : 1,
      peso_gramos_total:
        tipoRegistro === "lote" && pesoTotal > 0 ? pesoTotal : null,

      costo_material: costoMaterial,
      costo_mano_obra: costoManoObra,
      precio_venta: precioVenta,
      precio_minimo: precioMinimo > 0 ? precioMinimo : null,

      fotos_urls: [],
      ubicacion: ubicacion.trim() || null,
      origen,
      proveedor: proveedor.trim() || null,
      fecha_adquisicion: fechaAdq || undefined,
      notas: notas.trim() || null,
    };

    startTransition(async () => {
      const res = await crearPiezaJoyeria(payload);
      if (res && "error" in res && res.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Tipo de registro */}
      <Section titulo="Tipo de registro" numero="1">
        <div className="grid grid-cols-2 gap-3">
          <TipoCard
            activo={tipoRegistro === "pieza"}
            onClick={() => setTipoRegistro("pieza")}
            icon={<Gem className="h-5 w-5" />}
            titulo="Pieza individual"
            desc="Una sola unidad con peso y características propias."
          />
          <TipoCard
            activo={tipoRegistro === "lote"}
            onClick={() => setTipoRegistro("lote")}
            icon={<Layers className="h-5 w-5" />}
            titulo="Lote"
            desc="Varias unidades iguales. Se descuentan por venta."
          />
        </div>
      </Section>

      {/* Básico */}
      <Section titulo="Identificación" numero="2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-sm">
              Nombre / descripción <Req />
            </Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={
                tipoRegistro === "pieza"
                  ? "Anillo solitario con zirconia"
                  : "Aretes de plata 925 corazón"
              }
              className="h-11"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Categoría</Label>
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
              <Label className="text-sm">Material <Req /></Label>
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

            {material === "oro" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Kilataje</Label>
                <Select
                  value={String(kilatajeOro)}
                  onValueChange={(v) => v && setKilatajeOro(Number(v) as Kilataje)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KILATAJES_ORO.map((k) => (
                      <SelectItem key={k} value={String(k)}>
                        {k}K
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {material === "plata" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Ley</Label>
                <Select
                  value={String(leyPlata)}
                  onValueChange={(v) => v && setLeyPlata(Number(v))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEYES_PLATA.map((l) => (
                      <SelectItem key={l} value={String(l)}>
                        .{l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Características físicas */}
      {tipoRegistro === "pieza" ? (
        <Section titulo="Características" numero="3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Peso (g)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={peso || ""}
                onChange={(e) => setPeso(Number(e.target.value))}
                className="h-11 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Medida / talla</Label>
              <Input
                value={medida}
                onChange={(e) => setMedida(e.target.value)}
                placeholder="7, 20cm, 42mm…"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tejido / modelo</Label>
              <Input
                value={tejido}
                onChange={(e) => setTejido(e.target.value)}
                placeholder="Bizantina, barbada, rope…"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Marca</Label>
              <Input
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {/* Piedras */}
          <div className="mt-4 space-y-2">
            <Label className="text-sm">Piedras (opcional)</Label>
            {piedras.length === 0 && (
              <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground">
                Sin piedras. Agrega si la pieza tiene gemas o zirconias.
              </p>
            )}
            {piedras.map((p, idx) => (
              <motion.div
                key={p.uid}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="border-muted">
                  <CardContent className="space-y-2 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Piedra #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePiedra(p.uid)}
                        className="flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Quitar
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Tipo</Label>
                        <Input
                          value={p.tipo}
                          onChange={(e) =>
                            updatePiedra(p.uid, { tipo: e.target.value })
                          }
                          placeholder="Diamante, zirconia, zafiro…"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cantidad</Label>
                        <Input
                          type="number"
                          min="1"
                          value={p.cantidad ?? ""}
                          onChange={(e) =>
                            updatePiedra(p.uid, {
                              cantidad: Number(e.target.value),
                            })
                          }
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quilates</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={p.quilates ?? ""}
                          onChange={(e) =>
                            updatePiedra(p.uid, {
                              quilates: Number(e.target.value),
                            })
                          }
                          className="h-10"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPiedra}
              className="w-full gap-1.5"
            >
              <Plus className="h-4 w-4" /> Agregar piedra
            </Button>
          </div>
        </Section>
      ) : (
        <Section titulo="Lote" numero="3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Unidades totales <Req /></Label>
              <Input
                type="number"
                min="1"
                value={unidades || ""}
                onChange={(e) => setUnidades(Number(e.target.value))}
                className="h-11 tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Se descuentan automáticamente al vender.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Peso total del lote (g)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={pesoTotal || ""}
                onChange={(e) => setPesoTotal(Number(e.target.value))}
                className="h-11 tabular-nums"
              />
            </div>
          </div>
        </Section>
      )}

      {/* Costo y precio */}
      <Section titulo="Costo y precio" numero="4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Costo material (RD$)</Label>
            <Input
              type="number"
              min="0"
              value={costoMaterial || ""}
              onChange={(e) => setCostoMaterial(Number(e.target.value))}
              className="h-11 tabular-nums"
            />
            {costoSugeridoOro > 0 && (
              <p className="text-[11px] text-accent-foreground/80">
                Sugerido por peso:{" "}
                <button
                  type="button"
                  onClick={() => setCostoMaterial(costoSugeridoOro)}
                  className="font-semibold underline"
                >
                  {formatearDOP(costoSugeridoOro)}
                </button>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Costo mano de obra (RD$)</Label>
            <Input
              type="number"
              min="0"
              value={costoManoObra || ""}
              onChange={(e) => setCostoManoObra(Number(e.target.value))}
              className="h-11 tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Precio de venta (RD$) <Req /></Label>
            <Input
              type="number"
              min="0"
              value={precioVenta || ""}
              onChange={(e) => setPrecioVenta(Number(e.target.value))}
              className="h-11 text-base font-semibold tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Precio mínimo (opcional)</Label>
            <Input
              type="number"
              min="0"
              value={precioMinimo || ""}
              onChange={(e) => setPrecioMinimo(Number(e.target.value))}
              className="h-11 tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">
              Límite para negociar precio al vender.
            </p>
          </div>
        </div>

        {precioVenta > 0 && costoTotal > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Costo total: <strong className="tabular-nums">{formatearDOP(costoTotal)}</strong>
            </span>
            <span
              className={cn(
                "tabular-nums font-semibold",
                margen < 10 ? "text-destructive" : "text-success",
              )}
            >
              Margen: {margen.toFixed(0)}%
            </span>
          </div>
        )}
      </Section>

      {/* Origen y meta */}
      <Section titulo="Procedencia" numero="5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Origen</Label>
            <Select
              value={origen}
              onValueChange={(v) => v && setOrigen(v as OrigenJoyeria)}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="taller">Taller propio</SelectItem>
                <SelectItem value="compra_oro">Compra de oro</SelectItem>
                <SelectItem value="articulo_propiedad">
                  Artículo propiedad casa
                </SelectItem>
                <SelectItem value="proveedor_externo">
                  Proveedor externo
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Fecha de adquisición</Label>
            <Input
              type="date"
              value={fechaAdq}
              max={hoyStr()}
              onChange={(e) => setFechaAdq(e.target.value)}
              className="h-11"
            />
          </div>

          {origen === "proveedor_externo" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Proveedor</Label>
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor"
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm">Ubicación física</Label>
            <Input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Vitrina 2, caja fuerte, gaveta A…"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm">Notas</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Detalles internos, garantías, procedencia…"
            />
          </div>
        </div>
      </Section>

      {/* Preview */}
      {precioVenta > 0 && (
        <Card className="wine-gradient text-wine-foreground overflow-hidden">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2">
              <Gem className="h-4 w-4" />
              <p className="text-xs uppercase tracking-wide opacity-80">
                Resumen
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatearDOP(precioVenta)}
              {tipoRegistro === "lote" && (
                <span className="ml-2 text-sm font-normal opacity-75">
                  × {unidades} unidades
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoMini
                icon={<Box className="h-3.5 w-3.5" />}
                label="Tipo"
                valor={tipoRegistro === "pieza" ? "Individual" : "Lote"}
              />
              <InfoMini
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Material"
                valor={`${material}${
                  kilajeActual
                    ? material === "plata"
                      ? ` .${kilajeActual}`
                      : ` ${kilajeActual}K`
                    : ""
                }`}
              />
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
          Crear pieza
        </Button>
      </div>
    </div>
  );
}

function Section({
  titulo,
  numero,
  children,
}: {
  titulo: string;
  numero: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {numero}
        </span>
        <h2 className="text-base font-semibold">{titulo}</h2>
      </div>
      <div className="pl-8">{children}</div>
    </section>
  );
}

function TipoCard({
  activo,
  onClick,
  icon,
  titulo,
  desc,
}: {
  activo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all",
        activo
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          activo ? "text-primary" : "text-foreground",
        )}
      >
        {icon}
        {titulo}
      </div>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
    </button>
  );
}

function InfoMini({
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
      <p className="font-medium capitalize">{valor}</p>
    </div>
  );
}

function Req() {
  return <span className="text-destructive">*</span>;
}

// Export tiny warning banner for reuse
export function AvisoJoyeria() {
  return (
    <Card className="border-accent/40 bg-accent/10">
      <CardContent className="flex items-start gap-3 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
        <p className="text-xs text-muted-foreground">
          El SKU se genera automáticamente al crear.
        </p>
      </CardContent>
    </Card>
  );
}
