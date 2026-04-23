-- ============================================================
-- 009 · Contabilidad DGII + campos extendidos de cliente
-- ============================================================
-- Agrega al sistema:
--   * Columnas opcionales en `clientes` necesarias para el Libro de
--     Compraventa físico (edad, color, nacionalidad, estado civil,
--     oficio/profesión). Todas nullable: el front las tratará como
--     opcionales y solo las exigirá cuando el contable arme el libro.
--   * Tabla `reportes_dgii_generados` que trackea los TXT que ya se
--     emitieron (606/607/608 por periodo) — así el contable sabe qué
--     ya subió a la DGII y qué falta.
--   * Vista `v_libro_compraventa` que une compras_oro + clientes con
--     todas las columnas del libro físico (para reemplazar la libreta).
--
-- Idempotente.
-- ============================================================

-- 1) Columnas nuevas en clientes (opcionales)
alter table public.clientes
  add column if not exists edad smallint check (edad is null or (edad between 0 and 120)),
  add column if not exists color text,
  add column if not exists nacionalidad text,
  add column if not exists estado_civil text,
  add column if not exists oficio_profesion text;

-- 2) Tipos para reportes DGII
do $$
begin
  if not exists (select 1 from pg_type where typname = 'formato_dgii') then
    create type formato_dgii as enum ('606', '607', '608');
  end if;
end $$;

-- 3) Tabla de reportes generados
create table if not exists public.reportes_dgii_generados (
  id uuid primary key default uuid_generate_v4(),
  formato formato_dgii not null,
  periodo text not null, -- 'YYYY-MM'
  generado_por uuid references public.app_users(id) on delete set null,
  generado_at timestamptz not null default now(),
  conteo_registros integer not null default 0,
  total_monto numeric(14,2) not null default 0,
  total_itbis numeric(14,2) not null default 0,
  archivo_txt_contenido text, -- guardamos el TXT generado para re-descarga
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reportes_dgii_formato_periodo
  on public.reportes_dgii_generados(formato, periodo desc);

-- Un mismo periodo puede regenerarse: NO poner unique. Se ordena por
-- generado_at desc para que la UI muestre la última.

-- 4) Vista: libro de compraventa
-- ============================================================
-- Este es el reemplazo digital del libro físico "RECORD DE COMPRA Y
-- VENTA / COMPRAVENTA PEPE". Una fila por COMPRA DE ORO con todas las
-- columnas del legal dominicano.
--
-- Columnas mapeadas desde la libreta:
--   Cédula          → clientes.cedula
--   Serie           → clientes.cedula (prefijo serie — no separamos)
--   Fecha Compra    → compras_oro.created_at
--   Nombre/Apellido → clientes.nombre_completo
--   Edad            → clientes.edad
--   Color           → clientes.color
--   Nacionalidad    → clientes.nacionalidad
--   Estado          → clientes.estado_civil
--   Oficio/Profesión→ clientes.oficio_profesion
--   Domicilio       → clientes.direccion
--   Residencia      → clientes.direccion (misma columna — el libro
--                     antiguo separaba domicilio/residencia)
--   No.             → compras_oro.codigo
--   Fecha de Salida → (vacío hasta que se venda: joined desde ventas)
--   Efectos         → descripción (kilataje + peso)
--   Orden No.       → compras_oro.codigo
--   Valor           → compras_oro.total_pagado
-- ============================================================
create or replace view public.v_libro_compraventa as
select
  co.id as compra_oro_id,
  co.codigo as orden_numero,
  c.cedula as cedula,
  co.created_at::date as fecha_compra,
  c.nombre_completo as nombre_completo,
  c.edad as edad,
  c.color as color,
  c.nacionalidad as nacionalidad,
  c.estado_civil as estado_civil,
  c.oficio_profesion as oficio_profesion,
  c.direccion as domicilio,
  c.telefono as telefono,
  co.kilataje as kilataje,
  co.peso_gramos as peso_gramos,
  co.precio_gramo as precio_gramo,
  co.total_pagado as valor,
  -- descripción resumida para la columna "Efectos"
  (co.kilataje::text || 'K · ' || co.peso_gramos::text || 'g') as efectos,
  co.notas as notas_compra,
  -- Fecha de salida (si hay venta relacionada al cliente posterior a la
  -- compra — aproximación, el legado no linkeaba compra↔venta directamente)
  null::date as fecha_salida
from public.compras_oro co
join public.clientes c on c.id = co.cliente_id;

-- 5) RLS — los admins y empleados con módulo 'contabilidad' pueden leer.
--    Las tablas fuente (compras_oro, clientes) ya tienen RLS; aquí solo
--    protegemos la tabla de reportes generados.
alter table public.reportes_dgii_generados enable row level security;

drop policy if exists reportes_dgii_select on public.reportes_dgii_generados;
create policy reportes_dgii_select on public.reportes_dgii_generados
  for select using (
    public.es_admin_actual()
    or public.tiene_acceso_modulo('contabilidad')
  );

drop policy if exists reportes_dgii_insert on public.reportes_dgii_generados;
create policy reportes_dgii_insert on public.reportes_dgii_generados
  for insert with check (
    public.es_admin_actual()
    or public.tiene_acceso_modulo('contabilidad')
  );

drop policy if exists reportes_dgii_update on public.reportes_dgii_generados;
create policy reportes_dgii_update on public.reportes_dgii_generados
  for update using (public.es_admin_actual())
  with check (public.es_admin_actual());

drop policy if exists reportes_dgii_delete on public.reportes_dgii_generados;
create policy reportes_dgii_delete on public.reportes_dgii_generados
  for delete using (public.es_admin_actual());

-- ============================================================
-- Notas de diseño:
--   * El TXT generado se guarda en `archivo_txt_contenido` en lugar de
--     un bucket de Storage — esto evita tener que manejar upload/delete
--     y el payload típico de un mes rara vez pasa 100KB.
--   * `total_itbis` se calcula pero en compraventa/empeños casi siempre
--     es 0 (ITBIS aplica en ventas con factura de crédito fiscal).
--   * La vista `v_libro_compraventa` solo considera COMPRAS DE ORO.
--     Si en el futuro se quieren incluir empeños vencidos convertidos a
--     propiedad, se puede hacer `union all` con `articulos` + `prestamos`.
-- ============================================================
