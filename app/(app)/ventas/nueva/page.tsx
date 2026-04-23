import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { FormVenta } from "@/components/ventas/form-venta";
import { createClient } from "@/lib/supabase/server";
import type { Articulo } from "@/lib/supabase/types";

export const metadata = { title: "Nueva venta" };

interface Props {
  searchParams: Promise<{ articulo?: string }>;
}

export default async function NuevaVentaPage({ searchParams }: Props) {
  const { articulo: articuloId } = await searchParams;
  if (!articuloId) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("articulos")
    .select("*")
    .eq("id", articuloId)
    .maybeSingle();

  if (!data) notFound();
  const articulo = data as Articulo;

  // Precio sugerido: si hay valor tasado histórico, lo usamos + 40% de margen
  // (práctica común). Para artículos nuevos sin tasado, el operador lo define
  // manualmente en el formulario — mejor cero que una cifra inventada.
  const precioSugerido =
    articulo.valor_tasado != null
      ? Math.round(Number(articulo.valor_tasado) * 1.4)
      : 0;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 md:py-8">
      <Link
        href="/inventario"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Inventario
      </Link>
      <FadeIn>
        <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">
          Registrar venta
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Vende un artículo propiedad de la casa.
        </p>
      </FadeIn>
      <FormVenta articulo={articulo} precio_sugerido={precioSugerido} />
    </div>
  );
}
