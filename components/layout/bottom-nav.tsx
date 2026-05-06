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

/**
 * Tab Bar iOS — translúcido (vibrancy material), hairline top, tinted icon
 * cuando está activo. La pill animada es opcional pero le da el toque de
 * iOS 18 (tinted background bajo el icono activo).
 */
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
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden safe-bottom",
        "material-chrome",
        // Hairline top — 0.5px effect via box-shadow
        "shadow-[inset_0_0.5px_0_oklch(from_var(--foreground)_l_c_h/0.12)]",
      )}
    >
      <ul className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
        {visibles.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5",
                  "px-2 py-1.5 rounded-[10px]",
                  "text-[10.5px] font-[590] tracking-[-0.005em]",
                  "transition-colors duration-150 no-tap-highlight press-ios",
                  active ? "text-primary" : "text-muted-foreground/90",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-3 inset-y-1 -z-0 rounded-[10px] bg-primary/[0.13] dark:bg-primary/[0.2]"
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn("relative z-10 h-[22px] w-[22px]", active && "drop-shadow-[0_0_0.5px_currentColor]")}
                  strokeWidth={active ? 2.2 : 1.7}
                />
                <span className="relative z-10">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
