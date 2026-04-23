#!/usr/bin/env node
/**
 * Aplica la migración 008_usuarios.sql al Supabase del proyecto.
 *
 * Uso: DATABASE_URL=... node scripts/apply-008.mjs
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
  console.error('❌ Falta DATABASE_URL.');
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
    join(ROOT, "supabase/migrations/008_usuarios.sql"),
    "utf8",
  );

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("▶ 008_usuarios.sql");
    const started = Date.now();
    await client.query(sql);
    console.log(`✅ aplicada en ${Date.now() - started}ms`);

    // Verificación: que el admin quedó bien seteado
    const { rows } = await client.query(
      `select email, es_admin, modulos_permitidos, activo
       from public.app_users
       order by es_admin desc, email`,
    );
    console.log("\n📋 app_users:");
    console.table(
      rows.map((r) => ({
        email: r.email,
        es_admin: r.es_admin,
        modulos: `(${(r.modulos_permitidos ?? []).length}) ${(r.modulos_permitidos ?? []).slice(0, 3).join(",")}${(r.modulos_permitidos ?? []).length > 3 ? "..." : ""}`,
        activo: r.activo,
      })),
    );

    // Si el admin no matcheó ningún email (porque elviocreations no está
    // todavía en app_users), avisamos.
    const admins = rows.filter((r) => r.es_admin);
    if (admins.length === 0) {
      console.log(
        "\n⚠️  Nadie quedó como admin todavía — probablemente elviocreations@gmail.com aún no existe en app_users.",
      );
      console.log(
        "   Cuando hagas login con ese email, o crees la fila manualmente, se le debe marcar es_admin=true.",
      );
    } else {
      console.log(
        `\n🎉 Admin confirmado: ${admins.map((r) => r.email).join(", ")}`,
      );
    }
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
