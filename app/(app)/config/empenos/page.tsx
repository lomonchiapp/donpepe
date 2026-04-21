import { Scale } from "lucide-react";

import { ConfigEmpty } from "../config-empty";
import { cargarConfigYUsuario } from "../loader";
import { Section } from "../section";
import { FormEmpenos } from "./form-empenos";

export const metadata = { title: "Empeños — Configuración" };

export default async function ConfigEmpenosPage() {
  const { config } = await cargarConfigYUsuario();

  return (
    <Section
      icon={<Scale className="h-5 w-5" />}
      titulo="Valores por defecto de empeños"
      descripcion="Estos valores se pre-cargan al crear un nuevo préstamo. Se pueden ajustar caso por caso."
    >
      {config ? <FormEmpenos config={config} /> : <ConfigEmpty />}
    </Section>
  );
}
