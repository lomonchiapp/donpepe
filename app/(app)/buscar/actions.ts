"use server";

import { createClient } from "@/lib/supabase/server";

export interface ResultadoCliente {
  tipo: "cliente";
  id: string;
  nombre: string;
  cedula: string;
  telefono: string | null;
}

export interface ResultadoEmpeno {
  tipo: "empeno";
  id: string;
  codigo: string;
  estado: string;
  monto: number;
}

export interface ResultadoPieza {
  tipo: "pieza";
  id: string;
  nombre: string;
  sku: string;
  precio: number;
  estado: string;
}

export type Resultado = ResultadoCliente | ResultadoEmpeno | ResultadoPieza;

// Escapa caracteres que PostgREST interpreta en filtros `.or()` y `ilike` patterns.
function escaparParaIlike(q: string): string {
  return q.replace(/[%_]/g, "\\$&").replace(/,/g, " ");
}

export async function buscarGlobal(q: string): Promise<Resultado[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const safe = escaparParaIlike(query);

  const [clientesRes, empenosRes, piezasRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nombre_completo, cedula, telefono")
      .or(
        `nombre_completo.ilike.%${safe}%,cedula.ilike.%${safe}%,telefono.ilike.%${safe}%`,
      )
      .limit(6),
    supabase
      .from("prestamos")
      .select("id, codigo, estado, monto_prestado")
      .ilike("codigo", `%${safe}%`)
      .limit(6),
    supabase
      .from("piezas_joyeria")
      .select("id, nombre, sku, precio_venta, estado")
      .or(`nombre.ilike.%${safe}%,sku.ilike.%${safe}%`)
      .limit(6),
  ]);

  const resultados: Resultado[] = [];

  for (const c of (clientesRes.data ?? []) as Array<{
    id: string;
    nombre_completo: string;
    cedula: string;
    telefono: string | null;
  }>) {
    resultados.push({
      tipo: "cliente",
      id: c.id,
      nombre: c.nombre_completo,
      cedula: c.cedula,
      telefono: c.telefono,
    });
  }

  for (const e of (empenosRes.data ?? []) as Array<{
    id: string;
    codigo: string;
    estado: string;
    monto_prestado: number;
  }>) {
    resultados.push({
      tipo: "empeno",
      id: e.id,
      codigo: e.codigo,
      estado: e.estado,
      monto: Number(e.monto_prestado),
    });
  }

  for (const p of (piezasRes.data ?? []) as Array<{
    id: string;
    nombre: string;
    sku: string;
    precio_venta: number;
    estado: string;
  }>) {
    resultados.push({
      tipo: "pieza",
      id: p.id,
      nombre: p.nombre,
      sku: p.sku,
      precio: Number(p.precio_venta),
      estado: p.estado,
    });
  }

  return resultados;
}
