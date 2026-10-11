-- ============================================================
-- COUTURE BYTE MARKET — REFUERZO DE SEGURIDAD (pedidos)
-- ============================================================
-- Qué hace:
--   1. Quita al público (visitantes de la tienda) el permiso de usar
--      "actualizar_estado_pedido". Esa función cambia el estado de un
--      pedido y mueve el stock, así que SOLO la administradora debe
--      poder llamarla. El panel no se ve afectado.
--   2. Borra "cancelar_parcial_pedido" si existía de una versión
--      anterior: la opción "Cancelar prendas" ya no existe en el panel
--      y no tiene sentido dejar esa función disponible.
--
-- Es seguro ejecutarlo varias veces. Ejecútalo después del 09.

revoke execute on function actualizar_estado_pedido(uuid, text) from public, anon;
grant execute on function actualizar_estado_pedido(uuid, text) to authenticated;

drop function if exists cancelar_parcial_pedido(uuid, integer);
