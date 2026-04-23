/**
 * Tipos TypeScript del schema de Don Pepe.
 *
 * En producción esto debe regenerarse con:
 *   npx supabase gen types typescript --project-id <ID> > lib/supabase/types.ts
 *
 * Por ahora mantenemos una tipificación manual basada en
 * `supabase/migrations/001_schema.sql`.
 */

export type UserRol = "dueno" | "empleado";
export type TipoArticulo = "joya_oro" | "electrodomestico" | "tenis" | "otro";
export type EstadoArticulo =
  | "empenado"
  | "retirado"
  | "vencido_propio"
  | "vendido"
  | "convertido_a_joyeria";
export type EstadoPrestamo =
  | "activo"
  | "pagado"
  | "renovado"
  | "vencido_a_cobro"
  | "propiedad_casa";
/**
 * Subconjunto de `TipoPago` aplicable a pagos sobre préstamos (empeños).
 * Mantenido aquí para evitar duplicación con `lib/calc/intereses.ts`.
 */
export type TipoPagoEmpeno =
  | "interes"
  | "abono_capital"
  | "saldo_total"
  | "renovacion";

export type TipoPago =
  | TipoPagoEmpeno
  | "venta"
  | "compra_oro"
  | "otro";
export type DireccionPago = "ingreso" | "egreso";

// Facturación (DGII / e-CF)
export type TipoRecibo =
  | "pago_empeno"
  | "saldo_empeno"
  | "renovacion"
  | "venta_compraventa"
  | "venta_joyeria"
  | "compra_oro"
  | "otro";
export type TipoComprobante =
  | "factura_credito_fiscal" // 01 / B01 / E31
  | "factura_consumo" // 02 / B02 / E32
  | "nota_debito" // 03 / E33
  | "nota_credito" // 04 / E34
  | "compra" // 11 / B11 / E41 (compra al público)
  | "gastos_menores" // 12 / E43
  | "registro_especial" // 13
  | "regimen_especial" // 14 / E44
  | "gubernamental" // 15 / E45
  | "exportaciones" // 16 / E46
  | "pagos_exterior"; // 17 / E47
export type EstadoFactura =
  | "borrador"
  | "emitida"
  | "firmada"
  | "aceptada"
  | "rechazada"
  | "anulada"
  | "fallida";
export type EstadoRangoNcf = "activo" | "agotado" | "vencido" | "anulado";
export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";
export type EstadoNotificacion = "pendiente" | "enviada" | "fallida" | "leida";
export type TipoNotificacion =
  | "resumen_diario"
  | "vencimiento_hoy"
  | "vencimiento_proximo"
  | "articulos_propiedad";

// Joyería
export type TipoRegistroJoyeria = "pieza" | "lote";
export type MaterialJoyeria = "oro" | "plata" | "mixto";
export type EstadoPiezaJoyeria =
  | "disponible"
  | "reservada"
  | "vendida"
  | "en_reparacion"
  | "baja"
  | "agotado";
export type OrigenJoyeria =
  | "taller"
  | "compra_oro"
  | "articulo_propiedad"
  | "proveedor_externo";
export type TipoMovimientoJoyeria =
  | "alta"
  | "ajuste_precio"
  | "cambio_estado"
  | "cambio_ubicacion"
  | "venta"
  | "baja"
  | "reparacion_inicio"
  | "reparacion_fin"
  | "ajuste_unidades";

/**
 * Kilatajes soportados:
 *   Oro: 10, 14, 18, 22, 24
 *   Plata: 800, 925, 950, 999
 */
export type KilatajeJoyeria = 10 | 14 | 18 | 22 | 24 | 800 | 925 | 950 | 999;

export interface PiedraJoyeria {
  tipo: string; // "diamante", "circón", "zafiro"…
  cantidad?: number;
  quilates?: number;
  color?: string;
  notas?: string;
}

