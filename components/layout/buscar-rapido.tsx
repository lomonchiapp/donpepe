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

  // Hotkeys globales:
  //   - "/" cuando no se está escribiendo (estilo Slack/Notion)
  //   - "⌘K" / "Ctrl+K" siempre (estilo macOS Spotlight / Linear)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘K / Ctrl+K — siempre abre, incluso si está escribiendo
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (abierto) cerrar();
        else abrir();
        return;
      }
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
  }, [abierto, abrir, cerrar]);

  const total = resultados.length;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Buscar"
        className={cn(
          "ml-auto flex h-9 max-w-md flex-1 items-center gap-2",
          "rounded-[10px] border border-transparent bg-secondary px-3.5",
          "text-[13.5px] tracking-[-0.005em] text-muted-foreground",
          "transition-[background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-ios)]",
          "hover:bg-secondary/70",
          "md:ml-0 md:w-80 md:flex-none",
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Buscar cédula, cliente o ticket…
        </span>
        <span className="hidden items-center gap-1 md:inline-flex">
          <kbd className="rounded-[5px] border border-border/60 bg-card px-1.5 py-0.5 font-sans text-[10px] font-[590] text-muted-foreground">
            ⌘K
          </kbd>
        </span>
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

          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
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
              className="flex-1 bg-transparent text-[15px] tracking-[-0.005em] outline-none placeholder:text-muted-foreground/70"
            />
            {pending && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <kbd className="hidden rounded-[5px] border border-border/60 bg-secondary px-1.5 py-0.5 font-sans text-[10px] font-[590] text-muted-foreground sm:inline-block">
              esc
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

          <div className="flex items-center justify-between border-t border-border/60 bg-secondary/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded-[4px] border border-border/60 bg-card px-1 py-0.5 font-sans text-[10px] font-[590]">
                  ↑↓
                </kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded-[4px] border border-border/60 bg-card px-1 py-0.5 font-sans text-[10px] font-[590]">
                  ↵
                </kbd>
                abrir
              </span>
            </span>
            <span className="font-[510]">
              {total > 0 &&
                `${total} ${total === 1 ? "resultado" : "resultados"}`}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
