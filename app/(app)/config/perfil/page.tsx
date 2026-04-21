import { User } from "lucide-react";

import { ConfigEmpty } from "../config-empty";
import { cargarConfigYUsuario } from "../loader";
import { Section } from "../section";
import { FormPerfil } from "./form-perfil";

export const metadata = { title: "Mi perfil — Configuración" };

export default async function ConfigPerfilPage() {
  const { me } = await cargarConfigYUsuario();

  return (
    <Section
      icon={<User className="h-5 w-5" />}
      titulo="Mi perfil"
      descripcion="Tu nombre, tu WhatsApp y las alertas que recibes."
    >
      {me ? <FormPerfil me={me} /> : <ConfigEmpty />}
    </Section>
  );
}
