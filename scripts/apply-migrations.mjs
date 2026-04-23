#!/usr/bin/env node
/**
 * Aplica las migraciones 004+005+006+007 al Supabase del proyecto.
 *
 * Uso:
 *   1. Agarra la Connection String "Transaction pooler" (puerto 6543) desde
 *      Supabase → Project Settings → Database → Connection string → URI.
 *      Ya trae el password en la URL.
 *   2. Correrlo:
 *        DATABASE_URL="postgres://postgres.xxxx:PASS@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
 *        node scripts/apply-migrations.mjs
 *
 * El script corre Parte 1 y Parte 2 en transacciones separadas (obligatorio
 * porque Postgres no permite usar un valor de enum recién agregado en la
 * misma transacción que el ALTER TYPE ADD VALUE).
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL. Ejemplo:')
  console.error('   DATABASE_URL="postgres://postgres.xxxx:PASS@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \\')
  console.error('     node scripts/apply-migrations.mjs')
  process.exit(1)
}

// Cargar `pg` aunque no esté en package.json
let Client
try {
  ;({ Client } = await import('pg'))
} catch {
  console.log('📦 Instalando pg temporalmente…')
  execSync('npm install --no-save --prefix . pg@8', { stdio: 'inherit', cwd: ROOT })
  const require = createRequire(import.meta.url)
  Client = require(join(ROOT, 'node_modules/pg')).Client
}

const BUNDLES = [
  { label: 'Parte 1/2 (004 + 005 + 006 + enum ALTERs de 007)', file: 'supabase/migrations/_bundle_parte1.sql' },
  { label: 'Parte 2/2 (resto de 007 — numeracion_series, funciones, seed)', file: 'supabase/migrations/_bundle_004_007.sql' },
]

// Si _bundle_parte2.sql existe, usarlo (es el split correcto). Si no, caer al bundle único.
async function resolveBundles() {
  const { existsSync } = await import('node:fs')
  const parte2 = join(ROOT, 'supabase/migrations/_bundle_parte2.sql')
  if (existsSync(parte2)) {
    return [
      { label: 'Parte 1/2 (004 + 005 + 006 + enum ALTERs de 007)', file: 'supabase/migrations/_bundle_parte1.sql' },
      { label: 'Parte 2/2 (resto de 007)', file: 'supabase/migrations/_bundle_parte2.sql' },
    ]
  }
  return BUNDLES
}

async function runBundle(client, { label, file }) {
  const path = join(ROOT, file)
  const sql = await readFile(path, 'utf8')
  console.log(`\n▶ ${label}`)
  console.log(`   (${file}, ${sql.length.toLocaleString()} chars)`)
  const started = Date.now()
  await client.query(sql)
  console.log(`✅ ${label} — ${Date.now() - started}ms`)
}

async function main() {
  const bundles = await resolveBundles()

  for (const bundle of bundles) {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    try {
      await runBundle(client, bundle)
    } finally {
      await client.end()
    }
  }

  // Verificación rápida
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const { rows } = await client.query(
      'select scope, etiqueta, prefijo, contador, año_actual, activa from public.numeracion_series order by scope'
    )
    console.log('\n📋 numeracion_series:')
    console.table(rows)
  } finally {
    await client.end()
  }

  console.log('\n🎉 Listo. Recarga /config/numeraciones para verlo.')
}

main().catch((err) => {
  console.error('\n❌ Falló:', err.message)
  if (err.position) console.error('   posición SQL:', err.position)
  if (err.detail) console.error('   detalle:', err.detail)
  if (err.hint) console.error('   hint:', err.hint)
  process.exit(1)
})
