import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MapPin, FileText, Coins, Plus } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BotonEliminarCliente } from "@/components/cliente/boton-eliminar";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  formatearDOP,
  formatearFechaCorta,
  formatearTelefono,
} from "@/lib/format";
import type { Cliente, Prestamo, CompraOro } from "@/lib/supabase/types";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [clienteRes, prestamosRes, orosRes] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("prestamos")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("compras_oro")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const cliente = clienteRes.data as Cliente | null;
  if (!cliente) notFound();

  const prestamos = (prestamosRes.data ?? []) as Prestamo[];
  const compras = (orosRes.data ?? []) as CompraOro[];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <FadeIn>
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
              {cliente.nombre_completo.charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold md:text-2xl">
                {cliente.nombre_completo}
              </h1>
              <p className="text-sm font-mono text-muted-foreground">{cliente.cedula}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/empenos/nuevo?cliente=${cliente.id}`}
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "gap-1.5")}
            >
              <Plus className="h-4 w-4" /> Nuevo empeño
            </Link>
            <BotonEliminarCliente
              cliente_id={cliente.id}
              nombre={cliente.nombre_completo}
              totalEmpenos={prestamos.length}
              totalCompras={compras.length}
            />
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-4 md:grid-cols-3">
        <FadeIn delay={0.05} className="md:col-span-1">
          <Card>
            <CardContent className="space-y-3 py-5 text-sm">
              {cliente.telefono && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{formatearTelefono(cliente.telefono)}</span>
                </div>
              )}
              {cliente.direccion && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{cliente.direccion}</span>
                </div>
              )}
              <div className="pt-2 text-xs text-muted-foreground">
                Registrado el {formatearFechaCorta(cliente.created_at)}
              </div>
              {cliente.notas && (
                <div className="mt-3 rounded-md bg-muted p-3 text-xs">
                  {cliente.notas}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1} className="md:col-span-2 space-y-4">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-4 w-4" /> Empeños ({prestamos.length})
            </h2>
            {prestamos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Sin empeños aún.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {prestamos.map((p) => (
                  <li key={p.id}>
                    <Link href={`/empenos/${p.id}`}>
                      <Card className="transition-all hover:-translate-y-0.5 hover:shadow">
                        <CardContent className="flex items-center justify-between py-3">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">
                              {p.codigo}
                            </p>
                            <p className="text-sm font-semibold">
                              {formatearDOP(Number(p.monto_prestado))}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {p.estado.replace("_", " ")}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {compras.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Coins className="h-4 w-4" /> Compras de oro ({compras.length})
              </h2>
              <ul className="space-y-2">
                {compras.map((c) => (
                  <li key={c.id}>
                    <Card>
                      <CardContent className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {c.codigo}
                          </p>
                          <p className="text-sm">
                            {c.peso_gramos}g · {c.kilataje}K
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatearDOP(Number(c.total_pagado))}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
