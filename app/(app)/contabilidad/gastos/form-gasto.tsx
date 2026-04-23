"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FORMAS_PAGO_DGII,
  TIPOS_GASTO_DGII,
} from "@/lib/dgii/categorias";

import { crearGasto } from "./actions";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FormGasto() {
  const [pending, startTransition] = useTransition();
  const [resetCount, setResetCount] = useState(0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await crearGasto(fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Gasto registrado");
        form.reset();
        setResetCount((c) => c + 1);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} key={resetCount} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha">
          <Input
            type="date"
            name="fecha"
            defaultValue={hoy()}
            required
          />
        </Campo>
        <Campo label="Monto (RD$)">
          <Input
            type="number"
            name="monto"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
          />
        </Campo>
      </div>

      <Campo label="Concepto">
        <Input
          name="concepto"
          required
          placeholder="Alquiler del local · factura EDE Este · pago nómina…"
          maxLength={200}
        />
      </Campo>

      <Campo label="Categoría DGII">
        <select
          name="categoria"
          defaultValue="02"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {TIPOS_GASTO_DGII.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.codigo} · {t.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="RNC/Cédula proveedor">
          <Input
            name="rnc_proveedor"
            placeholder="ej. 130123456 o 00112345678"
            inputMode="numeric"
          />
        </Campo>
        <Campo label="Tipo ID">
          <select
            name="tipo_id_proveedor"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Auto</option>
            <option value="1">1 · RNC</option>
            <option value="2">2 · Cédula</option>
          </select>
        </Campo>
      </div>

      <Campo label="Nombre/Razón social del proveedor">
        <Input name="nombre_proveedor" placeholder="opcional" maxLength={200} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="NCF (si aplica)">
          <Input name="ncf" placeholder="B01XXXXXXXXX / E31…" maxLength={19} />
        </Campo>
        <Campo label="NCF modificado">
          <Input name="ncf_modificado" placeholder="opcional" maxLength={19} />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="ITBIS facturado">
          <Input
            type="number"
            name="itbis_facturado"
            step="0.01"
            min="0"
            defaultValue="0"
          />
        </Campo>
        <Campo label="ITBIS retenido">
          <Input
            type="number"
            name="itbis_retenido"
            step="0.01"
            min="0"
            defaultValue="0"
          />
        </Campo>
      </div>

      <Campo label="Forma de pago">
        <select
          name="forma_pago"
          defaultValue="01"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {FORMAS_PAGO_DGII.map((f) => (
            <option key={f.codigo} value={f.codigo}>
              {f.codigo} · {f.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Notas">
        <Textarea
          name="notas"
          rows={2}
          placeholder="opcional"
          maxLength={500}
        />
      </Campo>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar gasto"}
        </Button>
      </div>
    </form>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
