"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Coins,
  FileText,
  Plus,
  Search,
  ShoppingCart,
  Users,
  Zap,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatearDOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buscarGlobal, type Resultado } from "@/app/(app)/buscar/actions";

const ACCIONES_RAPIDAS: Array<{
  label: string;
  href: string;
  icon: typeof Zap;
  desc: string;
}> = [
  {
    label: "Nuevo empeño",
    href: "/empenos/nuevo",
    icon: FileText,
    desc: "Crear préstamo sobre artículo",
  },
  {
    label: "Nueva venta",
    href: "/ventas/nueva",
    icon: ShoppingCart,
    desc: "Vender pieza o artículo",
  },
  {
    label: "Compra de oro",
    href: "/oro/compra",
    icon: Coins,
    desc: "Registrar compra al público",
  },
  {
    label: "Registrar cliente",
    href: "/clientes/nuevo",
    icon: Users,
    desc: "Alta nueva",
  },
];

function isTypingInField(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

// base-ui dialogs exponen `data-open` cuando están abiertos. Si ya hay un
// modal/sheet/popover abierto no queremos pisarlo con la paleta de comandos.
function hayModalAbierto(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(
    '[data-slot="dialog-content"][data-open], [data-slot="sheet-content"][data-open], [role="dialog"][data-open]',
  );
}

export function PagoRapido() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [pending, startTransition] = useTransition();
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const abrir = useCallback(() => {
    // Si ya hay otro modal abierto (formulario de pago, confirmación, etc.)
    // no lo tapamos con la paleta — el usuario está a mitad de una acción.
    if (hayModalAbierto()) return;
    setAbierto(true);
    setQuery("");
    setResultados([]);
    setIndiceSeleccionado(0);
  }, []);

  // Hotkeys: Cmd/Ctrl+K o tecla "P" cuando nada está enfocado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K: abre si no hay otro modal encima
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (hayModalAbierto()) return;
        e.preventDefault();
        abrir();
        return;
      }
      // Tecla "P" solo si no hay campo enfocado, no hay modificadores, y no
      // hay otro modal encima.
      if (
        e.key.toLowerCase() === "p" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !isTypingInField() &&
        !hayModalAbierto()
      ) {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir]);

  // Auto-focus al abrir
  useEffect(() => {
    if (abierto) {
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [abierto]);

  // Debounce de la búsqueda
  useEffect(() => {
    if (!abierto) return;
    const q = query.trim();
    if (q.length < 2) return; // no reiniciamos state aquí; se limpia al cerrar
    const id = setTimeout(() => {
      startTransition(async () => {
        const res = await buscarGlobal(q);
        setResultados(res);
        setIndiceSeleccionado(0);
      });
    }, 180);
    return () => clearTimeout(id);
  }, [query, abierto]);

  // Items navegables (resultados + acciones rápidas si la búsqueda está vacía)
  const mostrarAcciones = query.trim().length < 2;
  const itemsCount = mostrarAcciones ? ACCIONES_RAPIDAS.length : resultados.length;

  function navegar(item: Resultado) {
    setAbierto(false);
    if (item.tipo === "empeno") {
      router.push(`/empenos/${item.id}`);
    } else if (item.tipo === "cliente") {
      router.push(`/clientes/${item.id}`);
    } else if (item.tipo === "pieza") {
      router.push(`/joyeria/${item.id}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSeleccionado((i) => Math.min(i + 1, itemsCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSeleccionado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (mostrarAcciones) {
        const a = ACCIONES_RAPIDAS[indiceSeleccionado];
        if (a) {
          setAbierto(false);
          router.push(a.href);
        }
      } else {
        const r = resultados[indiceSeleccionado];
        if (r) navegar(r);
      }
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Pago rápido</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.trim().length < 2) setResultados([]);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar empeño, cliente, cédula o pieza…"
            className="h-12 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd className="hidden text-[10px] text-muted-foreground md:inline">
            ESC
          </kbd>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-2">
          {mostrarAcciones ? (
            <>
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acciones rápidas
              </p>
              <ul className="mt-1 space-y-0.5">
                {ACCIONES_RAPIDAS.map((a, i) => {
                  const activo = i === indiceSeleccionado;
                  const Icon = a.icon;
                  return (
                    <li key={a.href}>
                      <Link
                        href={a.href}
                        onClick={() => setAbierto(false)}
                        onMouseEnter={() => setIndiceSeleccionado(i)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                          activo
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{a.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {a.desc}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 border-t pt-2 px-2 text-[11px] text-muted-foreground">
                <p>
                  <kbd className="rounded bg-muted px-1">P</kbd> para abrir ·{" "}
                  <kbd className="rounded bg-muted px-1">⌘K</kbd> también
                  funciona ·{" "}
                  <kbd className="rounded bg-muted px-1">↑↓</kbd> para navegar
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {pending
                  ? "Buscando…"
                  : resultados.length === 0
                  ? "Sin resultados"
                  : "Resultados"}
              </p>
              <ul className="mt-1 space-y-0.5">
                {resultados.map((r, i) => {
                  const activo = i === indiceSeleccionado;
                  return (
                    <li key={`${r.tipo}-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => navegar(r)}
                        onMouseEnter={() => setIndiceSeleccionado(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                          activo
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <ItemIcon tipo={r.tipo} />
                        <ItemBody r={r} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemIcon({ tipo }: { tipo: Resultado["tipo"] }) {
  const Icon =
    tipo === "empeno" ? FileText : tipo === "cliente" ? Users : Coins;
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
      <Icon className="h-4 w-4" />
    </div>
  );
}

function ItemBody({ r }: { r: Resultado }) {
  if (r.tipo === "empeno") {
    return (
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-medium">{r.codigo}</p>
        <p className="text-[11px] text-muted-foreground">
          <span className="capitalize">{r.estado.replace(/_/g, " ")}</span> ·{" "}
          {formatearDOP(r.monto)}
        </p>
      </div>
    );
  }
  if (r.tipo === "cliente") {
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{r.nombre}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {r.cedula}
          {r.telefono ? ` · ${r.telefono}` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">{r.nombre}</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        {r.sku} · {formatearDOP(r.precio)}
      </p>
    </div>
  );
}
