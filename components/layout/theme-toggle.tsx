"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * ThemeToggle — botón circular en TopBar con dropdown estilo iOS Control Center.
 *
 * Tres modos: System (sigue prefers-color-scheme), Light, Dark. El icono
 * mostrado refleja el `resolvedTheme` actual (no el preference), así el
 * usuario ve qué está aplicado de verdad.
 */
// `useSyncExternalStore` con un store no-op da un boolean `mounted` sin
// usar setState dentro de useEffect (evita warnings de la regla
// react-hooks/set-state-in-effect en Next 16 / React 19).
const noopSubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  const Icon = !mounted
    ? Monitor
    : resolvedTheme === "dark"
      ? Moon
      : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cambiar apariencia"
            className="relative"
          />
        }
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44">
        <DropdownMenuLabel>Apariencia</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeOption
          icon={<Sun className="size-4" strokeWidth={1.8} />}
          label="Claro"
          active={theme === "light"}
          onSelect={() => setTheme("light")}
        />
        <ThemeOption
          icon={<Moon className="size-4" strokeWidth={1.8} />}
          label="Oscuro"
          active={theme === "dark"}
          onSelect={() => setTheme("dark")}
        />
        <ThemeOption
          icon={<Monitor className="size-4" strokeWidth={1.8} />}
          label="Sistema"
          active={theme === "system"}
          onSelect={() => setTheme("system")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeOption({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      className={cn(
        "gap-2.5",
        active && "text-primary [&_svg]:text-primary",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {active && (
        <span className="ml-auto text-[15px] leading-none">✓</span>
      )}
    </DropdownMenuItem>
  );
}
