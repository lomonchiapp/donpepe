import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ConfigNegocio, Recibo } from "@/lib/supabase/types";
import { FormEmitirFactura } from "@/components/facturas/form-emitir";

export const metadata = { title: "Emitir factura" };

interface ReciboDetallado extends Recibo {
  pagos: {
    id: string;
    prestamo_id: string | null;
    venta_id: string | null;
    compra_oro_id: string | null;
  } | null;
}

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ recibo?: string }>;
}) {
  const { recibo: reciboId } = await searchParams;
  const supabase = await createClient();

  const [reciboRes, cfgRes, rangosRes] = await Promise.all([
    reciboId
      ? supabase
          .from("recibos")
          .select(
            "*, pagos(id, prestamo_id, venta_id, compra_oro_id)",
          )
          .eq("id", reciboId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("config_negocio").select("*").limit(1).maybeSingle(),
    supabase
      .from("ncf_rangos")
      .select("tipo_comprobante")
      .eq("estado", "activo"),
  ]);

  const recibo = (reciboRes.data ?? null) as unknown as ReciboDetallado | null;
  const config = (cfgRes.data as ConfigNegocio | null) ?? null;
  const tiposActivos = new Set(
    ((rangosRes.data ?? []) as Array<{ tipo_comprobante: string }>).map(
      (r) => r.tipo_comprobante,
    ),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <FadeIn>
        <div className="mb-6 flex items-center gap-2">
          <Link
            href={recibo ? `/recibos/${recibo.id}` : "/facturas"}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            {recibo ? "Volver al recibo" : "Facturas"}
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">
          Emitir factura
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {recibo
            ? `Desde recibo ${recibo.codigo}`
            : "Factura manual (sin recibo asociado)"}
        </p>
      </FadeIn>

      {!config?.rnc && (
        <FadeIn delay={0.1}>
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Aún no has configurado el RNC del negocio. Las facturas se emitirán
            sin RNC del emisor.{" "}
            <Link href="/config" className="font-medium underline">
              Configurar
            </Link>
          </div>
        </FadeIn>
      )}

      {tiposActivos.size === 0 && (
        <FadeIn delay={0.1}>
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            No hay rangos NCF activos cargados. Carga al menos un rango para
            poder emitir facturas con NCF.{" "}
            <Link href="/config/ncf" className="font-medium underline">
              Cargar rango
            </Link>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-6">
            <FormEmitirFactura
              recibo={
                recibo
                  ? {
                      id: recibo.id,
                      tipo: recibo.tipo,
                      cliente_id: recibo.cliente_id,
                      cliente_nombre: recibo.cliente_nombre,
                      cliente_cedula: recibo.cliente_cedula,
                      cliente_telefono: recibo.cliente_telefono,
                      concepto: recibo.concepto,
                      items: recibo.items,
                    }
                  : null
              }
              tiposNcfActivos={Array.from(tiposActivos)}
            />
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
