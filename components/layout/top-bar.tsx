"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { NuevoMegaMenu } from "@/components/layout/nuevo-megamenu";
import { BuscarRapido } from "@/components/layout/buscar-rapido";
import { cn } from "@/lib/utils";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md safe-top">
      <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:px-6">
        {/* Logo sólo en móvil (en desktop va en sidebar) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl wine-gradient">
            <span className="font-serif text-xl font-bold text-accent">P</span>
          </div>
          <span className="font-bold">Don Pepe</span>
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
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </Link>

          <NuevoMegaMenu />
        </div>
      </div>
    </header>
  );
}
