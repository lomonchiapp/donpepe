-- Datos de ejemplo para desarrollo local. NO ejecutar en producción.

-- Config del negocio: incluye datos fiscales para poder emitir facturas de
-- ejemplo. En producción el dueño completa estos campos desde /config.
-- NOTA: las columnas `razon_social`, `direccion_fiscal`, `email_fiscal`,
-- `itbis_default` y `logo_factura_url` se añaden en 005_facturacion.sql —
-- este seed asume que ambas migraciones se corrieron antes.
insert into public.config_negocio (
  nombre_comercial,
  razon_social,
  rnc,
  direccion,
  direccion_fiscal,
  email_fiscal,
  telefono,
  itbis_default,
  tasa_interes_default,
  plazo_meses_default,
  porcentaje_prestamo_default
)
values (
  'Don Pepe Compraventa',
  'Don Pepe Compraventa SRL',
  '131-12345-6',
  'Santo Domingo, RD',
  'Av. Máximo Gómez #123, Santo Domingo, DN',
  'facturacion@donpepe.do',
  '(809) 555-0100',
  18,
  0.10,
  3,
  0.60
)
on conflict do nothing;

-- Rango NCF de ejemplo: factura de consumo electrónica (serie E, tipo 02).
-- 200 secuencias disponibles, vence en 1 año. Pensado para pruebas locales.
insert into public.ncf_rangos (
  tipo_comprobante,
  serie,
  secuencia_desde,
  secuencia_hasta,
  secuencia_actual,
  fecha_vencimiento,
  estado,
  notas
)
values (
  'factura_consumo',
  'E',
  1,
  200,
  1,
  current_date + interval '1 year',
  'activo',
  'Rango de ejemplo para desarrollo local'
)
on conflict (tipo_comprobante, serie, secuencia_desde) do nothing;

-- Precios de oro del día
insert into public.precios_oro (fecha, kilataje, precio_dop_gramo, precio_venta_dop_gramo, fuente)
values
  (current_date, 10, 2_600, 3_500, 'manual'),
  (current_date, 14, 3_700, 4_900, 'manual'),
  (current_date, 18, 4_800, 6_400, 'manual'),
  (current_date, 22, 5_900, 7_900, 'manual'),
  (current_date, 24, 6_400, 8_600, 'manual')
on conflict (fecha, kilataje) do nothing;

-- Clientes de ejemplo
insert into public.clientes (cedula, nombre_completo, telefono, direccion)
values
  ('001-1234567-8', 'María Fernández Santos', '(809) 555-0111', 'Los Mina, SDE'),
  ('402-2345678-9', 'Juan Carlos Pérez', '(829) 555-0222', 'Villa Mella'),
  ('001-3456789-0', 'Rosa Angélica Martínez', '(849) 555-0333', 'Naco, DN')
on conflict (cedula) do nothing;
