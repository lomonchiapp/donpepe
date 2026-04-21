import { Bell } from "lucide-react";

import { ConfigEmpty } from "../config-empty";
import { cargarConfigYUsuario } from "../loader";
import { Section } from "../section";
import { FormAlertas } from "./form-alertas";

export const metadata = { title: "Alertas — Configuración" };

export default async function ConfigAlertasPage() {
  const { config } = await cargarConfigYUsuario();

  return (
    <Section
      icon={<Bell className="h-5 w-5" />}
      titulo="Alertas y recordatorios"
      descripcion="Cuándo se envían los avisos de vencimiento por WhatsApp al dueño y a los clientes."
    >
      {config ? <FormAlertas config={config} /> : <ConfigEmpty />}
    </Section>
  );
}
