import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button — estilo Apple (iOS/macOS).
 *
 * - `default`     : filled (system blue). CTA primaria.
 * - `tinted`      : background del primary al 14% + texto primary. La variante
 *                   más usada en iOS para acciones secundarias destacadas.
 * - `secondary`   : neutral fill (gray) — para acciones de menor jerarquía.
 * - `outline`     : hairline border + fondo card. Para toolbars.
 * - `ghost`       : sin background. Hover muy sutil. Para iconos en navbars.
 * - `destructive` : tinted red para acciones peligrosas.
 * - `link`/`plain`: solo texto (Apple "plain button").
 *
 * Press state: scale 0.97 + opacidad 0.7 (curva ease-out iOS).
 * Focus visible: halo de 4px del color tint con offset = 0 (sistema iOS).
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center",
    "rounded-[10px] border border-transparent bg-clip-padding",
    "text-[13.5px] font-[590] leading-none tracking-[-0.01em] whitespace-nowrap",
    "transition-[transform,background-color,box-shadow,opacity] duration-150",
    "[transition-timing-function:var(--ease-ios)]",
    "outline-none select-none",
    "focus-visible:ring-[4px] focus-visible:ring-ring/30 focus-visible:ring-offset-0",
    "active:not-aria-[haspopup]:scale-[0.97] active:not-aria-[haspopup]:opacity-80",
    "disabled:pointer-events-none disabled:opacity-40",
    "aria-invalid:ring-[4px] aria-invalid:ring-destructive/30",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_1px_2px_oklch(0_0_0/0.08)] hover:bg-primary/90 [a]:hover:bg-primary/90",
        tinted:
          "bg-primary/[0.13] text-primary hover:bg-primary/[0.18] dark:bg-primary/[0.18] dark:hover:bg-primary/[0.24]",
        outline:
          "border-border bg-card text-foreground shadow-hairline hover:bg-secondary/60 dark:bg-card/60 dark:hover:bg-secondary/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary",
        ghost:
          "text-foreground hover:bg-secondary/70 aria-expanded:bg-secondary dark:hover:bg-secondary/50",
        destructive:
          "bg-destructive/[0.13] text-destructive hover:bg-destructive/[0.18] focus-visible:ring-destructive/30 dark:bg-destructive/[0.2] dark:hover:bg-destructive/[0.28]",
        "destructive-filled":
          "bg-destructive text-white shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_1px_2px_oklch(0_0_0/0.08)] hover:bg-destructive/90 focus-visible:ring-destructive/30",
        link:
          "text-primary underline-offset-4 hover:underline rounded-none",
        plain:
          "text-primary hover:opacity-70 active:opacity-50 rounded-none",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs:
          "h-6 gap-1 rounded-md px-2 text-[11.5px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm:
          "h-7 gap-1 rounded-lg px-2.5 text-[12.5px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg:
          "h-10 gap-2 rounded-[12px] px-4 text-[14px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl:
          // Acción primaria móvil — Apple usa ~50pt de alto y rounded grande
          "h-12 gap-2 rounded-2xl px-5 text-[15px] font-[600] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-[18px]",
        icon:
          "size-8 rounded-full",
        "icon-xs":
          "size-6 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg":
          "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
