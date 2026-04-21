"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfigNegocio } from "@/lib/supabase/types";

import { actualizarGeneral } from "../actions";
import { SaveButton } from "../save-button";

export function FormGeneral({ config }: { config: ConfigNegocio }) {
  const [pending, start] = useTransition();

  async function onSubmit(formData: FormData) {
    start(async () => {
      const res = await actualizarGeneral(formData);
      if (res?.error) toast.error(res.error);
      else toast.success("Datos del negocio actualizados");
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={config.id} />

      <div className="space-y-2">
        <Label htmlFor="nombre_comercial">Nombre comercial</Label>
        <Input
          id="nombre_comercial"
          name="nombre_comercial"
          defaultValue={config.nombre_comercial}
          className="h-11"
          required
        />
        <p className="text-xs text-muted-foreground">
          Aparece en recibos, facturas y notificaciones a clientes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            defaultValue={config.telefono ?? ""}
            inputMode="tel"
            placeholder="(809) 555-0100"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo_url">URL del logo</Label>
          <Input
            id="logo_url"
            name="logo_url"
            type="url"
            defaultValue={config.logo_url ?? ""}
            placeholder="https://…"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Se muestra en cabeceras de recibos.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion">Dirección del local</Label>
        <Input
          id="direccion"
          name="direccion"
          defaultValue={config.direccion ?? ""}
          placeholder="Calle, número, sector, ciudad"
          className="h-11"
        />
      </div>

      <div className="pt-2">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}
