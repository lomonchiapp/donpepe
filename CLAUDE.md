# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos

| Comando             | Uso                                                         |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Dev server (Turbopack, `http://localhost:3000`)             |
| `npm run build`     | Build producción                                            |
| `npm run typecheck` | `tsc --noEmit` — ejecutar antes de dar una tarea por hecha  |
| `npm run lint`      | ESLint (config `eslint-config-next`)                        |
| `npm run test`      | Todos los tests unitarios                                   |

Para un test suelto: `node --import tsx --test tests/unit/intereses.test.ts`.
El runner es **`node:test` + `tsx`**, no Vitest ni Jest — usar `test()` y `assert` de `node:test`/`node:assert/strict`.

## Gotchas de Next.js 16 presentes en este repo

- **`middleware.ts` se llama `proxy.ts`** en la raíz. Su función exportada es `proxy` (no `middleware`). Refresca sesión de Supabase y protege rutas.
- **`cookies()` es `async`** — ver `lib/supabase/server.ts`. Siempre `await cookies()` antes de leer.
- Antes de escribir código nuevo, consultar `node_modules/next/dist/docs/` si hay duda sobre una API, porque APIs clásicas pueden haber cambiado.

## Arquitectura

### Grupos de rutas
- `app/(auth)/login` — acceso público; magic link de Supabase; callback en `app/auth/callback`.
- `app/(app)/*` — protegido. `app/(app)/layout.tsx` vuelve a verificar sesión con `supabase.auth.getUser()` y redirige a `/login` si no hay usuario (además del chequeo en `proxy.ts`).
- `app/api/cron/vencimientos` y `app/api/webhooks/whatsapp` — **públicas** según `proxy.ts`. El cron se autentica con `CRON_SECRET` (header `Authorization: Bearer …` o `?secret=`).
- `app/print/recibo/[id]` — vista imprimible del ticket, sin chrome de la app.

### Capa Supabase
Dos clientes distintos, ambos en `lib/supabase/`:
- `createClient()` (server.ts) — cookies-aware para Server Components, Server Actions y Route Handlers con sesión del usuario. Respeta RLS.
- `createServiceClient()` (server.ts) — **service role**, sin cookies, solo para Route Handlers (p. ej. el cron). Bypassea RLS — **nunca exponer al cliente**.
- `createClient()` (client.ts) — browser, anon key.

Los **tipos de la base de datos** en `lib/supabase/types.ts` se mantienen **a mano** (no están regenerados con `supabase gen types`). El cliente se crea sin genérico y cada llamada hace cast explícito (`data as Prestamo`, etc.). Si se cambia el schema SQL, actualizar también `types.ts`.

RLS está activo en todas las tablas (`supabase/migrations/002_rls.sql`): helpers SQL `current_app_user()`, `es_dueno()`, `es_staff()` gatillan las policies. Single-tenant: cualquier usuario con fila en `app_users` ve los datos; el rol `dueno` tiene permisos extra.

### Server Actions — contrato
Las actions en `app/(app)/*/actions.ts` (p. ej. `empenos/actions.ts`, `oro/actions.ts`, `ventas/actions.ts`, `config/actions.ts`, `clientes/actions.ts`):
- Validan con **Zod** (`z.coerce.number()`, `z.uuid()`, etc.).
- Devuelven `{ error: string }` en fallo o `{ ok: true }` / `redirect()` en éxito. El caller decide cómo mostrar el error.
- Llaman `revalidatePath()` de las rutas afectadas antes de retornar.

### Dominio de negocio

**Máquina de estados de un préstamo** (ver `lib/supabase/types.ts` `EstadoPrestamo`):
```
activo ──(vence hoy, cron)──► vencido_a_cobro ──(+ dias_gracia_vencimiento)──► propiedad_casa
  │                                                                               │
  └─ pagado (tipo=saldo_total) / renovado ─► nueva fecha_vencimiento              └─ artículo pasa a estado 'vencido_propio' (inventario)
```

El cron `app/api/cron/vencimientos/route.ts` es quien ejecuta esas transiciones diariamente. Además envía el WhatsApp de **resumen diario** al dueño y registra cada envío en `notificaciones`. `dias_gracia_vencimiento` vive en `config_negocio`.

**Cálculos** (todos puros, en `lib/calc/`):
- `intereses.ts` — interés simple mensual acumulativo prorrateado por días (mes = 30d). `calcularDeuda`, `calcularFechaVencimiento` (suma meses calendario), `diasHastaVencimiento`, `semaforoVencimiento`, `sugerirMontoPrestamo`. **Fechas `YYYY-MM-DD` se parsean como local**, no UTC, para evitar saltos por zona (RD = UTC-4).
- `oro.ts` — tasación por kilataje (10/14/18/22/24K) y derivación de tabla de precios a partir del spot 24K.

**WhatsApp** (`lib/whatsapp/`):
- `send.ts` usa Meta Cloud API v22. Solo envía **plantillas HSM** pre-aprobadas (nombres en `templates.ts`: `don_pepe_resumen_diario`, `don_pepe_vencimiento_hoy`, `don_pepe_articulos_propiedad`). Lenguaje `es_MX`.
- Teléfonos se normalizan a E.164 dominicano (prefijo `1` si el número tiene 10 dígitos).
- Requiere `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.

**Validación de cédula** dominicana en `lib/validaciones/cedula-do.ts` (Luhn modificado con pesos [1, 2]).

### UI

- Tailwind v4 (`app/globals.css` con variables OKLCH). No hay `tailwind.config.*`.
- shadcn/ui estilo **`base-nova`** (`components.json`). Añadir componentes con el CLI de shadcn apuntando al alias `@/components/ui`.
- `@base-ui/react` + `motion` (no framer-motion) para animaciones. `sonner` para toasts (instancia única en `app/layout.tsx`).
- Mobile-first: en `app/(app)/layout.tsx` coexisten `Sidebar` (md+), `BottomNav` y `Fab` (mobile).

### Variables de entorno esperadas
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.

### Despliegue
- Vercel. El único cron declarado está en `vercel.json` → `/api/cron/vencimientos` a las 12:00 UTC (8 AM RD).
- Migraciones SQL (`supabase/migrations/*.sql`) se corren **manualmente** en el SQL Editor de Supabase (001 schema, 002 RLS, 003 seed solo-dev).
