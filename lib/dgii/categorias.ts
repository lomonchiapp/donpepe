/**
 * Catálogos DGII usados en el módulo de gastos operativos y en los
 * selects del 606. Los códigos son los que publica DGII y están
 * modelados en los enums `tipo_gasto_dgii` y `forma_pago_dgii` de la
 * migración 010.
 */

import type { FormaPagoDgii, TipoGastoDgii } from "@/lib/supabase/types";

export const TIPOS_GASTO_DGII: Array<{
  codigo: TipoGastoDgii;
  etiqueta: string;
  descripcion: string;
}> = [
  { codigo: "01", etiqueta: "Gastos de Personal", descripcion: "Nómina, prestaciones, bonos" },
  { codigo: "02", etiqueta: "Trabajos, Suministros y Servicios", descripcion: "Contratistas, insumos" },
  { codigo: "03", etiqueta: "Arrendamientos", descripcion: "Alquiler del local" },
  { codigo: "04", etiqueta: "Activos Fijos (gastos)", descripcion: "Reparación de equipo" },
  { codigo: "05", etiqueta: "Representación", descripcion: "Almuerzos de negocio" },
  { codigo: "06", etiqueta: "Otras Deducciones Admitidas", descripcion: "Misc. deducible" },
  { codigo: "07", etiqueta: "Gastos Financieros", descripcion: "Intereses, comisiones bancarias" },
  { codigo: "08", etiqueta: "Gastos Extraordinarios", descripcion: "Eventos no recurrentes" },
  { codigo: "09", etiqueta: "Costo de Venta", descripcion: "Compras que forman parte del costo" },
  { codigo: "10", etiqueta: "Adquisiciones de Activos", descripcion: "Compra de equipo/vehículos" },
  { codigo: "11", etiqueta: "Seguros", descripcion: "Pólizas" },
];

export const FORMAS_PAGO_DGII: Array<{
  codigo: FormaPagoDgii;
  etiqueta: string;
}> = [
  { codigo: "01", etiqueta: "Efectivo" },
  { codigo: "02", etiqueta: "Cheque / Transferencia / Depósito" },
  { codigo: "03", etiqueta: "Tarjeta Crédito / Débito" },
  { codigo: "04", etiqueta: "Compra a Crédito" },
  { codigo: "05", etiqueta: "Permuta" },
  { codigo: "06", etiqueta: "Nota de Crédito" },
  { codigo: "07", etiqueta: "Mixto" },
];

export function etiquetaTipoGasto(codigo: TipoGastoDgii | string): string {
  return (
    TIPOS_GASTO_DGII.find((t) => t.codigo === codigo)?.etiqueta ?? codigo
  );
}

export function etiquetaFormaPago(codigo: FormaPagoDgii | string): string {
  return (
    FORMAS_PAGO_DGII.find((f) => f.codigo === codigo)?.etiqueta ?? codigo
  );
}
