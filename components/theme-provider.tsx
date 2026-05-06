"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * ThemeProvider — sigue automáticamente `prefers-color-scheme` del sistema.
 *
 * Cuando el SO está en dark, next-themes pone `class="dark"` en `<html>` y
 * los tokens de globals.css cambian a la paleta dark. Soporta también un
 * eventual toggle manual (storageKey="don-pepe-theme").
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="don-pepe-theme"
    >
      {children}
    </NextThemeProvider>
  );
}
