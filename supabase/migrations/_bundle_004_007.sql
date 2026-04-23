-- ============================================================
-- Bundle: 004 + 005 + 006 + 007
-- Correr UNA SOLA VEZ en SQL Editor. Es idempotente.
-- ============================================================

-- ########## 004_joyeria.sql ##########
-- Don Pepe — Módulo de Joyería
-- ---------------------------------------------------------------
-- Inventario de joyería como negocio paralelo a la compraventa.
--
-- Diseño:
--   * Tabla separada `piezas_joyeria` (no reusa `articulos`).
--   * SKU auto incremental JY-000001.
--   * Soporta piezas individuales (oro/plata) y lotes (ideal para plata barata
--     tipo "50 aretes iguales" — se descuenta unidad por venta).
--   * Audit log en `movimientos_joyeria` alimentado por triggers.
--   * Ventas pueden ser de artículo (compraventa) O de pieza (joyería),
--     con `cantidad` para soportar venta de N unidades de un lote.
-- ---------------------------------------------------------------

-- Categorías editables (anillo, cadena, pulsera…)
create table if not exists public.categorias_joyeria (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text unique not null,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categorias_joyeria (nombre, slug, orden) values
  ('Anillo',      'anillo',      10),
  ('Cadena',      'cadena',      20),
  ('Pulsera',     'pulsera',     30),
  ('Arete',       'arete',       40),
  ('Dije',        'dije',        50),
  ('Collar',      'collar',      60),
  ('Pendiente',   'pendiente',   70),
  ('Reloj',       'reloj',       80),
  ('Gargantilla', 'gargantilla', 90),
  ('Otro',        'otro',        999)
on conflict (slug) do nothing;

-- Secuencia y RPC de SKU
create sequence if not exists public.piezas_joyeria_sku_seq start 1;

create or replace function public.generar_sku_joyeria()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.piezas_joyeria_sku_seq');
  return 'JY-' || lpad(n::text, 6, '0');
end;
$$;

-- Enums
do $$ begin
  create type tipo_registro_joyeria as enum ('pieza', 'lote');
exception when duplicate_object then null; end $$;

do $$ begin
  create type material_joyeria as enum ('oro', 'plata', 'mixto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pieza_joyeria as enum (
    'disponible', 'reservada', 'vendida', 'en_reparacion', 'baja', 'agotado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type origen_joyeria as enum (
    'taller', 'compra_oro', 'articulo_propiedad', 'proveedor_externo'
  );
exception when duplicate_object then null; end $$;

-- Tabla principal
create table if not exists public.piezas_joyeria (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  tipo_registro tipo_registro_joyeria not null default 'pieza',

  categoria_id uuid references public.categorias_joyeria(id) on delete set null,
  nombre text not null,
  material material_joyeria not null,
  kilataje int check (kilataje is null or kilataje in (10, 14, 18, 22, 24, 800, 925, 950, 999)),

  -- Individuales
  peso_gramos numeric(10,3) check (peso_gramos is null or peso_gramos > 0),
  medida text,
  tejido text,
  marca text,
  piedras jsonb,

  -- Lotes
  unidades_totales int not null default 1 check (unidades_totales >= 1),
  unidades_disponibles int not null default 1 check (unidades_disponibles >= 0),
  peso_gramos_total numeric(10,3) check (peso_gramos_total is null or peso_gramos_total > 0),

  -- Costo y precio
  costo_material numeric(12,2) not null default 0 check (costo_material >= 0),
  costo_mano_obra numeric(12,2) not null default 0 check (costo_mano_obra >= 0),
  costo_total numeric(12,2) generated always as (costo_material + costo_mano_obra) stored,
  precio_venta numeric(12,2) not null check (precio_venta > 0),
  precio_minimo numeric(12,2) check (precio_minimo is null or precio_minimo >= 0),

  -- Fotos y ubicación física
  fotos_urls text[] not null default array[]::text[],
  ubicacion text,

  -- Estado y origen
  estado estado_pieza_joyeria not null default 'disponible',
  origen origen_joyeria not null default 'taller',
  origen_ref uuid,
  proveedor text,

  -- Meta
  fecha_adquisicion date not null default current_date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Invariantes
  constraint disponibles_no_exceden_totales
    check (unidades_disponibles <= unidades_totales),
  constraint lote_con_varias_unidades
    check (tipo_registro = 'pieza' or unidades_totales >= 1),
  constraint precio_minimo_no_mayor_a_venta
    check (precio_minimo is null or precio_minimo <= precio_venta)
);

create index if not exists idx_piezas_joyeria_estado
  on public.piezas_joyeria(estado);
create index if not exists idx_piezas_joyeria_categoria
  on public.piezas_joyeria(categoria_id);
create index if not exists idx_piezas_joyeria_material
  on public.piezas_joyeria(material);
create index if not exists idx_piezas_joyeria_created
  on public.piezas_joyeria(created_at desc);
create index if not exists idx_piezas_joyeria_origen_ref
  on public.piezas_joyeria(origen_ref) where origen_ref is not null;

-- updated_at trigger (reusa función del 001 si existe)
do $$ begin
  create trigger trg_piezas_joyeria_updated_at
    before update on public.piezas_joyeria
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
  when undefined_function then
    -- Si no existe set_updated_at, la crearemos inline
    null;
end $$;

-- Fallback: crear set_updated_at si no existe
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Re-intentar trigger (idempotente)
drop trigger if exists trg_piezas_joyeria_updated_at on public.piezas_joyeria;
create trigger trg_piezas_joyeria_updated_at
  before update on public.piezas_joyeria
  for each row execute function public.set_updated_at();

-- Asignación automática de SKU y transición a 'agotado'
create or replace function public.piezas_joyeria_before_insert()
returns trigger language plpgsql as $$
begin
  if new.sku is null or new.sku = '' then
    new.sku := public.generar_sku_joyeria();
  end if;
  if new.tipo_registro = 'pieza' then
    new.unidades_totales := 1;
    new.unidades_disponibles := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_piezas_joyeria_before_insert on public.piezas_joyeria;
create trigger trg_piezas_joyeria_before_insert
  before insert on public.piezas_joyeria
  for each row execute function public.piezas_joyeria_before_insert();

create or replace function public.piezas_joyeria_before_update()
returns trigger language plpgsql as $$
begin
  -- Lotes que llegan a 0 disponibles se marcan agotados (salvo que ya estén vendidos/baja/reparacion)
  if new.tipo_registro = 'lote'
     and new.unidades_disponibles = 0
     and new.estado not in ('vendida', 'baja', 'en_reparacion') then
    new.estado := 'agotado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_piezas_joyeria_before_update on public.piezas_joyeria;
create trigger trg_piezas_joyeria_before_update
  before update on public.piezas_joyeria
  for each row execute function public.piezas_joyeria_before_update();

-- Audit log
create table if not exists public.movimientos_joyeria (
  id uuid primary key default gen_random_uuid(),
  pieza_id uuid not null references public.piezas_joyeria(id) on delete cascade,
  tipo text not null check (tipo in (
    'alta',
    'ajuste_precio',
    'cambio_estado',
    'cambio_ubicacion',
    'venta',
    'baja',
    'reparacion_inicio',
    'reparacion_fin',
    'ajuste_unidades'
  )),
  datos_antes jsonb,
  datos_despues jsonb,
  user_id uuid references auth.users(id) on delete set null,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_joyeria_pieza
  on public.movimientos_joyeria(pieza_id, created_at desc);

-- Trigger de alta automática
create or replace function public.piezas_joyeria_after_insert()
returns trigger language plpgsql as $$
begin
  insert into public.movimientos_joyeria (pieza_id, tipo, datos_despues, user_id, notas)
  values (
    new.id,
    'alta',
    jsonb_build_object(
      'sku', new.sku,
      'nombre', new.nombre,
      'precio_venta', new.precio_venta,
      'estado', new.estado,
      'origen', new.origen,
      'tipo_registro', new.tipo_registro,
      'unidades_totales', new.unidades_totales
    ),
    auth.uid(),
    'Alta automática'
  );
  return new;
end;
$$;

drop trigger if exists trg_piezas_joyeria_after_insert on public.piezas_joyeria;
create trigger trg_piezas_joyeria_after_insert
  after insert on public.piezas_joyeria
  for each row execute function public.piezas_joyeria_after_insert();

-- Trigger de cambios relevantes
create or replace function public.piezas_joyeria_after_update()
returns trigger language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.movimientos_joyeria (pieza_id, tipo, datos_antes, datos_despues, user_id)
    values (
      new.id,
      'cambio_estado',
      jsonb_build_object('estado', old.estado),
      jsonb_build_object('estado', new.estado),
      auth.uid()
    );
  end if;

  if new.precio_venta is distinct from old.precio_venta then
    insert into public.movimientos_joyeria (pieza_id, tipo, datos_antes, datos_despues, user_id)
    values (
      new.id,
      'ajuste_precio',
      jsonb_build_object('precio_venta', old.precio_venta),
      jsonb_build_object('precio_venta', new.precio_venta),
      auth.uid()
    );
  end if;

  if new.ubicacion is distinct from old.ubicacion then
    insert into public.movimientos_joyeria (pieza_id, tipo, datos_antes, datos_despues, user_id)
    values (
      new.id,
      'cambio_ubicacion',
      jsonb_build_object('ubicacion', old.ubicacion),
      jsonb_build_object('ubicacion', new.ubicacion),
      auth.uid()
    );
  end if;

  if new.unidades_disponibles is distinct from old.unidades_disponibles then
    insert into public.movimientos_joyeria (pieza_id, tipo, datos_antes, datos_despues, user_id)
    values (
      new.id,
      'ajuste_unidades',
      jsonb_build_object('unidades_disponibles', old.unidades_disponibles),
      jsonb_build_object('unidades_disponibles', new.unidades_disponibles),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_piezas_joyeria_after_update on public.piezas_joyeria;
create trigger trg_piezas_joyeria_after_update
  after update on public.piezas_joyeria
  for each row execute function public.piezas_joyeria_after_update();

-- -------------------------------------------
-- Ampliar `ventas` para soportar venta de pieza
-- -------------------------------------------

alter table public.ventas
  add column if not exists pieza_joyeria_id uuid references public.piezas_joyeria(id) on delete set null;

alter table public.ventas
  add column if not exists cantidad int not null default 1 check (cantidad >= 1);

-- Un venta es de artículo O de pieza (no ambos, no ninguno si queremos tracking)
-- Permitimos ambos null para ventas de efectivo "genéricas" históricas
-- pero nunca ambos llenos
alter table public.ventas
  drop constraint if exists ventas_articulo_o_pieza;
alter table public.ventas
  add constraint ventas_articulo_o_pieza
  check (not (articulo_id is not null and pieza_joyeria_id is not null));

create index if not exists idx_ventas_pieza
  on public.ventas(pieza_joyeria_id) where pieza_joyeria_id is not null;

-- -------------------------------------------
-- Ampliar `articulos` con estado convertido_a_joyeria
-- -------------------------------------------

-- En Postgres no se puede añadir valor a un enum existente dentro de una
-- transacción que lo use. Primero el valor, luego (en migración futura) se usa.
do $$ begin
  alter type estado_articulo add value if not exists 'convertido_a_joyeria';
exception when duplicate_object then null; end $$;

-- -------------------------------------------
-- RLS (staff puede todo, igual que el resto)
-- -------------------------------------------

alter table public.categorias_joyeria enable row level security;
alter table public.piezas_joyeria enable row level security;
alter table public.movimientos_joyeria enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'categorias_joyeria','piezas_joyeria','movimientos_joyeria'
  ]) loop
    execute format(
      'drop policy if exists %1$s_staff_all on public.%1$s;
       create policy %1$s_staff_all on public.%1$s for all
         using (public.es_staff()) with check (public.es_staff());',
      t
    );
  end loop;
end $$;

-- -------------------------------------------
-- Fin
-- -------------------------------------------

-- ########## 005_facturacion.sql ##########
-- ============================================================
-- Don Pepe — Migración 005: Pagos, Recibos, Facturas (DGII-ready)
-- ============================================================
-- Esta migración es idempotente: puede correrse más de una vez sin
-- romper datos existentes.
-- ============================================================

-- ============================================================
-- 0. Extender config_negocio con datos fiscales
-- ============================================================
alter table public.config_negocio
  add column if not exists razon_social text,
  add column if not exists direccion_fiscal text,
  add column if not exists email_fiscal text,
  add column if not exists itbis_default numeric(5,2) not null default 18,
  add column if not exists logo_factura_url text;

-- ============================================================
-- 1. Extender tipo_pago con nuevos valores
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'tipo_pago' and e.enumlabel = 'venta') then
    alter type tipo_pago add value 'venta';
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'tipo_pago' and e.enumlabel = 'compra_oro') then
    alter type tipo_pago add value 'compra_oro';
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'tipo_pago' and e.enumlabel = 'otro') then
    alter type tipo_pago add value 'otro';
  end if;
