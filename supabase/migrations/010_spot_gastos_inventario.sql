-- ============================================================
-- 010 · Spot metales + gastos operativos + disponibilidad oro
-- ============================================================
-- Agrega al sistema:
--   * Tabla `spot_metales_diario`: precio internacional (referencia) por
--     día para oro 24K, plata, platino y paladio. Se actualiza una vez
--     por día vía cron (app/api/cron/spot-metales/route.ts) llamando a
--     MetalpriceAPI. Es INFORMATIVO — los precios locales para compra
--     siguen en `precios_oro` y los controla el dueño manualmente.
--
--   * Tabla `gastos_operativos`: gastos del negocio (alquiler, luz,
--     personal, suministros, etc.) — dos usos:
--       1. Contabilidad interna (margen real).
--       2. Alimentar el 606 DGII con gastos admitidos como deducibles.
--
--   * Columna `compras_oro.oro_disponible`: flag que indica si el oro
--     comprado todavía está en stock (true) o ya se fundió/vendió
--     (false). Permite que /inventario muestre oro comprado pendiente
--     de procesar.
--
--   * Vista `v_libro_compraventa` ahora UNE compras_oro Y gastos con
--     RNC para que el contable vea todo en un solo libro.
--
-- Idempotente.
-- ============================================================

-- 1) Tabla spot_metales_diario
-- ------------------------------------------------------------
create table if not exists public.spot_metales_diario (
  fecha date primary key,
  -- Precios en DOP por gramo. Nullable si la API falló para ese metal.
  oro_24k_dop_gramo numeric(10, 2),
  plata_dop_gramo numeric(10, 4),
  platino_dop_gramo numeric(10, 2),
  paladio_dop_gramo numeric(10, 2),
  -- Precios brutos USD/oz tal como vienen de la API (para auditoría).
  oro_usd_oz numeric(10, 2),
  plata_usd_oz numeric(10, 4),
  platino_usd_oz numeric(10, 2),
  paladio_usd_oz numeric(10, 2),
  -- Tipo de cambio USD→DOP usado en la conversión.
  usd_dop numeric(10, 4),
  fuente text not null default 'metalpriceapi',
  actualizado_at timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_spot_metales_fecha
  on public.spot_metales_diario(fecha desc);

-- RLS: todos los empleados logueados pueden leer; solo admin puede
-- escribir (el cron usa service role y bypasea RLS de todos modos).
alter table public.spot_metales_diario enable row level security;

drop policy if exists spot_metales_select on public.spot_metales_diario;
create policy spot_metales_select on public.spot_metales_diario
  for select using (true);

drop policy if exists spot_metales_write on public.spot_metales_diario;
create policy spot_metales_write on public.spot_metales_diario
  for all using (public.es_admin_actual())
  with check (public.es_admin_actual());

-- 2) Tabla gastos_operativos
-- ------------------------------------------------------------
-- Cubre los códigos de Tipo de Bien/Servicio de la DGII 606:
--   01 Gastos de Personal
--   02 Trabajos, Suministros y Servicios
--   03 Arrendamientos
--   04 Activos Fijos
--   05 Representación
--   06 Otras Deducciones Admitidas
--   07 Gastos Financieros
--   08 Gastos Extraordinarios
--   09 Compras/Gastos que forman parte del Costo de Venta
--   10 Adquisiciones de Activos
--   11 Seguros
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_gasto_dgii') then
    create type tipo_gasto_dgii as enum (
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'forma_pago_dgii') then
    create type forma_pago_dgii as enum (
      '01', -- Efectivo
      '02', -- Cheques/Transferencias/Depósitos
      '03', -- Tarjeta Crédito/Débito
      '04', -- Compra a Crédito
      '05', -- Permuta
      '06', -- Nota de Crédito
      '07'  -- Mixto
    );
  end if;
end $$;

