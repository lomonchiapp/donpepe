import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-[10px]",
        "border border-transparent bg-secondary",
        "px-3 py-2 text-[14px] leading-relaxed tracking-[-0.005em]",
        "transition-[box-shadow,background-color] duration-150",
        "[transition-timing-function:var(--ease-ios)]",
        "outline-none placeholder:text-muted-foreground/80",
        "focus-visible:ring-[4px] focus-visible:ring-ring/30 focus-visible:bg-card focus-visible:border-border",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-[4px] aria-invalid:ring-destructive/30 aria-invalid:bg-destructive/[0.05]",
        "md:text-[13.5px]",
        "dark:bg-secondary/80 dark:focus-visible:bg-card",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
