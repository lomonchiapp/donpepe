"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function CompraOroFeedbackInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (sp.get("compra_oro") !== "ok") return;
    fired.current = true;

    const sinRecibo = sp.get("recibo_fallido") === "1";
    if (sinRecibo) {
      toast.warning("Compra de oro guardada", {
        description:
          "No se completó el movimiento de caja ni el recibo. La compra sí quedó en el sistema: revisá Pagos o contactá al administrador para reintentar.",
        duration: 14_000,
      });
    } else {
      toast.success("Compra de oro registrada", {
        description: "Podés abrir el recibo desde Pagos o Recibos para imprimirlo.",
        duration: 8000,
      });
    }

    const params = new URLSearchParams(sp.toString());
    params.delete("compra_oro");
    params.delete("recibo_fallido");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [sp, pathname, router]);

  return null;
}

/** Lee ?compra_oro=ok tras registrar compra de oro y muestra toast; limpia la query. */
export function CompraOroClienteFeedback() {
  return (
    <Suspense fallback={null}>
      <CompraOroFeedbackInner />
    </Suspense>
  );
}
