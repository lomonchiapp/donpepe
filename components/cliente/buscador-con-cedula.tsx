"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
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
  /** Etiqueta del cuadro de búsqueda — ej. "¿Quién trae el artículo?" */
  placeholder?: string;
}

/**
 * Buscador de clientes con verificación de cédula contra el padrón dominicano.
 *
 * Flujo:
 *  1. Usuario escribe: si es texto busca por nombre; si son 11 dígitos busca por cédula.
 *  2. Si la cédula no está en la base local, verifica contra OGTIC/Megaplus.
 *  3. Si la cédula es real, muestra el nombre y permite crearlo inline sin salir del wizard.
 *  4. Si no se valida, el operador puede crear manualmente (link a /clientes/nuevo).
 *
 * Esto evita que vengan a empeñar/vender oro con cédulas falsas.
 */
export function BuscadorClienteConCedula({
  value,
  onSelect,
  placeholder = "Buscar por nombre o cédula",
}: Props) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscandoDB, setBuscandoDB] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state: lookup, lookup: doLookup, reset: resetLookup } =
    useCedulaLookup();

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // Si el usuario ya seleccionó un cliente, muestra la tarjeta verde.
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cleanDigits = limpiarCedula(raw);
    const isCedula = cleanDigits.length === 11;

    // Formatea visualmente la cédula si está completa
    const pretty = isCedula ? formatearCedula(cleanDigits) : raw;
    setQ(pretty);

    // 1) Buscar en DB (por nombre o cédula)
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (raw.trim().length < 2) {
      setResultados([]);
      resetLookup();
      return;
    }

    setBuscandoDB(true);
    searchTimer.current = setTimeout(async () => {
      const supabase = createSupabase();
      const termBusqueda = isCedula ? formatearCedula(cleanDigits) : raw;
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

      // 2) Si es cédula completa y no hay match en DB, verifica en OGTIC
      if (isCedula && filas.length === 0) {
        doLookup(cleanDigits);
      } else {
        resetLookup();
      }
    }, 300);
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

      {/* Estado: cédula verificada en OGTIC, cliente nuevo */}
      {lookup.status === "found" && resultados.length === 0 && (
        <CedulaEncontrada
          data={lookup.data!}
          onConfirm={(cliente) => onSelect(cliente)}
        />
      )}

      {/* Estado: cédula NO válida */}
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

      {/* Sin resultados por nombre */}
      {!buscandoDB &&
        lookup.status === "idle" &&
        q.trim().length >= 2 &&
        resultados.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-5 text-center">
              <p className="mb-2 text-sm text-muted-foreground">
                Sin resultados por nombre.
              </p>
              <p className="text-xs text-muted-foreground">
                Escribe la cédula completa (11 dígitos) para verificar en el
                padrón.
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
  data: { cedula: string; fullName?: string };
  onConfirm: (c: Cliente) => void;
}) {
  const [nombre, setNombre] = useState(data.fullName ?? "");
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
      <Card className="border-success/40 bg-success/5">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-success">
                Cédula verificada en el padrón
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {data.cedula}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nombre completo</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del ciudadano"
              className="h-11 text-base"
            />
            {data.fullName && nombre !== data.fullName && (
              <button
                type="button"
                onClick={() => setNombre(data.fullName!)}
                className="text-[11px] text-primary hover:underline"
              >
                Usar sugerencia del padrón: {data.fullName}
              </button>
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
