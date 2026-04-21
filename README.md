# Don Pepe

Sistema de compraventa dominicana: préstamos prendarios (empeño), compra y venta de oro, y gestión de inventario.

Diseñado **mobile-first** para dueños de compraventas que no son muy tecnológicos. Wizard guiado de 3 pasos para crear un empeño, cálculo automático de intereses, alertas WhatsApp al dueño, e inventario automático cuando los artículos pasan a propiedad de la casa.

## Stack

- **Next.js 16** (App Router · Turbopack · Server Actions)
- **React 19.2** con Motion para animaciones
- **Tailwind v4** + **shadcn/ui** (estilo base-nova)
- **Supabase** (Postgres · Auth · Storage · RLS)
- **WhatsApp Cloud API** (Meta) — alertas al dueño
- **Vercel** — hosting + Cron Jobs
- **Tests**: `node:test` + `tsx` (sin Vitest)

## Primera vez

```bash
cp .env.local.example .env.local
# Edita .env.local con las credenciales de Supabase y WhatsApp

npm install
npm run dev         # arranca en http://localhost:3000

# Ejecutar las migraciones en Supabase (Dashboard → SQL Editor):
#   supabase/migrations/001_schema.sql
#   supabase/migrations/002_rls.sql
#   supabase/migrations/003_seed.sql   (solo dev)
```

## Scripts

| Comando             | Descripción                                   |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server con Turbopack                      |
| `npm run build`     | Build de producción                           |
| `npm run test`      | Tests unitarios (cédula, intereses, oro)      |
| `npm run typecheck` | Verifica tipos TypeScript                     |
| `npm run lint`      | ESLint                                        |

## Estructura

```
app/
  (auth)/login/         Login con magic link
  (app)/                Rutas protegidas con layout + sidebar/bottom nav
    empenos/            Lista · wizard · detalle · pagos
    clientes/
    oro/                Precios del día + compra directa
    inventario/         Artículos propiedad de la casa
    ventas/
    alertas/            Vencimientos y contacto WhatsApp del cliente
    reportes/
    config/
  api/
    cron/vencimientos   Cron diario
    webhooks/whatsapp   Verificación + eventos Meta
  print/recibo/[id]     Vista imprimible del ticket
components/
  empeno/ cliente/ oro/ ventas/ layout/ motion/ ui/
lib/
  calc/                 Intereses y tasación de oro
  validaciones/         Cédula JCE
  supabase/             Clientes server / browser
  whatsapp/             Envío por plantillas HSM
  format/               DOP, fechas es-DO
supabase/migrations/    SQL: schema · RLS · seed
tests/unit/             Tests puros
```

## Lógica de negocio dominicana (referencia)

- **Préstamo**: 50-70% del valor tasado (configurable en `/config`).
- **Interés**: 10-15% mensual típico. Se cobra al renovar o saldar.
- **Plazo**: 3-6 meses. Renovable.
- **Vencimiento**: al no pagar ni renovar, el artículo pasa a `vencido_a_cobro` y luego (tras días de gracia) a `propiedad_casa` y aparece en inventario.
- **Oro**: se tasa por kilataje (10/14/18/22/24K) × peso × precio DOP/gramo del día.
- **Marco legal**: Ley 387 de 1932.

## Producción (Vercel)

- El cron `/api/cron/vencimientos` corre todos los días a las 12:00 UTC (8 AM RD) — ver `vercel.json`.
- WhatsApp requiere plantillas HSM aprobadas (Meta Business Manager):
  - `don_pepe_resumen_diario`
  - `don_pepe_vencimiento_hoy`
  - `don_pepe_articulos_propiedad`
- Para que el dueño reciba alertas debe tener `recibir_alertas = true` y `telefono_whatsapp` en la tabla `app_users`.

## Identidad visual

Paleta "cálida dominicana + dorado" (OKLCH en `app/globals.css`):

- Primary (vino): `#7C1D1D`
- Accent (oro): `#D4AF37`
- Secondary (crema): `#F5E6C8`
- Dark (café oscuro): `#1A0F0A`
- Success (verde): `#2D6A4F`
- Danger (rojo bandera): `#C1272D`
# donpepe
