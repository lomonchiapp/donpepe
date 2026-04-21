import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gem } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { FormConvertirArticulo } from "@/components/joyeria/form-convertir-articulo";
import { createClient } from "@/lib/supabase/server";
import type { Articulo, CategoriaJoyeria } from "@/lib/supabase/types";

export const metadata = { title: "Convertir artículo a pieza" };

interface Props {
  params: Promise<{ articuloId: string }>;
}

export default async function ConvertirPage({ params }: Props) {
  const { articuloId } = await params;
  const supabase = await createClient();

  const [artRes, catRes] = await Promise.all([
    supabase
      .from("articulos")
      .select("*")
      .eq("id", articuloId)
      .maybeSingle(),
    supabase
      .from("categorias_joyeria")
      .select("*")
      .eq("activo", true)
      .order("orden"),
  ]);

  const articulo = artRes.data as Articulo | null;
  if (!articulo) notFound();
  if (articulo.estado !== "vencido_propio") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          href="/inventario"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inventario
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-5 text-sm text-destructive">
          Solo se pueden convertir artículos que ya pasaron a propiedad de la
          casa. Este artículo está en estado{" "}
          <strong>{articulo.estado}</strong>.
        </div>
      </div>
    );
  }

  const categorias = (catRes.data ?? []) as CategoriaJoyeria[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/inventario"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Inventario
      </Link>
      <FadeIn>
        <div className="mb-1 flex items-center gap-2">
          <Gem className="h-6 w-6 text-chart-3" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Convertir a pieza de joyería
          </h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          El artículo de la compraventa pasa a ser una pieza comercial con SKU,
          precio y ubicación propia.
        </p>
      </FadeIn>

      <FormConvertirArticulo articulo={articulo} categorias={categorias} />
    </div>
  );
}
