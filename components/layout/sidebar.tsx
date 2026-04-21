"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Home,
  FileText,
  Users,
  Coins,
  Package,
  BarChart3,
  Settings,
  LogOut,
  ShoppingCart,
  Gem,
  Receipt,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const SECTIONS: Array<{
  titulo: string;
  items: Array<{
    href: string;
    label: string;
    icon: typeof Home;
    match: (p: string) => boolean;
  }>;
}> = [
  {
    titulo: "Operación",
    items: [
      { href: "/", label: "Inicio", icon: Home, match: (p) => p === "/" },
      { href: "/empenos", label: "Empeños", icon: FileText, match: (p) => p.startsWith("/empenos") },
      { href: "/clientes", label: "Clientes", icon: Users, match: (p) => p.startsWith("/clientes") },
    ],
  },
  {
    titulo: "Oro",
    items: [
      { href: "/oro", label: "Precios del día", icon: Coins, match: (p) => p === "/oro" },
      { href: "/oro/compra", label: "Compra de oro", icon: ShoppingCart, match: (p) => p.startsWith("/oro/compra") },
    ],
  },
  {
    titulo: "Joyería",
    items: [
      { href: "/joyeria", label: "Piezas", icon: Gem, match: (p) => p.startsWith("/joyeria") },
    ],
  },
  {
    titulo: "Inventario y ventas",
    items: [
      { href: "/inventario", label: "Inventario", icon: Package, match: (p) => p.startsWith("/inventario") },
      { href: "/ventas", label: "Ventas", icon: ShoppingCart, match: (p) => p.startsWith("/ventas") },
    ],
  },
  {
    titulo: "Caja y facturación",
    items: [
      { href: "/pagos", label: "Pagos", icon: Wallet, match: (p) => p.startsWith("/pagos") },
      { href: "/recibos", label: "Recibos", icon: Receipt, match: (p) => p.startsWith("/recibos") },
      { href: "/facturas", label: "Facturas", icon: FileText, match: (p) => p.startsWith("/facturas") },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3, match: (p) => p.startsWith("/reportes") },
      { href: "/config", label: "Configuración", icon: Settings, match: (p) => p.startsWith("/config") },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl wine-gradient ring-1 ring-sidebar-border shadow">
          <span className="font-serif text-2xl font-bold text-accent">P</span>
        </div>
        <div>
          <h1 className="text-lg font-bold leading-none tracking-tight">Don Pepe</h1>
          <p className="text-xs text-muted-foreground">Compraventa & Oro</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.titulo}>
            <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.titulo}
            </h2>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t px-3 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
