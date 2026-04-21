"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";

interface FadeInProps extends Omit<HTMLMotionProps<"div">, "initial" | "animate"> {
  delay?: number;
  y?: number;
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(function FadeIn(
  { children, delay = 0, y = 8, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] as const }}
      {...props}
    >
      {children}
    </motion.div>
  );
});
