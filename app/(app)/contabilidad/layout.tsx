import { requireAcceso } from "@/lib/permisos/check";

/**
 * Layout del módulo Contabilidad.
 *
 * Cualquier usuario que entre a `/contabilidad/*` tiene que tener el
 * módulo `contabilidad` en `modulos_permitidos` (o ser admin). Caso
 * contrario, `requireAcceso` redirige a `/sin-permiso`.
 *
 * El típico usuario que entra aquí es el contable, que solo tiene este
 * módulo marcado en su perfil.
 */
export default async function ContabilidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAcceso("contabilidad");
  return <>{children}</>;
}
