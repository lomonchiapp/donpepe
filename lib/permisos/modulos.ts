/**
 * Catálogo de módulos del sistema.
 *
 * Cada módulo es una página/sección del app a la que un usuario puede tener
 * o no acceso. El admin (es_admin=true) bypasea esta lista y puede todo.
 *
 * Si agregas una ruta nueva con navegación propia:
 *   1. Agrégala aquí con un `codigo` único.
 *   2. Actualiza el `Sidebar` (auto-filtra por código).
 *   3. En el layout o página server-side, llama `requireAcceso(codigo)`.
 */

import {
  Home,
  FileText,
  Users,
  Coins,
  Package,
  BarChart3,
  Settings,
  ShoppingCart,
  Gem,
  Receipt,
  Wallet,
  Calculator,
  type LucideIcon,
} from "lucide-react";

export type ModuloCodigo =
  | "inicio"
  | "empenos"
  | "clientes"
  | "oro_precios"
  | "oro_compra"
  | "joyeria"
  | "inventario"
  | "ventas"
  | "pagos"
  | "recibos"
  | "facturas"
  | "reportes"
  | "contabilidad"
  | "config";

export interface Modulo {
  codigo: ModuloCodigo;
  label: string;
  descripcion: string;
  icon: LucideIcon;
  path: string;
  /** true = el módulo solo lo puede usar un admin, no aparece en el selector de permisos */
  soloAdmin?: boolean;
}

/**
 * Lista canónica, en el orden en que aparecen en el sidebar.
 */
export const MODULOS: readonly Modulo[] = [
  {
    codigo: "inicio",
    label: "Inicio",
    descripcion: "Dashboard con resumen del día",
    icon: Home,
    path: "/",
  },
  {
    codigo: "empenos",
    label: "Empeños",
    descripcion: "Crear, renovar y liquidar préstamos",
    icon: FileText,
    path: "/empenos",
  },
  {
    codigo: "clientes",
    label: "Clientes",
    descripcion: "Gestión del padrón de clientes",
    icon: Users,
    path: "/clientes",
  },
  {
    codigo: "oro_precios",
    label: "Precios del día",
    descripcion: "Tabla de tasación del oro por kilataje",
    icon: Coins,
    path: "/oro",
  },
  {
    codigo: "oro_compra",
    label: "Compra de oro",
    descripcion: "Registrar compras de oro a clientes",
    icon: ShoppingCart,
    path: "/oro/compra",
  },
  {
    codigo: "joyeria",
    label: "Joyería",
    descripcion: "Inventario de piezas de joyería",
    icon: Gem,
    path: "/joyeria",
  },
  {
    codigo: "inventario",
    label: "Inventario",
    descripcion: "Inventario general (empeños vencidos, oro, etc.)",
    icon: Package,
    path: "/inventario",
  },
  {
    codigo: "ventas",
    label: "Ventas",
    descripcion: "Registrar ventas y consultar histórico",
    icon: ShoppingCart,
    path: "/ventas",
  },
  {
    codigo: "pagos",
    label: "Pagos",
    descripcion: "Caja de pagos (intereses, abonos, saldos)",
    icon: Wallet,
    path: "/pagos",
  },
  {
    codigo: "recibos",
    label: "Recibos",
    descripcion: "Histórico de recibos internos",
    icon: Receipt,
    path: "/recibos",
  },
  {
    codigo: "facturas",
    label: "Facturas",
    descripcion: "Facturación con NCF",
    icon: FileText,
    path: "/facturas",
  },
  {
    codigo: "reportes",
    label: "Reportes",
    descripcion: "Reportes y analítica",
    icon: BarChart3,
    path: "/reportes",
  },
  {
    codigo: "contabilidad",
    label: "Contabilidad",
    descripcion:
      "Libro de compraventa y reportes DGII (606, 607, 608) para el contable",
    icon: Calculator,
    path: "/contabilidad",
  },
  {
    codigo: "config",
    label: "Configuración",
    descripcion: "Ajustes generales (solo admin)",
    icon: Settings,
    path: "/config",
    soloAdmin: true,
  },
] as const;

/** Lista de códigos de módulo, útil para validaciones Zod. */
export const MODULOS_CODIGOS = MODULOS.map((m) => m.codigo);

/** Módulos que se muestran en el selector de permisos del admin. */
export const MODULOS_ASIGNABLES: readonly Modulo[] = MODULOS.filter(
  (m) => !m.soloAdmin,
);

/**
 * Devuelve el módulo cuyo path matchea el pathname actual, o null.
 * Usa prefijo: `/empenos/123` matchea el módulo `empenos`.
 * El módulo `inicio` (path `/`) solo matchea exacto.
 */
export function moduloDePathname(pathname: string): Modulo | null {
  if (pathname === "/") {
    return MODULOS.find((m) => m.codigo === "inicio") ?? null;
  }
  // Ordenar por longitud de path desc para priorizar matches más específicos
  // (ej: `/oro/compra` gana sobre `/oro`).
  const ordenados = [...MODULOS].sort((a, b) => b.path.length - a.path.length);
  return (
    ordenados.find((m) => m.path !== "/" && pathname.startsWith(m.path)) ?? null
  );
}

/** Lookup por código. */
export function moduloByCodigo(codigo: string): Modulo | null {
  return MODULOS.find((m) => m.codigo === codigo) ?? null;
}
