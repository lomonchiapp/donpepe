import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Fab } from "@/components/layout/fab";
import { PagoRapido } from "@/components/cmd/pago-rapido";
import { createClient } from "@/lib/supabase/server";
import { getAppUser, tieneAcceso } from "@/lib/permisos/check";
import { MODULOS, moduloDePathname } from "@/lib/permisos/modulos";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const me = await getAppUser();
  const esAdmin = me?.es_admin ?? false;
  const modulosPermitidos = me?.modulos_permitidos ?? [];

  // Enforcement a nivel URL: si el usuario escribe /empenos directo en el
  // navegador y no tiene el módulo habilitado, lo mandamos a /sin-permiso.
  // Admin pasa derecho. Whitelist: /sin-permiso (la propia página de error) y
  // /config/perfil (el perfil propio siempre es accesible, aunque el módulo
  // `config` sea soloAdmin).
  //
  // Caso especial: si el usuario llega a `/` (inicio) pero no tiene el módulo
  // `inicio`, en lugar de mandarlo a /sin-permiso (que crea un loop visual
  // con su botón "Volver al inicio"), lo redirigimos directo al primer módulo
  // que sí tiene permitido. Esto arregla la UX para roles limitados como
  // "contable" que solo tienen `contabilidad`.
  if (!esAdmin) {
    const hdrs = await headers();
    const pathname = hdrs.get("x-pathname") ?? "/";
    const esRutaAbierta =
      pathname.startsWith("/sin-permiso") ||
      pathname.startsWith("/config/perfil");
    if (!esRutaAbierta) {
      const modulo = moduloDePathname(pathname);
      if (modulo && !tieneAcceso(me, modulo.codigo)) {
        const primerPermitido = MODULOS.find(
          (m) => !m.soloAdmin && modulosPermitidos.includes(m.codigo),
        );
        if (pathname === "/" && primerPermitido) {
          redirect(primerPermitido.path);
        }
        redirect("/sin-permiso");
      }
    }
  }

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar esAdmin={esAdmin} modulosPermitidos={modulosPermitidos} />
      <div className="flex min-h-dvh w-full flex-col md:pl-64">
        <TopBar />
        <main className="flex-1 pb-24 md:pb-8">{children}</main>
        <BottomNav esAdmin={esAdmin} modulosPermitidos={modulosPermitidos} />
        <Fab />
        <PagoRapido />
      </div>
    </div>
  );
}
