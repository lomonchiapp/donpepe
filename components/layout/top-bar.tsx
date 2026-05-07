"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { NuevoMegaMenu } from "@/components/layout/nuevo-megamenu";
import { BuscarRapido } from "@/components/layout/buscar-rapido";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * TopBar (NavigationBar iOS / Toolbar macOS):
 *  - Vibrancy material chrome (translúcido + saturate blur).
 *  - Hairline bottom 0.5px.
 *  - Iconos circulares plain estilo iOS.
 *
 * `alertasCount` viene del layout (server component) — número de empeños
 * vencidos + próximos a vencer en los siguientes 7 días.
 * `alertasUrgentes` true si hay vencidos (renderiza el badge en rojo
 * destructive). Si solo hay próximos, badge en naranja warning.
 */
export function TopBar({
  alertasCount = 0,
  alertasUrgentes = false,
}: {
  alertasCount?: number;
  alertasUrgentes?: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 safe-top",
        "material-chrome",
        // Hairline bottom 0.5px usando box-shadow inset
        "shadow-[inset_0_-0.5px_0_oklch(from_var(--foreground)_l_c_h/0.1)]",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3 md:h-[52px] md:px-5">
        {/* Logo sólo en móvil (en desktop va en sidebar) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] wine-gradient ring-1 ring-inset ring-white/10 shadow-elevated">
            <span className="font-heading text-[17px] font-[700] text-accent leading-none">P</span>
          </div>
          <span className="font-[600] text-[15px] tracking-[-0.022em]">Don Pepe</span>
        </div>

        <BuscarRapido />

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/alertas"
            aria-label={
              alertasCount === 0
                ? "Alertas"
                : `Alertas — ${alertasCount} ${alertasCount === 1 ? "pendiente" : "pendientes"}`
            }
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "relative",
            )}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {alertasCount > 0 && (
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5",
                  "min-w-[18px] h-[18px] px-1 rounded-full",
                  "flex items-center justify-center",
                  "text-[10px] font-[700] text-white tabular-nums leading-none",
                  alertasUrgentes ? "bg-destructive" : "bg-warning",
                  "ring-[2px] ring-[var(--material-chrome)]",
                  "shadow-[0_0_0_0.5px_oklch(0_0_0/0.08)]",
                  // Mini bounce-in apenas se carga
                  "animate-in fade-in zoom-in-50 duration-300 [animation-timing-function:var(--ease-ios)]",
                )}
              >
                {alertasCount > 99 ? "99+" : alertasCount}
              </span>
            )}
          </Link>

          <ThemeToggle />
          <NuevoMegaMenu />
        </div>
      </div>
    </header>
  );
}
