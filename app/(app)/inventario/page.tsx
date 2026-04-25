import Link from "next/link";
import { Coins, Gem, Package, Scale, ShoppingCart } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearDOP, formatearFechaCorta } from "@/lib/format";
import type { Articulo, CompraOro, PiezaJoyeria, Prestamo } from "@/lib/supabase/types";

export const metadata = { title: "Inventario" };

type CompraOroConCliente = CompraOro & {
  clientes: { nombre_completo: string } | null;
};

/** Misma lógica de calendario que el cron: venta como propiedad el día después de vencimiento + días de gracia. */
function fechaPrimeraVentaPropiedad(ymdVencimiento: string, diasGracia: number): string {
  const [yy, mm, dd] = ymdVencimiento.split("-").map((x) => parseInt(x, 10));
  const t = new Date(yy, mm - 1, dd);
  t.setDate(t.getDate() + diasGracia + 1);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type PrestamoColateral = Pick<
  Prestamo,
  "id" | "codigo" | "estado" | "fecha_vencimiento" | "monto_prestado"
> & {
  articulos: Pick<Articulo, "id" | "descripcion" | "tipo" | "kilataje" | "peso_gramos"> | null;
  clientes: { nombre_completo: string } | null;
};

const SELECT_COMPRAS_ORO_INV =
  "id, codigo, kilataje, peso_gramos, precio_gramo, total_pagado, created_at, oro_disponible, notas, cliente_id, clientes:cliente_id(nombre_completo)";
const SELECT_COMPRAS_ORO_INV_LEGACY =
  "id, codigo, kilataje, peso_gramos, precio_gramo, total_pagado, created_at, notas, cliente_id, clientes:cliente_id(nombre_completo)";

/**
 * `compras_oro.oro_disponible` existe desde la migración 010. Si la BD no la tiene,
 * filtrar con `.eq("oro_disponible", true)` hace fallar toda la consulta y el oro
 * no aparece en inventario aunque los registros existan.
 */
async function cargarComprasOroStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CompraOroConCliente[]> {
  const res = await supabase
    .from("compras_oro")
    .select(SELECT_COMPRAS_ORO_INV)
    .order("created_at", { ascending: false });

  let rows: unknown[] = res.data ?? [];

  if (res.error) {
    const msg = res.error.message?.toLowerCase() ?? "";
    const columnaAusente =
      msg.includes("oro_disponible") ||
      msg.includes("does not exist") ||
      msg.includes("column") && msg.includes("compras_oro");

    if (!columnaAusente) {
      return [];
    }

    const res2 = await supabase
      .from("compras_oro")
      .select(SELECT_COMPRAS_ORO_INV_LEGACY)
      .order("created_at", { ascending: false });

    if (res2.error) return [];
    rows = res2.data ?? [];
  }

  return (rows as (CompraOroConCliente & { oro_disponible?: boolean })[]).filter(
    (r) => r.oro_disponible !== false,
  );
}

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: configRow } = await supabase.from("config_negocio").select("dias_gracia_vencimiento").limit(1).maybeSingle();
  const diasGracia = (configRow as { dias_gracia_vencimiento?: number } | null)?.dias_gracia_vencimiento ?? 7;

  const colateralRes = await supabase
    .from("prestamos")
    .select(
      "id, codigo, estado, fecha_vencimiento, monto_prestado, articulos:articulo_id (id, descripcion, tipo, kilataje, peso_gramos), clientes:cliente_id (nombre_completo)",
    )
    .in("estado", ["activo", "vencido_a_cobro"])
    .order("fecha_vencimiento", { ascending: true });

  const colateral = (colateralRes.data ?? []) as unknown as PrestamoColateral[];

  // 1) Artículos propiedad de la casa (vienen de empeños vencidos)
  const articulosRes = await supabase
    .from("articulos")
    .select("*")
    .eq("estado", "vencido_propio")
    .order("updated_at", { ascending: false });

  // 2) Oro comprado pendiente de procesar (oro_disponible !== false; ver cargarComprasOroStock)
  const oros = await cargarComprasOroStock(supabase);

  // 3) Piezas de joyería disponibles
  const joyeriaRes = await supabase
    .from("piezas_joyeria")
    .select(
      "id, sku, nombre, material, kilataje, peso_gramos, unidades_disponibles, precio_venta, estado, fotos_urls, created_at",
    )
    .in("estado", ["disponible", "reservada"])
    .order("created_at", { ascending: false })
    .limit(48);

  const articulos = (articulosRes.data ?? []) as Articulo[];
  const joyeria = (joyeriaRes.data ?? []) as unknown as PiezaJoyeria[];

  const totalOroGramos = oros.reduce((s, o) => s + Number(o.peso_gramos), 0);
  const totalOroDop = oros.reduce((s, o) => s + Number(o.total_pagado), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Package className="h-7 w-7 text-accent" /> Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            Oro en stock, colateral de empeños en tienda y bienes ya de la casa listos para vender.
          </p>
        </div>
      </FadeIn>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          titulo="Oro comprado"
          valor={`${oros.length}`}
          sub={`${totalOroGramos.toFixed(1)} g · ${formatearDOP(totalOroDop)}`}
        />
        <Stat titulo="Colateral (empeños)" valor={`${colateral.length}`} sub="en poder físico" />
        <Stat titulo="Propiedad casa" valor={`${articulos.length}`} sub="vendibles" />
        <Stat titulo="Piezas joyería" valor={`${joyeria.length}`} sub="disponibles" />
      </section>

      {/* Colateral: préstamos activos o en gracia (artículo aún empeñado) */}
      <FadeIn>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Scale className="h-5 w-5 text-violet-500" /> Colateral en tienda (empeños)
          </h2>
          <Link
            href="/empenos"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start sm:self-auto")}
          >
            Ver empeños
          </Link>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Joyas y artículos que están físicamente en la casa como garantía. No figuran como inventario
          vendible hasta pasar a propiedad de la casa tras la gracia legal; aquí los ves igualmente
          con su estado y fechas.
        </p>
      </FadeIn>

      {colateral.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay préstamos activos ni en cobro. Cuando registres un empeño, el artículo aparecerá
            aquí.
          </CardContent>
        </Card>
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colateral.map((p, i) => {
            const art = p.articulos;
            const fechaVentaPermitida =
              p.estado === "vencido_a_cobro"
                ? fechaPrimeraVentaPropiedad(p.fecha_vencimiento, diasGracia)
                : null;
            return (
              <FadeIn key={p.id} delay={i * 0.02}>
                <Card>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{p.codigo}</p>
                        <p className="text-sm font-semibold">{art?.descripcion ?? "Artículo"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.clientes?.nombre_completo ?? "—"}
                        </p>
                        {art?.kilataje != null && art.peso_gramos != null && (
                          <Badge variant="outline" className="mt-1">
                            {art.kilataje}K · {art.peso_gramos}g
                          </Badge>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0 ring-1",
                          p.estado === "activo"
                            ? "bg-sky-500/15 text-sky-900 ring-sky-500/35 dark:text-sky-200"
                            : "bg-orange-500/15 text-orange-950 ring-orange-500/40 dark:text-orange-200",
                        )}
                      >
                        {p.estado === "activo" ? "Préstamo activo" : "Vencido · gracia"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vence {formatearFechaCorta(p.fecha_vencimiento)} · préstamo{" "}
                      {formatearDOP(Number(p.monto_prestado))}
                    </div>
                    {p.estado === "vencido_a_cobro" && fechaVentaPermitida && (
                      <p className="text-xs font-medium text-foreground">
                        Venta como propiedad (tras cron): desde{" "}
                        <span className="tabular-nums">{formatearFechaCorta(fechaVentaPermitida)}</span>
                        <span className="block font-normal text-muted-foreground">
                          ({diasGracia} días de gracia tras el vencimiento, según configuración)
                        </span>
                      </p>
                    )}
                    {p.estado === "activo" && (
                      <p className="text-xs text-muted-foreground">
                        Sigue siendo del cliente hasta incumplimiento y gracia; no usar el flujo de
                        venta de inventario.
                      </p>
                    )}
                    <Link
                      href={`/empenos/${p.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
                    >
                      Abrir empeño
                    </Link>
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </ul>
      )}

      {/* Oro comprado pendiente de procesar */}
      <FadeIn>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-amber-500" /> Oro comprado —
            pendiente de procesar
          </h2>
          <Link
            href="/oro/compra"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            + Comprar oro
          </Link>
        </div>
      </FadeIn>

      {oros.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay oro en stock pendiente: no hay compras registradas, o ya se
            usaron en joyería (cada lote deja de listarse al crear la pieza desde esa
            compra). Las compras históricas siguen en Pagos y en la ficha del cliente.
          </CardContent>
        </Card>
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {oros.map((o, i) => (
            <FadeIn key={o.id} delay={i * 0.02}>
              <Card>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {o.codigo}
                      </p>
                      <p className="text-sm font-semibold">
                        {o.kilataje}K · {Number(o.peso_gramos).toFixed(2)}g
                      </p>
                      <p className="text-xs text-muted-foreground">
                        de {o.clientes?.nombre_completo ?? "—"}
                      </p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-200">
                      Disponible
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Pagado
                      </p>
                      <p className="font-semibold tabular-nums">
                        {formatearDOP(Number(o.total_pagado))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        a {formatearDOP(Number(o.precio_gramo))}/g
                      </p>
                    </div>
                    <Link
                      href={`/joyeria/nueva?compra_oro=${o.id}`}
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "gap-1.5",
                      )}
                      title="Crear una pieza de joyería a partir de este oro"
                    >
                      <Gem className="h-3.5 w-3.5" />
                      A joyería
                    </Link>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Desde {formatearFechaCorta(o.created_at)}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </ul>
      )}

      {/* Artículos propiedad de la casa */}
      <FadeIn>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5 text-blue-500" /> Artículos propiedad
          de la casa
        </h2>
      </FadeIn>

      {articulos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay artículos en inventario vendible (propiedad de la casa). Los empeños en curso o en
            gracia siguen en la sección de colateral arriba hasta que el sistema los marque listos
            para venta.
          </CardContent>
        </Card>
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articulos.map((a, i) => (
            <FadeIn key={a.id} delay={i * 0.03}>
              <Card className="overflow-hidden">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{a.descripcion}</p>
                      {a.kilataje && a.peso_gramos && (
                        <Badge variant="outline" className="mt-1">
                          {a.kilataje}K · {a.peso_gramos}g
                        </Badge>
                      )}
                    </div>
                    <Badge className="bg-accent/30 text-accent-foreground ring-1 ring-accent/50">
                      Propiedad casa
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {a.valor_tasado != null ? "Tasado en" : "Sin tasación"}
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {a.valor_tasado != null
                          ? formatearDOP(Number(a.valor_tasado))
                          : "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Link
                        href={`/ventas/nueva?articulo=${a.id}`}
                        className={cn(
                          buttonVariants({ variant: "default", size: "sm" }),
                          "gap-1.5",
                        )}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Vender tal cual
                      </Link>
                      {a.tipo === "joya_oro" && (
                        <Link
                          href={`/joyeria/convertir/${a.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "gap-1.5 text-xs",
                          )}
                          title="Pasa a la joyería con SKU, precio y ubicación"
                        >
                          <Gem className="h-3.5 w-3.5" />
                          Convertir a pieza
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Desde {formatearFechaCorta(a.updated_at)}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </ul>
      )}

      {/* Piezas de joyería disponibles */}
      <FadeIn>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Gem className="h-5 w-5 text-pink-500" /> Piezas de joyería
          </h2>
          <Link
            href="/joyeria"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ver todas
          </Link>
        </div>
      </FadeIn>

      {joyeria.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay piezas de joyería disponibles.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {joyeria.slice(0, 12).map((j, i) => (
            <FadeIn key={j.id} delay={i * 0.02}>
              <Card>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {j.sku}
                      </p>
                      <p className="text-sm font-semibold">{j.nombre}</p>
                      {j.kilataje && (
                        <Badge variant="outline" className="mt-1">
                          {j.material} · {j.kilataje}
                          {[10, 14, 18, 22, 24].includes(j.kilataje as number) ? "K" : ""}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      className={cn(
                        "ring-1",
                        j.estado === "disponible"
                          ? "bg-green-500/20 text-green-900 ring-green-500/40 dark:text-green-200"
                          : "bg-yellow-500/20 text-yellow-900 ring-yellow-500/40 dark:text-yellow-200",
                      )}
                    >
                      {j.estado}
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Venta</p>
                      <p className="font-bold tabular-nums">
                        {formatearDOP(Number(j.precio_venta))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        stock: {j.unidades_disponibles}
                      </p>
                    </div>
                    <Link
                      href={`/joyeria/${j.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Ver
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
