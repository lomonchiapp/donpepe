import Link from "next/link";
import { FileStack, Receipt } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ConfigEmpty } from "../config-empty";
import { cargarConfigYUsuario } from "../loader";
import { Section } from "../section";
import { FormFacturacion } from "./form-facturacion";

export const metadata = { title: "Facturación — Configuración" };

export default async function ConfigFacturacionPage() {
  const { config } = await cargarConfigYUsuario();

  if (!config) {
    return (
      <Section
        icon={<Receipt className="h-5 w-5" />}
        titulo="Facturación DGII"
        descripcion="Datos fiscales para emitir facturas electrónicas."
      >
        <ConfigEmpty />
      </Section>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        icon={<Receipt className="h-5 w-5" />}
        titulo="Datos fiscales"
        descripcion="Aparecen en cada factura emitida. Son obligatorios para facturar."
      >
        <FormFacturacion config={config} />
      </Section>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <FileStack className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Rangos NCF autorizados</p>
              <p className="text-xs text-muted-foreground">
                Cargar y administrar los rangos de comprobantes autorizados por la DGII.
              </p>
            </div>
          </div>
          <Link
            href="/config/ncf"
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            Gestionar rangos
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
