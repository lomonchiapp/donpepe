"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient as createSupabase } from "@/lib/supabase/client";
import { useCedulaLookup } from "@/lib/hooks/use-cedula-lookup";
import {
  formatearCedula,
  limpiarCedula,
} from "@/lib/validaciones/cedula-do";
import { crearClienteRapido } from "@/app/(app)/clientes/actions";
import type { Cliente } from "@/lib/supabase/types";

interface Props {
  value: Cliente | null;
  onSelect: (c: Cliente | null) => void;
  placeholder?: string;
}

/** Debounce del input de búsqueda por nombre. 500ms es suficiente para que
 * el usuario pueda pausar entre palabras sin gatillar la UI de "no encontré". */
const BUSQUEDA_DEBOUNCE_MS = 500;

/** Mínimo de caracteres para decidir que hay "no resultados". Con 2 chars
 * todavía no sabemos — cualquier "Ju" puede ser Juan, Julia, Julio. */
const MIN_CHARS_NO_RESULTS = 3;

function looksLikeCedula(raw: string): boolean {
  const clean = raw.replace(/[\s-]/g, "");
  return /^\d+$/.test(clean) && clean.length >= 1;
}

type Paso =
  | { tipo: "buscar" }
  | { tipo: "crear-con-nombre"; nombre: string };

