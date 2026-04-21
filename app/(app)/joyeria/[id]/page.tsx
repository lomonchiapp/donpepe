import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Gem,
  MapPin,
  Package2,
  ShoppingCart,
  Tag,
  Wallet,
} from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AccionesPieza } from "@/components/joyeria/acciones-pieza";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CategoriaJoyeria,
  EstadoPiezaJoyeria,
  MaterialJoyeria,
  MovimientoJoyeria,
  PiedraJoyeria,
  PiezaJoyeria,
} from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; convertido?: string }>;
}

const ESTADO_LABEL: Record<EstadoPiezaJoyeria, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  en_reparacion: "En reparación",
  baja: "Dada de baja",
  agotado: "Agotada",
};

const ESTADO_CLASES: Record<EstadoPiezaJoyeria, string> = {
  disponible: "bg-success/15 text-success ring-1 ring-success/40",
  reservada: "bg-warning/20 text-warning-foreground ring-1 ring-warning/40",
  vendida: "bg-muted text-muted-foreground",
  en_reparacion: "bg-chart-4/20 text-foreground ring-1 ring-chart-4/40",
  baja: "bg-destructive/15 text-destructive ring-1 ring-destructive/40",
  agotado: "bg-muted text-muted-foreground",
};

const MATERIAL_LABEL: Record<MaterialJoyeria, string> = {
  oro: "Oro",
  plata: "Plata",
  mixto: "Mixto",
};

