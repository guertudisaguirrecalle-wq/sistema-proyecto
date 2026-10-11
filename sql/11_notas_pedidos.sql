-- ============================================================
-- COUTURE BYTE MARKET — NOTA INTERNA EN CADA PEDIDO (panel admin)
-- ============================================================
-- Agrega (si todavía no existe) la columna donde el admin escribe una
-- nota del pedido, por ejemplo: "canceló la mitad del pedido".
-- Solo la ve el admin: la tabla "pedidos" ya está protegida por RLS
-- (ver 03_seguridad_rls.sql), así que no hace falta una política nueva.
-- Es seguro ejecutarlo varias veces.

alter table pedidos add column if not exists notas_internas text default '';
