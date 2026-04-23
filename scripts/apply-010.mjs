#!/usr/bin/env node
/**
 * Aplica la migración 010_spot_gastos_inventario.sql al Supabase del proyecto.
 *
 * Uso: DATABASE_URL=... node scripts/apply-010.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL.");
  process.exit(1);
}

let Client;
try {
  ({ Client } = await import("pg"));
} catch {
  console.log("📦 Instalando pg temporalmente…");
  execSync("npm install --no-save --prefix . pg@8", {
    stdio: "inherit",
    cwd: ROOT,
  });
  const require = createRequire(import.meta.url);
  Client = require(join(ROOT, "node_modules/pg")).Client;
}

async function main() {
  const sql = await readFile(
    join(ROOT, "supabase/migrations/010_spot_gastos_inventario.sql"),
    "utf8",
  );

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("▶ 010_spot_gastos_inventario.sql");
    const started = Date.now();
    await client.query(sql);
    console.log(`✅ aplicada en ${Date.now() - started}ms`);

    // Verificación: tabla spot_metales_diario
    const { rows: spotTab } = await client.query(
      `select table_name from information_schema.tables
        where table_schema='public' and table_name='spot_metales_diario'`,
    );
    console.log(
      spotTab.length > 0
        ? "✅ spot_metales_diario creada."
        : "⚠️  spot_metales_diario NO fue creada — revisa.",
    );

    // Verificación: tabla gastos_operativos
    const { rows: gastosTab } = await client.query(
      `select table_name from information_schema.tables
        where table_schema='public' and table_name='gastos_operativos'`,
    );
    console.log(
      gastosTab.length > 0
        ? "✅ gastos_operativos creada."
        : "⚠️  gastos_operativos NO fue creada — revisa.",
    );

    // Verificación: columna oro_disponible en compras_oro
    const { rows: col } = await client.query(
      `select column_name, data_type from information_schema.columns
        where table_schema='public' and table_name='compras_oro'
          and column_name='oro_disponible'`,
    );
    if (col.length > 0) {
      console.log("✅ Columna compras_oro.oro_disponible agregada.");
    } else {
      console.log("⚠️  compras_oro.oro_disponible NO fue agregada — revisa.");
    }

    // Verificación: vista v_libro_compraventa con nuevas columnas
    const { rows: viewCols } = await client.query(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name='v_libro_compraventa'
          and column_name in ('registro_id','origen','categoria','disponible','ncf')
        order by column_name`,
    );
    console.log(
      `✅ Vista v_libro_compraventa con ${viewCols.length}/5 columnas nuevas.`,
    );

    // Verificación: trigger tg_marcar_compra_oro_procesada
    const { rows: trig } = await client.query(
      `select tgname from pg_trigger
        where tgname='trg_marcar_compra_oro_procesada'`,
    );
    console.log(
      trig.length > 0
        ? "✅ Trigger trg_marcar_compra_oro_procesada instalado."
        : "⚠️  Trigger NO instalado — revisa.",
    );

    console.log(
      "\n🎉 Migración 010 completa. Ahora:",
      "\n   1. En Vercel → Settings → Environment Variables, agrega METALPRICE_API_KEY",
      "\n      (consigue una gratis en https://metalpriceapi.com)",
      "\n   2. Haz deploy — el cron /api/cron/spot-metales correrá a las 9:00 AM RD.",
      "\n   3. Mientras tanto, /contabilidad/gastos ya funciona para registrar gastos del negocio.",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Falló:", err.message);
  if (err.position) console.error("   posición SQL:", err.position);
  if (err.detail) console.error("   detalle:", err.detail);
  if (err.hint) console.error("   hint:", err.hint);
  process.exit(1);
});
