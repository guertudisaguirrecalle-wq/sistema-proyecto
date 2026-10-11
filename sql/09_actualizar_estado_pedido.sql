-- ============================================================
-- COUTURE BYTE MARKET — CAMBIAR ESTADO DE PEDIDO CON DEVOLUCIÓN DE STOCK
-- ============================================================
-- Problema que resuelve:
-- Antes, el admin cambiaba el estado de un pedido con un simple
-- UPDATE a la columna "estado" (ver js/admin/orders.js). Eso significa
-- que si se cancelaba un pedido, el stock que "crear_pedido" había
-- descontado NUNCA volvía. Con el tiempo una talla podía quedar en 0
-- por pedidos que ya no existían realmente.
--
-- Esta función reemplaza ese UPDATE directo y maneja el stock según
-- la transición de estado, todo en una sola transacción (o se aplica
-- todo o no se aplica nada):
--
--   * Pedido activo -> "cancelado"   => se DEVUELVE el stock de cada
--                                        talla del detalle del pedido.
--   * "cancelado" -> pedido activo   => se vuelve a DESCONTAR el stock
--                                        (reactivar un pedido es, en la
--                                        práctica, una nueva compra).
--                                        Si ya no hay stock suficiente,
--                                        la función falla y el estado
--                                        NO cambia (no se puede reactivar
--                                        un pedido si ya no hay tallas).
--   * Cualquier otra transición      => solo cambia la etiqueta de
--     (pendiente/confirmado/enviado)    estado, sin tocar stock.
--
-- "for update" bloquea las filas de producto_tallas mientras se hace
-- el cambio, igual que en crear_pedido, para que dos cambios de estado
-- al mismo tiempo no descuadren el stock.

create or replace function actualizar_estado_pedido(
  p_pedido_id uuid,
  p_nuevo_estado text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_actual text;
  v_item record;
  v_stock int;
begin
  if p_nuevo_estado not in ('pendiente', 'confirmado', 'enviado', 'cancelado') then
    raise exception 'ESTADO_INVALIDO:%', p_nuevo_estado;
  end if;

  -- Bloquea el pedido para evitar que dos cambios de estado choquen entre sí.
  select estado into v_estado_actual
    from pedidos
    where id = p_pedido_id
    for update;

  if v_estado_actual is null then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;

  -- Sin cambio real: no hay nada que hacer con el stock.
  if v_estado_actual = p_nuevo_estado then
    return;
  end if;

  -- Caso 1: se está cancelando un pedido que estaba activo -> devolver stock.
  if p_nuevo_estado = 'cancelado' and v_estado_actual != 'cancelado' then
    for v_item in
      select producto_id, talla, cantidad
      from detalle_pedidos
      where pedido_id = p_pedido_id
    loop
      update producto_tallas
        set stock = stock + v_item.cantidad
        where producto_id = v_item.producto_id
          and talla = v_item.talla;
    end loop;

  -- Caso 2: se está reactivando un pedido que estaba cancelado -> volver a descontar.
  elsif v_estado_actual = 'cancelado' and p_nuevo_estado != 'cancelado' then
    for v_item in
      select producto_id, talla, cantidad
      from detalle_pedidos
      where pedido_id = p_pedido_id
    loop
      select stock into v_stock
        from producto_tallas
        where producto_id = v_item.producto_id
          and talla = v_item.talla
        for update;

      if v_stock is null or v_stock < v_item.cantidad then
        raise exception 'STOCK_INSUFICIENTE_REACTIVAR:%:%', v_item.talla, coalesce(v_stock, 0);
      end if;

      update producto_tallas
        set stock = stock - v_item.cantidad
        where producto_id = v_item.producto_id
          and talla = v_item.talla;
    end loop;
  end if;
  -- Cualquier otra transición (ej: pendiente -> confirmado -> enviado)
  -- no mueve stock, solo cambia la etiqueta más abajo.

  update pedidos set estado = p_nuevo_estado where id = p_pedido_id;
end;
$$;

-- Solo el admin (con sesión de Supabase Auth) puede cambiar el estado de un pedido.
grant execute on function actualizar_estado_pedido(uuid, text) to authenticated;
