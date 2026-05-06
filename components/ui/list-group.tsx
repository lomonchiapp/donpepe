"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ListGroup — Inset Grouped List al estilo iOS Settings.
 *
 * Estructura:
 *   <ListSection title="VENCE HOY">
 *     <ListGroup>
 *       <ListRow icon={...} title="..." subtitle="..." trailing={...} />
 *       <ListRow ... />
 *     </ListGroup>
 *   </ListSection>
 *
 * Detalles:
 *   - Section header: small caps, tracking abierto, color muted, padding
 *     horizontal alineado al edge del card.
 *   - ListGroup: card con border hairline + shadow-card, esquinas 14px,
 *     overflow hidden para que los rows hereden el corner radius.
 *   - ListRow: hairline divider entre rows que se "insetea" desde el icon
 *     (typical iOS), chevron opcional cuando es navegacional.
 */

export function ListSection({
  title,
  description,
  children,
  className,
}: {
  /** Header en uppercase small caps. Opcional. */
  title?: React.ReactNode;
  /** Footnote debajo del card (iOS list footer). */
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {title && (
        <h2 className={cn(
          "px-4 text-[10.5px] font-[590] uppercase tracking-[0.06em]",
          "text-muted-foreground/85",
        )}>
          {title}
        </h2>
      )}
      {children}
      {description && (
        <p className="px-4 text-[12px] leading-snug text-muted-foreground tracking-[-0.005em]">
          {description}
        </p>
      )}
    </section>
  );
}

export function ListGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] bg-card",
        "border border-border/60 shadow-card",
        // Cada hijo (ListRow) recibe la divider desde aquí
        "[&>*+*]:border-t [&>*+*]:border-border/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ListRowProps {
  /** Icono o glyph al inicio del row. Recomendado 22-28px. */
  icon?: React.ReactNode;
  /** Título principal. */
  title?: React.ReactNode;
  /** Subtitle bajo el title (un solo line, ellipsizado por defecto). */
  subtitle?: React.ReactNode;
  /** Contenido al final del row (badge, value, switch, etc.). */
  trailing?: React.ReactNode;
  /** Si es row navegacional (envoltorio link). Renderiza chevron. */
  href?: string;
  /** Click handler. Si está, el row se hace clickable. */
  onClick?: () => void;
  /** Forzar mostrar chevron incluso sin href (para drill-downs). */
  chevron?: boolean;
  /** Densidad del row. */
  size?: "default" | "sm";
  className?: string;
  /** Permite renderizar children libres si la API icon/title/subtitle no es suficiente. */
  children?: React.ReactNode;
}

/**
 * ListRow — fila individual al estilo iOS Settings.
 * Si recibe `href` o `onClick`, agrega tap state y chevron por default.
 */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  chevron,
  size = "default",
  className,
  children,
}: ListRowProps) {
  const isInteractive = Boolean(href || onClick);
  const showChevron = chevron ?? Boolean(href);

  const padding = size === "sm" ? "px-3.5 py-2" : "px-4 py-2.5";

  const inner = (
    <div
      className={cn(
        "flex w-full items-center gap-3",
        padding,
        // Hairline divider iOS — insetea desde el icono cuando hay icono
        // (manejado por el border-t en ListGroup; aquí controlamos la regla
        // de inset visual via padding-left del separator pseudo)
        isInteractive && "transition-colors duration-100 active:bg-foreground/[0.04] dark:active:bg-foreground/[0.06] hover:bg-foreground/[0.025] dark:hover:bg-foreground/[0.04]",
        "no-tap-highlight",
        className,
      )}
    >
      {icon && (
        <div className="shrink-0 flex items-center justify-center text-foreground/85">
          {icon}
        </div>
      )}
      {children ? (
        <div className="flex-1 min-w-0">{children}</div>
      ) : (
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-[14.5px] font-[510] tracking-[-0.014em] truncate">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="text-[12.5px] text-muted-foreground tracking-[-0.005em] truncate">
              {subtitle}
            </div>
          )}
        </div>
      )}
      {trailing && (
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground tracking-[-0.005em]">
          {trailing}
        </div>
      )}
      {showChevron && (
        <ChevronRight className="shrink-0 text-muted-foreground/60" size={16} strokeWidth={2.2} />
      )}
    </div>
  );

  if (href) {
    // Link wrapper — usar <a> nativo deja la responsabilidad de routing al
    // caller (next/link, etc.). Si el caller quiere prefetch, que envuelva.
    return (
      <a href={href} className="block press-ios">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left press-ios">
        {inner}
      </button>
    );
  }
  return inner;
}

/**
 * Glyph circular tinted al estilo iOS Settings (icono blanco sobre fondo
 * de color del módulo). Tamaño 28px por defecto.
 *
 * <SettingsGlyph color="blue"><Bell className="size-4" /></SettingsGlyph>
 */
export function SettingsGlyph({
  children,
  color = "blue",
  size = 28,
}: {
  children: React.ReactNode;
  color?:
    | "blue"
    | "green"
    | "red"
    | "orange"
    | "yellow"
    | "purple"
    | "pink"
    | "indigo"
    | "teal"
    | "graphite"
    | "gold";
  size?: 24 | 28 | 30 | 32;
}) {
  const palette: Record<string, string> = {
    blue:     "bg-[oklch(0.598_0.197_256.5)] text-white",
    green:    "bg-[oklch(0.7_0.18_145)] text-white",
    red:      "bg-[oklch(0.628_0.235_25)] text-white",
    orange:   "bg-[oklch(0.731_0.181_56)] text-white",
    yellow:   "bg-[oklch(0.872_0.171_91)] text-[oklch(0.18_0.04_70)]",
    purple:   "bg-[oklch(0.585_0.215_309)] text-white",
    pink:     "bg-[oklch(0.65_0.235_8)] text-white",
    indigo:   "bg-[oklch(0.51_0.18_282)] text-white",
    teal:     "bg-[oklch(0.788_0.13_230)] text-white",
    graphite: "wine-gradient text-accent",
    gold:     "gold-gradient text-[oklch(0.18_0.04_70)]",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[7px]",
        "shadow-[0_0.5px_0_oklch(1_0_0/0.18)_inset]",
        palette[color],
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}
