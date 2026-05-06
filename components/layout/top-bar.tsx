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
 */
export function TopBar() {
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
            aria-label="Alertas"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "relative",
            )}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span
              className={cn(
                "absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive",
                "ring-2 ring-[var(--material-chrome)]",
              )}
            />
          </Link>

          <ThemeToggle />
          <NuevoMegaMenu />
        </div>
      </div>
    </header>
  );
}
