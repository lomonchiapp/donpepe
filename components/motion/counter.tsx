"use client";

import { useEffect } from "react";
import {
  animate,
  useMotionValue,
  useTransform,
  motion,
  useInView,
} from "motion/react";
import { useRef } from "react";

import { formatearDOP } from "@/lib/format";

interface CounterProps {
  value: number;
  /** Si true, formatea como DOP. Si no, usa Intl.NumberFormat es-DO. */
  moneda?: boolean;
  duracion?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const NUM_FORMATTER = new Intl.NumberFormat("es-DO");

/**
 * Contador animado que cuenta de 0 al valor final con easing.
 * Dispara cuando entra en viewport.
 */
export function Counter({
  value,
  moneda = false,
  duracion = 0.9,
  className,
  prefix,
  suffix,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const mv = useMotionValue(0);
  const texto = useTransform(mv, (n) =>
    moneda ? formatearDOP(Math.round(n)) : NUM_FORMATTER.format(Math.round(n)),
  );

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration: duracion,
      ease: [0.16, 1, 0.3, 1] as const,
    });
    return () => controls.stop();
  }, [inView, value, duracion, mv]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{texto}</motion.span>
      {suffix}
    </span>
  );
}
