import Link from "next/link";
import { ShieldOff, ArrowLeft } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { getAppUser } from "@/lib/permisos/check";
import { MODULOS } from "@/lib/permisos/modulos";

export const metadata = { title: "Sin permiso" };

export default async function SinPermisoPage() {
  const me = await getAppUser();

  // Determinamos la mejor página a la que mandar al usuario:
  //   - admin: /
  //   - usuario con módulos permitidos: primer módulo permitido
  //   - usuario sin módulos: /config/perfil (única ruta siempre accesible)
  const esAdmin = me?.es_admin ?? false;
  const modulosPermitidos = me?.modulos_permitidos ?? [];
  const primerPermitido = esAdmin
    ? null
    : MODULOS.find((m) => !m.soloAdmin && modulosPermitidos.includes(m.codigo));

  const destino = esAdmin
    ? "/"
    : primerPermitido
      ? primerPermitido.path
      : "/config/perfil";
  const labelDestino = esAdmin
    ? "Volver al inicio"
    : primerPermitido
      ? `Ir a ${primerPermitido.label}`
      : "Ir a mi perfil";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-lg items-center justify-center px-4 py-8">
      <FadeIn>
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShieldOff className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight">
                No tienes permiso
              </h1>
              <p className="text-sm text-muted-foreground">
                Esta sección no está habilitada para tu usuario. Si crees que
                es un error, pídele al administrador que revise tus permisos.
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <Link
                href={destino}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                {labelDestino}
              </Link>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