export interface AppUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  nombre: string;
  rol: UserRol;
  /** Super-admin inmutable. Bypasa la lista de módulos y puede crear/editar usuarios. */
  es_admin: boolean;
  /** Códigos de módulos a los que el usuario tiene acceso. El admin ignora esta lista. */
  modulos_permitidos: string[];
  telefono_whatsapp: string | null;
  recibir_alertas: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfigNegocio {
  id: string;
  nombre_comercial: string;
  direccion: string | null;
  telefono: string | null;
  rnc: string | null;
  logo_url: string | null;
  tasa_interes_default: number;
  plazo_meses_default: number;
  porcentaje_prestamo_default: number;
  dias_gracia_vencimiento: number;
  hora_alerta_whatsapp: string;
  dias_alerta_previa: number[];
  margen_compra_oro: number;
  // Datos fiscales (facturación DGII)
  razon_social: string | null;
  direccion_fiscal: string | null;
  email_fiscal: string | null;
  itbis_default: number;
  logo_factura_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  cedula: string;
  nombre_completo: string;
  telefono: string | null;
  direccion: string | null;
  foto_cedula_url: string | null;
  foto_cliente_url: string | null;
  notas: string | null;
  // Campos extendidos (migración 009) — usados por el libro de compraventa
  // y reportes DGII. Todos opcionales.
  edad: number | null;
  color: string | null;
  nacionalidad: string | null;
  estado_civil: string | null;
  oficio_profesion: string | null;
  created_at: string;
  updated_at: string;
}

/** Formatos DGII generables. */
export type FormatoDgii = "606" | "607" | "608";

/** Fila de `reportes_dgii_generados` (migración 009). */
export interface ReporteDgiiGenerado {
  id: string;
  formato: FormatoDgii;
  /** 'YYYY-MM' */
  periodo: string;
  generado_por: string | null;
  generado_at: string;
  conteo_registros: number;
  total_monto: number;
  total_itbis: number;
  archivo_txt_contenido: string | null;
  notas: string | null;
  created_at: string;
}

/**
 * Fila de la vista `v_libro_compraventa` (reescrita en migración 010).
 *
 * La vista unifica compras de oro y gastos operativos en un solo
 * libro para el contable. Se puede distinguir por `origen`:
 *   - 'compra_oro' → registro de compra de oro (tiene cédula, kilataje…)
 *   - 'gasto'      → gasto operativo (tiene categoría DGII, NCF…)
 *
 * Los campos específicos de una fuente son `null` para la otra.
 */
export interface LibroCompraventaRow {
  registro_id: string;
  origen: "compra_oro" | "gasto";
  orden_numero: string;
  cedula: string;
  fecha: string;
  nombre: string;
  edad: number | null;
  color: string | null;
  nacionalidad: string | null;
  estado_civil: string | null;
  oficio_profesion: string | null;
  domicilio: string | null;
  telefono: string | null;
  kilataje: number | null;
  peso_gramos: number | null;
  precio_gramo: number | null;
  valor: number;
  efectos: string;
  notas: string | null;
  fecha_salida: string | null;
  ncf: string | null;
  categoria: string;
  disponible: boolean | null;
}

/** Tipo de bien/servicio DGII (Formato 606). */
export type TipoGastoDgii =
  | "01" // Gastos de Personal
  | "02" // Trabajos, Suministros y Servicios
  | "03" // Arrendamientos
  | "04" // Activos Fijos
  | "05" // Representación
  | "06" // Otras Deducciones Admitidas
  | "07" // Gastos Financieros
  | "08" // Gastos Extraordinarios
  | "09" // Compras/Gastos que forman parte del Costo de Venta
  | "10" // Adquisiciones de Activos
  | "11"; // Seguros