end $$;

-- ============================================================
-- 2. Expandir tabla pagos → libro de caja unificado
-- ============================================================
alter table public.pagos
  add column if not exists codigo text,
  add column if not exists direccion text not null default 'ingreso',
  add column if not exists concepto text,
  add column if not exists venta_id uuid references public.ventas(id) on delete restrict,
  add column if not exists compra_oro_id uuid references public.compras_oro(id) on delete restrict,
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_por uuid references public.app_users(id) on delete set null;

-- prestamo_id ya no obligatorio
alter table public.pagos alter column prestamo_id drop not null;

-- check de direccion
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_pago_direccion') then
    alter table public.pagos
      add constraint chk_pago_direccion check (direccion in ('ingreso','egreso'));
  end if;
end $$;

-- check: al menos uno de los orígenes O concepto libre
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_pago_origen') then
    alter table public.pagos
      add constraint chk_pago_origen check (
        ((prestamo_id is not null)::int
         + (venta_id is not null)::int
         + (compra_oro_id is not null)::int) <= 1
      );
  end if;
end $$;

-- unique de codigo (permite NULL múltiples para backfill gradual)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_codigo_unique') then
    alter table public.pagos add constraint pagos_codigo_unique unique (codigo);
  end if;
end $$;

create index if not exists idx_pagos_venta on public.pagos(venta_id) where venta_id is not null;
create index if not exists idx_pagos_compra_oro on public.pagos(compra_oro_id) where compra_oro_id is not null;
create index if not exists idx_pagos_cliente on public.pagos(cliente_id);
create index if not exists idx_pagos_fecha on public.pagos(fecha desc);
create index if not exists idx_pagos_codigo on public.pagos(codigo);

