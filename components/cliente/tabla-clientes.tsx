"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Columns3,
  Copy,
  Eye,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  Coins,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { eliminarCliente } from "@/app/(app)/clientes/actions";
import {
  formatearFechaCorta,
  formatearTelefono,
} from "@/lib/format";
import type { Cliente } from "@/lib/supabase/types";
import { EditarClienteDialog } from "@/components/cliente/editar-cliente-dialog";

/**
 * Conteos precalculados por cliente que se muestran en la tabla.
 * Se computan en `/clientes/page.tsx` con queries agregados.
 */
export interface ClienteRow extends Cliente {
  empenos_activos: number;
  empenos_total: number;
  compras_oro_total: number;
  facturas_total: number;
}

type ColKey =
  | "cedula"
  | "telefono"
  | "direccion"
  | "edad"
  | "oficio_profesion"
  | "empenos"
  | "compras_oro"
  | "facturas"
  | "created_at";

const COLUMNAS: { key: ColKey; label: string; defaultVisible: boolean }[] = [
  { key: "cedula", label: "Cédula", defaultVisible: true },
  { key: "telefono", label: "Teléfono", defaultVisible: true },
  { key: "direccion", label: "Dirección", defaultVisible: false },
  { key: "edad", label: "Edad", defaultVisible: false },
  { key: "oficio_profesion", label: "Oficio / Profesión", defaultVisible: false },
  { key: "empenos", label: "Empeños", defaultVisible: true },
  { key: "compras_oro", label: "Compras oro", defaultVisible: false },
  { key: "facturas", label: "Facturas", defaultVisible: false },
  { key: "created_at", label: "Registrado", defaultVisible: true },
];

const LS_KEY = "don-pepe:clientes:cols:v1";
const LS_EVENT = "don-pepe:clientes:cols:update";

const DEFAULT_VISIBLES: Record<ColKey, boolean> = COLUMNAS.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.defaultVisible }),
  {} as Record<ColKey, boolean>,
);

// `useSyncExternalStore` es el patrón recomendado para leer de
// localStorage sin caer en efectos con `setState` y sin mismatches
// de hidratación.
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(LS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LS_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

function guardarColumnas(next: Record<ColKey, boolean>): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(LS_EVENT));
  } catch {
    // localStorage bloqueado (modo privado / permisos) — no es fatal.
  }
}

interface Props {
  clientes: ClienteRow[];
}

export function TablaClientes({ clientes }: Props) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const visibles = useMemo<Record<ColKey, boolean>>(() => {
    if (!raw) return DEFAULT_VISIBLES;
    try {
      const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
      return { ...DEFAULT_VISIBLES, ...parsed };
    } catch {
      return DEFAULT_VISIBLES;
    }
  }, [raw]);

  function toggleCol(key: ColKey) {
    guardarColumnas({ ...visibles, [key]: !visibles[key] });
  }

  function resetearCols() {
    guardarColumnas(DEFAULT_VISIBLES);
  }

  const colsVisibles = useMemo(
    () => COLUMNAS.filter((c) => visibles[c.key]),
    [visibles],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {clientes.length}{" "}
          {clientes.length === 1 ? "cliente" : "clientes"}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Columns3 className="h-4 w-4" />
                Columnas
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNAS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={visibles[c.key]}
                onCheckedChange={() => toggleCol(c.key)}
                // Evitamos cerrar el menú al togglear una columna.
                closeOnClick={false}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={resetearCols}>
              Restablecer columnas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Cliente</th>
              {colsVisibles.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 font-medium whitespace-nowrap"
                >
                  {c.label}
                </th>
              ))}
              <th className="w-12 px-3 py-2 text-right font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <FilaCliente
                key={c.id}
                cliente={c}
                colsVisibles={colsVisibles}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaCliente({
  cliente,
  colsVisibles,
}: {
  cliente: ClienteRow;
  colsVisibles: { key: ColKey; label: string }[];
}) {
  return (
    <tr className="border-t transition-colors hover:bg-muted/30">
      <td className="px-3 py-2.5">
        <Link
          href={`/clientes/${cliente.id}`}
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {cliente.nombre_completo.charAt(0).toUpperCase()}
          </div>
          <span className="truncate font-medium group-hover:underline">
            {cliente.nombre_completo}
          </span>
        </Link>
      </td>
      {colsVisibles.map((c) => (
        <td
          key={c.key}
          className="px-3 py-2.5 whitespace-nowrap text-muted-foreground"
        >
          <Celda col={c.key} cliente={cliente} />
        </td>
      ))}
      <td className="px-3 py-2.5 text-right">
        <AccionesCliente cliente={cliente} />
      </td>
    </tr>
  );
}

