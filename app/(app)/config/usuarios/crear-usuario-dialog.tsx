"use client";

import { useState, useTransition } from "react";
import { UserPlus, Eye, EyeOff, Shuffle } from "lucide-react";
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

import { crearUsuario } from "./actions";

/**
 * Dialog para que el admin cree un nuevo usuario con:
 *  - email, nombre, password inicial
 *  - teléfono de WhatsApp (opcional)
 *  - checklist de módulos a los que tendrá acceso
 *
 * El usuario nuevo no puede ser admin: solo ixidominicana@gmail.com (hardcoded).
 */
export function CrearUsuarioDialog() {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPass, setMostrarPass] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [modulos, setModulos] = useState<Set<ModuloCodigo>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggleModulo(codigo: ModuloCodigo) {
    setModulos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  function resetForm() {
    setEmail("");
    setNombre("");
    setPassword("");
    setTelefono("");
    setModulos(new Set());
    setMostrarPass(false);
  }

  function generarPassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let p = "";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) {
      p += chars[arr[i] % chars.length];
    }
    setPassword(p);
    setMostrarPass(true);
  }

  function onCrear() {
    if (!email.trim() || !nombre.trim() || !password.trim()) {
      toast.error("Email, nombre y contraseña son obligatorios.");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", email.trim());
      fd.set("nombre", nombre.trim());
      fd.set("password", password);
      if (telefono.trim()) fd.set("telefono_whatsapp", telefono.trim());
      for (const codigo of modulos) {
        fd.append("modulos", codigo);
      }

      const res = await crearUsuario(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombre} creado. Comparte la contraseña por WhatsApp.`);
      resetForm();
      setAbierto(false);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger render={<Button size="sm" className="gap-2" />}>
        <UserPlus className="h-4 w-4" />
        Nuevo usuario
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            Define email, contraseña inicial y a qué módulos tendrá acceso. La
            contraseña se la compartes por WhatsApp; el usuario podrá cambiarla
            desde su perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="crear-email">Email</Label>
              <Input
                id="crear-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@donpepe.do"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crear-nombre">Nombre</Label>
              <Input
                id="crear-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan Pérez"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="crear-password">Contraseña inicial</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="crear-password"
                  type={mostrarPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={mostrarPass ? "Ocultar" : "Mostrar"}
                >
                  {mostrarPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generarPassword}
                className="gap-1.5"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Generar
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="crear-telefono">Teléfono WhatsApp (opcional)</Label>
            <Input
              id="crear-telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="829-555-0000"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Módulos permitidos</Label>
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAbierto(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={onCrear} disabled={pending}>
            {pending ? "Creando..." : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