-- ============================================================
-- 3. Secuencia y funciones para código PA-YYYY-NNNNN
-- ============================================================
create sequence if not exists public.pagos_codigo_seq start 1;

create or replace function public.generar_codigo_pago()
returns text language plpgsql as $$
declare n bigint;
begin
  n := nextval('public.pagos_codigo_seq');
  return 'PA-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end; $$;

create or replace function public.set_pago_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := public.generar_codigo_pago();
  end if;
  return new;
end; $$;

drop trigger if exists trg_pagos_codigo on public.pagos;
create trigger trg_pagos_codigo
  before insert on public.pagos
  for each row execute function public.set_pago_codigo();

-- ============================================================
-- 4. Backfill de códigos y cliente_id en pagos existentes
-- ============================================================
-- Codigos retroactivos, ordenados por created_at
with ordered as (
  select id,
         to_char(created_at, 'YYYY') as año,
         row_number() over (
           partition by extract(year from created_at)::int
           order by created_at, id
         ) as seq
  from public.pagos
  where codigo is null
)
update public.pagos p
set codigo = 'PA-' || o.año || '-' || lpad(o.seq::text, 5, '0')
from ordered o
where p.id = o.id;

-- Avanzar secuencia para que próximos códigos no colisionen
select setval(
  'public.pagos_codigo_seq',
  greatest((select count(*) from public.pagos), 1),
  true
);

-- Backfill cliente_id desde prestamos
update public.pagos p
set cliente_id = pr.cliente_id
from public.prestamos pr
where p.prestamo_id = pr.id and p.cliente_id is null;

-- Marcar todos los pagos existentes como 'ingreso' (ya es default)
update public.pagos set direccion = 'ingreso' where direccion is null;

