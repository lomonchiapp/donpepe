"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormCliente } from "@/components/cliente/form-cliente";
import type { Cliente } from "@/lib/supabase/types";

interface Props {
  cliente: Cliente;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Diálogo para editar un cliente reutilizando `FormCliente` en modo
 * `editar`. Cierra el dialog cuando la action termina OK y dispara un
 * toast.
 */
export function EditarClienteDialog({ cliente, open, onOpenChange }: Props) {
  // Key para remontar el form al abrir/cerrar (limpia useActionState).
  const [key, setKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setKey((k) => k + 1);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Actualiza los datos de {cliente.nombre_completo}.
          </DialogDescription>
        </DialogHeader>
        <FormCliente
          key={key}
          modo="editar"
          clienteId={cliente.id}
          inicial={{
            cedula: cliente.cedula,
            nombre_completo: cliente.nombre_completo,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            notas: cliente.notas,
            edad: cliente.edad,
            color: cliente.color,
            nacionalidad: cliente.nacionalidad,
            estado_civil: cliente.estado_civil,
            oficio_profesion: cliente.oficio_profesion,
          }}
          onSuccess={() => {
            toast.success("Cliente actualizado");
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
