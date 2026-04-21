-- Row Level Security para Don Pepe
-- Single-tenant: cualquier usuario autenticado con fila en app_users puede acceder.
-- El rol 'dueno' tiene permisos adicionales (eliminar, modificar config).

alter table public.app_users enable row level security;
alter table public.config_negocio enable row level security;
alter table public.clientes enable row level security;
alter table public.articulos enable row level security;
alter table public.prestamos enable row level security;
alter table public.pagos enable row level security;
alter table public.precios_oro enable row level security;
alter table public.compras_oro enable row level security;
alter table public.ventas enable row level security;
alter table public.notificaciones enable row level security;

-- Helper: usuario activo vinculado al auth actual
create or replace function public.current_app_user()
returns public.app_users
language sql stable security definer set search_path = public as $$
  select * from public.app_users
  where auth_user_id = auth.uid() and activo = true
  limit 1;
$$;

create or replace function public.es_dueno()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.app_users
    where auth_user_id = auth.uid() and activo = true and rol = 'dueno'
  );
$$;

create or replace function public.es_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.app_users
    where auth_user_id = auth.uid() and activo = true
  );
$$;

-- app_users: cada quien ve su propia fila; dueño ve todos
drop policy if exists app_users_self_select on public.app_users;
create policy app_users_self_select on public.app_users for select
  using (auth_user_id = auth.uid() or public.es_dueno());

drop policy if exists app_users_dueno_all on public.app_users;
create policy app_users_dueno_all on public.app_users for all
  using (public.es_dueno()) with check (public.es_dueno());

-- config_negocio: staff lee, dueño modifica
drop policy if exists config_select on public.config_negocio;
create policy config_select on public.config_negocio for select
  using (public.es_staff());

drop policy if exists config_write on public.config_negocio;
create policy config_write on public.config_negocio for all
  using (public.es_dueno()) with check (public.es_dueno());

-- Tablas operativas: cualquier staff autenticado tiene acceso total
do $$
declare t text;
begin
  for t in select unnest(array[
    'clientes','articulos','prestamos','pagos',
    'precios_oro','compras_oro','ventas','notificaciones'
  ]) loop
    execute format(
      'drop policy if exists %1$s_staff_all on public.%1$s;
       create policy %1$s_staff_all on public.%1$s for all
         using (public.es_staff()) with check (public.es_staff());',
      t
    );
  end loop;
end $$;

-- Storage buckets (ejecutar en Supabase Storage):
-- - bucket: cedulas (privado)
-- - bucket: articulos (privado)
-- - bucket: logos (público)
-- Policies aplicadas vía dashboard o via supabase storage commands.
