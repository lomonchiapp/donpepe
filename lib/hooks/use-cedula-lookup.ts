"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { limpiarCedula } from "@/lib/validaciones/cedula-do";

export type CedulaLookupData = {
  valid: true;
  cedula: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  source: "ogtic+megaplus" | "megaplus" | "ogtic" | "luhn";
};

export type CedulaLookupStatus = "idle" | "typing" | "loading" | "found" | "not-found";

interface State {
  status: CedulaLookupStatus;
  data: CedulaLookupData | null;
  message: string | null;
}

const INITIAL: State = { status: "idle", data: null, message: null };

/**
 * Hook para validar cédulas contra `/api/cedula/[cedula]` con debounce.
 *
 * Uso:
 * ```tsx
 * const { state, lookup, reset } = useCedulaLookup();
 * <Input onChange={(e) => lookup(e.target.value)} />
 * {state.status === "found" && <p>{state.data.fullName}</p>}
 * ```
 */
export function useCedulaLookup(opts: { debounceMs?: number } = {}) {
  const { debounceMs = 400 } = opts;
  const [state, setState] = useState<State>(INITIAL);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (ctrlRef.current) ctrlRef.current.abort();
    setState(INITIAL);
  }, []);

  const lookup = useCallback(
    (input: string) => {
      const clean = limpiarCedula(input);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (ctrlRef.current) ctrlRef.current.abort();

      if (clean.length === 0) {
        setState(INITIAL);
        return;
      }

      if (clean.length < 11) {
        setState({ status: "typing", data: null, message: null });
        return;
      }

      setState((prev) => ({ ...prev, status: "loading", message: null }));

      timerRef.current = setTimeout(async () => {
        const ctrl = new AbortController();
        ctrlRef.current = ctrl;
        try {
          const res = await fetch(`/api/cedula/${clean}`, {
            signal: ctrl.signal,
          });
          const body = (await res.json()) as
            | CedulaLookupData
            | { valid: false; message: string };

          if (body.valid) {
            setState({ status: "found", data: body, message: null });
          } else {
            setState({
              status: "not-found",
              data: null,
              message: body.message,
            });
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setState({
            status: "not-found",
            data: null,
            message: "Error de conexión",
          });
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => () => reset(), [reset]);

  return { state, lookup, reset };
}