/** Forma de pago DGII (Formato 606). */
export type FormaPagoDgii =
  | "01" // Efectivo
  | "02" // Cheques/Transferencias/Depósitos
  | "03" // Tarjeta Crédito/Débito
  | "04" // Compra a Crédito
  | "05" // Permuta
  | "06" // Nota de Crédito
  | "07"; // Mixto

/** Gasto operativo (migración 010) — alimenta el 606. */
export interface GastoOperativo {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  categoria: TipoGastoDgii;
  rnc_proveedor: string | null;
  nombre_proveedor: string | null;
  /** '1' RNC, '2' Cédula. */
  tipo_id_proveedor: "1" | "2" | null;
  ncf: string | null;
  ncf_modificado: string | null;
  itbis_facturado: number;
  itbis_retenido: number;
  forma_pago: FormaPagoDgii;
  notas: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Snapshot diario de precios spot de metales preciosos (migración 010).
 * Fuente: MetalpriceAPI. Se refresca vía cron una vez al día.
 * Es INFORMATIVO — los precios locales están en `precios_oro`.
 */
export interface SpotMetalesDiario {
  fecha: string;
  oro_24k_dop_gramo: number | null;
  plata_dop_gramo: number | null;
  platino_dop_gramo: number | null;
  paladio_dop_gramo: number | null;
  oro_usd_oz: number | null;
  plata_usd_oz: number | null;
  platino_usd_oz: number | null;
  paladio_usd_oz: number | null;
  usd_dop: number | null;
  fuente: string;
  actualizado_at: string;
  notas: string | null;
  created_at: string;
}

export interface Articulo {
  id: string;
  cliente_id: string | null;
  tipo: TipoArticulo;
  descripcion: string;
  fotos_urls: string[];
  kilataje: number | null;
  peso_gramos: number | null;
  /**
   * Valor tasado — nullable desde la migración 006. Los empeños nuevos
   * no lo capturan (se quitó del flujo porque guardar la cifra puede
   * volverse perjudicial con el tiempo). Registros legados lo mantienen.
   */
  valor_tasado: number | null;
  estado: EstadoArticulo;
  created_at: string;
  updated_at: string;
}

export interface Prestamo {
  id: string;
  codigo: string;
  cliente_id: string;
  articulo_id: string;
  monto_prestado: number;
  tasa_interes_mensual: number;
  plazo_meses: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  estado: EstadoPrestamo;
  creado_por: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pago {
  id: string;
  codigo: string;
  prestamo_id: string | null;
  venta_id: string | null;
  compra_oro_id: string | null;
  cliente_id: string | null;
  direccion: DireccionPago;
  concepto: string | null;
  tipo: TipoPago;
  monto: number;
  metodo: MetodoPago;
  fecha: string;
  nueva_fecha_vencimiento: string | null;
  notas: string | null;
  recibido_por: string | null;
  anulado_at: string | null;
  anulado_motivo: string | null;
  anulado_por: string | null;
  created_at: string;
}

export interface ReciboItem {
  descripcion: string;
  cantidad?: number;
  monto: number;
}

export interface Recibo {
  id: string;
  codigo: string;
  pago_id: string | null;
  tipo: TipoRecibo;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_cedula: string | null;
  cliente_telefono: string | null;
  concepto: string;
  items: ReciboItem[];
  subtotal: number;
  total: number;
  metodo: MetodoPago;
  factura_id: string | null;
  emitido_por: string | null;
  emitido_at: string;
  anulado_at: string | null;
  anulado_motivo: string | null;
  anulado_por: string | null;
  created_at: string;
}

export interface Factura {
  id: string;
  codigo_interno: string;
  ncf: string | null;
  tipo_comprobante: TipoComprobante;
  estado: EstadoFactura;
  rnc_emisor: string | null;
  razon_social_emisor: string | null;
  direccion_emisor: string | null;
  cliente_id: string | null;
  rnc_receptor: string | null;
  cedula_receptor: string | null;
  nombre_receptor: string;
  direccion_receptor: string | null;
  email_receptor: string | null;
  telefono_receptor: string | null;
  subtotal: number;
  descuento: number;
  base_itbis: number;
  base_exenta: number;
  itbis_monto: number;
  total: number;
  pago_id: string | null;
  factura_afectada_id: string | null;
  fecha_emision: string;
  fecha_vencimiento_ncf: string | null;
  xml_firmado: string | null;
  codigo_seguridad: string | null;
  url_xml: string | null;
  url_pdf: string | null;
  dgii_respuesta: Record<string, unknown> | null;
  notas: string | null;
  emitida_por: string | null;
  emitida_at: string | null;
  anulada_at: string | null;
  anulada_motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacturaItem {
  id: string;
  factura_id: string;
  orden: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number;
  precio_unitario_bruto: number;
  descuento_unitario: number;
  itbis_aplica: boolean;
  itbis_tasa: number;
  subtotal: number;
  itbis_monto: number;
  total: number;
  pieza_joyeria_id: string | null;
  articulo_id: string | null;
}

export interface NcfRango {
  id: string;
  tipo_comprobante: TipoComprobante;
  serie: string;
  secuencia_desde: number;
  secuencia_hasta: number;
  secuencia_actual: number;
  fecha_vencimiento: string | null;
  estado: EstadoRangoNcf;
  notas: string | null;
  created_at: string;
}

/**
 * Serie interna de numeración (migración 007).
 *
 * Hay una fila por "scope": empeno, venta, compra_oro, pago, recibo,
 * factura_interna. El dueño puede editar el prefijo, el formato y el
 * reset anual desde `/config/numeraciones`. El contador y el año
 * actual los gestiona `siguiente_numero()` — la UI no debe tocarlos
 * directamente (romper esos valores causaría huecos o duplicados).
 *
 * Placeholders del `formato`: `{prefijo}`, `{año}` / `{YYYY}`,
 * `{numero}` / `{NNNNN}`.
 */
export interface NumeracionSerie {
  id: string;
  scope: string;
  etiqueta: string;
  prefijo: string;
  ancho_secuencia: number;
  reset_anual: boolean;
  formato: string;
  año_actual: number;
  contador: number;
  activa: boolean;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fila de `v_resumen_numeraciones` — unifica series internas y rangos
 * NCF en una sola forma para la página de configuración.
 * Los campos específicos de NCF son `null` cuando `categoria = 'interna'`
 * y viceversa.
 */
export interface ResumenNumeracion {
  categoria: "interna" | "ncf";
  scope: string;
  etiqueta: string;
  prefijo: string;
  año_actual: number | null;
  ultimo_numero: number;
  proximo_numero: number;
  rango_disponible: number | null;
  proxima_expiracion: string | null;
  activa: boolean;
  reset_anual: boolean | null;
  formato: string | null;
  ncf_estado: EstadoRangoNcf | null;
}

export interface PrecioOro {
  id: string;
  fecha: string;
  kilataje: number;
  precio_dop_gramo: number;
  precio_venta_dop_gramo: number | null;
  fuente: "manual" | "goldapi" | "exchange-rates";
  created_at: string;
}

export interface CompraOro {
  id: string;
  codigo: string;
  cliente_id: string;
  kilataje: number;
  peso_gramos: number;
  precio_gramo: number;
  total_pagado: number;
  fotos_urls: string[];
  recibido_por: string | null;
  notas: string | null;
  /**
   * true = el oro todavía está en stock (no se procesó ni vendió).
   * false = ya fue convertido a pieza de joyería o vendido.
   * Columna agregada en migración 010 — un trigger la actualiza
   * automáticamente cuando se inserta en `piezas_joyeria` con
   * `origen='compra_oro'`.
   */
  oro_disponible: boolean;
  created_at: string;
}

export interface Venta {
  id: string;
  codigo: string;
  articulo_id: string | null;
  pieza_joyeria_id: string | null;
  cantidad: number;
  comprador_nombre: string | null;
  comprador_cedula: string | null;
  comprador_telefono: string | null;
  precio_venta: number;
  metodo: MetodoPago;
  vendido_por: string | null;
  notas: string | null;
  created_at: string;
}

export interface CategoriaJoyeria {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface PiezaJoyeria {
  id: string;
  sku: string;
  tipo_registro: TipoRegistroJoyeria;
  categoria_id: string | null;
  nombre: string;
  material: MaterialJoyeria;
  kilataje: KilatajeJoyeria | null;

