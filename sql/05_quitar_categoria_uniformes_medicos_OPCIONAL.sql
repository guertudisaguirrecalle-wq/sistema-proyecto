-- ============================================================
-- COUTURE BYTE MARKET — QUITAR LA CATEGORÍA DE EJEMPLO "UNIFORMES MÉDICOS"
-- ============================================================
-- Solo necesitas correr esto SI ya habías ejecutado antes el archivo
-- "05_categoria_uniformes_medicos.sql" en tu Supabase. Si nunca lo
-- ejecutaste, ignora este archivo — no tienes nada que borrar.
--
-- Esto elimina los 4 productos de ejemplo de esa categoría (y su stock)
-- y luego la categoría en sí. No afecta ninguna otra categoría ni
-- producto tuyo.

do $$
declare
  cat_id int;
begin
  select id into cat_id from categorias where slug = 'uniformes-medicos';

  if cat_id is not null then
    delete from producto_tallas where producto_id in (select id from productos where categoria_id = cat_id);
    delete from productos where categoria_id = cat_id;
    delete from categorias where id = cat_id;
  end if;
end $$;
