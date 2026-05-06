import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge — pill iOS-style.
 *
 * Variantes "tinted" (background al ~13-15% del color principal) son la
 * convención iOS para chips de estado. Para badges sólidas (counters,
 * notificaciones), usar `default` o `destructive-filled`.
 */
const badgeVariants = cva(
  [
    "group/badge inline-flex h-[20px] w-fit shrink-0 items-center justify-center gap-1",
    "overflow-hidden rounded-full border border-transparent",
    "px-2 py-0.5 text-[11px] font-[590] tracking-[-0.005em] whitespace-nowrap",
    "transition-all",
    "focus-visible:ring-[4px] focus-visible:ring-ring/30",
    "has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
    "aria-invalid:ring-[4px] aria-invalid:ring-destructive/30",
    "[&>svg]:pointer-events-none [&>svg]:size-3!",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary/[0.13] text-primary dark:bg-primary/[0.2]",
        solid:
          "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        success:
          "bg-success/[0.14] text-success dark:bg-success/[0.22] dark:text-success",
        warning:
          "bg-warning/[0.18] text-warning-foreground dark:bg-warning/[0.22]",
        destructive:
          "bg-destructive/[0.13] text-destructive dark:bg-destructive/[0.22]",
        "destructive-filled":
          "bg-destructive text-white shadow-[0_1px_0_oklch(1_0_0/0.18)_inset]",
        outline:
          "border-border text-foreground bg-transparent [a]:hover:bg-secondary",
        ghost:
          "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
