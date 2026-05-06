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
  Calculator,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { ModuloCodigo } from "@/lib/permisos/modulos";

type NavItem = {
  codigo: ModuloCodigo;
  href: string;
  label: string;
  icon: typeof Home;
  match: (p: string) => boolean;
};

const SECTIONS: Array<{ titulo: string; items: NavItem[] }> = [
  {
    titulo: "Operación",
    items: [
      { codigo: "inicio", href: "/", label: "Inicio", icon: Home, match: (p) => p === "/" },
      { codigo: "empenos", href: "/empenos", label: "Empeños", icon: FileText, match: (p) => p.startsWith("/empenos") },
      { codigo: "clientes", href: "/clientes", label: "Clientes", icon: Users, match: (p) => p.startsWith("/clientes") },
    ],
  },
  {
    titulo: "Oro",
    items: [
      { codigo: "oro_precios", href: "/oro", label: "Precios del día", icon: Coins, match: (p) => p === "/oro" },
      { codigo: "oro_compra", href: "/oro/compra", label: "Compra de oro", icon: ShoppingCart, match: (p) => p.startsWith("/oro/compra") },
    ],
  },
  {
    titulo: "Joyería",
    items: [
      { codigo: "joyeria", href: "/joyeria", label: "Piezas", icon: Gem, match: (p) => p.startsWith("/joyeria") },
    ],
  },
  {
    titulo: "Inventario y ventas",
    items: [
      { codigo: "inventario", href: "/inventario", label: "Inventario", icon: Package, match: (p) => p.startsWith("/inventario") },
      { codigo: "ventas", href: "/ventas", label: "Ventas", icon: ShoppingCart, match: (p) => p.startsWith("/ventas") },
    ],
  },
  {
    titulo: "Caja y facturación",
    items: [
      { codigo: "pagos", href: "/pagos", label: "Pagos", icon: Wallet, match: (p) => p.startsWith("/pagos") },
      { codigo: "recibos", href: "/recibos", label: "Recibos", icon: Receipt, match: (p) => p.startsWith("/recibos") },
      { codigo: "facturas", href: "/facturas", label: "Facturas", icon: FileText, match: (p) => p.startsWith("/facturas") },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { codigo: "reportes", href: "/reportes", label: "Reportes", icon: BarChart3, match: (p) => p.startsWith("/reportes") },
      { codigo: "contabilidad", href: "/contabilidad", label: "Contabilidad", icon: Calculator, match: (p) => p.startsWith("/contabilidad") },
      { codigo: "config", href: "/config", label: "Configuración", icon: Settings, match: (p) => p.startsWith("/config") },
    ],
  },
];

interface SidebarProps {
  /** Si es admin, ve todo. */
  esAdmin: boolean;
  /** Lista de codigos de modulo a los que el usuario tiene acceso (ignorado si esAdmin=true). */
  modulosPermitidos: string[];
}

/**
 * Sidebar estilo macOS Finder / Mail / Notes:
 *   - Vibrancy material (translúcido + saturate blur).
 *   - Selección como pill tinted del primary, con motion layoutId para slide.
 *   - Headers de sección en SF Pro semibold uppercase tracking ancho.
 *   - Separator hairline entre logo y nav, y entre nav y logout.
 */
export function Sidebar({ esAdmin, modulosPermitidos }: SidebarProps) {
  const pathname = usePathname();

  const permitido = (codigo: ModuloCodigo) =>
    esAdmin || modulosPermitidos.includes(codigo);

  const seccionesVisibles = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => permitido(item.codigo)),
  })).filter((section) => section.items.length > 0);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30",
        // Vibrancy macOS — el material se aplica encima de --sidebar
        "material-chrome",
        "border-r border-sidebar-border",
        "text-sidebar-foreground",
      )}
    >
      {/* Logo bar — emula el "traffic lights row" de macOS sin pretender ser eso */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/60">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[10px]",
            "wine-gradient shadow-elevated",
            "ring-1 ring-inset ring-white/10",
          )}
        >
          <span className="font-heading text-[17px] font-[700] text-accent leading-none">P</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-[14.5px] font-[600] leading-tight tracking-[-0.022em]">
            Don Pepe
          </h1>
          <p className="text-[11.5px] text-muted-foreground tracking-[-0.005em]">
            Compraventa & Oro
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {seccionesVisibles.map((section) => (
          <div key={section.titulo}>
            <h2 className="mb-1.5 px-2.5 text-[10.5px] font-[590] uppercase tracking-[0.06em] text-muted-foreground/80">
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
                        "relative flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5",
                        "text-[13.5px] tracking-[-0.005em]",
                        "transition-colors duration-150",
                        active
                          ? "text-sidebar-accent-foreground font-[590]"
                          : "text-sidebar-foreground/85 font-[500] hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 -z-0 rounded-[8px] bg-sidebar-accent"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon className="relative z-10 h-[15px] w-[15px]" strokeWidth={active ? 2.2 : 1.8} />
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border/60 px-2.5 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
