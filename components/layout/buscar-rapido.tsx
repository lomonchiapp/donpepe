"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Gem, Loader2, Search, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { buscarGlobal, type Resultado } from "@/app/(app)/buscar/actions";
import { formatearDOP } from "@/lib/format";
import { cn } from "@/lib/utils";

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

function hrefPara(r: Resultado): string {
  if (r.tipo === "cliente") return `/clientes/${r.id}`;
  if (r.tipo === "empeno") return `/empenos/${r.id}`;
  return `/joyeria/${r.id}`;
}

function labelTipo(r: Resultado): string {
  if (r.tipo === "cliente") return "Cliente";
  if (r.tipo === "empeno") return "Empeño";
  return "Joyería";
}

export function BuscarRapido() {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cursor, setCursor] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const abrir = useCallback(() => {
    setQ("");
    setResultados([]);
    setCursor(0);
    setAbierto(true);
  }, []);

  const cerrar = useCallback(() => setAbierto(false), []);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) abrir();
      else cerrar();
    },
    [abrir, cerrar],
  );

  const ejecutar = useCallback(
    (r: Resultado) => {
      setAbierto(false);
      router.push(hrefPara(r));
    },
    [router],
  );

  const onChangeQ = useCallback((val: string) => {
    setQ(val);
    if (val.trim().length < 2) {
      setResultados([]);
      setCursor(0);
    }
  }, []);

  // Debounce: ejecuta búsqueda 150ms después del último cambio.
  useEffect(() => {
    if (!abierto) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) return;

    const id = setTimeout(() => {
      startTransition(async () => {
        const res = await buscarGlobal(trimmed);
        setResultados(res);
        setCursor(0);
      });
    }, 150);

    return () => clearTimeout(id);
  }, [q, abierto]);

  // Hotkey global "/" para abrir (si no está escribiendo).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (abierto) return;
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, abrir]);

  const total = resultados.length;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Buscar"
        className="ml-auto flex h-10 max-w-md flex-1 items-center gap-2 rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground hover:bg-muted md:ml-0 md:w-80 md:flex-none"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Buscar cédula, cliente o ticket…
        </span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-block">
          /
        </kbd>
      </button>

      <Dialog open={abierto} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <DialogDescription className="sr-only">
            Busca clientes, empeños y piezas de joyería
          </DialogDescription>

          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => onChangeQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => (total ? (c + 1) % total : 0));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => (total ? (c - 1 + total) % total : 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const r = resultados[cursor];
                  if (r) ejecutar(r);
                }
              }}
              autoFocus
              placeholder="Cédula, cliente, ticket, pieza, SKU…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {pending && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {q.trim().length < 2 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Escribe al menos 2 caracteres.
              </div>
            ) : total === 0 && !pending ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Sin resultados.
              </div>
            ) : (
              <ul className="py-1">
                {resultados.map((r, i) => {
                  const activo = cursor === i;
                  const Icon =
                    r.tipo === "cliente"
                      ? User
                      : r.tipo === "empeno"
                        ? FileText
                        : Gem;
                  return (
                    <li key={`${r.tipo}-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => ejecutar(r)}
                        onMouseEnter={() => setCursor(i)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          activo ? "bg-primary/10" : "hover:bg-muted/60",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          {r.tipo === "cliente" && (
                            <>
                              <p className="truncate text-sm font-medium">
                                {r.nombre}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">
                                {r.cedula}
                                {r.telefono ? ` · ${r.telefono}` : ""}
                              </p>
                            </>
                          )}
                          {r.tipo === "empeno" && (
                            <>
                              <p className="truncate font-mono text-sm font-medium">
                                {r.codigo}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {formatearDOP(r.monto)} ·{" "}
                                <span className="capitalize">
                                  {r.estado.replace("_", " ")}
                                </span>
                              </p>
                            </>
                          )}
                          {r.tipo === "pieza" && (
                            <>
                              <p className="truncate text-sm font-medium">
                                {r.nombre}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">
                                {r.sku} · {formatearDOP(r.precio)}
                              </p>
                            </>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          {labelTipo(r)}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
                  ↑↓
                </kbd>
                mover
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
                  ↵
                </kbd>
                ir
              </span>
            </span>
            <span>
              {total > 0 &&
                `${total} resultado${total === 1 ? "" : "s"}`}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
