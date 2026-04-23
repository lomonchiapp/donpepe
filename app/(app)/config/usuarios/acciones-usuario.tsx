"use client";

import { useState, useTransition } from "react";
import {
  MoreHorizontal,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  Eye,
  EyeOff,
  Shuffle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppUser } from "@/lib/supabase/types";

import {
  desactivarUsuario,
  eliminarUsuario,
  reactivarUsuario,
  resetearPassword,
} from "./actions";

/**
 * Menú de acciones por usuario: reset password, activar/desactivar, eliminar.
 * El super-admin no expone ninguna acción destructiva (el menú se esconde).
 */
export function AccionesUsuario({
  usuario,
  meId,
}: {
  usuario: AppUser;
  meId: string;
}) {
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Al super-admin no se le puede hacer nada destructivo desde acá.
  if (usuario.es_admin) {
    return null;
  }

  const esYo = usuario.id === meId;

  function simpleCall(
    fn: (fd: FormData) => Promise<{ ok: true } | { error: string }>,
    mensajeOK: string,
  ) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", usuario.id);
      const res = await fn(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(mensajeOK);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Más acciones"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Resetear contraseña
          </DropdownMenuItem>
          {usuario.activo ? (
            <DropdownMenuItem
              onSelect={() =>
                simpleCall(desactivarUsuario, "Usuario desactivado")
              }
              disabled={esYo}
            >
              <UserX className="mr-2 h-4 w-4" />
              Desactivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                simpleCall(reactivarUsuario, "Usuario reactivado")
              }
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Reactivar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            disabled={esYo}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar definitivamente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        usuario={usuario}
      />

      <EliminarDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        usuario={usuario}
        pending={pending}
        onConfirmar={() =>
          simpleCall(eliminarUsuario, "Usuario eliminado definitivamente")
        }
      />
    </>
  );
}

function ResetPasswordDialog({
  open,
  onOpenChange,
  usuario,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuario: AppUser;
}) {
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [pending, startTransition] = useTransition();

  function generar() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    let p = "";
    for (let i = 0; i < arr.length; i++) p += chars[arr[i] % chars.length];
    setPassword(p);
    setMostrar(true);
  }

  function onConfirmar() {
    if (password.length < 8) {
      toast.error("Mínimo 8 caracteres.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", usuario.id);
      fd.set("password", password);
      const res = await resetearPassword(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Contraseña actualizada. Comparte la nueva con ${usuario.nombre}.`);
      setPassword("");
      setMostrar(false);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setPassword("");
          setMostrar(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
          <DialogDescription>
            Define una nueva contraseña para {usuario.nombre}. Se la compartes
            después por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reset-password">Nueva contraseña</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                id="reset-password"
                type={mostrar ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {mostrar ? (
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
              onClick={generar}
              className="gap-1.5"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Generar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={onConfirmar} disabled={pending}>
            {pending ? "Cambiando..." : "Cambiar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EliminarDialog({
  open,
  onOpenChange,
  usuario,
  pending,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuario: AppUser;
  pending: boolean;
  onConfirmar: () => void;
}) {
  const [emailConfirma, setEmailConfirma] = useState("");
  const puedeEliminar = emailConfirma.trim().toLowerCase() === usuario.email.toLowerCase();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setEmailConfirma("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Eliminar usuario definitivamente
          </DialogTitle>
          <DialogDescription>
            Esta acción es <strong>irreversible</strong>. Se borrará la cuenta
            de <strong>{usuario.nombre}</strong> ({usuario.email}) del sistema
            de autenticación y de la base de datos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirma-email" className="text-sm">
            Para confirmar, escribe el email del usuario:
          </Label>
          <Input
            id="confirma-email"
            value={emailConfirma}
            onChange={(e) => setEmailConfirma(e.target.value)}
            placeholder={usuario.email}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!puedeEliminar) {
                toast.error("El email no coincide.");
                return;
              }
              onConfirmar();
              onOpenChange(false);
            }}
            disabled={pending || !puedeEliminar}
          >
            {pending ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
