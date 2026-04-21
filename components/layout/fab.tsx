"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Plus, FileText, Coins, UserPlus, ShoppingCart, Gem, X } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCIONES = [
  { href: "/empenos/nuevo", label: "Empeño", icon: FileText, bg: "bg-primary text-primary-foreground" },
  { href: "/oro/compra", label: "Oro", icon: Coins, bg: "bg-accent text-accent-foreground" },
  { href: "/joyeria/nueva", label: "Pieza", icon: Gem, bg: "bg-chart-3 text-white" },
  { href: "/clientes/nuevo", label: "Cliente", icon: UserPlus, bg: "bg-secondary text-secondary-foreground" },
  { href: "/ventas/nueva", label: "Venta", icon: ShoppingCart, bg: "bg-success text-success-foreground" },
];

/**
 * Floating Action Button con abanico expansivo (sólo móvil).
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
            className="fixed inset-0 bg-background/60 backdrop-blur-sm"
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
                  initial={{ opacity: 0, scale: 0.6, y: 20 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { delay: i * 0.04, type: "spring", stiffness: 400, damping: 28 },
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.6,
                    y: 20,
                    transition: { delay: (ACCIONES.length - i - 1) * 0.03 },
                  }}
                  className="flex items-center gap-3"
                >
                  <span className="rounded-full bg-card px-3 py-1 text-sm font-medium shadow-lg border">
                    {accion.label}
                  </span>
                  <Link
                    href={accion.href}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full shadow-lg",
                      accion.bg,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </motion.div>
              );
            })}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setAbierto(!abierto)}
          whileTap={{ scale: 0.92 }}
          className="flex h-14 w-14 items-center justify-center rounded-full wine-gradient text-accent shadow-xl ring-4 ring-background"
          aria-label="Acciones rápidas"
        >
          <motion.span animate={{ rotate: abierto ? 45 : 0 }} transition={{ duration: 0.2 }}>
            {abierto ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </motion.span>
        </motion.button>
      </div>
    </div>
  );
}
