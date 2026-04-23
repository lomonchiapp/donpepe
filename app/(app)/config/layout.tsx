import { Settings } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { getAppUser } from "@/lib/permisos/check";

import { ConfigTabs } from "./config-tabs";

export const metadata = { title: "Configuración" };

export default async function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getAppUser();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <FadeIn>
        <header className="mb-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Settings className="h-7 w-7" /> Configuración
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajusta el funcionamiento del sistema en cada módulo.
          </p>
        </header>
      </FadeIn>

      <ConfigTabs esAdmin={me?.es_admin ?? false} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
