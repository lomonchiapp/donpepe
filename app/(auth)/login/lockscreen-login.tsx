"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";

import { UserAvatar } from "@/components/login/user-avatar";
import { PinKeypad } from "@/components/login/pin-keypad";
import { cn } from "@/lib/utils";
import { loginConPin, type LockscreenUserDTO } from "./actions";

/**
 * Reloj live via useSyncExternalStore — evita el cascading render del
 * useEffect+setState (React 19 strict rule react-hooks/set-state-in-effect)
 * y también el hydration mismatch (server retorna null, client retorna Date).
 */
function subscribeToClock(notify: () => void) {
  const id = setInterval(notify, 30_000);
  return () => clearInterval(id);
}
function getClockSnapshot() {
  // Cambia cada 30s gracias al setInterval; el snapshot puede ser el mismo
  // string varias veces si el reloj no avanzó visiblemente. Devolvemos un
  // valor inmutable por minuto para que useSyncExternalStore reuse el ref.
  const d = new Date();
  return Math.floor(d.getTime() / 30_000);
}
function getServerClockSnapshot() {
  return -1;
}
function useClock(): Date | null {
  const tick = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
  if (tick === -1) return null; // server / pre-hydration
  return new Date();
}

/**
 * Lockscreen-style login (estilo iOS).
 *
 * Flujo:
 *  1. RPC `lockscreen_users()` → grid de avatares.
 *  2. Usuario clickea su avatar → keypad.
 *  3. Al completar el PIN, RPC `email_for_app_user(id)` resuelve el email.
 *  4. `signInWithPassword(email, pin)` cierra el flujo.
 *
 * El email nunca se escribe — se conserva en BD para reportes (.env, alertas).
 *
 * Estados:
 *  - `loading`        — fetch inicial de usuarios.
 *  - `selected`       — usuario elegido, mostrar keypad.
 *  - `authenticating` — verificando PIN contra Supabase.
 *  - `error`          — PIN incorrecto, animación shake + reset.
 */
export function LockscreenLogin({
  users,
  next,
}: {
  users: LockscreenUserDTO[];
  next?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<LockscreenUserDTO | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState(false);
  const now = useClock();

  async function handlePinComplete(pin: string) {
    if (!selected) return;
    setAuthenticating(true);
    try {
      const result = await loginConPin(selected.id, pin);
      if ("error" in result) {
        setError(true);
        return;
      }
      router.push(next ?? "/");
      router.refresh();
    } finally {
      setAuthenticating(false);
    }
  }

  const timeStr = now
    ? now.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";
  const dateStr = now
    ? now.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <main className="relative min-h-dvh w-full overflow-hidden flex flex-col bg-background">
      {/* Wallpaper iOS — gradients animados + radial darken para profundidad */}
      <Wallpaper />

      {/* Clock — se colapsa cuando hay usuario seleccionado */}
      <div
        aria-hidden={!!selected}
        className={cn(
          "text-center select-none transition-all duration-500 ease-out overflow-hidden",
          selected
            ? "max-h-0 opacity-0 pt-0 pb-0"
            : "max-h-[280px] opacity-100 pt-12 sm:pt-20 pb-6",
        )}
      >
        <div
          className={cn(
            "font-[200] tabular-nums leading-none",
            "text-[80px] sm:text-[110px] md:text-[128px]",
            "tracking-[-0.04em] text-foreground/95",
            "drop-shadow-[0_2px_24px_oklch(from_var(--foreground)_l_c_h/0.18)]",
          )}
        >
          {timeStr}
        </div>
        <div className="mt-3 text-[14px] sm:text-[15px] font-[500] tracking-[-0.005em] text-foreground/60 capitalize">
          {dateStr}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        {users.length === 0 ? (
          <EmptyState />
        ) : selected ? (
          <PinStep
            user={selected}
            onBack={() => {
              setSelected(null);
              setError(false);
            }}
            onComplete={handlePinComplete}
            authenticating={authenticating}
            error={error}
            onErrorClear={() => setError(false)}
          />
        ) : (
          <UserPicker users={users} onPick={setSelected} />
        )}
      </div>

      {/* Footer brand */}
      <div className="pb-6 text-center text-[10.5px] tracking-[0.32em] uppercase text-muted-foreground/55 select-none">
        Don Pepe · Compraventa & Oro
      </div>
    </main>
  );
}

