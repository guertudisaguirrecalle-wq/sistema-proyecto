-- ============================================================
-- COUTURE BYTE MARKET — FUNCIÓN PARA CREAR PEDIDOS DE FORMA SEGURA
-- ============================================================
-- Esta función hace TODO el proceso de compra en una sola transacción:
-- 1) Verifica que haya stock suficiente para cada talla (bloqueando la fila
--    para que dos clientas no compren al mismo tiempo la última unidad).
-- 2) Registra a la clienta como cliente.
-- 3) Crea el pedido.
-- 4) Crea el detalle del pedido (productos, tallas, cantidades, precios).
-- 5) Descuenta el stock de producto_tallas.
-- 6) Calcula y guarda el total.
-- NOTA: esta es la versión básica. El archivo 14 la reemplaza por una más completa
-- (validaciones, envío, tienda cerrada). No vuelvas a correr este archivo después del 14.
--
-- Si algo falla (ej: stock insuficiente), TODO se cancela automáticamente
-- y no queda ningún registro a medias (ni cliente, ni pedido huérfano).

create or replace function crear_pedido(
  p_nombre text,
  p_telefono text,
  p_correo text,
  p_items jsonb -- [{"producto_id": "...", "talla": "M", "cantidad": 2}, ...]
)
returns table(pedido_id uuid, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_pedido_id uuid;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_stock int;
  v_precio numeric(10,2);
  v_activo boolean;
  v_subtotal numeric(10,2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;

  -- Paso 1: validar stock de todas las tallas ANTES de registrar nada
  for v_item in select * from jsonb_array_elements(p_items) loop
    select pt.stock, p.activo into v_stock, v_activo
      from producto_tallas pt
      join productos p on p.id = pt.producto_id
      where pt.producto_id = (v_item->>'producto_id')::uuid
        and pt.talla = v_item->>'talla'
      for update of pt;

    if v_stock is null then
      raise exception 'TALLA_NO_ENCONTRADA:%', v_item->>'talla';
    end if;

    if v_activo is false then
      raise exception 'PRODUCTO_NO_DISPONIBLE';
    end if;

    if v_stock < (v_item->>'cantidad')::int then
      raise exception 'STOCK_INSUFICIENTE:%:%', v_item->>'talla', v_stock;
    end if;
  end loop;

  -- Paso 2: registrar cliente
  insert into clientes(nombre_completo, telefono, correo)
    values (p_nombre, p_telefono, p_correo)
    returning id into v_cliente_id;

  -- Paso 3: crear pedido (total provisional 0)
  insert into pedidos(cliente_id, total, estado)
    values (v_cliente_id, 0, 'pendiente')
    returning id into v_pedido_id;

  -- Paso 4 y 5: detalle + descuento de stock
  for v_item in select * from jsonb_array_elements(p_items) loop
    select precio into v_precio from productos where id = (v_item->>'producto_id')::uuid;
    v_subtotal := v_precio * (v_item->>'cantidad')::int;
    v_total := v_total + v_subtotal;

    insert into detalle_pedidos(pedido_id, producto_id, talla, cantidad, precio_unitario, subtotal)
      values (
        v_pedido_id,
        (v_item->>'producto_id')::uuid,
        v_item->>'talla',
        (v_item->>'cantidad')::int,
        v_precio,
        v_subtotal
      );

    update producto_tallas
      set stock = stock - (v_item->>'cantidad')::int
      where producto_id = (v_item->>'producto_id')::uuid
        and talla = v_item->>'talla';
  end loop;

  -- Paso 6: total final
  update pedidos set total = v_total where id = v_pedido_id;

  return query select v_pedido_id, v_total;
end;
$$;

-- Permitir que clientas anónimas (la tienda pública) puedan ejecutar la función.
-- La función es "security definer" así que puede escribir en las tablas aunque
-- las políticas RLS de las tablas no permitan INSERT directo a un visitante.
grant execute on function crear_pedido(text, text, text, jsonb) to anon, authenticated;
