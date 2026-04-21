import Link from "next/link";
import { Search } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatearDOP } from "@/lib/format";

export const metadata = { title: "Buscar" };

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function BuscarPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  const tieneQuery = q.trim().length >= 2;

  const [clientesRes, empenosRes] = tieneQuery
    ? await Promise.all([
        supabase
          .from("clientes")
          .select("id, nombre_completo, cedula, telefono")
          .or(`nombre_completo.ilike.%${q}%,cedula.ilike.%${q}%`)
          .limit(10),
        supabase
          .from("prestamos")
          .select("id, codigo, monto_prestado, estado")
          .ilike("codigo", `%${q}%`)
          .limit(10),
      ])
    : [{ data: null }, { data: null }];

  const clientes = (clientesRes.data ?? []) as Array<{
    id: string;
    nombre_completo: string;
    cedula: string;
    telefono: string | null;
  }>;
  const empenos = (empenosRes.data ?? []) as Array<{
    id: string;
    codigo: string;
    monto_prestado: number;
    estado: string;
  }>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <FadeIn>
        <h1 className="mb-4 text-2xl font-bold">Buscar</h1>
        <form action="/buscar" method="get" className="mb-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="Cédula, nombre o código DP-2026-00001"
              className="h-12 pl-10 text-base"
            />
          </div>
        </form>
      </FadeIn>

      {!tieneQuery ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Escribe al menos 2 caracteres.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {clientes.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clientes
              </h2>
              <ul className="space-y-2">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`}>
                      <Card className="hover:border-primary">
                        <CardContent className="flex items-center gap-3 py-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                            {c.nombre_completo.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {c.nombre_completo}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {c.cedula}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {empenos.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Empeños
              </h2>
              <ul className="space-y-2">
                {empenos.map((e) => (
                  <li key={e.id}>
                    <Link href={`/empenos/${e.id}`}>
                      <Card className="hover:border-primary">
                        <CardContent className="flex items-center justify-between py-3">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">
                              {e.codigo}
                            </p>
                            <p className="text-sm font-semibold">
                              {formatearDOP(Number(e.monto_prestado))}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {e.estado.replace("_", " ")}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {clientes.length === 0 && empenos.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No se encontraron resultados para &ldquo;{q}&rdquo;.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
