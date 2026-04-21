import { Coins } from "lucide-react";

import { ConfigEmpty } from "../config-empty";
import { cargarConfigYUsuario } from "../loader";
import { Section } from "../section";
import { FormOro } from "./form-oro";

export const metadata = { title: "Oro — Configuración" };

export default async function ConfigOroPage() {
  const { config } = await cargarConfigYUsuario();

  return (
    <Section
      icon={<Coins className="h-5 w-5" />}
      titulo="Compra de oro"
      descripcion="Cuánto margen se deja al comprar oro bajo el precio spot del día."
    >
      {config ? <FormOro config={config} /> : <ConfigEmpty />}
    </Section>
  );
}
