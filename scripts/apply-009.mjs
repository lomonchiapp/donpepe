#!/usr/bin/env node
/**
 * Aplica la migración 009_contabilidad.sql al Supabase del proyecto.
 *
 * Uso: DATABASE_URL=... node scripts/apply-009.mjs
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
    join(ROOT, "supabase/migrations/009_contabilidad.sql"),
    "utf8",
  );

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("▶ 009_contabilidad.sql");
    const started = Date.now();
    await client.query(sql);
    console.log(`✅ aplicada en ${Date.now() - started}ms`);

    // Verificación: columnas nuevas en clientes
    const { rows: cols } = await client.query(
      `select column_name
         from information_schema.columns
        where table_schema='public' and table_name='clientes'
          and column_name in ('edad','color','nacionalidad','estado_civil','oficio_profesion')
        order by column_name`,
    );
    console.log("\n📋 Columnas nuevas en clientes:");
    console.table(cols);

    // Verificación: tabla reportes_dgii_generados
    const { rows: tabs } = await client.query(
      `select table_name
         from information_schema.tables
        where table_schema='public' and table_name='reportes_dgii_generados'`,
    );
    if (tabs.length > 0) {
      console.log("✅ Tabla reportes_dgii_generados creada.");
    } else {
      console.log("⚠️  reportes_dgii_generados NO fue creada — revisa.");
    }

    // Verificación: vista v_libro_compraventa
    const { rows: views } = await client.query(
      `select table_name
         from information_schema.views
        where table_schema='public' and table_name='v_libro_compraventa'`,
    );
    if (views.length > 0) {
      console.log("✅ Vista v_libro_compraventa creada.");
    } else {
      console.log("⚠️  v_libro_compraventa NO fue creada — revisa.");
    }

    console.log(
      "\n🎉 Migración 009 completa. Ya puedes usar /contabilidad desde la app.",
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
