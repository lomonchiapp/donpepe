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
