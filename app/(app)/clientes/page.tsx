import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatearFechaCorta, formatearTelefono } from "@/lib/format";
import type { Cliente } from "@/lib/supabase/types";

export const metadata = { title: "Clientes" };

interface SearchProps {
  searchParams: Promise<{ q?: string }>;
}

async function fetchClientes(q?: string): Promise<Cliente[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q && q.trim().length > 0) {
    const term = q.trim();
    query = query.or(`nombre_completo.ilike.%${term}%,cedula.ilike.%${term}%`);
  }

  const { data } = await query;
  return (data ?? []) as Cliente[];
}

export default async function ClientesPage({ searchParams }: SearchProps) {
  const { q } = await searchParams;
  const clientes = await fetchClientes(q);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Clientes
            </h1>
            <p className="text-sm text-muted-foreground">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
            </p>
          </div>
          <Link
            href="/clientes/nuevo"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "gap-1.5")}
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <form action="/clientes" method="get" className="mb-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nombre o cédula"
              className="h-12 pl-10 text-base"
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
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c, i) => (
            <FadeIn key={c.id} delay={0.02 * i}>
              <Link href={`/clientes/${c.id}`}>
                <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {c.nombre_completo.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {c.nombre_completo}
                      </p>
                      <p className="truncate text-xs text-muted-foreground font-mono">
                        {c.cedula}
                      </p>
                      {c.telefono && (
                        <p className="truncate text-xs text-muted-foreground">
                          {formatearTelefono(c.telefono)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatearFechaCorta(c.created_at)}
                    </span>
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
