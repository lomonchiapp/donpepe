"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Coins,
  FileText,
  Gem,
  History,
  Plus,
  ShoppingCart,
  Sparkles,
  UserPlus,
  type LucideProps,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type IconType = ComponentType<LucideProps>;

interface Accion {
  key: string;
  titulo: string;
  desc: string;
  href: string;
  icon: IconType;
  accent: string;
  ring: string;
}

interface Grupo {
  titulo: string;
  acciones: Accion[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: "Compraventa",
    acciones: [
      {
        key: "E",
        titulo: "Empeño nuevo",
        desc: "Inicia el wizard desde cero con cliente, artículo y préstamo.",
        href: "/empenos/nuevo",
        icon: FileText,
        accent: "bg-primary/10 text-primary",
        ring: "ring-primary/30",
      },
      {
        key: "R",
        titulo: "Registrar existente",
        desc: "Empeños que venían corriendo en papel, con pagos previos.",
        href: "/empenos/registrar-existente",
        icon: History,
        accent: "bg-accent/20 text-accent-foreground",
        ring: "ring-accent/40",
      },
      {
        key: "O",
        titulo: "Compra de oro",
        desc: "Tasa y compra oro al público con el precio del día.",
        href: "/oro/compra",
        icon: Coins,
        accent: "bg-chart-2/15 text-chart-2",
        ring: "ring-chart-2/30",
      },
    ],
  },
  {
    titulo: "Joyería y ventas",
    acciones: [
      {
        key: "J",
        titulo: "Pieza de joyería",
        desc: "Crea una pieza individual o un lote para la joyería.",
        href: "/joyeria/nueva",
        icon: Gem,
        accent: "bg-chart-3/15 text-chart-3",
        ring: "ring-chart-3/30",
      },
      {
        key: "V",
        titulo: "Registrar venta",
        desc: "Vende un artículo propiedad de la casa desde el inventario.",
        href: "/inventario",
        icon: ShoppingCart,
        accent: "bg-success/15 text-success",
        ring: "ring-success/30",
      },
      {
        key: "C",
        titulo: "Nuevo cliente",
        desc: "Registra un cliente con cédula, teléfono y foto.",
        href: "/clientes/nuevo",
        icon: UserPlus,
        accent: "bg-secondary text-secondary-foreground",
        ring: "ring-border",
      },
    ],
  },
];

const ACCIONES_FLAT = GRUPOS.flatMap((g) => g.acciones);

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

// Detección de plataforma sin setState-in-effect: useSyncExternalStore
// devuelve false en el servidor y el valor real al hidratar en cliente.
const subscribeNoop = () => () => {};
const getEsMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function NuevoMegaMenu() {
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const esMac = useSyncExternalStore(
    subscribeNoop,
    getEsMac,
    () => false,
  );

  const abrir = useCallback(() => {
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
    (href: string) => {
      setAbierto(false);
      router.push(href);
    },
    [router],
  );

  // Hotkeys globales
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = isEditableTarget(e.target);

      // ⌘K / Ctrl+K siempre abre/cierra
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (abierto) cerrar();
        else abrir();
        return;
      }

      // Atajos dentro del menú
      if (abierto) {
        if (e.key === "Escape") {
          cerrar();
          return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          setCursor((c) => (c + 1) % ACCIONES_FLAT.length);
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          setCursor(
            (c) => (c - 1 + ACCIONES_FLAT.length) % ACCIONES_FLAT.length,
          );
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const accion = ACCIONES_FLAT[cursor];
          if (accion) ejecutar(accion.href);
          return;
        }

        // Teclas directas (E, R, O, J, C, V) solo cuando el menú está abierto.
        // No requieren modificador porque el popup tiene el focus.
        if (e.key.length === 1 && /^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const letra = e.key.toUpperCase();
          const accion = ACCIONES_FLAT.find((a) => a.key === letra);
          if (accion) {
            e.preventDefault();
            ejecutar(accion.href);
          }
        }
        return;
      }

      // Cuando está cerrado: "N" abre (si no está escribiendo)
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          abrir();
          return;
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, cursor, ejecutar, abrir, cerrar]);

  const shortcutBadge = useMemo(
    () => (esMac ? "⌘K" : "Ctrl+K"),
    [esMac],
  );

  return (
    <>
      <Button
        ref={btnRef}
        size="sm"
        onClick={() => setAbierto(true)}
        className="hidden items-center gap-1.5 pr-1.5 md:inline-flex"
        aria-label={`Crear nuevo (${shortcutBadge})`}
      >
        <Plus className="h-4 w-4" />
        <span>Nuevo</span>
        <kbd className="ml-1 hidden rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-primary-foreground/90 lg:inline-block">
          {shortcutBadge}
        </kbd>
      </Button>

      <Dialog open={abierto} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-3xl gap-0 p-0 sm:max-w-3xl"
        >
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg wine-gradient">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <DialogTitle className="text-base">Crear nuevo</DialogTitle>
                <DialogDescription className="text-xs">
                  Elige una acción o pulsa la letra resaltada.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>mover</span>
              <Kbd>↵</Kbd>
              <span>ir</span>
              <Kbd>Esc</Kbd>
              <span>salir</span>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            {GRUPOS.map((grupo) => (
              <div key={grupo.titulo} className="mb-4 last:mb-0">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {grupo.titulo}
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {grupo.acciones.map((a) => {
                    const indexGlobal = ACCIONES_FLAT.findIndex(
                      (x) => x.key === a.key,
                    );
                    const activo = cursor === indexGlobal;
                    const Icon = a.icon;
                    return (
                      <Link
                        key={a.key}
                        href={a.href}
                        onClick={() => setAbierto(false)}
                        onMouseEnter={() => setCursor(indexGlobal)}
                        className={cn(
                          "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                          activo
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        {activo && (
                          <motion.span
                            layoutId="megamenu-cursor"
                            className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 32,
                            }}
                          />
                        )}
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                            a.accent,
                            a.ring,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {a.titulo}
                            </p>
                            <Kbd className="text-[10px]">{a.key}</Kbd>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {a.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span>
              Abre con <Kbd>N</Kbd> o <Kbd>{shortcutBadge}</Kbd>
            </span>
            <span>Don Pepe</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-foreground/80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
