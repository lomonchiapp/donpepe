"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/supabase/types";

import { actualizarPerfil } from "../actions";
import { SaveButton } from "../save-button";

export function FormPerfil({ me }: { me: AppUser }) {
  const [pending, start] = useTransition();

  async function onSubmit(formData: FormData) {
    start(async () => {
      const res = await actualizarPerfil(formData);
      if (res?.error) toast.error(res.error);
      else toast.success("Perfil actualizado");
    });
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      <form action={onSubmit} className="space-y-5">
        <input type="hidden" name="id" value={me.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={me.nombre}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={me.email} disabled className="h-11 bg-muted/40" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono_whatsapp">Teléfono WhatsApp</Label>
          <Input
            id="telefono_whatsapp"
            name="telefono_whatsapp"
            defaultValue={me.telefono_whatsapp ?? ""}
            placeholder="(809) 555-1234"
            inputMode="tel"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Aquí recibirás el resumen diario de vencimientos.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3.5">
          <div className="min-w-0">
            <Label htmlFor="alertas" className="text-[15px] font-medium">
              Alertas por WhatsApp
            </Label>
            <p className="text-xs text-muted-foreground">
              Recibir resumen diario de empeños por vencer.
            </p>
          </div>
          <Switch
            id="alertas"
            name="recibir_alertas"
            defaultChecked={me.recibir_alertas}
            value="true"
          />
        </div>

        <div className="pt-1">
          <SaveButton pending={pending}>Guardar perfil</SaveButton>
        </div>
      </form>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Cerrar sesión</p>
          <p className="text-xs text-muted-foreground">
            Terminarás la sesión en este dispositivo.
          </p>
        </div>
        <Button variant="outline" onClick={cerrarSesion} className="gap-1.5">
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </div>
    </div>
  );
}