-- ============================================================
-- 5. Enums para recibos/facturas
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_recibo') then
    create type tipo_recibo as enum (
      'pago_empeno','saldo_empeno','renovacion',
      'venta_compraventa','venta_joyeria','compra_oro','otro'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_comprobante') then
    create type tipo_comprobante as enum (
      'factura_credito_fiscal',   -- NCF 01 (B01 / E31)
      'factura_consumo',          -- NCF 02 (B02 / E32)
      'nota_debito',              -- NCF 03
      'nota_credito',             -- NCF 04
      'compra',                   -- NCF 11 (B11 / E41) — compra de oro al público
      'regimen_especial',         -- NCF 14
      'gubernamental'             -- NCF 15
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_factura') then
    create type estado_factura as enum (
      'borrador','emitida','firmada','aceptada','rechazada','anulada','fallida'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_rango_ncf') then
    create type estado_rango_ncf as enum ('activo','agotado','vencido','anulado');
  end if;
end $$;

-- ============================================================
-- 6. Tabla recibos (no fiscal, siempre 1:1 con pago)
-- ============================================================
create table if not exists public.recibos (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique not null,
  pago_id uuid references public.pagos(id) on delete restrict,
  tipo tipo_recibo not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text not null,
  cliente_cedula text,
  cliente_telefono text,
  concepto text not null,
  items jsonb not null default '[]',
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  metodo metodo_pago not null default 'efectivo',
  factura_id uuid,                                  -- FK después de facturas
  emitido_por uuid references public.app_users(id) on delete set null,
  emitido_at timestamptz not null default now(),
  anulado_at timestamptz,
  anulado_motivo text,
  anulado_por uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_recibos_pago on public.recibos(pago_id);
create index if not exists idx_recibos_cliente on public.recibos(cliente_id);
create index if not exists idx_recibos_fecha on public.recibos(emitido_at desc);
create index if not exists idx_recibos_factura on public.recibos(factura_id) where factura_id is not null;

-- Secuencia y función para código RC-YYYY-NNNNN
create sequence if not exists public.recibos_codigo_seq start 1;

create or replace function public.generar_codigo_recibo()
returns text language plpgsql as $$
declare n bigint;
begin
  n := nextval('public.recibos_codigo_seq');
  return 'RC-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end; $$;

create or replace function public.set_recibo_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := public.generar_codigo_recibo();
  end if;
  return new;
end; $$;

drop trigger if exists trg_recibos_codigo on public.recibos;
create trigger trg_recibos_codigo
  before insert on public.recibos
  for each row execute function public.set_recibo_codigo();

-- ============================================================
-- 7. Tabla facturas (fiscales, DGII/e-CF)
-- ============================================================
create table if not exists public.facturas (
  id uuid primary key default uuid_generate_v4(),
  codigo_interno text unique not null,
  ncf text unique,
  tipo_comprobante tipo_comprobante not null,
  estado estado_factura not null default 'borrador',

  -- Emisor (snapshot al emitir)
  rnc_emisor text,
  razon_social_emisor text,
  direccion_emisor text,

  -- Receptor (snapshot al emitir)
  cliente_id uuid references public.clientes(id) on delete set null,
  rnc_receptor text,
  cedula_receptor text,
  nombre_receptor text not null,
  direccion_receptor text,
  email_receptor text,
  telefono_receptor text,

  -- Montos (almacenados para inmutabilidad fiscal)
  subtotal numeric(14,2) not null default 0,         -- base gravada + exenta
  descuento numeric(14,2) not null default 0,
  base_itbis numeric(14,2) not null default 0,       -- gravado (para tasa 18%)
  base_exenta numeric(14,2) not null default 0,      -- no gravado
  itbis_monto numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,

  -- Relaciones
  pago_id uuid references public.pagos(id) on delete set null,
  factura_afectada_id uuid references public.facturas(id) on delete set null, -- nota crédito

  -- e-CF / DGII
  fecha_emision date not null default current_date,
  fecha_vencimiento_ncf date,
  xml_firmado text,
  codigo_seguridad text,
  url_xml text,
  url_pdf text,
  dgii_respuesta jsonb,

  notas text,
  emitida_por uuid references public.app_users(id) on delete set null,
  emitida_at timestamptz,
  anulada_at timestamptz,
  anulada_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facturas_cliente on public.facturas(cliente_id);
create index if not exists idx_facturas_estado on public.facturas(estado);
create index if not exists idx_facturas_tipo on public.facturas(tipo_comprobante);
create index if not exists idx_facturas_ncf on public.facturas(ncf) where ncf is not null;
create index if not exists idx_facturas_fecha on public.facturas(fecha_emision desc);

-- Secuencia y función para código interno FA-YYYY-NNNNN
create sequence if not exists public.facturas_codigo_seq start 1;

create or replace function public.generar_codigo_factura()
returns text language plpgsql as $$
declare n bigint;
begin
  n := nextval('public.facturas_codigo_seq');
  return 'FA-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end; $$;

create or replace function public.set_factura_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo_interno is null or new.codigo_interno = '' then
    new.codigo_interno := public.generar_codigo_factura();
  end if;
  return new;
end; $$;

drop trigger if exists trg_facturas_codigo on public.facturas;
create trigger trg_facturas_codigo
  before insert on public.facturas
  for each row execute function public.set_factura_codigo();

drop trigger if exists trg_facturas_updated_at on public.facturas;
create trigger trg_facturas_updated_at
  before update on public.facturas
  for each row execute function public.set_updated_at();

-- FK desde recibos a facturas (ya existe la columna, añado constraint)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_recibos_factura') then
    alter table public.recibos
      add constraint fk_recibos_factura
      foreign key (factura_id) references public.facturas(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- 8. Tabla factura_items (snapshot inmutable)
-- ============================================================
create table if not exists public.factura_items (
  id uuid primary key default uuid_generate_v4(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  orden int not null,
  codigo text,
  descripcion text not null,
  cantidad numeric(14,3) not null default 1,
  unidad text default 'UND',
  precio_unitario numeric(14,2) not null,          -- SIN ITBIS (base DGII)
  precio_unitario_bruto numeric(14,2) not null,    -- CON ITBIS (lo que ve el cliente)
  descuento_unitario numeric(14,2) not null default 0,
  itbis_aplica boolean not null default true,
  itbis_tasa numeric(5,2) not null default 18,
  subtotal numeric(14,2) not null,                 -- cantidad * precio_unitario (base)
  itbis_monto numeric(14,2) not null default 0,
  total numeric(14,2) not null,                    -- subtotal + itbis_monto
  pieza_joyeria_id uuid references public.piezas_joyeria(id) on delete set null,
  articulo_id uuid references public.articulos(id) on delete set null
);

create index if not exists idx_factura_items_factura on public.factura_items(factura_id, orden);

-- ============================================================
-- 9. Tabla ncf_rangos (stock DGII)
-- ============================================================
create table if not exists public.ncf_rangos (
  id uuid primary key default uuid_generate_v4(),
  tipo_comprobante tipo_comprobante not null,
  serie text not null default 'E' check (serie in ('B','E')),
  secuencia_desde bigint not null,
  secuencia_hasta bigint not null,
  secuencia_actual bigint not null,
  fecha_vencimiento date,
  estado estado_rango_ncf not null default 'activo',
  notas text,
  created_at timestamptz not null default now(),
  check (secuencia_desde <= secuencia_actual),
  check (secuencia_actual <= secuencia_hasta + 1),
  unique (tipo_comprobante, serie, secuencia_desde)
);

create index if not exists idx_ncf_activos
  on public.ncf_rangos(tipo_comprobante, estado)
  where estado = 'activo';

-- Asigna próximo NCF atómicamente y avanza secuencia
create or replace function public.obtener_proximo_ncf(p_tipo tipo_comprobante)
returns text language plpgsql as $$
declare
  r public.ncf_rangos%rowtype;
  tipo_codigo text;
  ncf_final text;
  largo_secuencia int;
begin
  select * into r
  from public.ncf_rangos
  where tipo_comprobante = p_tipo
    and estado = 'activo'
    and secuencia_actual <= secuencia_hasta
  order by created_at asc
  limit 1
  for update skip locked;

  if r.id is null then
    raise exception 'No hay rango NCF activo para %', p_tipo
      using errcode = 'P0001';
  end if;

  tipo_codigo := case p_tipo
    when 'factura_credito_fiscal' then '01'
    when 'factura_consumo' then '02'
    when 'nota_debito' then '03'
    when 'nota_credito' then '04'
    when 'compra' then '11'
    when 'regimen_especial' then '14'
    when 'gubernamental' then '15'
  end;

  -- e-CF: 10 dígitos; impreso B: 8 dígitos
  largo_secuencia := case r.serie when 'E' then 10 else 8 end;

  ncf_final := r.serie || tipo_codigo || lpad(r.secuencia_actual::text, largo_secuencia, '0');

  update public.ncf_rangos
  set secuencia_actual = secuencia_actual + 1,
      estado = case
        when secuencia_actual + 1 > secuencia_hasta then 'agotado'::estado_rango_ncf
        else estado
      end
  where id = r.id;

  return ncf_final;
end; $$;

-- ============================================================
-- 10. RLS para las nuevas tablas
-- ============================================================
alter table public.recibos enable row level security;
alter table public.facturas enable row level security;
alter table public.factura_items enable row level security;
alter table public.ncf_rangos enable row level security;

-- Recibos: staff puede todo excepto borrar (solo dueño)
drop policy if exists recibos_select on public.recibos;
create policy recibos_select on public.recibos for select using (public.es_staff());
drop policy if exists recibos_insert on public.recibos;
create policy recibos_insert on public.recibos for insert with check (public.es_staff());
drop policy if exists recibos_update on public.recibos;
create policy recibos_update on public.recibos for update using (public.es_staff()) with check (public.es_staff());
drop policy if exists recibos_delete on public.recibos;
create policy recibos_delete on public.recibos for delete using (public.es_dueno());

-- Facturas: mismo patrón
drop policy if exists facturas_select on public.facturas;
create policy facturas_select on public.facturas for select using (public.es_staff());
drop policy if exists facturas_insert on public.facturas;
create policy facturas_insert on public.facturas for insert with check (public.es_staff());
drop policy if exists facturas_update on public.facturas;
create policy facturas_update on public.facturas for update using (public.es_staff()) with check (public.es_staff());
drop policy if exists facturas_delete on public.facturas;
create policy facturas_delete on public.facturas for delete using (public.es_dueno());

-- factura_items: mismo patrón
drop policy if exists factura_items_select on public.factura_items;
create policy factura_items_select on public.factura_items for select using (public.es_staff());
drop policy if exists factura_items_insert on public.factura_items;
create policy factura_items_insert on public.factura_items for insert with check (public.es_staff());
drop policy if exists factura_items_update on public.factura_items;
create policy factura_items_update on public.factura_items for update using (public.es_staff()) with check (public.es_staff());
drop policy if exists factura_items_delete on public.factura_items;
create policy factura_items_delete on public.factura_items for delete using (public.es_dueno());

-- ncf_rangos: solo dueño puede cargar/modificar; staff solo lee
drop policy if exists ncf_rangos_select on public.ncf_rangos;
create policy ncf_rangos_select on public.ncf_rangos for select using (public.es_staff());
drop policy if exists ncf_rangos_insert on public.ncf_rangos;
create policy ncf_rangos_insert on public.ncf_rangos for insert with check (public.es_dueno());
drop policy if exists ncf_rangos_update on public.ncf_rangos;
create policy ncf_rangos_update on public.ncf_rangos for update using (public.es_dueno()) with check (public.es_dueno());
drop policy if exists ncf_rangos_delete on public.ncf_rangos;
create policy ncf_rangos_delete on public.ncf_rangos for delete using (public.es_dueno());

-- ============================================================
-- 11. Permitir que el usuario llame obtener_proximo_ncf
-- ============================================================
grant execute on function public.obtener_proximo_ncf(tipo_comprobante) to authenticated;
grant execute on function public.generar_codigo_pago() to authenticated;
grant execute on function public.generar_codigo_recibo() to authenticated;
grant execute on function public.generar_codigo_factura() to authenticated;

-- ########## 006_articulos_valor_tasado_nullable.sql ##########
-- ============================================================
-- 006 — Hacer `articulos.valor_tasado` opcional
-- ============================================================
--
-- Motivación: el dueño ya no quiere guardar el "valor tasado" al momento
-- del empeño. Guardar esa cifra puede volverse perjudicial con el tiempo
-- (disputas sobre precio, liability si el artículo se vende más barato
-- después, etc.). El flujo nuevo captura solo `monto_prestado`.
--
-- Cambios:
--   1. `valor_tasado` pasa de `NOT NULL` a permitir NULL.
--   2. El CHECK original (`valor_tasado > 0`) se reemplaza por uno que
--      permita NULL pero siga prohibiendo cero/negativos cuando haya
--      valor (para no romper los artículos legados).
--
-- Registros existentes quedan como están (mantienen su valor histórico).
-- Los artículos nuevos se insertan con `valor_tasado = NULL`.
-- ============================================================

alter table public.articulos
  alter column valor_tasado drop not null;

-- Si existe el CHECK original, lo removemos y volvemos a poner uno que
-- tolere NULL. El nombre del constraint puede variar según cómo Postgres
-- lo haya auto-nombrado; lo buscamos dinámicamente.
do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'articulos'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%valor_tasado%>%0%'
  loop
    execute format('alter table public.articulos drop constraint %I', cname);
  end loop;
end $$;

alter table public.articulos
  add constraint articulos_valor_tasado_positivo
  check (valor_tasado is null or valor_tasado > 0);

-- ########## 007_numeraciones.sql ##########
-- ============================================================
-- 007 — Sistema unificado de numeraciones
-- ============================================================
--
-- Motivación
-- -----------
-- Hasta ahora cada tipo de documento tenía su propia `sequence` de Postgres
-- con un generador hard-codeado (DP-, VT-, OR-, PA-, RC-, FA-) y el único
-- "sistema" configurable era `ncf_rangos`. Esto tenía varios problemas:
--
--   * Las secuencias eran **globales** (no reiniciaban por año fiscal): al
--     entrar a 2027 los códigos seguían con el contador de 2026, así que
--     DP-2027-00001 nunca existiría — saltaba al DP-2027-00872 o similar.
--   * No había forma de cambiar el prefijo o el formato desde la UI (por
--     ejemplo poner "PREN-" en vez de "DP-" sin tocar SQL).
--   * `obtener_proximo_ncf` NO filtraba rangos vencidos — una letra de
--     autorización expirada podía seguir emitiendo NCFs, lo cual es una
--     falla fiscal seria.
--   * El mapeo `tipo_comprobante → código numérico` asumía NCF impreso
--     (01, 02, 03…) y no soportaba e-CF (31, 32, 33… según DGII e-CF).
--   * Faltaban tipos de comprobante (gastos menores, registro especial,
--     exportaciones, pagos al exterior).
--   * No había auto-transición de rangos "vencidos" ni vista agregada
--     para la UI.
--
-- Diseño
-- ------
-- 1. Nueva tabla `numeracion_series` — una fila por serie interna
--    (empeno, venta, compra_oro, pago, recibo, factura_interna, ...) con
--    prefijo, formato, ancho de secuencia, reset anual y contador.
-- 2. Función `siguiente_numero(p_scope text)` que asigna el próximo
--    número atómicamente usando `SELECT FOR UPDATE`, con reinicio
--    automático al cambiar de año fiscal (usando zona horaria de RD).
-- 3. Los `generar_codigo_*` existentes se redefinen como wrappers de
--    `siguiente_numero(...)`, así los triggers actuales siguen
--    funcionando sin cambios en Server Actions.
-- 4. Las secuencias viejas (`prestamos_codigo_seq`, etc.) se dropean.
-- 5. `obtener_proximo_ncf` se arregla: filtra vencidos, ordena por la
--    fecha de vencimiento (FIFO), y el mapeo de código numérico es
--    consciente de serie (B vs E).
-- 6. `marcar_rangos_ncf_vencidos()` marca como `vencido` cualquier
--    rango `activo` cuya `fecha_vencimiento` ya pasó — se llama desde
--    el cron diario.
-- 7. Vista `v_resumen_numeraciones` para el panel de config.
-- 8. RLS: dueño gestiona, staff solo lee.
--
-- Idempotencia
-- ------------
-- Todo `create if not exists` / `do $$ ... $$`. Se puede correr más
-- de una vez sin romper.
-- ============================================================

-- ============================================================
-- 1. Ampliar enum `tipo_comprobante` con los NCF que faltaban
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_comprobante'
      and e.enumlabel = 'gastos_menores'
  ) then
    alter type tipo_comprobante add value 'gastos_menores';   -- 12 / E43
  end if;

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_comprobante'
      and e.enumlabel = 'registro_especial'
  ) then
    alter type tipo_comprobante add value 'registro_especial'; -- 13
  end if;

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_comprobante'
      and e.enumlabel = 'exportaciones'
  ) then
    alter type tipo_comprobante add value 'exportaciones';    -- 16 / E46
  end if;

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_comprobante'
      and e.enumlabel = 'pagos_exterior'
  ) then
    alter type tipo_comprobante add value 'pagos_exterior';   -- 17 / E47
  end if;
end $$;

-- ============================================================
-- 2. Tabla universal para series internas
-- ============================================================
create table if not exists public.numeracion_series (
  id uuid primary key default uuid_generate_v4(),
  -- Identificador lógico único. Los Server Actions hablan con este nombre.
  scope text unique not null,
  -- Texto visible en la UI ("Ticket de empeño", "Boleta de venta", ...).
  etiqueta text not null,
  -- Prefijo impreso. Editable.
  prefijo text not null,
  -- Cantidad de dígitos del contador cero-padded.
  ancho_secuencia int not null default 5 check (ancho_secuencia between 3 and 10),
  -- Si es true, el contador reinicia al cambiar de año fiscal.
  reset_anual boolean not null default true,
  -- Template. Placeholders: {prefijo}, {año}/{YYYY}, {numero}/{NNNNN}.
  -- Ejemplo: "{prefijo}-{año}-{numero}" → "DP-2026-00001".
  formato text not null default '{prefijo}-{año}-{numero}',
  -- Año fiscal vigente. Cuando `current_date` (en zona RD) pasa a
  -- un año posterior y `reset_anual=true`, la función avanza este campo
  -- y reinicia el contador.
  año_actual int not null,
  -- Último número asignado en el `año_actual` actual. El próximo será
  -- `contador + 1`.
  contador bigint not null default 0 check (contador >= 0),
  -- Si es false, `siguiente_numero(scope)` lanza excepción — útil para
  -- deshabilitar una serie sin borrar su historial.
  activa boolean not null default true,
  -- Texto libre para el dueño (por qué existe, restricciones, etc).
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_numeracion_series_scope
  on public.numeracion_series(scope);

drop trigger if exists trg_numeracion_series_updated_at on public.numeracion_series;
create trigger trg_numeracion_series_updated_at
  before update on public.numeracion_series
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. Función central: siguiente_numero(scope) — atómica y TZ-aware
-- ============================================================
--
-- Garantías:
--   * `SELECT FOR UPDATE` sobre la fila → dos transacciones nunca
--     producen el mismo número.
--   * El cálculo del año usa `America/Santo_Domingo` — evita falsos
--     saltos de año cuando el servidor está en UTC y son, digamos, las
--     9:00 PM del 31 de diciembre en RD (que en UTC ya sería 1-enero).
--   * Reset anual automático: si `año_actual < año_de_hoy_RD` y
--     `reset_anual`, se actualiza `año_actual` y el contador vuelve a 0.
--   * Serie inactiva → exception (P0003). Serie inexistente → P0002.
-- ============================================================
create or replace function public.siguiente_numero(p_scope text)
returns text language plpgsql as $$
declare
  serie public.numeracion_series%rowtype;
  año_hoy int;
  año_efectivo int;
  numero bigint;
  salida text;
begin
  año_hoy := extract(
    year from
      (current_timestamp at time zone 'America/Santo_Domingo')::date
  )::int;

  select * into serie
  from public.numeracion_series
  where scope = p_scope
  for update;

  if not found then
    raise exception 'Serie de numeración no configurada: %', p_scope
      using errcode = 'P0002';
  end if;

  if not serie.activa then
    raise exception 'Serie % está desactivada', p_scope
      using errcode = 'P0003';
  end if;

  -- Reset anual
  if serie.reset_anual and serie.año_actual < año_hoy then
    año_efectivo := año_hoy;
    numero := 1;
  else
    año_efectivo := serie.año_actual;
    numero := serie.contador + 1;
  end if;

  -- Render del formato (case-insensitive en los placeholders)
  salida := serie.formato;
  salida := replace(salida, '{prefijo}', serie.prefijo);
  salida := replace(salida, '{año}',    año_efectivo::text);
  salida := replace(salida, '{YYYY}',   año_efectivo::text);
  salida := replace(salida, '{numero}', lpad(numero::text, serie.ancho_secuencia, '0'));
  salida := replace(salida, '{NNNNN}',  lpad(numero::text, serie.ancho_secuencia, '0'));

  update public.numeracion_series
  set contador = numero,
      año_actual = año_efectivo
  where id = serie.id;

  return salida;
end $$;

grant execute on function public.siguiente_numero(text) to authenticated;

-- ============================================================
-- 4. Seed de series a partir de las secuencias / tablas existentes
-- ============================================================
--
-- Para preservar los códigos ya emitidos, el contador inicial se
-- calcula tomando el máximo `NNNNN` observado en la tabla destino para
-- el año actual. Ej.: si ya existe DP-2026-00042 el contador arranca
-- en 42 → el próximo es DP-2026-00043.
--
-- Filtramos con regex `^[A-Z]+-\d{4}-\d+$` para ignorar códigos que no
-- sigan el formato esperado (por si hubo imports o pruebas manuales).
-- ============================================================
do $$
declare
  año_hoy int := extract(
    year from (current_timestamp at time zone 'America/Santo_Domingo')::date
  )::int;
begin
  -- empeno (DP)
  insert into public.numeracion_series
    (scope, etiqueta, prefijo, año_actual, contador, descripcion)
  values (
    'empeno', 'Ticket de empeño', 'DP', año_hoy,
    coalesce((
      select max(split_part(codigo, '-', 3)::bigint)
      from public.prestamos
      where codigo ~ '^[A-Z]+-\d{4}-\d+$'
        and split_part(codigo, '-', 2)::int = año_hoy
    ), 0),
    'Identificador impreso del ticket de empeño.'
  )
  on conflict (scope) do nothing;

  -- venta (VT)
  insert into public.numeracion_series
    (scope, etiqueta, prefijo, año_actual, contador, descripcion)
  values (
    'venta', 'Venta', 'VT', año_hoy,
    coalesce((
      select max(split_part(codigo, '-', 3)::bigint)
      from public.ventas
      where codigo ~ '^[A-Z]+-\d{4}-\d+$'
        and split_part(codigo, '-', 2)::int = año_hoy
    ), 0),
    'Boleta de venta de inventario propio.'
  )
  on conflict (scope) do nothing;

  -- compra_oro (OR)
  insert into public.numeracion_series
    (scope, etiqueta, prefijo, año_actual, contador, descripcion)
  values (
    'compra_oro', 'Compra de oro', 'OR', año_hoy,
    coalesce((
      select max(split_part(codigo, '-', 3)::bigint)
      from public.compras_oro
      where codigo ~ '^[A-Z]+-\d{4}-\d+$'
        and split_part(codigo, '-', 2)::int = año_hoy
    ), 0),
    'Compra directa de oro al público (sin empeño).'
  )
  on conflict (scope) do nothing;

  -- pago (PA)
  insert into public.numeracion_series
    (scope, etiqueta, prefijo, año_actual, contador, descripcion)
  values (
    'pago', 'Movimiento de caja', 'PA', año_hoy,
    coalesce((
      select max(split_part(codigo, '-', 3)::bigint)
      from public.pagos
      where codigo is not null
        and codigo ~ '^[A-Z]+-\d{4}-\d+$'
        and split_part(codigo, '-', 2)::int = año_hoy
    ), 0),
    'Entrada o salida en el libro de caja.'
  )
  on conflict (scope) do nothing;

  -- recibo (RC)
  insert into public.numeracion_series
    (scope, etiqueta, prefijo, año_actual, contador, descripcion)
  values (
    'recibo', 'Recibo', 'RC', año_hoy,
    coalesce((
      select max(split_part(codigo, '-', 3)::bigint)
      from public.recibos
      where codigo ~ '^[A-Z]+-\d{4}-\d+$'
        and split_part(codigo, '-', 2)::int = año_hoy
    ), 0),
    'Recibo no fiscal que acompaña a cada pago / movimiento.'
  )
  on conflict (scope) do nothing;

  -- factura_interna (FA) — folio interno, separado del NCF fiscal
  insert into public.numeracion_series
    (scope, etiqueta, prefijo, año_actual, contador, descripcion)
  values (
    'factura_interna', 'Folio interno de factura', 'FA', año_hoy,
    coalesce((
      select max(split_part(codigo_interno, '-', 3)::bigint)
      from public.facturas
      where codigo_interno ~ '^[A-Z]+-\d{4}-\d+$'
        and split_part(codigo_interno, '-', 2)::int = año_hoy
    ), 0),
    'Folio interno de control. El NCF fiscal se gestiona en Rangos NCF.'
  )
  on conflict (scope) do nothing;
end $$;

-- ============================================================
-- 5. Redefinir los generar_codigo_* existentes como wrappers
-- ============================================================
--
-- Los triggers before-insert siguen llamándolos, así que ninguna
-- Server Action ni línea de TS cambia. Internamente delegan a la
-- nueva función, que respeta el reset anual y la configuración
-- editable.
-- ============================================================
create or replace function public.generar_codigo_prestamo()
returns text language plpgsql as $$
begin
  return public.siguiente_numero('empeno');
end $$;

create or replace function public.generar_codigo_venta()
returns text language plpgsql as $$
begin
  return public.siguiente_numero('venta');
end $$;

create or replace function public.generar_codigo_compra_oro()
returns text language plpgsql as $$
begin
  return public.siguiente_numero('compra_oro');
end $$;

create or replace function public.generar_codigo_pago()
returns text language plpgsql as $$
begin
  return public.siguiente_numero('pago');
end $$;

create or replace function public.generar_codigo_recibo()
returns text language plpgsql as $$
begin
  return public.siguiente_numero('recibo');
end $$;

create or replace function public.generar_codigo_factura()
returns text language plpgsql as $$
begin
  return public.siguiente_numero('factura_interna');
end $$;

-- Ya no se usan — los contadores viven en `numeracion_series`.
drop sequence if exists public.prestamos_codigo_seq;
drop sequence if exists public.ventas_codigo_seq;
drop sequence if exists public.compras_oro_codigo_seq;
drop sequence if exists public.pagos_codigo_seq;
drop sequence if exists public.recibos_codigo_seq;
drop sequence if exists public.facturas_codigo_seq;

-- ============================================================
-- 6. RLS para numeracion_series
-- ============================================================
alter table public.numeracion_series enable row level security;

drop policy if exists numeracion_series_select on public.numeracion_series;
create policy numeracion_series_select on public.numeracion_series
  for select using (public.es_staff());

drop policy if exists numeracion_series_insert on public.numeracion_series;
create policy numeracion_series_insert on public.numeracion_series
  for insert with check (public.es_dueno());

drop policy if exists numeracion_series_update on public.numeracion_series;
create policy numeracion_series_update on public.numeracion_series
  for update using (public.es_dueno()) with check (public.es_dueno());

drop policy if exists numeracion_series_delete on public.numeracion_series;
create policy numeracion_series_delete on public.numeracion_series
  for delete using (public.es_dueno());

-- ============================================================
-- 7. NCF: obtener_proximo_ncf corregido
-- ============================================================
--
-- Cambios vs. 005:
--   * Filtra rangos ya vencidos (`fecha_vencimiento < current_date`).
--   * Ordena por `fecha_vencimiento asc nulls last` — consume primero
--     los rangos que están por expirar (FIFO de caducidad). Esto evita
--     desperdiciar NCFs que DGII ya no aceptaría emitidos después.
--   * El código numérico es **consciente de serie**:
--       - Impresos (serie 'B'): 01,02,03,04,11,12,13,14,15,16,17.
--       - e-CF (serie 'E'): 31,32,33,34,41,43,44,45,46,47 (tabla e-CF).
--     El mapping antiguo mezclaba ambos y producía códigos inválidos
--     para e-CF (E0100000001 en vez de E310000000001, por ejemplo).
--   * Sigue usando `for update skip locked` → dos emisiones
--     concurrentes nunca reclaman el mismo NCF.
-- ============================================================
create or replace function public.obtener_proximo_ncf(p_tipo tipo_comprobante)
returns text language plpgsql as $$
declare
  r public.ncf_rangos%rowtype;
  tipo_codigo text;
  ncf_final text;
  largo_secuencia int;
begin
  select * into r
  from public.ncf_rangos
  where tipo_comprobante = p_tipo
    and estado = 'activo'
    and secuencia_actual <= secuencia_hasta
    and (fecha_vencimiento is null or fecha_vencimiento >= current_date)
  order by fecha_vencimiento asc nulls last, created_at asc
  limit 1
  for update skip locked;

  if r.id is null then
    raise exception 'No hay rango NCF activo y vigente para %', p_tipo
      using errcode = 'P0001';
  end if;

  tipo_codigo := case
    when r.serie = 'E' then
      case p_tipo
        when 'factura_credito_fiscal' then '31'
        when 'factura_consumo'        then '32'
        when 'nota_debito'            then '33'
        when 'nota_credito'           then '34'
        when 'compra'                 then '41'
        when 'gastos_menores'         then '43'
        when 'regimen_especial'       then '44'
        when 'gubernamental'          then '45'
        when 'exportaciones'          then '46'
        when 'pagos_exterior'         then '47'
        -- Sin e-CF formal aún (13); se mantiene igual al impreso.
        when 'registro_especial'      then '13'
      end
    else
      case p_tipo
        when 'factura_credito_fiscal' then '01'
        when 'factura_consumo'        then '02'
        when 'nota_debito'            then '03'
        when 'nota_credito'           then '04'
        when 'compra'                 then '11'
        when 'gastos_menores'         then '12'
        when 'registro_especial'      then '13'
        when 'regimen_especial'       then '14'
        when 'gubernamental'          then '15'
        when 'exportaciones'          then '16'
        when 'pagos_exterior'         then '17'
      end
  end;

  if tipo_codigo is null then
    raise exception 'Combinación tipo_comprobante/serie no mapeada: % / %',
      p_tipo, r.serie using errcode = 'P0004';
  end if;

  -- Impresos (B): 8 dígitos. e-CF (E): 10 dígitos. Formato DGII.
  largo_secuencia := case r.serie when 'E' then 10 else 8 end;

  ncf_final := r.serie
            || tipo_codigo
            || lpad(r.secuencia_actual::text, largo_secuencia, '0');

  update public.ncf_rangos
  set secuencia_actual = secuencia_actual + 1,
      estado = case
        when secuencia_actual + 1 > secuencia_hasta then 'agotado'::estado_rango_ncf
        else estado
      end
  where id = r.id;

  return ncf_final;
end $$;

-- ============================================================
-- 8. Auto-transición de rangos NCF vencidos
-- ============================================================
--
-- Llamable manualmente desde la UI o desde el cron diario. Devuelve
-- cuántos rangos se marcaron como vencidos. No tocamos `agotado` ni
-- `anulado` — solo `activo`.
-- ============================================================
create or replace function public.marcar_rangos_ncf_vencidos()
returns int language plpgsql as $$
declare
  n int;
begin
  update public.ncf_rangos
  set estado = 'vencido'::estado_rango_ncf
  where estado = 'activo'
    and fecha_vencimiento is not null
    and fecha_vencimiento < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.marcar_rangos_ncf_vencidos() to authenticated;

-- ============================================================
-- 9. Vista de resumen — unifica internas + NCF para la UI
-- ============================================================
--
-- Forma normalizada con `categoria` ('interna' | 'ncf') que la página
-- `/config/numeraciones` puede renderizar en un solo flujo.
-- Las columnas específicas de NCF (rango_disponible, proxima_expiracion)
-- quedan en `null` para las internas.
-- ============================================================
create or replace view public.v_resumen_numeraciones as
select
  'interna'::text                   as categoria,
  n.scope                           as scope,
  n.etiqueta                        as etiqueta,
  n.prefijo                         as prefijo,
  n.año_actual                      as año_actual,
  n.contador                        as ultimo_numero,
  (n.contador + 1)                  as proximo_numero,
  null::bigint                      as rango_disponible,
  null::date                        as proxima_expiracion,
  n.activa                          as activa,
  n.reset_anual                     as reset_anual,
  n.formato                         as formato,
  null::text                        as ncf_estado
from public.numeracion_series n
union all
select
  'ncf'::text                       as categoria,
  ('ncf_' || r.tipo_comprobante::text || '_' || r.serie) as scope,
  (r.tipo_comprobante::text || ' (serie ' || r.serie || ')') as etiqueta,
  r.serie                           as prefijo,
  null::int                         as año_actual,
  (r.secuencia_actual - 1)          as ultimo_numero,
  r.secuencia_actual                as proximo_numero,
  greatest(0, r.secuencia_hasta - r.secuencia_actual + 1)::bigint
                                    as rango_disponible,
  r.fecha_vencimiento               as proxima_expiracion,
  (r.estado = 'activo')             as activa,
  null::boolean                     as reset_anual,
  null::text                        as formato,
  r.estado::text                    as ncf_estado
from public.ncf_rangos r
where r.estado in ('activo','agotado','vencido');

grant select on public.v_resumen_numeraciones to authenticated;
