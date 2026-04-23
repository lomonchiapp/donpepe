#!/bin/bash
# Aplica la migración 008_usuarios.sql al Supabase del proyecto.
# Doble-click este archivo desde Finder — listo.
# BORRA ESTE ARCHIVO cuando termine (tiene el password embebido).

set -e
cd "$(dirname "$0")/.."

# Password URL-encodeado (Pepe2026!!! → Pepe2026%21%21%21)
export DATABASE_URL='postgresql://postgres.yczhvxjjwtyyhsjftler:Pepe2026%21%21%21@aws-1-us-east-2.pooler.supabase.com:6543/postgres'

echo ""
echo "=========================================="
echo " Don Pepe — aplicando migración 008"
echo "=========================================="
echo ""

node scripts/apply-008.mjs

status=$?
echo ""
if [ $status -eq 0 ]; then
  echo "✅ TERMINÓ BIEN. Puedes cerrar esta ventana."
  echo "⚠️  Borra este archivo (apply-008.command) — tiene el password."
else
  echo "❌ Algo falló. Mira el error arriba."
fi
echo ""
read -p "Presiona Enter para cerrar…"