export function BuscadorClienteConCedula({
  value,
  onSelect,
  placeholder = "Buscar por nombre o cédula",
}: Props) {
  const [paso, setPaso] = useState<Paso>({ tipo: "buscar" });
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscandoDB, setBuscandoDB] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state: lookup, lookup: doLookup, reset: resetLookup } =
    useCedulaLookup();

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // Si ya hay cliente seleccionado, la caja muestra el resumen
  if (value) {
    return (
      <Card className="border-success/40 bg-success/5">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success font-bold">
            {value.nombre_completo.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{value.nombre_completo}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {value.cedula}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
            Cambiar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Paso 2: el usuario decidió crear con un nombre
  if (paso.tipo === "crear-con-nombre") {
    return (
      <CrearDesdeName
        nombre={paso.nombre}
        onVolver={() => setPaso({ tipo: "buscar" })}
        onConfirm={(cliente) => onSelect(cliente)}
      />
    );
  }

  const cleanDigits = limpiarCedula(q);
  const isCedula = cleanDigits.length === 11;
  const isTypingCedula = looksLikeCedula(q.trim()) && q.trim().length >= 1;
  const isTypingName = q.trim().length >= 2 && !isTypingCedula;

  // Solo ofrecemos "crear con nombre" cuando:
  //   - el input tiene >= MIN_CHARS_NO_RESULTS
  //   - ya terminó la búsqueda en DB (searchDone)
  //   - no hay resultados
  //   - el lookup de cédula está idle (no chocar con mensajes de cédula)
  const nombreRecortado = q.trim();
  const ofrecerCrearConNombre =
    !buscandoDB &&
    searchDone &&
    isTypingName &&
    nombreRecortado.length >= MIN_CHARS_NO_RESULTS &&
    resultados.length === 0 &&
    lookup.status === "idle";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digits = limpiarCedula(raw);
    const cedulaCompleta = digits.length === 11;

    const pretty = cedulaCompleta ? formatearCedula(digits) : raw;
    setQ(pretty);
    setSearchDone(false);

    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (raw.trim().length < 2) {
      setResultados([]);
      resetLookup();
      setBuscandoDB(false);
      return;
    }

    setBuscandoDB(true);
    searchTimer.current = setTimeout(async () => {
      const supabase = createSupabase();
      const termBusqueda = cedulaCompleta ? formatearCedula(digits) : raw;
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .or(
          `nombre_completo.ilike.%${termBusqueda}%,cedula.ilike.%${termBusqueda}%`,
        )
        .limit(8);
      const filas = (data ?? []) as Cliente[];
      setResultados(filas);
      setBuscandoDB(false);
      setSearchDone(true);

      if (cedulaCompleta && filas.length === 0) {
        doLookup(digits);
      } else {
        resetLookup();
      }
    }, BUSQUEDA_DEBOUNCE_MS);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder={placeholder}
          value={q}
          onChange={handleChange}
          inputMode="text"
          maxLength={80}
          className="h-12 pl-10 text-base"
        />
        {(buscandoDB || lookup.status === "loading") && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Resultados de la DB */}
      {resultados.length > 0 && (
        <ul className="space-y-2">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left"
              >
                <Card className="transition-all hover:-translate-y-0.5 hover:border-primary">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {c.nombre_completo.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {c.nombre_completo}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.cedula}
                      </p>
                    </div>
                    {c.telefono && (
                      <Badge variant="outline" className="text-[10px]">
                        {c.telefono}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Cédula confirmada en el padrón, operador captura nombre */}
      {lookup.status === "found" && resultados.length === 0 && (
        <CedulaEncontrada
          data={lookup.data!}
          onConfirm={(cliente) => onSelect(cliente)}
        />
      )}

      {/* Cédula NO válida */}
      {lookup.status === "not-found" && resultados.length === 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-destructive">
                Cédula no reconocida
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lookup.message ?? "No aparece en el padrón dominicano."}
              </p>
              <Link
                href={`/clientes/nuevo?cedula=${encodeURIComponent(q)}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Crear manualmente de todas formas
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nombre sin resultados → invitación a crear (sin autoFocus, sin forzar) */}
      <AnimatePresence>
        {ofrecerCrearConNombre && (
          <motion.div
            key="crear-con-nombre-cta"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Card className="border-dashed border-primary/40 bg-primary/5">
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <UserPlus className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      Sin coincidencias
                    </p>
                    <p className="truncate text-sm">
                      No encontramos a{" "}
                      <span className="font-semibold">“{nombreRecortado}”</span>
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setPaso({ tipo: "crear-con-nombre", nombre: nombreRecortado })
                  }
                  className="gap-1.5 shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Crear con este nombre
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dígitos incompletos (cédula a medias) */}
      {!buscandoDB &&
        searchDone &&
        isTypingCedula &&
        !isCedula &&
        lookup.status === "idle" &&
        resultados.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-5 text-center">
              <p className="text-sm text-muted-foreground">
                Escribe la cédula completa (11 dígitos) para verificar en el
                padrón.
              </p>
            </CardContent>
          </Card>
        )}

      {/* Sigue escribiendo el nombre — mensaje soft, no agresivo */}
      {!buscandoDB &&
        searchDone &&
        isTypingName &&
        nombreRecortado.length < MIN_CHARS_NO_RESULTS &&
        resultados.length === 0 && (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Escribe al menos {MIN_CHARS_NO_RESULTS} letras para buscar.
              </p>
            </CardContent>
          </Card>
        )}

      {/* Placeholder inicial */}
      {q.trim().length < 2 && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex items-center gap-3 py-4">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Busca por nombre o pega la cédula — verificamos contra el padrón
              JCE.
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CedulaEncontrada({
  data,
  onConfirm,
}: {
  data: { cedula: string; source: "padron" | "luhn" };
  onConfirm: (c: Cliente) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleCreate() {
    if (nombre.trim().length < 3) {
      toast.error("Ingresa el nombre completo.");
      return;
    }
    startTransition(async () => {
      const res = await crearClienteRapido({
        cedula: data.cedula,
        nombre_completo: nombre.trim(),
        telefono: telefono.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Proyectamos a Cliente completo con nulls en los campos no capturados.
      onConfirm({
        id: res.cliente.id,
        cedula: res.cliente.cedula,
        nombre_completo: res.cliente.nombre_completo,
        telefono: res.cliente.telefono,
        direccion: null,
        foto_cedula_url: null,
        foto_cliente_url: null,
        notas: null,
        edad: null,
        color: null,
        nacionalidad: null,
        estado_civil: null,
        oficio_profesion: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  }

  const mensajeVerificacion =
    data.source === "padron"
      ? "Cédula verificada en el padrón JCE"
      : "Cédula con formato válido";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-success/40 bg-success/5">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-success">
                {mensajeVerificacion}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {data.cedula}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nombre completo</Label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Escribe el nombre tal como aparece en la cédula"
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Teléfono (opcional)</Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="(809) 555-1234"
              inputMode="tel"
              className="h-11 text-base"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={pending}
            size="lg"
            className="w-full gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Crear y continuar
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Paso 2 explícito: el usuario decidió crear un cliente con el nombre que
 * escribió. Aquí sí es seguro tener autoFocus en cédula y permitir editar
 * el nombre si se equivocó.
 */
function CrearDesdeName({
  nombre,
  onVolver,
  onConfirm,
}: {
  nombre: string;
  onVolver: () => void;
  onConfirm: (c: Cliente) => void;
}) {
  const [nombreEdit, setNombreEdit] = useState(nombre);
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pending, startTransition] = useTransition();
  const { state: lookup, lookup: doLookup, reset: resetLookup } =
    useCedulaLookup();

  function handleCedulaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const clean = limpiarCedula(raw);
    const formatted = clean.length === 11 ? formatearCedula(clean) : raw;
    setCedula(formatted);

    if (clean.length === 11) {
      doLookup(clean);
    } else {
      resetLookup();
    }
  }

  const cedulaClean = limpiarCedula(cedula);
  const cedulaReady =
    cedulaClean.length === 11 &&
    (lookup.status === "found" || lookup.status === "not-found");

  const verificationLabel =
    lookup.status === "found"
      ? lookup.data?.source === "padron"
        ? "Verificada en el padrón JCE"
        : "Formato válido"
      : lookup.status === "not-found"
        ? lookup.message ?? "No aparece en el padrón"
        : null;

  async function handleCreate() {
    if (nombreEdit.trim().length < 3) {
      toast.error("El nombre es muy corto.");
      return;
    }
    if (cedulaClean.length !== 11) {
      toast.error("Ingresa la cédula completa (11 dígitos).");
      return;
    }
    startTransition(async () => {
      const res = await crearClienteRapido({
        cedula: formatearCedula(cedulaClean),
        nombre_completo: nombreEdit.trim(),
        telefono: telefono.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onConfirm({
        id: res.cliente.id,
        cedula: res.cliente.cedula,
        nombre_completo: res.cliente.nombre_completo,
        telefono: res.cliente.telefono,
        direccion: null,
        foto_cedula_url: null,
        foto_cliente_url: null,
        notas: null,
        edad: null,
        color: null,
        nacionalidad: null,
        estado_civil: null,
        oficio_profesion: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onVolver}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a buscar
            </button>
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nombre completo</Label>
            <Input
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              placeholder="Nombre tal como aparece en la cédula"
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cédula</Label>
            <div className="relative">
              <Input
                autoFocus
                value={cedula}
                onChange={handleCedulaChange}
                placeholder="000-0000000-0"
                inputMode="numeric"
                maxLength={13}
                className="h-11 text-base"
              />
              {lookup.status === "loading" && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {verificationLabel && (
              <p
                className={`flex items-center gap-1 text-xs ${
                  lookup.status === "found"
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {lookup.status === "found" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {verificationLabel}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Teléfono (opcional)</Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="(809) 555-1234"
              inputMode="tel"
              className="h-11 text-base"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={pending || (!cedulaReady && lookup.status !== "idle")}
            size="lg"
            className="w-full gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Crear y continuar
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
