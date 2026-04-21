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
