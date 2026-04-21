"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "motion/react";
import { Loader2, Save, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearCedula, limpiarCedula } from "@/lib/validaciones/cedula-do";
import { crearCliente, type ClienteFormState } from "@/app/(app)/clientes/actions";

interface Props {
  inicial?: {
    cedula?: string;
    nombre_completo?: string;
    telefono?: string | null;
    direccion?: string | null;
    notas?: string | null;
  };
  modo?: "crear" | "editar";
}

export function FormCliente({ inicial, modo = "crear" }: Props) {
  const [state, formAction] = useActionState<ClienteFormState | undefined, FormData>(
    crearCliente,
    undefined,
  );
  const [cedula, setCedula] = useState(inicial?.cedula ?? "");

  function handleCedulaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const clean = limpiarCedula(e.target.value).slice(0, 11);
    setCedula(clean.length === 11 ? formatearCedula(clean) : clean);
  }

  return (
    <motion.form
      action={formAction}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <Field
        label="Cédula"
        name="cedula"
        value={cedula}
        onChange={handleCedulaChange}
        placeholder="000-0000000-0"
        required
        inputMode="numeric"
        maxLength={13}
        error={state?.fieldErrors?.cedula}
      />
      <Field
        label="Nombre completo"
        name="nombre_completo"
        defaultValue={inicial?.nombre_completo}
        placeholder="María Fernández Santos"
        required
        autoComplete="name"
        error={state?.fieldErrors?.nombre_completo}
      />
      <Field
        label="Teléfono"
        name="telefono"
        defaultValue={inicial?.telefono ?? ""}
        placeholder="(809) 555-1234"
        inputMode="tel"
        autoComplete="tel"
        error={state?.fieldErrors?.telefono}
      />
      <Field
        label="Dirección"
        name="direccion"
        defaultValue={inicial?.direccion ?? ""}
        placeholder="Sector, ciudad"
        error={state?.fieldErrors?.direccion}
      />

      <div className="space-y-2">
        <Label htmlFor="notas" className="text-base">
          Notas (opcional)
        </Label>
        <Textarea
          id="notas"
          name="notas"
          defaultValue={inicial?.notas ?? ""}
          rows={3}
          placeholder="Cualquier detalle sobre este cliente…"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <SubmitBtn modo={modo} />
    </motion.form>
  );
}

function Field({
  label,
  error,
  name,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-base">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        className="h-12 text-base"
        aria-invalid={!!error || undefined}
        {...rest}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SubmitBtn({ modo }: { modo: "crear" | "editar" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full h-12 text-base">
      {pending ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : modo === "crear" ? (
        <UserPlus className="mr-2 h-5 w-5" />
      ) : (
        <Save className="mr-2 h-5 w-5" />
      )}
      {modo === "crear" ? "Crear cliente" : "Guardar cambios"}
    </Button>
  );
}
