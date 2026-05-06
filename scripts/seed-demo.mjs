#!/usr/bin/env node
/**
 * Don Pepe — seed de demo.
 *
 * Aplica:
 *   1. Migración 012 (PIN login: avatar_url, pin_length, RPCs).
 *   2. 6 usuarios de demo con PIN como password.
 *   3. Datos de muestra: clientes, empeños en distintos estados, joyería,
 *      ventas, compras de oro, spot, precios.
 *
 * Idempotente — se puede correr varias veces. Detecta si ya hay >5 prestamos
 * y salta el seed de transacciones (asume datos reales).
 *
 * Uso:
 *   node scripts/seed-demo.mjs
 *
 * Variables esperadas (lee .env.local automáticamente si existe):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ============================================================
// 1. Cargar env vars desde .env.local
// ============================================================
async function loadEnv() {
  try {
    const txt = await readFile(join(ROOT, ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local opcional
  }
}
await loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`🔗 Conectado a ${SUPABASE_URL}\n`);

// ============================================================
// 2. Detectar si migración 012 está aplicada (avatar_url, pin_length)
// ============================================================
async function detectMigracion012() {
  // Probar leyendo una columna de la 012. Si no existe, advertir.
  const { error } = await sb
    .from("app_users")
    .select("pin_length")
    .limit(1);
  if (error && /pin_length/.test(error.message)) {
    return false;
  }
  return true;
}

function instruccionesMigracion012() {
  console.log("\n⚠️  La migración 012 (PIN login) NO está aplicada.");
  console.log("   Pega el contenido de este archivo en el SQL Editor de Supabase y ejecuta:");
  console.log(`     ${join(ROOT, "supabase/migrations/012_pin_login.sql")}`);
  console.log("   Luego vuelve a correr este script.\n");
}

// ============================================================
// 3. Crear/actualizar usuarios demo
// ============================================================
const DEMO_USERS = [
  {
    email: "elviocreations@gmail.com",
    nombre: "Elvio Pepe",
    pin: "123456",
    pin_length: 6,
    rol: "dueno",
    es_admin: true,
    modulos: [
      "inicio", "empenos", "clientes",
      "oro_precios", "oro_compra",
      "joyeria",
      "inventario", "ventas",
      "pagos", "recibos", "facturas",
      "reportes", "contabilidad", "config",
    ],
  },
  {
    email: "carlos@donpepe.local",
    nombre: "Carlos Medina",
    pin: "111111",
    pin_length: 6,
    rol: "empleado",
    es_admin: false,
    modulos: [
      "inicio", "empenos", "clientes",
      "oro_precios", "oro_compra",
      "joyeria",
      "inventario", "ventas",
      "pagos", "recibos",
    ],
  },
  {
    email: "maria@donpepe.local",
    nombre: "María Cabrera",
    pin: "222222",
    pin_length: 6,
    rol: "empleado",
    es_admin: false,
    modulos: ["inicio", "pagos", "recibos", "ventas", "clientes"],
  },
  {
    email: "pedro@donpepe.local",
    nombre: "Pedro Almonte",
    pin: "333333",
    pin_length: 6,
    rol: "empleado",
    es_admin: false,
    modulos: ["inicio", "empenos", "oro_precios", "oro_compra", "joyeria"],
  },
  {
    email: "ana@donpepe.local",
    nombre: "Ana Reynoso",
    pin: "444444",
    pin_length: 6,
    rol: "empleado",
    es_admin: false,
    modulos: ["inicio", "contabilidad", "facturas", "reportes"],
  },
  {
    email: "luis@donpepe.local",
    nombre: "Luis Tavárez",
    pin: "555555",
    pin_length: 6,
    rol: "empleado",
    es_admin: false,
    modulos: ["inicio", "inventario", "ventas", "joyeria"],
  },
];

async function seedUsers(has012) {
  console.log("\n👥 Sembrando usuarios demo…");
  for (const u of DEMO_USERS) {
    // 1) crear o asegurar el auth user con el PIN como password
    const { data: existingAuth, error: listErr } = await sb.auth.admin
      .listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      console.error(`  ✗ no se pudo listar auth.users: ${listErr.message}`);
      continue;
    }
    const found = existingAuth?.users?.find(
      (au) => au.email?.toLowerCase() === u.email.toLowerCase(),
    );
    let authUserId;
    if (found) {
      // actualizar password al PIN
      const { error: upErr } = await sb.auth.admin.updateUserById(found.id, {
        password: u.pin,
        email_confirm: true,
      });
      if (upErr) {
        console.error(`  ✗ ${u.email}: update password — ${upErr.message}`);
        continue;
      }
      authUserId = found.id;
      console.log(`  ✓ ${u.email} (auth existing, PIN actualizado)`);
    } else {
      const { data: created, error: cErr } = await sb.auth.admin.createUser({
        email: u.email,
        password: u.pin,
        email_confirm: true,
      });
      if (cErr) {
        console.error(`  ✗ ${u.email}: create — ${cErr.message}`);
        continue;
      }
      authUserId = created.user.id;
      console.log(`  ✓ ${u.email} (auth creado)`);
    }

    // 2) upsert en app_users (omitir pin_length si la 012 no se aplicó)
    const row = {
      auth_user_id: authUserId,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      es_admin: u.es_admin,
      modulos_permitidos: u.modulos,
      activo: true,
    };
    if (has012) row.pin_length = u.pin_length;
    const { error: upsertErr } = await sb
      .from("app_users")
      .upsert(row, { onConflict: "email" });
    if (upsertErr) {
      console.error(`  ✗ ${u.email}: app_users — ${upsertErr.message}`);
    }
  }
}

// ============================================================
// 4. Datos de demo (transacciones)
// ============================================================
const HOY = new Date();
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const CLIENTES = [
  { cedula: "001-0023456-7", nombre_completo: "Juan Pérez Rodríguez", telefono: "(809) 555-1001", direccion: "Los Mina, SDE", oficio_profesion: "Mecánico" },
  { cedula: "402-1234567-8", nombre_completo: "María Fernández Santos", telefono: "(829) 555-1002", direccion: "Villa Mella", oficio_profesion: "Comerciante" },
  { cedula: "001-0345678-9", nombre_completo: "Rosa Angélica Martínez", telefono: "(849) 555-1003", direccion: "Naco, DN", oficio_profesion: "Maestra" },
  { cedula: "001-0456789-0", nombre_completo: "José Antonio Cabrera", telefono: "(809) 555-1004", direccion: "Los Alcarrizos", oficio_profesion: "Chofer" },
  { cedula: "402-0567890-1", nombre_completo: "Carmen Esperanza Sosa", telefono: "(829) 555-1005", direccion: "Capotillo, DN", oficio_profesion: "Estilista" },
  { cedula: "001-0678901-2", nombre_completo: "Rafael Tavárez Méndez", telefono: "(849) 555-1006", direccion: "Herrera, SDO", oficio_profesion: "Albañil" },
  { cedula: "001-0789012-3", nombre_completo: "Ana Lucía Herrera", telefono: "(809) 555-1007", direccion: "Gazcue, DN", oficio_profesion: "Enfermera" },
  { cedula: "402-0890123-4", nombre_completo: "Pedro Manuel Núñez", telefono: "(829) 555-1008", direccion: "Sabana Perdida, SDN", oficio_profesion: "Plomero" },
  { cedula: "001-0901234-5", nombre_completo: "Luisa María Gómez", telefono: "(849) 555-1009", direccion: "Los Mina, SDE", oficio_profesion: "Costurera" },
  { cedula: "001-1012345-6", nombre_completo: "Ramón Antonio Reyes", telefono: "(809) 555-1010", direccion: "Villa Duarte, SDE", oficio_profesion: "Vendedor" },
  { cedula: "402-1123456-7", nombre_completo: "Mercedes Altagracia Díaz", telefono: "(829) 555-1011", direccion: "Bella Vista, DN", oficio_profesion: "Contadora" },
  { cedula: "001-1234567-8", nombre_completo: "Francisco Javier López", telefono: "(849) 555-1012", direccion: "27 de Febrero, DN", oficio_profesion: "Ingeniero" },
  { cedula: "001-1345678-9", nombre_completo: "Yolanda Báez Pichardo", telefono: "(809) 555-1013", direccion: "Cristo Rey, DN", oficio_profesion: "Cocinera" },
  { cedula: "402-1456789-0", nombre_completo: "Miguel Ángel Polanco", telefono: "(829) 555-1014", direccion: "Los Tres Brazos, SDE", oficio_profesion: "Soldador" },
  { cedula: "001-1567890-1", nombre_completo: "Patricia Elena Vargas", telefono: "(849) 555-1015", direccion: "Mirador Sur, DN", oficio_profesion: "Diseñadora" },
];

const ARTICULOS_OPS = [
  { tipo: "joya_oro", desc: "Cadena de oro 18K, 12g, modelo cubano", peso: 12, kilataje: 18 },
  { tipo: "joya_oro", desc: "Anillo de compromiso 14K con piedra de circón", peso: 4.5, kilataje: 14 },
  { tipo: "joya_oro", desc: "Pulsera de oro 22K trenzada, 18g", peso: 18, kilataje: 22 },
  { tipo: "joya_oro", desc: "Aretes de oro 18K con perlas", peso: 6, kilataje: 18 },
  { tipo: "joya_oro", desc: "Cadena 14K rolo, 9g", peso: 9, kilataje: 14 },
  { tipo: "joya_oro", desc: "Esclava cuadrada oro 22K, 28g", peso: 28, kilataje: 22 },
  { tipo: "electrodomestico", desc: "Smart TV Samsung 55\" 4K (2023)" },
  { tipo: "electrodomestico", desc: "Laptop HP Pavilion 15.6\" i5 8GB RAM" },
  { tipo: "electrodomestico", desc: "Nevera LG 14p3 inverter" },
  { tipo: "electrodomestico", desc: "Lavadora Whirlpool 22 libras" },
  { tipo: "electrodomestico", desc: "Microondas Black+Decker 1.6 cu ft" },
  { tipo: "electrodomestico", desc: "Estufa Mabe 4 hornillas" },
  { tipo: "tenis", desc: "Air Jordan 1 Mid Bred Toe talla 10" },
  { tipo: "tenis", desc: "Nike Dunk Low Panda talla 9" },
  { tipo: "tenis", desc: "Yeezy Boost 350 V2 Beluga talla 10.5" },
  { tipo: "otro", desc: "Bicicleta de montaña Trek 26\"" },
  { tipo: "otro", desc: "Reloj Casio G-Shock GA-2100" },
  { tipo: "otro", desc: "PlayStation 5 Slim digital" },
];

async function seedTransacciones() {
  console.log("\n💼 Sembrando datos de demo…");

  // Si ya hay >5 prestamos, asumir data real y saltar.
  const { count: prestamosCount } = await sb
    .from("prestamos")
    .select("id", { count: "exact", head: true });
  if ((prestamosCount ?? 0) > 5) {
    console.log(`  ⏭  Ya hay ${prestamosCount} préstamos — saltando seed transaccional.`);
    return;
  }

  // ---- Clientes ----
  for (const c of CLIENTES) {
    const { error } = await sb.from("clientes").upsert(c, { onConflict: "cedula" });
    if (error) console.log(`  ✗ cliente ${c.cedula}: ${error.message}`);
  }
  console.log(`  ✓ ${CLIENTES.length} clientes`);

  // ---- Precios de oro hoy ----
  const preciosOro = [
    { fecha: isoDate(HOY), kilataje: 10, precio_dop_gramo: 2_550, precio_venta_dop_gramo: 3_400, fuente: "manual" },
    { fecha: isoDate(HOY), kilataje: 14, precio_dop_gramo: 3_650, precio_venta_dop_gramo: 4_850, fuente: "manual" },
    { fecha: isoDate(HOY), kilataje: 18, precio_dop_gramo: 4_750, precio_venta_dop_gramo: 6_300, fuente: "manual" },
    { fecha: isoDate(HOY), kilataje: 22, precio_dop_gramo: 5_850, precio_venta_dop_gramo: 7_800, fuente: "manual" },
    { fecha: isoDate(HOY), kilataje: 24, precio_dop_gramo: 6_350, precio_venta_dop_gramo: 8_500, fuente: "manual" },
  ];
  for (const p of preciosOro) {
    await sb.from("precios_oro").upsert(p, { onConflict: "fecha,kilataje" });
  }
  console.log(`  ✓ Precios oro (5 kilatajes)`);

  // ---- Spot metales ----
  await sb.from("spot_metales_diario").upsert({
    fecha: isoDate(HOY),
    oro_24k_dop_gramo: 6_320,
    plata_dop_gramo: 75,
    platino_dop_gramo: 5_200,
    paladio_dop_gramo: 6_100,
    oro_usd_oz: 2050,
    plata_usd_oz: 24.5,
    platino_usd_oz: 950,
    paladio_usd_oz: 1100,
    usd_dop: 60.5,
    fuente: "manual",
  });
  console.log(`  ✓ Spot metales hoy`);

  // ---- Prestamos en distintos estados ----
  const { data: clientesDb } = await sb.from("clientes").select("id,cedula").limit(50);
  if (!clientesDb || clientesDb.length === 0) {
    console.log("  ✗ no hay clientes para asociar préstamos");
    return;
  }

  // 14 préstamos: 5 activos en buen estado, 4 vencen hoy/pronto, 3 vencidos a cobro,
  // 2 propiedad casa.
  const prestamos = [
    // activos sanos
    { offset: -5,  vence: 25, monto: 8_000,  art: 0,  estado: "activo" },
    { offset: -10, vence: 20, monto: 12_000, art: 1,  estado: "activo" },
    { offset: -15, vence: 15, monto: 25_000, art: 2,  estado: "activo" },
    { offset: -3,  vence: 27, monto: 6_500,  art: 6,  estado: "activo" },
    { offset: -20, vence: 10, monto: 18_000, art: 3,  estado: "activo" },
    // vencen pronto/hoy
    { offset: -28, vence: 2,  monto: 9_500,  art: 7,  estado: "activo" },
    { offset: -30, vence: 0,  monto: 14_000, art: 12, estado: "activo" },
    { offset: -27, vence: 3,  monto: 7_200,  art: 4,  estado: "activo" },
    { offset: -29, vence: 1,  monto: 22_000, art: 5,  estado: "activo" },
    // vencidos a cobro (fecha_vencimiento en pasado)
    { offset: -45, vence: -15, monto: 5_500, art: 13, estado: "vencido_a_cobro" },
    { offset: -60, vence: -30, monto: 11_000, art: 8, estado: "vencido_a_cobro" },
    { offset: -50, vence: -20, monto: 8_800, art: 14, estado: "vencido_a_cobro" },
    // propiedad casa
    { offset: -120, vence: -90, monto: 6_000, art: 9, estado: "propiedad_casa" },
    { offset: -150, vence: -120, monto: 13_500, art: 15, estado: "propiedad_casa" },
  ];

  let ok = 0;
  for (let i = 0; i < prestamos.length; i++) {
    const p = prestamos[i];
    const cliente = clientesDb[i % clientesDb.length];
    const articuloDef = ARTICULOS_OPS[p.art % ARTICULOS_OPS.length];

    const { data: art, error: artErr } = await sb
      .from("articulos")
      .insert({
        cliente_id: cliente.id,
        tipo: articuloDef.tipo,
        descripcion: articuloDef.desc,
        kilataje: articuloDef.kilataje ?? null,
        peso_gramos: articuloDef.peso ?? null,
        fotos_urls: [],
        estado: p.estado === "propiedad_casa" ? "vencido_propio" : "empenado",
      })
      .select("id")
      .single();
    if (artErr) {
      console.log(`  ✗ artículo ${i}: ${artErr.message}`);
      continue;
    }

    const { data: codigo, error: codErr } = await sb.rpc("generar_codigo_prestamo");
    if (codErr) {
      console.log(`  ✗ codigo prestamo ${i}: ${codErr.message}`);
      continue;
    }

    const fechaInicio = addDays(HOY, p.offset);
    const fechaVenc = addDays(HOY, p.vence);

    const { error: pErr } = await sb.from("prestamos").insert({
      codigo,
      cliente_id: cliente.id,
      articulo_id: art.id,
      monto_prestado: p.monto,
      tasa_interes_mensual: 0.10,
      plazo_meses: 1,
      fecha_inicio: isoDate(fechaInicio),
      fecha_vencimiento: isoDate(fechaVenc),
      estado: p.estado,
    });
    if (pErr) console.log(`  ✗ prestamo ${i}: ${pErr.message}`);
    else ok++;
  }
  console.log(`  ✓ ${ok} préstamos en distintos estados`);

  // ---- Compras de oro recientes ----
  const compras = [
    { offset: -1, kilataje: 14, peso: 8.5,  precio_gramo: 3650 },
    { offset: -1, kilataje: 18, peso: 12,   precio_gramo: 4750 },
    { offset: -2, kilataje: 22, peso: 6.2,  precio_gramo: 5850 },
    { offset: 0,  kilataje: 14, peso: 4.8,  precio_gramo: 3650 },
    { offset: 0,  kilataje: 18, peso: 9.3,  precio_gramo: 4750 },
    { offset: -3, kilataje: 24, peso: 3.1,  precio_gramo: 6350 },
  ];
  let okCompras = 0;
  for (let i = 0; i < compras.length; i++) {
    const c = compras[i];
    const cli = clientesDb[(i + 5) % clientesDb.length];
    const total = Math.round(c.peso * c.precio_gramo);
    const { data: codigo } = await sb.rpc("generar_codigo_compra_oro");
    const { error } = await sb.from("compras_oro").insert({
      codigo,
      cliente_id: cli.id,
      kilataje: c.kilataje,
      peso_gramos: c.peso,
      precio_gramo: c.precio_gramo,
      total_pagado: total,
      fotos_urls: [],
      created_at: addDays(HOY, c.offset).toISOString(),
    });
    if (error) console.log(`  ✗ compra oro ${i}: ${error.message}`);
    else okCompras++;
  }
  console.log(`  ✓ ${okCompras} compras de oro`);

  // ---- Piezas de joyería ----
  const piezas = [
    { sku: "JL-0001", nombre: "Anillo solitario circón 14K", material: "oro", kilataje: 14, peso: 3.5,  costo: 12_000, precio: 18_500, estado: "disponible", origen: "compra_oro" },
    { sku: "JL-0002", nombre: "Aretes argollas 18K medianas", material: "oro", kilataje: 18, peso: 4.2,  costo: 19_950, precio: 28_900, estado: "disponible", origen: "taller" },
    { sku: "JL-0003", nombre: "Cadena rolo 14K 50cm", material: "oro", kilataje: 14, peso: 6.8,  costo: 24_820, precio: 34_500, estado: "disponible", origen: "taller" },
    { sku: "JL-0004", nombre: "Pulsera tenis 18K con circón", material: "oro", kilataje: 18, peso: 7.5,  costo: 35_625, precio: 49_900, estado: "disponible", origen: "compra_oro" },
    { sku: "JL-0005", nombre: "Anillo aro infinito 22K", material: "oro", kilataje: 22, peso: 5.0,  costo: 29_250, precio: 39_500, estado: "disponible", origen: "compra_oro" },
    { sku: "JL-0006", nombre: "Esclava plana 18K hombre", material: "oro", kilataje: 18, peso: 22, costo: 104_500, precio: 138_000, estado: "disponible", origen: "compra_oro" },
    { sku: "JL-0007", nombre: "Dije corazón 14K", material: "oro", kilataje: 14, peso: 1.8, costo: 6_570, precio: 10_500, estado: "vendida", origen: "taller" },
    { sku: "JL-0008", nombre: "Cadena cubana 22K 60cm", material: "oro", kilataje: 22, peso: 35, costo: 204_750, precio: 268_000, estado: "disponible", origen: "compra_oro" },
    { sku: "JL-0009", nombre: "Anillo ancho 14K matrimonio", material: "oro", kilataje: 14, peso: 6.0, costo: 21_900, precio: 31_500, estado: "reservada", origen: "taller" },
    { sku: "JL-0010", nombre: "Aretes perla cultivada 18K", material: "oro", kilataje: 18, peso: 2.5, costo: 11_875, precio: 18_500, estado: "disponible", origen: "proveedor_externo" },
  ];
  let okJoy = 0;
  for (const p of piezas) {
    const { error } = await sb.from("piezas_joyeria").upsert({
      sku: p.sku,
      tipo_registro: "pieza",
      nombre: p.nombre,
      material: p.material,
      kilataje: p.kilataje,
      peso_gramos: p.peso,
      unidades_totales: 1,
      unidades_disponibles: p.estado === "disponible" ? 1 : 0,
      costo_material: p.costo,
      costo_mano_obra: 0,
      precio_venta: p.precio,
      precio_minimo: Math.round(p.precio * 0.9),
      fotos_urls: [],
      estado: p.estado,
      origen: p.origen,
      fecha_adquisicion: isoDate(addDays(HOY, -Math.floor(Math.random() * 60))),
    }, { onConflict: "sku" });
    if (error) console.log(`  ✗ pieza ${p.sku}: ${error.message}`);
    else okJoy++;
  }
  console.log(`  ✓ ${okJoy} piezas de joyería`);

  // ---- Ventas ----
  const { data: piezasVendibles } = await sb
    .from("piezas_joyeria")
    .select("id,sku,precio_venta")
    .in("estado", ["disponible", "vendida"])
    .limit(8);
  const ventas = [
    { offset: -7, idx: 0, metodo: "efectivo" },
    { offset: -5, idx: 1, metodo: "tarjeta" },
    { offset: -3, idx: 2, metodo: "transferencia" },
    { offset: -1, idx: 3, metodo: "efectivo" },
    { offset: 0,  idx: 4, metodo: "tarjeta" },
  ];
  let okVentas = 0;
  for (const v of ventas) {
    if (!piezasVendibles?.[v.idx]) continue;
    const p = piezasVendibles[v.idx];
    const { data: codigo } = await sb.rpc("generar_codigo_venta");
    const { error } = await sb.from("ventas").insert({
      codigo,
      pieza_joyeria_id: p.id,
      cantidad: 1,
      precio_venta: p.precio_venta,
      metodo: v.metodo,
      created_at: addDays(HOY, v.offset).toISOString(),
    });
    if (error) console.log(`  ✗ venta ${p.sku}: ${error.message}`);
    else okVentas++;
  }
  console.log(`  ✓ ${okVentas} ventas`);

  // ---- Pagos de intereses recientes (sobre préstamos activos) ----
  const { data: prestamosActivos } = await sb
    .from("prestamos")
    .select("id,monto_prestado,tasa_interes_mensual")
    .eq("estado", "activo")
    .limit(4);
  let okPagos = 0;
  for (let i = 0; i < (prestamosActivos?.length ?? 0); i++) {
    const pr = prestamosActivos[i];
    const interes = Math.round(pr.monto_prestado * pr.tasa_interes_mensual);
    const { data: codigo } = await sb.rpc("generar_codigo_pago");
    const { error } = await sb.from("pagos").insert({
      codigo,
      prestamo_id: pr.id,
      direccion: "ingreso",
      tipo: "interes",
      monto: interes,
      metodo: "efectivo",
      fecha: isoDate(addDays(HOY, -i)),
    });
    if (error) console.log(`  ✗ pago ${i}: ${error.message}`);
    else okPagos++;
  }
  console.log(`  ✓ ${okPagos} pagos de intereses`);
}

// ============================================================
// Run
// ============================================================
async function main() {
  const has012 = await detectMigracion012();
  if (!has012) {
    instruccionesMigracion012();
    console.log("   (continuamos con seed sin pin_length — default 4 en la UI)\n");
  } else {
    console.log("✓ Migración 012 detectada (pin_length presente)");
  }
  await seedUsers(has012);
  await seedTransacciones();
  console.log("\n✨ Listo — el cliente ya puede entrar al sistema con cualquiera de los PINs:\n");
  for (const u of DEMO_USERS) {
    console.log(`   ${u.nombre.padEnd(20)} → PIN ${u.pin}`);
  }
  if (!has012) {
    console.log("\n⚠  Recuerda aplicar la migración 012 antes de usar el lockscreen:");
    console.log("    Supabase Dashboard → SQL Editor → pegar 012_pin_login.sql → Run");
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n💥 Error fatal:", err);
  process.exit(1);
});
