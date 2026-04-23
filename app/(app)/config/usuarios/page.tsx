import { UsersRound, ShieldCheck, AlertCircle } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/permisos/check";
import { moduloByCodigo } from "@/lib/permisos/modulos";
import { formatearFechaCorta } from "@/lib/format";

import { Section } from "../section";
import { listarUsuarios } from "./actions";
import { CrearUsuarioDialog } from "./crear-usuario-dialog";
import { EditarUsuarioDialog } from "./editar-usuario-dialog";
import { AccionesUsuario } from "./acciones-usuario";

export const metadata = { title: "Usuarios — Configuración" };

export default async function ConfigUsuariosPage() {
  const me = await requireAdmin();
  const usuarios = await listarUsuarios();

  return (
    <FadeIn>
      <Section
        icon={<UsersRound className="h-5 w-5" />}
        titulo="Usuarios"
        descripcion="Gestiona quién accede al sistema y a qué módulos. Tú siempre serás el super-admin."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>
                Estás conectado como{" "}
                <strong className="text-foreground">{me.email}</strong>{" "}
                (super-admin).
              </span>
            </div>
            <CrearUsuarioDialog />
          </div>

          {usuarios.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Todavía no hay usuarios registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Nombre</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Permisos</th>
                    <th className="pb-3 pr-4">Estado</th>
                    <th className="pb-3 pr-4">Creado</th>
                    <th className="pb-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t align-top text-sm last:border-b"
                    >
                      <td className="py-3 pr-4 font-medium">
                        <div className="flex items-center gap-2">
                          {u.nombre}
                          {u.es_admin && (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 text-primary"
                            >
                              Admin
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="py-3 pr-4">
                        {u.es_admin ? (
                          <span className="text-muted-foreground">
                            Acceso total
                          </span>
                        ) : u.modulos_permitidos.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Sin permisos
                          </span>
                        ) : (
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {u.modulos_permitidos.slice(0, 4).map((codigo) => {
                              const m = moduloByCodigo(codigo);
                              return (
                                <Badge
                                  key={codigo}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {m?.label ?? codigo}
                                </Badge>
                              );
                            })}
                            {u.modulos_permitidos.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{u.modulos_permitidos.length - 4}
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {u.activo ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          >
                            Activo
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-muted-foreground/30 text-muted-foreground"
                          >
                            Inactivo
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatearFechaCorta(u.created_at)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditarUsuarioDialog usuario={u} />
                          <AccionesUsuario usuario={u} meId={me.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </FadeIn>
  );
}