function UserPicker({
  users,
  onPick,
}: {
  users: LockscreenUserDTO[];
  onPick: (u: LockscreenUserDTO) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col items-center gap-8 max-w-3xl w-full"
    >
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground tracking-[0.18em] uppercase font-[590]">
        <Lock className="h-3 w-3" />
        Selecciona un usuario
      </div>

      <div
        className={cn(
          "flex flex-wrap justify-center gap-7 sm:gap-9",
          users.length <= 4 && "sm:gap-12",
        )}
      >
        {users.map((u, i) => (
          <motion.button
            key={u.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 380, damping: 26 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onPick(u)}
            className="group flex flex-col items-center gap-3 no-tap-highlight"
          >
            <UserAvatar
              name={u.nombre}
              rol={u.rol_display}
              esAdmin={u.es_admin}
              avatarUrl={u.avatar_url}
              size="lg"
            />
            <div className="text-center">
              <div className="text-[14px] font-[590] tracking-[-0.01em] text-foreground/95">
                {u.nombre}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-[590]">
                {u.rol_display}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function PinStep({
  user,
  onBack,
  onComplete,
  authenticating,
  error,
  onErrorClear,
}: {
  user: LockscreenUserDTO;
  onBack: () => void;
  onComplete: (pin: string) => Promise<void>;
  authenticating: boolean;
  error: boolean;
  onErrorClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col items-center gap-7 relative w-full"
    >
      <button
        type="button"
        onClick={onBack}
        disabled={authenticating}
        className={cn(
          "absolute -top-4 left-2 sm:-top-12 sm:left-0",
          "flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors",
          "press-ios disabled:opacity-50",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Cambiar usuario
      </button>

      <UserAvatar
        name={user.nombre}
        rol={user.rol_display}
        esAdmin={user.es_admin}
        avatarUrl={user.avatar_url}
        size="xl"
        selected
      />

      <div className="text-center">
        <div className="text-[20px] font-[600] tracking-[-0.022em]">{user.nombre}</div>
        <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-[590]">
          {error ? "PIN incorrecto" : "Ingresa tu código"}
        </div>
      </div>

      <PinKeypad
        length={user.pin_length || 4}
        onComplete={onComplete}
        disabled={authenticating}
        error={error}
        onErrorClear={onErrorClear}
      />

      <AnimatePresence>
        {authenticating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[12px] text-muted-foreground"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Verificando…
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="max-w-sm text-center space-y-3 rounded-[18px] border border-border/50 material-thick p-8 shadow-elevated">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-foreground/[0.06]">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-[15px] font-[600] tracking-[-0.014em]">Sistema sin configurar</h3>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground tracking-[-0.005em]">
        No hay usuarios activos. Crea el primer usuario en Supabase Auth y asigna
        sus datos en la tabla <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">app_users</code>.
      </p>
    </div>
  );
}

/**
 * Wallpaper estilo iOS lockscreen — bokeh de luces tenues + radial darken
 * para profundidad. Funciona en ambos themes (light = warm bokeh; dark =
 * cool blue/purple haze).
 */
function Wallpaper() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      {/* Base — tono frío en dark, gris cálido en light */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/40" />

      {/* Luz orb 1 (azul system) */}
      <div
        className="absolute -top-[20%] -left-[10%] h-[640px] w-[640px] rounded-full blur-[140px] opacity-70"
        style={{
          background:
            "radial-gradient(circle, oklch(0.598 0.197 256.5 / 0.35), transparent 70%)",
        }}
      />
      {/* Luz orb 2 (champagne/indigo) */}
      <div
        className="absolute -bottom-[20%] -right-[10%] h-[640px] w-[640px] rounded-full blur-[140px] opacity-60"
        style={{
          background:
            "radial-gradient(circle, oklch(0.685 0.072 70 / 0.32), transparent 70%)",
        }}
      />
      {/* Luz orb 3 (purple) — sólo dark se ve */}
      <div
        className="absolute top-[40%] left-[55%] h-[420px] w-[420px] rounded-full blur-[120px] opacity-30"
        style={{
          background:
            "radial-gradient(circle, oklch(0.585 0.215 309 / 0.4), transparent 70%)",
        }}
      />

      {/* Vignette — oscurece bordes para focus central */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, oklch(0 0 0 / 0.35) 100%)",
        }}
      />

      {/* Grain texture — sutil grano de "papel" Apple */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
