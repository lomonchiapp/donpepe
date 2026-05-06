import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

/**
 * Stack tipográfico Apple-first:
 * - En macOS/iOS/iPadOS: el sistema sirve SF Pro Display/Text/Mono nativos.
 * - En Windows/Linux/Android: cae a Inter (la mejor aproximación a SF
 *   disponible con licencia web), cargada via next/font con métricas
 *   adjustadas para minimizar layout-shift.
 *
 * El stack final está definido en globals.css → --font-sans / --font-display.
 * Acá sólo registramos la variable `--font-fallback` para el slot de Inter.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fallback",
  // Aproxima métricas SF Pro Text para reducir CLS cuando la fuente carga.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: "Don Pepe",
    template: "%s · Don Pepe",
  },
  description: "Sistema de compraventa, empeño y oro — República Dominicana.",
  applicationName: "Don Pepe",
  appleWebApp: {
    capable: true,
    title: "Don Pepe",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-DO"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
