import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FormCliente } from "@/components/cliente/form-cliente";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = { title: "Nuevo cliente" };

export default function NuevoClientePage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 md:py-8">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Nuevo cliente
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Registra una persona para empeñar o vender oro.
        </p>
        <FormCliente />
      </FadeIn>
    </div>
  );
}
