"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Plus, FileText, Coins, UserPlus, ShoppingCart, Gem, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cada acción usa una de las "tints" del sistema iOS para iconos circulares
 * de fondo (estilo Settings iOS — donde cada categoría tiene su color).
 */
const ACCIONES = [
  { href: "/empenos/nuevo",  label: "Empeño",  icon: FileText,     bg: "bg-primary text-primary-foreground" },
  { href: "/oro/compra",     label: "Oro",     icon: Coins,        bg: "bg-warning text-warning-foreground" },
  { href: "/joyeria/nueva",  label: "Pieza",   icon: Gem,          bg: "bg-[oklch(0.585_0.215_309)] text-white" },
  { href: "/clientes/nuevo", label: "Cliente", icon: UserPlus,     bg: "bg-[oklch(0.788_0.13_230)] text-white" },
  { href: "/ventas/nueva",   label: "Venta",   icon: ShoppingCart, bg: "bg-success text-success-foreground" },
];

/**
 * Floating Action Button — abanico expansivo (sólo móvil).
 *
 * Estilo Apple Hardware metallic: el botón principal usa `wine-gradient`
 * (graphite Big Sur) con highlight inset. Las acciones expanden con springs
 * iOS con stagger inverso al cerrar.
 */
export function Fab() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-30 md:hidden safe-bottom">
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-md"
            onClick={() => setAbierto(false)}
          />
        )}
      </AnimatePresence>

      <div className="relative flex flex-col items-end gap-3">
        <AnimatePresence>
          {abierto &&
            ACCIONES.map((accion, i) => {
              const Icon = accion.icon;
              return (
                <motion.div
                  key={accion.href}
                  initial={{ opacity: 0, scale: 0.6, y: 16 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { delay: i * 0.04, type: "spring", stiffness: 420, damping: 28 },
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.6,
                    y: 16,
                    transition: { delay: (ACCIONES.length - i - 1) * 0.025 },
                  }}
                  className="flex items-center gap-3"
                >
                  <span
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[13px] font-[590] tracking-[-0.01em]",
                      "material-thick shadow-elevated border border-border/40",
                    )}
                  >
                    {accion.label}
                  </span>
                  <Link
                    href={accion.href}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full shadow-elevated",
                      "ring-1 ring-inset ring-white/15",
                      accion.bg,
                    )}
                  >
                    <Icon className="h-[20px] w-[20px]" strokeWidth={2} />
                  </Link>
                </motion.div>
              );
            })}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setAbierto(!abierto)}
          whileTap={{ scale: 0.92 }}
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-full",
            "wine-gradient text-accent shadow-floating",
            // Highlight superior interior tipo Apple Hardware brillado
            "ring-1 ring-inset ring-white/15",
            "before:absolute before:inset-x-2 before:top-1 before:h-3 before:rounded-full",
            "before:bg-gradient-to-b before:from-white/25 before:to-transparent",
            "before:pointer-events-none",
          )}
          aria-label="Acciones rápidas"
        >
          <motion.span
            animate={{ rotate: abierto ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="relative z-10"
          >
            {abierto ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" strokeWidth={2.2} />}
          </motion.span>
        </motion.button>
      </div>
    </div>
  );
}
