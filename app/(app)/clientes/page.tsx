import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { TablaClientes, type ClienteRow } from "@/components/cliente/tabla-clientes";
import type { Cliente } from "@/lib/supabase/types";

export const metadata = { title: "Clientes" };

interface SearchProps {
  searchParams: Promise<{ q?: string }>;
}

async function fetchClientes(q?: string): Promise<ClienteRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q && q.trim().length > 0) {
    const term = q.trim();
    query = query.or(
      `nombre_completo.ilike.%${term}%,cedula.ilike.%${term}%,telefono.ilike.%${term}%`,
    );
  }

  const { data } = await query;
  const clientes = (data ?? []) as Cliente[];
  if (clientes.length === 0) return [];

  const ids = clientes.map((c) => c.id);

  // Conteos agregados en paralelo. Usamos `select(id)` con el filtro
  // `in` para traer solo ids y contar en memoria — es más liviano que
  // N queries con `count: 'exact', head: true`.
  const [prestamosRes, comprasRes, facturasRes] = await Promise.all([
    supabase
      .from("prestamos")
      .select("cliente_id, estado")
      .in("cliente_id", ids),
    supabase
      .from("compras_oro")
      .select("cliente_id")
      .in("cliente_id", ids),
    supabase
      .from("facturas")
      .select("cliente_id")
      .in("cliente_id", ids),
  ]);

  const empenosTotal = new Map<string, number>();
  const empenosActivos = new Map<string, number>();
  for (const row of (prestamosRes.data ?? []) as {
    cliente_id: string;
    estado: string;
  }[]) {
    empenosTotal.set(row.cliente_id, (empenosTotal.get(row.cliente_id) ?? 0) + 1);
    if (row.estado === "activo" || row.estado === "vencido_a_cobro") {
      empenosActivos.set(
        row.cliente_id,
        (empenosActivos.get(row.cliente_id) ?? 0) + 1,
      );
    }
  }

  const comprasOro = new Map<string, number>();
  for (const row of (comprasRes.data ?? []) as { cliente_id: string }[]) {
    comprasOro.set(row.cliente_id, (comprasOro.get(row.cliente_id) ?? 0) + 1);
  }

  const facturas = new Map<string, number>();
  for (const row of (facturasRes.data ?? []) as { cliente_id: string | null }[]) {
    if (!row.cliente_id) continue;
    facturas.set(row.cliente_id, (facturas.get(row.cliente_id) ?? 0) + 1);
  }

  return clientes.map((c) => ({
    ...c,
    empenos_total: empenosTotal.get(c.id) ?? 0,
    empenos_activos: empenosActivos.get(c.id) ?? 0,
    compras_oro_total: comprasOro.get(c.id) ?? 0,
    facturas_total: facturas.get(c.id) ?? 0,
  }));
}

export default async function ClientesPage({ searchParams }: SearchProps) {
  const { q } = await searchParams;
  const clientes = await fetchClientes(q);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
              <Users className="h-7 w-7" /> Clientes
            </h1>
            <p className="text-sm text-muted-foreground">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
            </p>
          </div>
          <Link
            href="/clientes/nuevo"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "gap-1.5",
            )}
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <form action="/clientes" method="get" className="mb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nombre, cédula o teléfono"
              className="h-11 pl-10"
            />
          </div>
        </form>
      </FadeIn>

      {clientes.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm text-muted-foreground">
              {q
                ? `No se encontraron clientes para "${q}".`
                : "Aún no hay clientes registrados."}
            </p>
            <Link
              href="/clientes/nuevo"
              className={cn(buttonVariants({ variant: "default" }), "mt-4")}
            >
              Crear primer cliente
            </Link>
          </CardContent>
        </Card>
      ) : (
        <FadeIn delay={0.1}>
          <TablaClientes clientes={clientes} />
        </FadeIn>
      )}
    </div>
  );
}
