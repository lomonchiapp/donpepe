"use client";

import { motion, type HTMLMotionProps, type Variants } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

export function StaggerList({
  children,
  ...props
}: HTMLMotionProps<"ul">) {
  return (
    <motion.ul
      variants={container}
      initial="hidden"
      animate="show"
      {...props}
    >
      {children}
    </motion.ul>
  );
}

export function StaggerItem({
  children,
  ...props
}: HTMLMotionProps<"li">) {
  return (
    <motion.li variants={item} {...props}>
      {children}
    </motion.li>
  );
}
