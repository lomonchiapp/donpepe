"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * Switch — toggle iOS auténtico.
 *
 * Track:
 *   - off: bg-secondary (neutral fill).
 *   - on:  bg-success (System Green) — iOS por convención usa verde para
 *          toggles "habilitar". Si necesitas otro color (ej. peligroso) usa
 *          la prop `tone`.
 *   - disabled: opacity reducida.
 *
 * Thumb:
 *   - blanco con shadow elevada y micro-rim para 3D iOS.
 *   - ease-out spring al transicionar.
 *
 * Tamaños: `default` (51×31pt iOS estándar) y `sm` (compact list rows).
 */
function Switch({
  className,
  size = "default",
  tone = "success",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
  /** Color del track ON. Default `success` (verde iOS). */
  tone?: "success" | "primary" | "destructive"
}) {
  const checkedBg = {
    success: "data-checked:bg-success",
    primary: "data-checked:bg-primary",
    destructive: "data-checked:bg-destructive",
  }[tone]

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center",
        "rounded-full border border-transparent",
        "transition-[background-color] duration-200 [transition-timing-function:var(--ease-ios)]",
        // Tap area expandida (Apple HIG)
        "after:absolute after:-inset-x-2 after:-inset-y-2",
        "outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30",
        "aria-invalid:ring-[4px] aria-invalid:ring-destructive/30",
        // Tamaños iOS — 51×31 default, 38×22 small
        "data-[size=default]:h-[31px] data-[size=default]:w-[51px]",
        "data-[size=sm]:h-[22px] data-[size=sm]:w-[38px]",
        // Off / on backgrounds
        "data-unchecked:bg-secondary dark:data-unchecked:bg-[oklch(0.32_0.005_286)]",
        checkedBg,
        // Disabled
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white",
          // Sombra Apple del thumb — drop shadow + rim
          "shadow-[0_2px_4px_rgb(0_0_0/0.18),0_0_0_0.5px_rgb(0_0_0/0.04)]",
          "transition-transform duration-220 [transition-timing-function:var(--ease-ios)]",
          // Tamaños del thumb (iOS 27pt thumb en 31pt track)
          "group-data-[size=default]/switch:size-[27px]",
          "group-data-[size=sm]/switch:size-[18px]",
          // Margen interno 2px
          "group-data-[size=default]/switch:translate-x-[2px]",
          "group-data-[size=sm]/switch:translate-x-[2px]",
          "group-data-[size=default]/switch:data-checked:translate-x-[22px]",
          "group-data-[size=sm]/switch:data-checked:translate-x-[18px]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
