"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Toaster — banner notification estilo iOS / Dynamic Island.
 *
 * Usa el material vibrancy `--material-thick` (definido en globals.css).
 * Los CSS vars de Sonner están mapeados a tokens del design system.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info:    <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error:   <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--material-thick)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast group/toast !backdrop-blur-2xl !backdrop-saturate-[1.8] " +
            "!shadow-floating !border !border-border/40",
          title: "!text-[14px] !font-[590] !tracking-[-0.01em]",
          description: "!text-[12.5px] !text-muted-foreground !tracking-[-0.005em]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
