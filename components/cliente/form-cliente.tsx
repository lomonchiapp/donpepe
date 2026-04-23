"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Loader2, Save, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearCedula, limpiarCedula } from "@/lib/validaciones/cedula-do";
import {
  actualizarClienteAction,
  crearCliente,
  type ClienteFormState,
} from "@/app/(app)/clientes/actions";

interface Props {
  inicial?: {
    cedula?: string;
    nombre_completo?: string;
    telefono?: string | null;
    direccion?: string | null;
    notas?: string | null;
    edad?: number | null;
    color?: string | null;
    nacionalidad?: string | null;
    estado_civil?: string | null;
    oficio_profesion?: string | null;
  };
  modo?: "crear" | "editar";
  /** Requerido en modo `editar`. Se envía como campo oculto. */
  clienteId?: string;
  /** Callback en modo `editar` cuando la action terminó OK. */
  onSuccess?: () => void;
}

export function FormCliente({ inicial, modo = "crear", clienteId, onSuccess }: Props) {
  const [state, formAction] = useActionState<ClienteFormState | undefined, FormData>(
    modo === "editar" ? actualizarClienteAction : crearCliente,
    undefined,
  );
  const [cedula, setCedula] = useState(inicial?.cedula ?? "");

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  // Si alguno de los campos del libro ya vino lleno (modo editar),
  // abrimos la sección por defecto. Así el contable ve de inmediato
  // lo que tiene que completar.
  const hayDatosLibro =
    inicial?.edad != null ||
    !!inicial?.color ||
    !!inicial?.nacionalidad ||
    !!inicial?.estado_civil ||
    !!inicial?.oficio_profesion;
  const [libroAbierto, setLibroAbierto] = useState(hayDatosLibro);

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
      {modo === "editar" && clienteId && (
        <input type="hidden" name="__id" value={clienteId} />
      )}
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

      {/* Datos extendidos — necesarios para el libro de compraventa DGII */}
      <div className="rounded-lg border bg-muted/30">
        <button
          type="button"
          onClick={() => setLibroAbierto((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          aria-expanded={libroAbierto}
        >
          <div>
            <p className="text-sm font-medium">
              Datos para el libro de compraventa
            </p>
            <p className="text-xs text-muted-foreground">
              Opcional. El contable los necesita para el libro legal.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${
              libroAbierto ? "rotate-180" : ""
            }`}
          />
        </button>
        <AnimatePresence initial={false}>
          {libroAbierto && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 border-t px-4 pb-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Edad"
                    name="edad"
                    defaultValue={inicial?.edad ?? ""}
                    placeholder="35"
                    inputMode="numeric"
                    maxLength={3}
                    error={state?.fieldErrors?.edad}
                  />
                  <Field
                    label="Color"
                    name="color"
                    defaultValue={inicial?.color ?? ""}
                    placeholder="Indio, blanco…"
                    error={state?.fieldErrors?.color}
                  />
                </div>
                <Field
                  label="Nacionalidad"
                  name="nacionalidad"
                  defaultValue={inicial?.nacionalidad ?? "Dominicana"}
                  placeholder="Dominicana"
                  error={state?.fieldErrors?.nacionalidad}
                />
                <Field
                  label="Estado civil"
                  name="estado_civil"
                  defaultValue={inicial?.estado_civil ?? ""}
                  placeholder="Soltero, casado, unión libre…"
                  error={state?.fieldErrors?.estado_civil}
                />
                <Field
                  label="Oficio / Profesión"
                  name="oficio_profesion"
                  defaultValue={inicial?.oficio_profesion ?? ""}
                  placeholder="Comerciante, ama de casa…"
                  error={state?.fieldErrors?.oficio_profesion}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
