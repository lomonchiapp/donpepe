"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Keypad numérico estilo iPhone Lockscreen.
 *
 * - Botones circulares con material translúcido sobre el wallpaper.
 * - Active state: scale 0.92 + halo iOS azul.
 * - Soporta teclado físico (0-9, Backspace).
 * - Animación shake cuando el PIN es incorrecto (`error` prop).
 *
 * El parent es responsable de:
 *   - Manejar la lógica de auth en `onComplete`.
 *   - Mostrar `error=true` cuando el intento falla; nosotros borramos el
 *     PIN visible 600ms después y llamamos `onErrorClear`.
 */
export interface PinKeypadProps {
  length?: number;
  onComplete: (pin: string) => void | Promise<void>;
  disabled?: boolean;
  error?: boolean;
  onErrorClear?: () => void;
}

export function PinKeypad({
  length = 4,
  onComplete,
  disabled = false,
  error = false,
  onErrorClear,
}: PinKeypadProps) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => {
      setPin("");
      onErrorClear?.();
    }, 600);
    return () => clearTimeout(t);
  }, [error, onErrorClear]);

  const press = async (digit: string) => {
    if (disabled || pin.length >= length) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === length) {
      await onComplete(next);
    }
  };

  const back = () => {
    if (disabled) return;
    setPin((p) => p.slice(0, -1));
  };

  // Soporte de teclado físico
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, disabled]);

  return (
    <div className="flex flex-col items-center gap-7 w-full max-w-[280px] mx-auto">
      {/* PIN dots */}
      <motion.div
        animate={error ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="flex items-center gap-3.5 h-4"
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-3 rounded-full border transition-all duration-150",
              i < pin.length
                ? error
                  ? "bg-destructive border-destructive"
                  : "bg-foreground border-foreground scale-110"
                : "border-foreground/30 bg-transparent",
            )}
          />
        ))}
      </motion.div>

      {/* Keypad — 3x4 grid (1-9, [empty], 0, backspace) */}
      <div className="grid grid-cols-3 gap-3.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n, i) => (
          <KeyButton
            key={n}
            onPress={() => press(n)}
            disabled={disabled}
            digit={n}
            sub={SUBLABELS[i]}
          />
        ))}
        <div className="h-[68px] w-[68px]" aria-hidden />
        <KeyButton onPress={() => press("0")} disabled={disabled} digit="0" sub="+" />
        <button
          type="button"
          onClick={back}
          disabled={disabled || !pin.length}
          aria-label="Borrar"
          className={cn(
            "h-[68px] w-[68px] rounded-full",
            "flex items-center justify-center text-foreground/80",
            "transition-all duration-150 [transition-timing-function:var(--ease-ios)]",
            "hover:bg-foreground/[0.08] hover:text-foreground",
            "active:scale-[0.92]",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            "no-tap-highlight",
          )}
        >
          <Delete className="h-[22px] w-[22px]" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

const SUBLABELS = ["", "ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ"];

function KeyButton({
  onPress,
  disabled,
  digit,
  sub,
}: {
  onPress: () => void;
  disabled?: boolean;
  digit: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={cn(
        "h-[68px] w-[68px] rounded-full",
        "flex flex-col items-center justify-center gap-0",
        "border border-foreground/[0.08]",
        "bg-foreground/[0.06] backdrop-blur-md",
        "text-foreground/95",
        "transition-all duration-150 [transition-timing-function:var(--ease-ios)]",
        "hover:bg-foreground/[0.12] hover:border-foreground/[0.14]",
        "active:scale-[0.92] active:bg-primary/[0.18] active:border-primary/30",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "select-none touch-none no-tap-highlight",
      )}
    >
      <span className="text-[26px] font-[300] tracking-[-0.014em] leading-none tabular-nums">
        {digit}
      </span>
      {sub && (
        <span className="text-[9px] font-[600] tracking-[0.18em] text-foreground/55 mt-0.5 uppercase">
          {sub}
        </span>
      )}
    </button>
  );
}
