import { cn } from "@/lib/utils";
import type { EstadoPrestamo } from "@/lib/supabase/types";

const ESTADOS: Record<
  EstadoPrestamo,
  { label: string; className: string }
> = {
  activo: {
    label: "Activo",
    className: "bg-success/15 text-success ring-success/30",
  },
  renovado: {
    label: "Renovado",
    className: "bg-success/15 text-success ring-success/30",
  },
  pagado: {
    label: "Pagado",
    className: "bg-muted text-muted-foreground ring-border",
  },
  vencido_a_cobro: {
    label: "Vencido",
    className: "bg-destructive/15 text-destructive ring-destructive/30 animate-pulse",
  },
  propiedad_casa: {
    label: "Propiedad casa",
    className: "bg-accent/25 text-accent-foreground ring-accent/40",
  },
};

export function BadgeEstado({
  estado,
  className,
}: {
  estado: EstadoPrestamo;
  className?: string;
}) {
  const cfg = ESTADOS[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
