-- ============================================================
-- 012 · PIN Login (lockscreen estilo iOS)
-- ============================================================
-- Sistema interno con máximo ~6 usuarios. En lugar del login con email +
-- password, la pantalla de login muestra un grid de avatares y un keypad
-- numérico. El PIN se usa como password de Supabase Auth (cada usuario
-- tiene su email solo para reportes; no lo escribe al loguearse).
--
-- Cambios en este archivo:
--   * `app_users.avatar_url`   — URL pública opcional (Storage bucket o
--                                emoji codificado, etc.).
--   * `app_users.pin_length`   — 4-8, default 4. Define cuántos dígitos
--                                pide el keypad para ese usuario.
--
-- RPCs públicos (callable sin sesión):
--   * `lockscreen_users()`     → lista de usuarios activos visibles en la
--                                pantalla de bloqueo, sin secrets.
--   * `email_for_app_user()`   → mapea id → email para el signInWithPassword.
--
-- Idempotente.
-- ============================================================

-- 1) Columnas nuevas
alter table public.app_users
  add column if not exists avatar_url text;

-- pin_length default 6 — alineado con el mínimo de Supabase Auth.
-- Cualquier valor < 6 sería rechazado por auth, así que el constraint
-- también empieza en 6.
alter table public.app_users
  add column if not exists pin_length int not null default 6
    check (pin_length between 6 and 8);

-- 2) RPC: lockscreen_users()
--
-- Retorna las filas activas de `app_users` necesarias para renderizar el
-- lockscreen. NO retorna `auth_user_id`, `created_at`, `updated_at` ni
-- `modulos_permitidos` (esto último por privacidad — el contable no debe
-- ver los módulos del dueño en una pantalla pública).
--
-- El campo `rol_display` es derivado:
--   admin    → 'Admin'
--   dueno    → 'Dueño'
--   contabilidad ∈ módulos → 'Contador'
--   resto    → 'Empleado'
create or replace function public.lockscreen_users()
returns table (
  id          uuid,
  nombre      text,
  email       text,
  avatar_url  text,
  es_admin    boolean,
  rol_display text,
  pin_length  int
)
language sql stable security definer set search_path = public as $$
  select
    u.id,
    u.nombre,
    u.email,
    u.avatar_url,
    u.es_admin,
    case
      when u.es_admin then 'Admin'
      when u.rol = 'dueno' then 'Dueño'
      when 'contabilidad' = any(u.modulos_permitidos) then 'Contador'
      else 'Empleado'
    end as rol_display,
    u.pin_length
  from public.app_users u
  where u.activo = true
  order by
    u.es_admin desc,
    case u.rol when 'dueno' then 0 else 1 end,
    u.nombre asc;
$$;

revoke all on function public.lockscreen_users() from public;
grant execute on function public.lockscreen_users() to anon, authenticated;

-- 3) RPC: email_for_app_user(uuid)
--
-- Dado el id de la fila `app_users`, retorna el email correspondiente.
-- Esto permite hacer signInWithPassword(email, pin) en el cliente sin
-- que el lockscreen tenga que escribir el email.
--
-- Devuelve null si el usuario no existe o está inactivo.
create or replace function public.email_for_app_user(p_user_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select email
    from public.app_users
   where id = p_user_id
     and activo = true;
$$;

revoke all on function public.email_for_app_user(uuid) from public;
grant execute on function public.email_for_app_user(uuid) to anon, authenticated;

-- pin_length default 6 ya cubre a todos los usuarios; no hace falta seed.
