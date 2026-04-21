import { Building2 } from "lucide-react";

import { ConfigEmpty } from "../config-empty";
import { cargarConfigYUsuario } from "../loader";
import { Section } from "../section";
import { FormGeneral } from "./form-general";

export const metadata = { title: "General — Configuración" };

export default async function ConfigGeneralPage() {
  const { config } = await cargarConfigYUsuario();

  return (
    <Section
      icon={<Building2 className="h-5 w-5" />}
      titulo="Identidad del negocio"
      descripcion="Nombre comercial, contacto público y dirección. Aparece en recibos impresos."
    >
      {config ? <FormGeneral config={config} /> : <ConfigEmpty />}
    </Section>
  );
}
