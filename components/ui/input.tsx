import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Input — estilo iOS/macOS form field.
 *
 * - Background: `--secondary` (gris suave) — sin border visible al reposo.
 * - Focus: halo de 4px del primary (`ring-ring/30`) sin desplazamiento.
 * - Disabled: opacidad bajada, fondo más tenue.
 * - aria-invalid: halo rojo del destructive.
 * - file inputs: estilo refinado para inputs de archivo.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[10px]",
        "border border-transparent bg-secondary",
        "px-3 py-1.5 text-[14px] tracking-[-0.005em]",
        "transition-[box-shadow,background-color] duration-150",
        "[transition-timing-function:var(--ease-ios)]",
        "outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-[13px] file:font-[590] file:text-foreground",
        "placeholder:text-muted-foreground/80",
        "focus-visible:ring-[4px] focus-visible:ring-ring/30 focus-visible:bg-card focus-visible:border-border",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-[4px] aria-invalid:ring-destructive/30 aria-invalid:bg-destructive/[0.05]",
        "md:text-[13.5px]",
        "dark:bg-secondary/80 dark:focus-visible:bg-card",
        className
      )}
      {...props}
    />
  )
}

export { Input }
