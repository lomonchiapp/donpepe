import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Card — superficie elevada al estilo iOS Settings / macOS preferences.
 *
 * - Background: `--card` (white / #1C1C1E).
 * - Border: hairline 0.5px (alpha sobre el foreground).
 * - Sombra: `--shadow-card` (multi-layer suave Apple).
 * - Radio: `--radius-lg` = 14px (estándar iOS para cards).
 *
 * Para "inset grouped" iOS (cards que parecen tarjetas dentro del fondo
 * gris), Card sólo necesita estar dentro de un container con
 * `bg-background` — el contraste blanco/gris ya es suficiente.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden",
        "rounded-[14px] bg-card text-card-foreground",
        "border border-border/60 shadow-card",
        "py-4 text-sm",
        "has-data-[slot=card-footer]:pb-0",
        "has-[>img:first-child]:pt-0",
        "data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0",
        "*:[img:first-child]:rounded-t-[13px] *:[img:last-child]:rounded-b-[13px]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-[13px] px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // SF Pro Display tracking — apretado en títulos
        "font-heading text-[15px] leading-snug font-[590] tracking-[-0.014em]",
        "group-data-[size=sm]/card:text-[13.5px]",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "text-[13px] leading-relaxed text-muted-foreground tracking-[-0.005em]",
        className
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-[13px] border-t border-border/60",
        // En iOS los footers son del mismo blanco con divider — no tinted
        "p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