create table if not exists public.gastos_operativos (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null default current_date,
  concepto text not null,
  monto numeric(14, 2) not null check (monto > 0),
  categoria tipo_gasto_dgii not null default '02',
  -- Datos del proveedor (pueden ser NULL si es gasto sin factura formal).
  rnc_proveedor text,
  nombre_proveedor text,
  -- Para la columna "Tipo ID" del 606 (1=RNC, 2=Cédula).
  tipo_id_proveedor char(1), -- '1' RNC, '2' Cédula
  ncf text,
  ncf_modificado text,
  itbis_facturado numeric(14, 2) not null default 0,
  itbis_retenido numeric(14, 2) not null default 0,
  forma_pago forma_pago_dgii not null default '01',
  notas text,
  registrado_por uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gastos_fecha
  on public.gastos_operativos(fecha desc);
create index if not exists idx_gastos_categoria
  on public.gastos_operativos(categoria, fecha desc);
create index if not exists idx_gastos_rnc
  on public.gastos_operativos(rnc_proveedor)
  where rnc_proveedor is not null;

alter table public.gastos_operativos enable row level security;

drop policy if exists gastos_select on public.gastos_operativos;
create policy gastos_select on public.gastos_operativos
  for select using (
    public.es_admin_actual()
    or public.tiene_acceso_modulo('contabilidad')
  );

drop policy if exists gastos_insert on public.gastos_operativos;
create policy gastos_insert on public.gastos_operativos
  for insert with check (
    public.es_admin_actual()
    or public.tiene_acceso_modulo('contabilidad')
  );

drop policy if exists gastos_update on public.gastos_operativos;
create policy gastos_update on public.gastos_operativos
  for update using (
    public.es_admin_actual()
    or public.tiene_acceso_modulo('contabilidad')
  )
  with check (
    public.es_admin_actual()
    or public.tiene_acceso_modulo('contabilidad')
  );

drop policy if exists gastos_delete on public.gastos_operativos;
create policy gastos_delete on public.gastos_operativos
  for delete using (public.es_admin_actual());

-- Trigger updated_at
create or replace function public.tg_gastos_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gastos_updated_at on public.gastos_operativos;
create trigger trg_gastos_updated_at
  before update on public.gastos_operativos
  for each row execute function public.tg_gastos_updated_at();

-- 3) Columna compras_oro.oro_disponible
-- ------------------------------------------------------------
-- true = el oro está en stock (no se fundió/vendió todavía)
-- false = ya se procesó (convertido a pieza joyería o vendido)
-- Default true: las compras históricas se consideran "en stock" hasta
-- que alguien las marque explícitamente como procesadas.
alter table public.compras_oro
  add column if not exists oro_disponible boolean not null default true;

create index if not exists idx_compras_oro_disponible
  on public.compras_oro(oro_disponible, created_at desc)
  where oro_disponible = true;

-- Cuando se convierte una compra_oro en pieza_joyeria, el flujo ya
-- inserta en piezas_joyeria con origen='compra_oro'. Agregamos un
-- trigger que pone oro_disponible=false automáticamente.
create or replace function public.tg_marcar_compra_oro_procesada()
returns trigger as $$
begin
  if new.origen = 'compra_oro' and new.origen_ref is not null then
    update public.compras_oro
      set oro_disponible = false
      where id = new.origen_ref::uuid;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_marcar_compra_oro_procesada on public.piezas_joyeria;
create trigger trg_marcar_compra_oro_procesada
  after insert on public.piezas_joyeria
  for each row execute function public.tg_marcar_compra_oro_procesada();

-- 4) Vista v_libro_compraventa — ahora une compras_oro + gastos
-- ------------------------------------------------------------
-- Incluimos los gastos con RNC que son deducibles para el 606. Los
-- gastos sin RNC/sin NCF siguen existiendo en `gastos_operativos` pero
-- no aparecen en el libro legal, solo en reportes internos.
create or replace view public.v_libro_compraventa as
-- Fuente 1: compras de oro
select
  co.id as registro_id,
  'compra_oro'::text as origen,
  co.codigo as orden_numero,
  c.cedula as cedula,
  co.created_at::date as fecha,
  c.nombre_completo as nombre,
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
  (co.kilataje::text || 'K · ' || co.peso_gramos::text || 'g') as efectos,
  co.notas as notas,
  null::date as fecha_salida,
  null::text as ncf,
  'oro'::text as categoria,
  co.oro_disponible as disponible
from public.compras_oro co
join public.clientes c on c.id = co.cliente_id

union all

-- Fuente 2: gastos operativos
select
  g.id as registro_id,
  'gasto'::text as origen,
  coalesce(g.ncf, 'SIN-NCF') as orden_numero,
  coalesce(g.rnc_proveedor, '') as cedula,
  g.fecha as fecha,
  coalesce(g.nombre_proveedor, g.concepto) as nombre,
  null::smallint as edad,
  null::text as color,
  null::text as nacionalidad,
  null::text as estado_civil,
  null::text as oficio_profesion,
  null::text as domicilio,
  null::text as telefono,
  null::integer as kilataje,
  null::numeric as peso_gramos,
  null::numeric as precio_gramo,
  g.monto as valor,
  g.concepto as efectos,
  g.notas as notas,
  null::date as fecha_salida,
  g.ncf as ncf,
  g.categoria::text as categoria,
  null::boolean as disponible
from public.gastos_operativos g;

-- ============================================================
-- Fin migración 010
-- ============================================================