export default async function PiezaDetallePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { nuevo, convertido } = await searchParams;
  const supabase = await createClient();

  const [piezaRes, movRes, catRes] = await Promise.all([
    supabase.from("piezas_joyeria").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("movimientos_joyeria")
      .select("*")
      .eq("pieza_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("categorias_joyeria")
      .select("*")
      .eq("activo", true)
      .order("orden"),
  ]);

  const pieza = piezaRes.data as PiezaJoyeria | null;
  if (!pieza) notFound();

  const movimientos = (movRes.data ?? []) as MovimientoJoyeria[];
  const categorias = (catRes.data ?? []) as CategoriaJoyeria[];
  const categoria = categorias.find((c) => c.id === pieza.categoria_id);

  const piedras: PiedraJoyeria[] = Array.isArray(pieza.piedras)
    ? (pieza.piedras as PiedraJoyeria[])
    : [];

  const estadoFinal = pieza.estado === "vendida" || pieza.estado === "baja";

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 md:px-6 md:py-6">
      <Link
        href="/joyeria"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Joyería
      </Link>

      {nuevo === "1" && (
        <FadeIn>
          <div className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success ring-1 ring-success/30">
            Pieza registrada — SKU <strong>{pieza.sku}</strong>.
          </div>
        </FadeIn>
      )}
      {convertido === "1" && (
        <FadeIn>
          <div className="mb-4 rounded-xl bg-accent/15 px-4 py-3 text-sm ring-1 ring-accent/30">
            Artículo convertido en pieza de joyería — SKU{" "}
            <strong>{pieza.sku}</strong>.
          </div>
        </FadeIn>
      )}

      <div className="grid gap-5 md:grid-cols-[320px_1fr]">
        {/* Fotos / encabezado */}
        <FadeIn>
          <Card className="overflow-hidden">
            <div className="relative aspect-square w-full bg-muted">
              {pieza.fotos_urls.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pieza.fotos_urls[0]}
                  alt={pieza.nombre}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Gem className="h-14 w-14 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <CardContent className="space-y-2 py-3">
              <p className="font-mono text-[11px] text-muted-foreground">
                {pieza.sku}
              </p>
              <h1 className="text-xl font-bold leading-tight">{pieza.nombre}</h1>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge className={cn(ESTADO_CLASES[pieza.estado])}>
                  {ESTADO_LABEL[pieza.estado]}
                </Badge>
                {pieza.tipo_registro === "lote" && (
                  <Badge variant="outline">
                    Lote · {pieza.unidades_disponibles}/{pieza.unidades_totales}
                  </Badge>
                )}
                {categoria && <Badge variant="outline">{categoria.nombre}</Badge>}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Info principal */}
        <FadeIn delay={0.05}>
          <Card>
            <CardContent className="space-y-4 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Precio de venta
                </p>
                <p className="text-3xl font-bold tabular-nums">
                  {formatearDOP(Number(pieza.precio_venta))}
                </p>
                {pieza.precio_minimo != null && (
                  <p className="text-xs text-muted-foreground">
                    Mínimo aceptable {formatearDOP(Number(pieza.precio_minimo))}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Dato
                  icon={<Gem className="h-3.5 w-3.5" />}
                  label="Material"
                  valor={`${MATERIAL_LABEL[pieza.material]}${
                    pieza.kilataje
                      ? pieza.material === "plata"
                        ? ` .${pieza.kilataje}`
                        : ` ${pieza.kilataje}K`
                      : ""
                  }`}
                />
                {pieza.peso_gramos && (
                  <Dato
                    icon={<Package2 className="h-3.5 w-3.5" />}
                    label="Peso"
                    valor={`${Number(pieza.peso_gramos).toFixed(2)} g`}
                  />
                )}
                {pieza.peso_gramos_total && (
                  <Dato
                    icon={<Package2 className="h-3.5 w-3.5" />}
                    label="Peso total lote"
                    valor={`${Number(pieza.peso_gramos_total).toFixed(2)} g`}
                  />
                )}
                {pieza.medida && (
                  <Dato
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Medida"
                    valor={pieza.medida}
                  />
                )}
                {pieza.tejido && (
                  <Dato
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Tejido"
                    valor={pieza.tejido}
                  />
                )}
                {pieza.marca && (
                  <Dato
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Marca"
                    valor={pieza.marca}
                  />
                )}
                {pieza.ubicacion && (
                  <Dato
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label="Ubicación"
                    valor={pieza.ubicacion}
                  />
                )}
              </div>

              {piedras.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Piedras
                  </p>
                  <ul className="space-y-1 text-xs">
                    {piedras.map((p, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-muted/40 px-2 py-1"
                      >
                        <span className="font-medium">{p.tipo}</span>
                        {p.cantidad ? ` ×${p.cantidad}` : ""}
                        {p.quilates ? ` · ${p.quilates}ct` : ""}
                        {p.color ? ` · ${p.color}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <Dato
                  icon={<Wallet className="h-3.5 w-3.5" />}
                  label="Costo material"
                  valor={formatearDOP(Number(pieza.costo_material))}
                />
                <Dato
                  icon={<Wallet className="h-3.5 w-3.5" />}
                  label="Mano de obra"
                  valor={formatearDOP(Number(pieza.costo_mano_obra))}
                />
                <Dato
                  icon={<Wallet className="h-3.5 w-3.5" />}
                  label="Costo total"
                  valor={formatearDOP(Number(pieza.costo_total))}
                />
                <Dato
                  icon={<ShoppingCart className="h-3.5 w-3.5" />}
                  label="Origen"
                  valor={pieza.origen.replace(/_/g, " ")}
                />
                <Dato
                  icon={<Tag className="h-3.5 w-3.5" />}
                  label="Adquirida"
                  valor={formatearFechaCorta(pieza.fecha_adquisicion)}
                />
                {pieza.proveedor && (
                  <Dato
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Proveedor"
                    valor={pieza.proveedor}
                  />
                )}
              </div>

              {pieza.notas && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Notas
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {pieza.notas}
                    </p>
                  </div>
                </>
              )}

              {!estadoFinal && (
                <>
                  <Separator />
                  <AccionesPieza pieza={pieza} />
                </>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Historial */}
      {movimientos.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold tracking-tight">
              Historial
            </h2>
            <Card>
              <CardContent className="divide-y p-0">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium capitalize">
                          {m.tipo.replace(/_/g, " ")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatearFechaCorta(m.created_at)}
                        </p>
                      </div>
                      {m.notas && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {m.notas}
                        </p>
                      )}
                      {m.datos_despues && (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {JSON.stringify(m.datos_despues)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function Dato({
  icon,
  label,
  valor,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
