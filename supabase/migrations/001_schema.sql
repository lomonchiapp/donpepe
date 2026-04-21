-- Don Pepe — Schema inicial
-- Compraventa dominicana (préstamos prendarios + oro + ventas).

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- para búsqueda por nombre/cédula

-- ============================================================
-- USUARIOS DEL SISTEMA (dueño + empleados)
-- ============================================================
create type user_rol as enum ('dueno', 'empleado');

create table if not exists public.app_users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  nombre text not null,
  rol user_rol not null default 'empleado',
  telefono_whatsapp text,
  recibir_alertas boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CONFIG DEL NEGOCIO (fila única)
-- ============================================================
create table if not exists public.config_negocio (
  id uuid primary key default uuid_generate_v4(),
  nombre_comercial text not null default 'Don Pepe',
  direccion text,
  telefono text,
  rnc text,
  logo_url text,
  tasa_interes_default numeric(6,4) not null default 0.10,
  plazo_meses_default smallint not null default 3,
  porcentaje_prestamo_default numeric(4,3) not null default 0.60,
  dias_gracia_vencimiento smallint not null default 7,
  hora_alerta_whatsapp time not null default '08:00:00',
  dias_alerta_previa smallint[] not null default '{7,3,1,0}',
  margen_compra_oro numeric(4,3) not null default 0.25,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una sola fila enforced vía constraint
create unique index if not exists config_negocio_unica on public.config_negocio ((true));

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists public.clientes (
  id uuid primary key default uuid_generate_v4(),
  cedula text unique not null,
  nombre_completo text not null,
  telefono text,
  direccion text,
  foto_cedula_url text,
  foto_cliente_url text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_nombre_trgm on public.clientes using gin (nombre_completo gin_trgm_ops);
create index if not exists idx_clientes_cedula_trgm on public.clientes using gin (cedula gin_trgm_ops);

-- ============================================================
-- ARTÍCULOS (joyas, electrodomésticos, etc.)
-- ============================================================
create type tipo_articulo as enum ('joya_oro', 'electrodomestico', 'tenis', 'otro');
create type estado_articulo as enum ('empenado', 'retirado', 'vencido_propio', 'vendido');

create table if not exists public.articulos (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo tipo_articulo not null,
  descripcion text not null,
  fotos_urls text[] not null default '{}',
  kilataje smallint check (kilataje in (10, 14, 18, 22, 24)),
  peso_gramos numeric(10,2) check (peso_gramos is null or peso_gramos > 0),
  valor_tasado numeric(12,2) not null check (valor_tasado > 0),
  estado estado_articulo not null default 'empenado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articulos_cliente on public.articulos(cliente_id);
create index if not exists idx_articulos_estado on public.articulos(estado);

-- ============================================================
-- PRÉSTAMOS (tickets de empeño)
-- ============================================================
create type estado_prestamo as enum ('activo', 'pagado', 'renovado', 'vencido_a_cobro', 'propiedad_casa');

create table if not exists public.prestamos (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique not null,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  articulo_id uuid not null references public.articulos(id) on delete restrict,
  monto_prestado numeric(12,2) not null check (monto_prestado > 0),
  tasa_interes_mensual numeric(6,4) not null check (tasa_interes_mensual >= 0),
  plazo_meses smallint not null check (plazo_meses between 1 and 12),
  fecha_inicio date not null default current_date,
  fecha_vencimiento date not null,
  estado estado_prestamo not null default 'activo',
  creado_por uuid references public.app_users(id),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prestamos_cliente on public.prestamos(cliente_id);
create index if not exists idx_prestamos_estado on public.prestamos(estado);
create index if not exists idx_prestamos_vencimiento on public.prestamos(fecha_vencimiento) where estado = 'activo';
create index if not exists idx_prestamos_codigo_trgm on public.prestamos using gin (codigo gin_trgm_ops);

-- Generador de códigos DP-YYYY-00001
create sequence if not exists prestamos_codigo_seq start 1;

create or replace function public.generar_codigo_prestamo()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('prestamos_codigo_seq');
  return 'DP-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- ============================================================
-- PAGOS
-- ============================================================
create type tipo_pago as enum ('interes', 'abono_capital', 'saldo_total', 'renovacion');
create type metodo_pago as enum ('efectivo', 'transferencia', 'tarjeta');

create table if not exists public.pagos (
  id uuid primary key default uuid_generate_v4(),
  prestamo_id uuid not null references public.prestamos(id) on delete restrict,
  tipo tipo_pago not null,
  monto numeric(12,2) not null check (monto > 0),
  metodo metodo_pago not null default 'efectivo',
  fecha date not null default current_date,
  nueva_fecha_vencimiento date,
  notas text,
  recibido_por uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pagos_prestamo on public.pagos(prestamo_id);
create index if not exists idx_pagos_fecha on public.pagos(fecha desc);

-- ============================================================
-- PRECIOS DE ORO
-- ============================================================
create table if not exists public.precios_oro (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null default current_date,
  kilataje smallint not null check (kilataje in (10, 14, 18, 22, 24)),
  precio_dop_gramo numeric(12,2) not null check (precio_dop_gramo > 0),
  precio_venta_dop_gramo numeric(12,2),
  fuente text not null default 'manual' check (fuente in ('manual', 'goldapi', 'exchange-rates')),
  created_at timestamptz not null default now(),
  unique(fecha, kilataje)
);

create index if not exists idx_precios_oro_fecha on public.precios_oro(fecha desc, kilataje);

-- ============================================================
-- COMPRAS DE ORO DIRECTAS (sin empeño)
-- ============================================================
create table if not exists public.compras_oro (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique not null,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  kilataje smallint not null check (kilataje in (10, 14, 18, 22, 24)),
  peso_gramos numeric(10,2) not null check (peso_gramos > 0),
  precio_gramo numeric(12,2) not null check (precio_gramo > 0),
  total_pagado numeric(12,2) not null check (total_pagado > 0),
  fotos_urls text[] not null default '{}',
  recibido_por uuid references public.app_users(id),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_compras_oro_cliente on public.compras_oro(cliente_id);
create index if not exists idx_compras_oro_fecha on public.compras_oro(created_at desc);

create sequence if not exists compras_oro_codigo_seq start 1;

create or replace function public.generar_codigo_compra_oro()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('compras_oro_codigo_seq');
  return 'OR-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- ============================================================
-- VENTAS (de inventario propiedad casa)
-- ============================================================
create table if not exists public.ventas (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique not null,
  articulo_id uuid references public.articulos(id) on delete set null,
  comprador_nombre text,
  comprador_cedula text,
  comprador_telefono text,
  precio_venta numeric(12,2) not null check (precio_venta > 0),
  metodo metodo_pago not null default 'efectivo',
  vendido_por uuid references public.app_users(id),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ventas_fecha on public.ventas(created_at desc);

create sequence if not exists ventas_codigo_seq start 1;

create or replace function public.generar_codigo_venta()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('ventas_codigo_seq');
  return 'VT-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- ============================================================
-- NOTIFICACIONES WHATSAPP
-- ============================================================
create type estado_notificacion as enum ('pendiente', 'enviada', 'fallida', 'leida');
create type tipo_notificacion as enum ('resumen_diario', 'vencimiento_hoy', 'vencimiento_proximo', 'articulos_propiedad');

create table if not exists public.notificaciones (
  id uuid primary key default uuid_generate_v4(),
  destinatario_user_id uuid references public.app_users(id) on delete cascade,
  tipo tipo_notificacion not null,
  contenido jsonb not null,
  enviada_at timestamptz,
  status estado_notificacion not null default 'pendiente',
  meta_message_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_destinatario on public.notificaciones(destinatario_user_id, created_at desc);
create index if not exists idx_notif_status on public.notificaciones(status) where status = 'pendiente';

-- ============================================================
-- TRIGGERS de updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'app_users','config_negocio','clientes','articulos','prestamos'
    ])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
         for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;