  // Individuales
  peso_gramos: number | null;
  medida: string | null;
  tejido: string | null;
  marca: string | null;
  piedras: PiedraJoyeria[] | null;

  // Lotes
  unidades_totales: number;
  unidades_disponibles: number;
  peso_gramos_total: number | null;

  // Costo y precio
  costo_material: number;
  costo_mano_obra: number;
  costo_total: number; // generated column
  precio_venta: number;
  precio_minimo: number | null;

  // Fotos y ubicación
  fotos_urls: string[];
  ubicacion: string | null;

  // Estado y origen
  estado: EstadoPiezaJoyeria;
  origen: OrigenJoyeria;
  origen_ref: string | null;
  proveedor: string | null;

  // Meta
  fecha_adquisicion: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface MovimientoJoyeria {
  id: string;
  pieza_id: string;
  tipo: TipoMovimientoJoyeria;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  user_id: string | null;
  notas: string | null;
  created_at: string;
}

export interface Notificacion {
  id: string;
  destinatario_user_id: string | null;
  tipo: TipoNotificacion;
  contenido: Record<string, unknown>;
  enviada_at: string | null;
  status: EstadoNotificacion;
  meta_message_id: string | null;
  error: string | null;
  created_at: string;
}

type Table<R> = {
  Row: R;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      app_users: Table<AppUser>;
      config_negocio: Table<ConfigNegocio>;
      clientes: Table<Cliente>;
      articulos: Table<Articulo>;
      prestamos: Table<Prestamo>;
      pagos: Table<Pago>;
      precios_oro: Table<PrecioOro>;
      compras_oro: Table<CompraOro>;
      ventas: Table<Venta>;
      notificaciones: Table<Notificacion>;
      categorias_joyeria: Table<CategoriaJoyeria>;
      piezas_joyeria: Table<PiezaJoyeria>;
      movimientos_joyeria: Table<MovimientoJoyeria>;
      recibos: Table<Recibo>;
      facturas: Table<Factura>;
      factura_items: Table<FacturaItem>;
      ncf_rangos: Table<NcfRango>;
      numeracion_series: Table<NumeracionSerie>;
      reportes_dgii_generados: Table<ReporteDgiiGenerado>;
      gastos_operativos: Table<GastoOperativo>;
      spot_metales_diario: Table<SpotMetalesDiario>;
    };
    Views: {
      v_resumen_numeraciones: { Row: ResumenNumeracion };
      v_libro_compraventa: { Row: LibroCompraventaRow };
    };
    Functions: {
      generar_codigo_prestamo: { Args: Record<string, never>; Returns: string };
      generar_codigo_compra_oro: { Args: Record<string, never>; Returns: string };
      generar_codigo_venta: { Args: Record<string, never>; Returns: string };
      generar_sku_joyeria: { Args: Record<string, never>; Returns: string };
      generar_codigo_pago: { Args: Record<string, never>; Returns: string };
      generar_codigo_recibo: { Args: Record<string, never>; Returns: string };
      generar_codigo_factura: { Args: Record<string, never>; Returns: string };
      obtener_proximo_ncf: { Args: { p_tipo: TipoComprobante }; Returns: string };
      siguiente_numero: { Args: { p_scope: string }; Returns: string };
      marcar_rangos_ncf_vencidos: { Args: Record<string, never>; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
