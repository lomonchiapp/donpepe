"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODULOS_ASIGNABLES, type ModuloCodigo } from "@/lib/permisos/modulos";
import type { AppUser } from "@/lib/supabase/types";

import { editarUsuario } from "./actions";

export function EditarUsuarioDialog({ usuario }: { usuario: AppUser }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(usuario.nombre);
  const [telefono, setTelefono] = useState(usuario.telefono_whatsapp ?? "");
  const [modulos, setModulos] = useState<Set<string>>(
    new Set(usuario.modulos_permitidos),
  );
  const [pending, startTransition] = useTransition();

  const esAdminFijo = usuario.es_admin;

  function toggleModulo(codigo: ModuloCodigo) {
    setModulos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  function onGuardar() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", usuario.id);
      fd.set("nombre", nombre.trim());
      fd.set("telefono_whatsapp", telefono.trim());
      for (const codigo of modulos) fd.append("modulos", codigo);

      const res = await editarUsuario(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Usuario actualizado.");
      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
          />
        }
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {usuario.nombre}</DialogTitle>
          <DialogDescription>
            {esAdminFijo
              ? "Este usuario es el super-admin. Tiene acceso total y no se pueden modificar sus permisos."
              : "Modifica los módulos a los que tiene acceso, su nombre y teléfono."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="editar-nombre">Nombre</Label>
              <Input
                id="editar-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-telefono">Teléfono WhatsApp</Label>
              <Input
                id="editar-telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {usuario.email}
            </p>
            <p className="text-xs text-muted-foreground">
              El email no se puede cambiar.
            </p>
          </div>

          {!esAdminFijo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Módulos permitidos
                </Label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      setModulos(
                        new Set(MODULOS_ASIGNABLES.map((m) => m.codigo)),
                      )
                    }
                  >
                    Todos
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:underline"
                    onClick={() => setModulos(new Set())}
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {MODULOS_ASIGNABLES.map((m) => {
                  const Icon = m.icon;
                  const checked = modulos.has(m.codigo);
                  return (
                    <label
                      key={m.codigo}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModulo(m.codigo)}
                        className="mt-0.5 h-4 w-4 accent-primary"
                      />
                      <span className="flex-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {m.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {m.descripcion}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAbierto(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
