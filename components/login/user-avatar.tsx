"use client";

import Image from "next/image";
import { Crown, ShieldCheck, Calculator, User as UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Avatar de usuario para la pantalla de bloqueo (lockscreen iOS).
 *
 * - Usa la foto si existe (`avatar_url`); si no, muestra iniciales sobre
 *   un gradient tinted del rol.
 * - Badge inferior-derecho con el icono del rol (Crown/Shield/Calc/User).
 * - `selected` = rim ring (offset) + scale, igual que iOS al elegir un user.
 */
export interface UserAvatarProps {
  name: string;
  /** Texto display del rol (Admin | Dueño | Contador | Empleado). */
  rol: string;
  esAdmin?: boolean;
  avatarUrl?: string | null;
  size?: "md" | "lg" | "xl";
  selected?: boolean;
}

const SIZES = {
  md: { box: "h-16 w-16", text: "text-[18px]", badge: "h-6 w-6", badgeIcon: "h-3 w-3" },
  lg: { box: "h-24 w-24", text: "text-[26px]", badge: "h-7 w-7", badgeIcon: "h-3.5 w-3.5" },
  xl: { box: "h-32 w-32", text: "text-[38px]", badge: "h-8 w-8", badgeIcon: "h-4 w-4" },
} as const;

/**
 * Cada rol pinta un gradient distinto en el background del avatar.
 * Usamos colores sistema iOS (sin saturar, propios de Apple Hardware).
 */
function gradientForRol(rol: string, esAdmin: boolean): string {
  if (esAdmin) {
    // Champagne metallic (Apple Hardware Gold) — exclusivo admin
    return "gold-gradient";
  }
  switch (rol) {
    case "Dueño":
      // Graphite Big Sur
      return "wine-gradient";
    case "Contador":
      // System Indigo → Blue
      return "bg-gradient-to-br from-[oklch(0.51_0.18_282)] to-[oklch(0.598_0.197_256.5)]";
    default:
      // System Blue → Teal
      return "bg-gradient-to-br from-[oklch(0.598_0.197_256.5)] to-[oklch(0.788_0.13_230)]";
  }
}

function rolBadgeIcon(rol: string, esAdmin: boolean, className: string) {
  if (esAdmin) return <Crown className={className} strokeWidth={2.4} />;
  switch (rol) {
    case "Dueño":    return <ShieldCheck className={className} strokeWidth={2.4} />;
    case "Contador": return <Calculator className={className} strokeWidth={2.4} />;
    default:         return <UserIcon className={className} strokeWidth={2.4} />;
  }
}

function ringForRol(rol: string, esAdmin: boolean): string {
  if (esAdmin) return "ring-[oklch(0.685_0.072_70)]/60";
  switch (rol) {
    case "Dueño":    return "ring-foreground/40";
    case "Contador": return "ring-[oklch(0.51_0.18_282)]/60";
    default:         return "ring-primary/60";
  }
}

export function UserAvatar({
  name,
  rol,
  esAdmin = false,
  avatarUrl,
  size = "lg",
  selected = false,
}: UserAvatarProps) {
  const cfg = SIZES[size];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center font-[600] text-white",
        "shadow-floating ring-1 ring-inset ring-white/15",
        "transition-[transform,box-shadow] duration-300 [transition-timing-function:var(--ease-ios)]",
        gradientForRol(rol, esAdmin),
        cfg.box,
        cfg.text,
        selected && cn(
          "scale-110 ring-4 ring-offset-4 ring-offset-transparent",
          ringForRol(rol, esAdmin),
        ),
      )}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={128}
          height={128}
          className="h-full w-full rounded-full object-cover"
          unoptimized
        />
      ) : (
        <span className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)] tracking-[-0.02em] tabular-nums">
          {initials || "·"}
        </span>
      )}

      {/* Highlight superior interior — Apple Hardware glossy */}
      <div className="pointer-events-none absolute inset-x-2 top-1 h-2.5 rounded-full bg-gradient-to-b from-white/30 to-transparent" />

      {/* Badge del rol */}
      <div
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full",
          "bg-card border-2 border-card shadow-elevated",
          esAdmin ? "text-[oklch(0.685_0.072_70)]" :
          rol === "Dueño" ? "text-foreground" :
          rol === "Contador" ? "text-[oklch(0.51_0.18_282)]" :
          "text-primary",
          cfg.badge,
        )}
      >
        {rolBadgeIcon(rol, esAdmin, cfg.badgeIcon)}
      </div>
    </div>
  );
}
