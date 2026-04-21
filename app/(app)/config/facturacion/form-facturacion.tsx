"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ConfigNegocio } from "@/lib/supabase/types";

import { actualizarFacturacion } from "../actions";
import { SaveButton } from "../save-button";

export function FormFacturacion({ config }: { config: ConfigNegocio }) {
  const [pending, start] = useTransition();

  async function onSubmit(formData: FormData) {
    start(async () => {
      const res = await actualizarFacturacion(formData);
      if (res?.error) toast.error(res.error);
      else toast.success("Datos de facturación actualizados");
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={config.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rnc">RNC</Label>
          <Input
            id="rnc"
            name="rnc"
            defaultValue={config.rnc ?? ""}
            placeholder="131-12345-6"
            className="h-11 font-mono tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="razon_social">Razón social</Label>
          <Input
            id="razon_social"
            name="razon_social"
            defaultValue={config.razon_social ?? ""}
            placeholder="Nombre legal en DGII"
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion_fiscal">Dirección fiscal</Label>
        <Input
          id="direccion_fiscal"
          name="direccion_fiscal"
          defaultValue={config.direccion_fiscal ?? ""}
          placeholder="Av. Máximo Gómez #123, Santo Domingo, DN"
          className="h-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email_fiscal">Email fiscal</Label>
          <Input
            id="email_fiscal"
            name="email_fiscal"
            type="email"
            defaultValue={config.email_fiscal ?? ""}
            placeholder="facturacion@empresa.do"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Email registrado ante la DGII para recibir notificaciones.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="itbis_default">ITBIS por defecto</Label>
          <div className="relative">
            <Input
              id="itbis_default"
              name="itbis_default"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={String(config.itbis_default)}
              className="h-11 pr-8 tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Normalmente 18% en RD.</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="logo_factura_url">URL del logo para facturas</Label>
        <Input
          id="logo_factura_url"
          name="logo_factura_url"
          type="url"
          defaultValue={config.logo_factura_url ?? ""}
          placeholder="https://…"
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Se imprime en la cabecera de cada factura electrónica.
        </p>
      </div>

      <div className="pt-1">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}
