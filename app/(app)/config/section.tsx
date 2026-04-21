"use client";

import { motion } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionProps {
  icon: React.ReactNode;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Contenedor visual de una sección de configuración. Header con icono
 * prominente + card.
 */
export function Section({
  icon,
  titulo,
  descripcion,
  children,
  className,
}: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("space-y-4", className)}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            {titulo}
          </h2>
          {descripcion && (
            <p className="text-sm text-muted-foreground">{descripcion}</p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">{children}</CardContent>
      </Card>
    </motion.section>
  );
}
