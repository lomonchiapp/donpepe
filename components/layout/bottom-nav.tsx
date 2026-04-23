"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, FileText, Coins, Gem, Package } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ModuloCodigo } from "@/lib/permisos/modulos";

type BottomTab = {
  codigo: ModuloCodigo | "inventario_grupo";
  /** Para el grupo inventario, lista de módulos cualquiera de los cuales habilita el tab. */
  gates?: ModuloCodigo[];
  href: string;
  label: string;
  icon: typeof Home;
  match: (p: string) => boolean;
};

const TABS: BottomTab[] = [
  {
    codigo: "inicio",
    href: "/",
    label: "Inicio",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    codigo: "empenos",
    href: "/empenos",
    label: "Empeños",
    icon: FileText,
    match: (p) => p.startsWith("/empenos"),
  },
  {
    codigo: "oro_precios",
    href: "/oro",
    label: "Oro",
    icon: Coins,
    match: (p) => p.startsWith("/oro"),
  },
  {
    codigo: "joyeria",
    href: "/joyeria",
    label: "Joyería",
    icon: Gem,
    match: (p) => p.startsWith("/joyeria"),
  },
  {
    codigo: "inventario_grupo",
    gates: ["inventario", "ventas", "clientes"],
    href: "/inventario",
    label: "Inventario",
    icon: Package,
    match: (p) =>
      p.startsWith("/inventario") ||
      p.startsWith("/ventas") ||
      p.startsWith("/clientes"),
  },
];

interface BottomNavProps {
  esAdmin: boolean;
  modulosPermitidos: string[];
}

export function BottomNav({ esAdmin, modulosPermitidos }: BottomNavProps) {
  const pathname = usePathname();

  const visibles = TABS.filter((tab) => {
    if (esAdmin) return true;
    if (tab.gates) {
      return tab.gates.some((g) => modulosPermitidos.includes(g));
    }
    return modulosPermitidos.includes(tab.codigo as string);
  });

  if (visibles.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden safe-bottom">
      <ul className="flex items-stretch justify-around px-1 pt-1">
        {visibles.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors no-tap-highlight",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-4 top-1 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className={cn("h-5 w-5", active && "fill-primary/10")} strokeWidth={active ? 2.4 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
