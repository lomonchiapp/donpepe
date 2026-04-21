"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, FileText, Coins, Gem, Package } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Inicio", icon: Home, match: (p: string) => p === "/" },
  { href: "/empenos", label: "Empeños", icon: FileText, match: (p: string) => p.startsWith("/empenos") },
  { href: "/oro", label: "Oro", icon: Coins, match: (p: string) => p.startsWith("/oro") },
  { href: "/joyeria", label: "Joyería", icon: Gem, match: (p: string) => p.startsWith("/joyeria") },
  { href: "/inventario", label: "Inventario", icon: Package, match: (p: string) => p.startsWith("/inventario") || p.startsWith("/ventas") || p.startsWith("/clientes") },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden safe-bottom">
      <ul className="flex items-stretch justify-around px-1 pt-1">
        {TABS.map((tab) => {
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
