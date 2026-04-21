import Link from "next/link";
import { Plus, Gem } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearDOP } from "@/lib/format";
import type {
  EstadoPiezaJoyeria,
  MaterialJoyeria,
  PiezaJoyeria,
} from "@/lib/supabase/types";

export const metadata = { title: "Joyería" };

type Filtro =
  | "disponibles"
  | "vendidas"
  | "reservadas"
  | "reparacion"
  | "agotadas"
  | "bajas"
  | "todas";

interface Props {
  searchParams: Promise<{
    filtro?: Filtro;
    material?: MaterialJoyeria | "todos";
    q?: string;
  }>;
}

const ESTADO_LABEL: Record<EstadoPiezaJoyeria, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  en_reparacion: "En reparación",
  baja: "Baja",
  agotado: "Agotado",
};

const MATERIAL_LABEL: Record<MaterialJoyeria, string> = {
  oro: "Oro",
  plata: "Plata",
  mixto: "Mixto",
};

async function fetchPiezas(
  filtro: Filtro,
  material: MaterialJoyeria | "todos",
  q: string | undefined,
): Promise<PiezaJoyeria[]> {
  const supabase = await createClient();
  let query = supabase
    .from("piezas_joyeria")
    .select("*")
    .order("created_at", { ascending: false });

  switch (filtro) {
    case "disponibles":
      query = query.eq("estado", "disponible");
      break;
    case "vendidas":
      query = query.eq("estado", "vendida");
      break;
    case "reservadas":
      query = query.eq("estado", "reservada");
      break;
    case "reparacion":
      query = query.eq("estado", "en_reparacion");
      break;
    case "agotadas":
      query = query.eq("estado", "agotado");
      break;
    case "bajas":
      query = query.eq("estado", "baja");
      break;
    case "todas":
      break;
  }

  if (material && material !== "todos") {
    query = query.eq("material", material);
  }

  if (q && q.length >= 2) {
    query = query.or(
      `sku.ilike.%${q}%,nombre.ilike.%${q}%,tejido.ilike.%${q}%,marca.ilike.%${q}%`,
    );
  }

  const { data } = await query.limit(300);
  return (data ?? []) as PiezaJoyeria[];
}

export default async function JoyeriaPage({ searchParams }: Props) {
  const { filtro = "disponibles", material = "todos", q = "" } = await searchParams;
  const piezas = await fetchPiezas(filtro, material, q || undefined);

  const tabs: { value: Filtro; label: string }[] = [
    { value: "disponibles", label: "Disponibles" },
    { value: "reservadas", label: "Reservadas" },
    { value: "reparacion", label: "En reparación" },
    { value: "vendidas", label: "Vendidas" },
    { value: "agotadas", label: "Agotadas" },
    { value: "bajas", label: "Bajas" },
    { value: "todas", label: "Todas" },
  ];

  const materiales: { value: MaterialJoyeria | "todos"; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "oro", label: "Oro" },
    { value: "plata", label: "Plata" },
    { value: "mixto", label: "Mixto" },
  ];

  const totalDisponibles = piezas.filter(
    (p) => p.estado === "disponible" || p.estado === "reservada",
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
              <Gem className="h-7 w-7 text-chart-3" /> Joyería
            </h1>
            <p className="text-sm text-muted-foreground">
              {piezas.length} {piezas.length === 1 ? "pieza" : "piezas"} en esta vista ·{" "}
              {totalDisponibles} disponibles
            </p>
          </div>
          <Link
            href="/joyeria/nueva"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "gap-1.5")}
          >
            <Plus className="h-4 w-4" /> Nueva pieza
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <form
          method="get"
          action="/joyeria"
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="filtro" value={filtro} />
          <input type="hidden" name="material" value={material} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por SKU, nombre, tejido o marca…"
            className="h-9 flex-1 min-w-48 rounded-lg border bg-background px-3 text-sm"
          />
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Buscar
          </button>
        </form>
      </FadeIn>

      <FadeIn delay={0.05}>
        <nav className="mb-3 flex w-full overflow-x-auto rounded-xl bg-muted/50 p-1">
          {tabs.map((t) => {
            const activo = t.value === filtro;
            const params = new URLSearchParams();
            params.set("filtro", t.value);
            if (material !== "todos") params.set("material", material);
            if (q) params.set("q", q);
            return (
              <Link
                key={t.value}
                href={`/joyeria?${params.toString()}`}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
                  activo
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Material:</span>
          {materiales.map((m) => {
            const activo = m.value === material;
            const params = new URLSearchParams();
            params.set("filtro", filtro);
            params.set("material", m.value);
            if (q) params.set("q", q);
            return (
              <Link
                key={m.value}
                href={`/joyeria?${params.toString()}`}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </div>
      </FadeIn>

      {piezas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No hay piezas en esta vista.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {piezas.map((p, i) => (
            <FadeIn key={p.id} delay={Math.min(i, 10) * 0.02}>
              <Link href={`/joyeria/${p.id}`}>
                <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {p.fotos_urls.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.fotos_urls[0]}
                        alt={p.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Gem className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <Badge
                      className={cn(
                        "absolute left-2 top-2",
                        p.estado === "disponible" && "bg-success/90 text-white",
                        p.estado === "reservada" && "bg-warning/90 text-white",
                        p.estado === "vendida" && "bg-muted text-muted-foreground",
                        p.estado === "en_reparacion" && "bg-chart-4 text-white",
                        p.estado === "agotado" && "bg-muted text-muted-foreground",
                        p.estado === "baja" && "bg-destructive/80 text-white",
                      )}
                    >
                      {ESTADO_LABEL[p.estado]}
                    </Badge>
                    {p.tipo_registro === "lote" && (
                      <Badge className="absolute right-2 top-2 bg-background/80 text-foreground">
                        ×{p.unidades_disponibles}/{p.unidades_totales}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="space-y-1.5 py-3">
                    <p className="font-mono text-[10px] text-muted-foreground">{p.sku}</p>
                    <p className="truncate text-sm font-semibold">{p.nombre}</p>
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <Badge variant="outline">{MATERIAL_LABEL[p.material]}</Badge>
                      {p.kilataje && (
                        <Badge variant="outline">
                          {p.material === "plata" ? `.${p.kilataje}` : `${p.kilataje}K`}
                        </Badge>
                      )}
                      {p.peso_gramos && (
                        <span className="text-muted-foreground">
                          {Number(p.peso_gramos).toFixed(1)}g
                        </span>
                      )}
                    </div>
                    <p className="pt-1 text-base font-bold tabular-nums">
                      {formatearDOP(Number(p.precio_venta))}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
