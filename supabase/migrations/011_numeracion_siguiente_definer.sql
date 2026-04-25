-- ============================================================
-- 011 · siguiente_numero con SECURITY DEFINER + re-sembrado
-- ============================================================
--
-- Contexto: `numeracion_series` tiene RLS donde sólo `es_dueno()` puede
-- hacer UPDATE. La función `siguiente_numero` hace SELECT FOR UPDATE y luego
-- UPDATE del contador. Si un empleado inserta `pagos`/`recibos`, el trigger
-- llama a `generar_codigo_*` → `siguiente_numero` como **invocador**; el
-- UPDATE puede fallar por RLS o dejar un estado confuso, a veces surfacido
-- como “Serie de numeración no configurada” (p. ej. si no hay fila visible).
--
-- Solución: `siguiente_numero` corre como propietario de la función (rol que
-- crea el objeto en Supabase, típicamente postgres) y fija `search_path`.
--
-- Además se re-ejecuta el bloque de inserción idempotente de 007 por si falta
-- algún `scope` (pago, recibo, etc.) tras borrados manuales o migraciones
-- parciales.
--
-- Idempotente. Ejecutar en el SQL Editor de Supabase después de 007.
-- ============================================================

create or replace function public.siguiente_numero(p_scope text)
returns text
language plpgsql
security definer
set search_path = public
as $$
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

  if serie.reset_anual and serie.año_actual < año_hoy then
    año_efectivo := año_hoy;
    numero := 1;
  else
    año_efectivo := serie.año_actual;
    numero := serie.contador + 1;
  end if;

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

-- Re-sembrar series internas faltantes (misma lógica que migración 007)
do $$
declare
  año_hoy int := extract(
    year from (current_timestamp at time zone 'America/Santo_Domingo')::date
  )::int;
begin
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
