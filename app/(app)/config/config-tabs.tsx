"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Bell,
  Building2,
  Coins,
  FileStack,
  Receipt,
  Scale,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TABS: Array<{
  href: string;
  label: string;
  icon: typeof Building2;
}> = [
  { href: "/config/general", label: "General", icon: Building2 },
  { href: "/config/perfil", label: "Mi perfil", icon: User },
  { href: "/config/empenos", label: "Empeños", icon: Scale },
  { href: "/config/oro", label: "Oro", icon: Coins },
  { href: "/config/facturacion", label: "Facturación", icon: Receipt },
  { href: "/config/ncf", label: "Rangos NCF", icon: FileStack },
  { href: "/config/alertas", label: "Alertas", icon: Bell },
];

export function ConfigTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de configuración"
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max gap-1.5 border-b md:gap-2">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (pathname.startsWith(`${tab.href}/`) && tab.href !== "/config");
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="relative">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors md:px-4 md:text-[15px]",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </Link>
              {active && (
                <motion.span
                  layoutId="config-tab-active"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