function Celda({ col, cliente }: { col: ColKey; cliente: ClienteRow }) {
  switch (col) {
    case "cedula":
      return <span className="font-mono text-xs">{cliente.cedula}</span>;
    case "telefono":
      return cliente.telefono ? (
        <span>{formatearTelefono(cliente.telefono)}</span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      );
    case "direccion":
      return cliente.direccion ? (
        <span className="block max-w-[220px] truncate">{cliente.direccion}</span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      );
    case "edad":
      return cliente.edad != null ? (
        <span>{cliente.edad}</span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      );
    case "oficio_profesion":
      return cliente.oficio_profesion ? (
        <span className="block max-w-[180px] truncate">
          {cliente.oficio_profesion}
        </span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      );
    case "empenos":
      if (cliente.empenos_total === 0)
        return <span className="text-muted-foreground/60">—</span>;
      return (
        <span className="tabular-nums">
          {cliente.empenos_total}
          {cliente.empenos_activos > 0 && (
            <span className="ml-1 text-[10px] font-medium text-primary">
              ({cliente.empenos_activos} activos)
            </span>
          )}
        </span>
      );
    case "compras_oro":
      return cliente.compras_oro_total > 0 ? (
        <span className="tabular-nums">{cliente.compras_oro_total}</span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      );
    case "facturas":
      return cliente.facturas_total > 0 ? (
        <span className="tabular-nums">{cliente.facturas_total}</span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      );
    case "created_at":
      return (
        <span className="text-xs">
          {formatearFechaCorta(cliente.created_at)}
        </span>
      );
  }
}

function AccionesCliente({ cliente }: { cliente: ClienteRow }) {
  const router = useRouter();
  const [editarOpen, setEditarOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const tel = (cliente.telefono ?? "").replace(/\D/g, "");
  const telE164 = tel.length === 10 ? `1${tel}` : tel;
  const tieneHistorial =
    cliente.empenos_total > 0 || cliente.compras_oro_total > 0;

  function copiarCedula() {
    navigator.clipboard.writeText(cliente.cedula).then(
      () => toast.success("Cédula copiada"),
      () => toast.error("No se pudo copiar"),
    );
  }

  function confirmarEliminar() {
    startTransition(async () => {
      try {
        const res = await eliminarCliente({ cliente_id: cliente.id });
        if (res && "error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Cliente ${cliente.nombre_completo} eliminado`);
        setEliminarOpen(false);
        router.refresh();
      } catch (err) {
        // `redirect()` de Next lanza NEXT_REDIRECT — se deja propagar.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest?: string }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        toast.error(
          err instanceof Error ? err.message : "Error al eliminar",
        );
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Acciones para ${cliente.nombre_completo}`}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            onSelect={() => router.push(`/clientes/${cliente.id}`)}
          >
            <Eye className="mr-2 h-4 w-4" /> Ver detalle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditarOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Nuevo</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() =>
              router.push(`/empenos/nuevo?cliente=${cliente.id}`)
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Nuevo empeño
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              router.push(`/oro/compra?cliente=${cliente.id}`)
            }
          >
            <Coins className="mr-2 h-4 w-4" /> Compra de oro
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              router.push(`/ventas/nueva?cliente=${cliente.id}`)
            }
          >
            <ShoppingCart className="mr-2 h-4 w-4" /> Nueva venta
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              router.push(`/facturas/nueva?cliente=${cliente.id}`)
            }
          >
            <Receipt className="mr-2 h-4 w-4" /> Nueva factura
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Historial</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => router.push(`/empenos?cliente=${cliente.id}`)}
          >
            <FileText className="mr-2 h-4 w-4" /> Ver empeños
            {cliente.empenos_total > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {cliente.empenos_total}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => router.push(`/facturas?cliente=${cliente.id}`)}
          >
            <Receipt className="mr-2 h-4 w-4" /> Ver facturas
            {cliente.facturas_total > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {cliente.facturas_total}
              </span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copiarCedula}>
            <Copy className="mr-2 h-4 w-4" /> Copiar cédula
          </DropdownMenuItem>
          {telE164 && (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  window.location.href = `tel:+${telE164}`;
                }}
              >
                <Phone className="mr-2 h-4 w-4" /> Llamar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  window.open(
                    `https://wa.me/${telE164}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setEliminarOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar cliente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditarClienteDialog
        cliente={cliente}
        open={editarOpen}
        onOpenChange={setEditarOpen}
      />

      <Dialog open={eliminarOpen} onOpenChange={setEliminarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              {tieneHistorial ? (
                <>
                  <strong>{cliente.nombre_completo}</strong> tiene{" "}
                  {cliente.empenos_total > 0 && (
                    <>
                      {cliente.empenos_total} empeño
                      {cliente.empenos_total === 1 ? "" : "s"}
                    </>
                  )}
                  {cliente.empenos_total > 0 &&
                    cliente.compras_oro_total > 0 &&
                    " y "}
                  {cliente.compras_oro_total > 0 && (
                    <>
                      {cliente.compras_oro_total} compra
                      {cliente.compras_oro_total === 1 ? "" : "s"} de oro
                    </>
                  )}{" "}
                  registrado
                  {cliente.empenos_total + cliente.compras_oro_total === 1
                    ? ""
                    : "s"}
                  . No se puede eliminar hasta remover esos registros primero.
                </>
              ) : (
                <>
                  Se eliminará a <strong>{cliente.nombre_completo}</strong>.
                  Si tiene artículos, pagos, recibos o facturas históricas,
                  estos sobreviven pero pierden la referencia. Esta acción no
                  se puede deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEliminarOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarEliminar}
              disabled={pending || tieneHistorial}
            >
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
