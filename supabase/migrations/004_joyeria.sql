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
