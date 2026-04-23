-- ============================================================
-- 008 · Gestión de usuarios por permisos (módulos) + admin flag
-- ============================================================
-- Agrega al modelo existente:
--   * es_admin        → super-admin inmutable por email (seed de elviocreations@gmail.com)
--   * modulos_permitidos → text[] de códigos de módulo accesibles
-- Actualiza helpers SQL para que las policies existentes sigan funcionando:
--   * es_dueno() → true si rol='dueno' O es_admin=true
--   * es_admin_actual() → nuevo, estricto por es_admin
--   * tiene_acceso_modulo(text) → admin bypass, o chequea modulos_permitidos
--
-- Idempotente: se puede correr múltiples veces sin romper.
-- ============================================================

-- 1) Columnas nuevas en app_users
alter table public.app_users
  add column if not exists es_admin boolean not null default false;

alter table public.app_users
  add column if not exists modulos_permitidos text[] not null default '{}'::text[];

-- 2) Seed del admin inicial — elviocreations@gmail.com queda como admin
--    con TODOS los módulos. Si la fila no existe todavía (porque auth aún no
--    creó el user), esto no hace nada; se setea al crear la fila.
update public.app_users
set es_admin = true,
    modulos_permitidos = array[
      'inicio','empenos','clientes',
      'oro_precios','oro_compra',
      'joyeria',
      'inventario','ventas',
      'pagos','recibos','facturas',
      'reportes','config'
    ],
    updated_at = now()
where lower(email) = 'elviocreations@gmail.com';

-- 3) Helper nuevo: es_admin_actual() — chequea estrictamente es_admin
create or replace function public.es_admin_actual()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.app_users
    where auth_user_id = auth.uid()
      and activo = true
      and es_admin = true
  );
$$;

-- 4) Redefinir es_dueno() para que incluya es_admin.
--    Las policies existentes que usan es_dueno() ahora también se aplican a admins,
--    que es justo lo que queremos (el admin puede todo lo que el dueño).
create or replace function public.es_dueno()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.app_users
    where auth_user_id = auth.uid()
      and activo = true
      and (rol = 'dueno' or es_admin = true)
  );
$$;

-- 5) Helper: tiene_acceso_modulo(modulo text)
--    Admin bypass → true. Si no es admin, chequea si el código está en
--    modulos_permitidos.
create or replace function public.tiene_acceso_modulo(modulo text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.app_users
    where auth_user_id = auth.uid()
      and activo = true
      and (
        es_admin = true
        or modulo = any(modulos_permitidos)
      )
  );
$$;

-- 6) Policy adicional: los admins pueden hacer TODO sobre app_users
--    (la policy app_users_dueno_all ya lo cubre porque es_dueno() ahora incluye
--    admins, pero la dejamos explícita para claridad).
drop policy if exists app_users_admin_all on public.app_users;
create policy app_users_admin_all on public.app_users for all
  using (public.es_admin_actual())
  with check (public.es_admin_actual());

-- 7) Índice para lookups por modulos_permitidos (GIN para array contains)
create index if not exists idx_app_users_modulos
  on public.app_users using gin (modulos_permitidos);

-- 8) Trigger para mantener updated_at
create or replace function public.touch_app_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_touch on public.app_users;
create trigger trg_app_users_touch
  before update on public.app_users
  for each row execute function public.touch_app_users_updated_at();

-- ============================================================
-- Notas de diseño:
--   * No se toca el enum user_rol ni la columna rol — existe por compat.
--     Nuevos usuarios se crean con rol='empleado' + modulos_permitidos[].
--     El admin es quien marca es_admin=true, nunca la UI lo expone
--     (salvo para el seed de elviocreations@gmail.com, que es inmutable
--     desde las server actions).
--   * El super-admin (elviocreations@gmail.com) queda protegido en el código:
--     lib/permisos/check.ts lanza error si se intenta quitar es_admin a ese
--     email.
-- ============================================================
