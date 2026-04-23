-- ============================================================
-- 006 — Hacer `articulos.valor_tasado` opcional
-- ============================================================
--
-- Motivación: el dueño ya no quiere guardar el "valor tasado" al momento
-- del empeño. Guardar esa cifra puede volverse perjudicial con el tiempo
-- (disputas sobre precio, liability si el artículo se vende más barato
-- después, etc.). El flujo nuevo captura solo `monto_prestado`.
--
-- Cambios:
--   1. `valor_tasado` pasa de `NOT NULL` a permitir NULL.
--   2. El CHECK original (`valor_tasado > 0`) se reemplaza por uno que
--      permita NULL pero siga prohibiendo cero/negativos cuando haya
--      valor (para no romper los artículos legados).
--
-- Registros existentes quedan como están (mantienen su valor histórico).
-- Los artículos nuevos se insertan con `valor_tasado = NULL`.
-- ============================================================

alter table public.articulos
  alter column valor_tasado drop not null;

-- Si existe el CHECK original, lo removemos y volvemos a poner uno que
-- tolere NULL. El nombre del constraint puede variar según cómo Postgres
-- lo haya auto-nombrado; lo buscamos dinámicamente.
do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'articulos'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%valor_tasado%>%0%'
  loop
    execute format('alter table public.articulos drop constraint %I', cname);
  end loop;
end $$;

alter table public.articulos
  add constraint articulos_valor_tasado_positivo
  check (valor_tasado is null or valor_tasado > 0);
