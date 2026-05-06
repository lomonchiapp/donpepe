"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Tabs — Segmented Control iOS por defecto.
 *
 * Variantes:
 *   - `default` (segmented): pills tabs con highlight blanco que se desliza
 *      sobre fondo gris secondary. Estilo iOS UISegmentedControl.
 *   - `line`: subrayado debajo del tab activo, sin background. Útil cuando
 *      las tabs encabezan páginas full-width.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-3 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  cn(
    "group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground",
    "group-data-horizontal/tabs:h-[30px]",
    "group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  ),
  {
    variants: {
      variant: {
        // iOS UISegmentedControl
        default: cn(
          "rounded-[10px] bg-secondary p-[2px] gap-[2px]",
          "shadow-[inset_0_0_0_0.5px_oklch(from_var(--foreground)_l_c_h/0.04)]",
        ),
        // Underline tabs (Mail, Notes detail nav)
        line: cn(
          "rounded-none border-b border-border/60 gap-1 bg-transparent",
          "h-auto pb-0",
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Base
        "relative inline-flex flex-1 items-center justify-center gap-1.5",
        "text-[13px] font-[590] tracking-[-0.005em] whitespace-nowrap",
        "transition-all duration-200 [transition-timing-function:var(--ease-ios)]",
        "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        // SEGMENTED (default)
        "group-data-[variant=default]/tabs-list:rounded-[8px]",
        "group-data-[variant=default]/tabs-list:px-3 group-data-[variant=default]/tabs-list:h-[26px]",
        "group-data-[variant=default]/tabs-list:text-foreground/65",
        "group-data-[variant=default]/tabs-list:hover:text-foreground",
        "group-data-[variant=default]/tabs-list:data-active:bg-card",
        "group-data-[variant=default]/tabs-list:data-active:text-foreground",
        "group-data-[variant=default]/tabs-list:data-active:shadow-[0_1px_2px_oklch(0_0_0/0.06),0_0_0_0.5px_oklch(0_0_0/0.04)]",
        "group-data-[variant=default]/tabs-list:dark:data-active:bg-[oklch(0.32_0.005_286)]",
        "group-data-[variant=default]/tabs-list:dark:data-active:shadow-[0_1px_2px_oklch(0_0_0/0.4),0_0_0_0.5px_oklch(1_0_0/0.06)]",
        // LINE
        "group-data-[variant=line]/tabs-list:px-1 group-data-[variant=line]/tabs-list:py-2",
        "group-data-[variant=line]/tabs-list:rounded-none",
        "group-data-[variant=line]/tabs-list:hover:text-foreground",
        "group-data-[variant=line]/tabs-list:data-active:text-primary",
        "group-data-[variant=line]/tabs-list:data-active:font-[600]",
        // Underline indicator (line variant)
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-1 group-data-[variant=line]/tabs-list:after:-bottom-[1px]",
        "group-data-[variant=line]/tabs-list:after:h-[2px] group-data-[variant=line]/tabs-list:after:rounded-full",
        "group-data-[variant=line]/tabs-list:after:bg-primary group-data-[variant=line]/tabs-list:after:opacity-0",
        "group-data-[variant=line]/tabs-list:after:transition-opacity",
        "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
