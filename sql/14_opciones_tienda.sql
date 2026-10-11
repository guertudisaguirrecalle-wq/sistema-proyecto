-- ============================================================
-- COUTURE BYTE MARKET — OPCIONES DE LA TIENDA (v26)
-- ============================================================
-- Agrega opciones que se prenden y apagan desde Panel → Configuración.
-- TODAS vienen APAGADAS: mientras no las actives, la tienda se comporta igual que antes.
--
--   * Tienda abierta / cerrada (si está cerrada no se aceptan pedidos).
--   * Aviso en la tienda (una franja arriba con tu mensaje).
--   * Horario de atención.
--   * Dirección y mapa propios.
--   * Costo de envío (fijo, y "gratis desde Bs X" si quieres).
--   * "Consultar mi pedido" para las clientas.
--
-- Requiere haber ejecutado antes 01, 02 y 06. Es seguro ejecutarlo varias veces.
-- Este script reemplaza la función crear_pedido por una versión más completa: además valida
-- nombre, teléfono, correo y cantidades, y limita pedidos en cadena (5 por hora por teléfono/correo
-- y 40 cada 10 minutos en toda la tienda).

-- ---------- 1) Columnas nuevas ----------
alter table configuracion add column if not exists tienda_abierta boolean not null default true;
alter table configuracion add column if not exists mensaje_cerrada text;

alter table configuracion add column if not exists aviso_activo boolean not null default false;
alter table configuracion add column if not exists aviso_texto text;

alter table configuracion add column if not exists horario_activo boolean not null default false;
alter table configuracion add column if not exists horario_texto text;

alter table configuracion add column if not exists direccion_activo boolean not null default false;
alter table configuracion add column if not exists direccion_texto text;

alter table configuracion add column if not exists envio_costo_activo boolean not null default false;
alter table configuracion add column if not exists envio_costo numeric(10,2) not null default 0;
alter table configuracion add column if not exists envio_gratis_desde numeric(10,2);

alter table configuracion add column if not exists consulta_pedido_activo boolean not null default false;

-- Límites razonables (por si alguien intenta guardar valores raros)
alter table configuracion drop constraint if exists configuracion_envio_valido;
alter table configuracion add constraint configuracion_envio_valido
  check (envio_costo >= 0 and envio_costo <= 10000
         and (envio_gratis_desde is null or (envio_gratis_desde > 0 and envio_gratis_desde <= 1000000)));

-- Cada pedido guarda el envío que se le cobró (así un cambio de tarifa no altera pedidos viejos).
-- "total" sigue siendo SOLO el valor de las prendas; lo que paga la clienta es total + costo_envio.
alter table pedidos add column if not exists costo_envio numeric(10,2) not null default 0;

-- ---------- 2) Cuánto cuesta el envío de un pedido ----------
create or replace function calcular_envio(p_subtotal numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_activo boolean;
  v_costo numeric;
  v_gratis numeric;
begin
  select envio_costo_activo, envio_costo, envio_gratis_desde
    into v_activo, v_costo, v_gratis
    from configuracion where id = 1;

  if v_activo is not true then return 0; end if;
  if v_gratis is not null and p_subtotal >= v_gratis then return 0; end if;
  return coalesce(v_costo, 0);
end;
$$;
revoke all on function calcular_envio(numeric) from public, anon;

-- ---------- 3) crear_pedido: validaciones + freno anti-spam + tienda cerrada + envío ----------
drop function if exists crear_pedido(text, text, text, jsonb);

create function crear_pedido(
  p_nombre text,
  p_telefono text,
  p_correo text,
  p_items jsonb -- [{"producto_id": "...", "talla": "M", "cantidad": 2}, ...]
)
returns table(pedido_id uuid, total numeric, costo_envio numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_pedido_id uuid;
  v_total numeric(10,2) := 0;
  v_envio numeric(10,2) := 0;
  v_item jsonb;
  v_stock int;
  v_precio numeric(10,2);
  v_activo boolean;
  v_subtotal numeric(10,2);
  v_pedido_cant int;
  v_necesaria int;
  v_tel_digitos text;
  v_recientes int;
  v_abierta boolean;
begin
  -- Tienda cerrada desde el panel: no se aceptan pedidos.
  select c.tienda_abierta into v_abierta from configuracion c where c.id = 1;
  if v_abierta is false then
    raise exception 'TIENDA_CERRADA';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'CARRITO_INVALIDO';
  end if;

  p_nombre   := btrim(coalesce(p_nombre, ''));
  p_telefono := btrim(coalesce(p_telefono, ''));
  p_correo   := btrim(coalesce(p_correo, ''));
  v_tel_digitos := regexp_replace(p_telefono, '\D', '', 'g');

  if char_length(p_nombre) not between 3 and 120
     or char_length(p_correo) not between 5 and 160
     or p_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     or char_length(p_telefono) > 30
     or char_length(v_tel_digitos) not between 7 and 15 then
    raise exception 'DATOS_INVALIDOS';
  end if;

  select count(*) into v_recientes
    from pedidos p
    join clientes c on c.id = p.cliente_id
    where p.created_at > now() - interval '1 hour'
      and p.estado <> 'cancelado'
      and (lower(c.correo) = lower(p_correo)
           or right(regexp_replace(c.telefono, '\D', '', 'g'), 8) = right(v_tel_digitos, 8));
  if v_recientes >= 5 then
    raise exception 'DEMASIADOS_PEDIDOS';
  end if;

  select count(*) into v_recientes
    from pedidos p
    where p.created_at > now() - interval '10 minutes';
  if v_recientes >= 40 then
    raise exception 'DEMASIADOS_PEDIDOS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'producto_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(v_item->>'cantidad', '') !~ '^[0-9]{1,3}$'
       or coalesce(v_item->>'talla', '') = '' then
      raise exception 'CARRITO_INVALIDO';
    end if;
    v_pedido_cant := (v_item->>'cantidad')::int;
    if v_pedido_cant < 1 or v_pedido_cant > 50 then
      raise exception 'CARRITO_INVALIDO';
    end if;

    select pt.stock, pr.activo into v_stock, v_activo
      from producto_tallas pt
      join productos pr on pr.id = pt.producto_id
      where pt.producto_id = (v_item->>'producto_id')::uuid
        and pt.talla = v_item->>'talla'
      for update of pt;

    if v_stock is null then
      raise exception 'TALLA_NO_ENCONTRADA:%', v_item->>'talla';
    end if;

    if v_activo is false then
      raise exception 'PRODUCTO_NO_DISPONIBLE';
    end if;

    select coalesce(sum((x->>'cantidad')::int), 0) into v_necesaria
      from jsonb_array_elements(p_items) x
      where x->>'producto_id' = v_item->>'producto_id'
        and x->>'talla' = v_item->>'talla'
        and coalesce(x->>'cantidad', '') ~ '^[0-9]{1,3}$';

    if v_stock < v_necesaria then
      raise exception 'STOCK_INSUFICIENTE:%:%', v_item->>'talla', v_stock;
    end if;
  end loop;

  insert into clientes(nombre_completo, telefono, correo)
    values (p_nombre, p_telefono, p_correo)
    returning id into v_cliente_id;

  insert into pedidos(cliente_id, total, estado)
    values (v_cliente_id, 0, 'pendiente')
    returning id into v_pedido_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select pr.precio into v_precio from productos pr where pr.id = (v_item->>'producto_id')::uuid;
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

    update producto_tallas pt
      set stock = pt.stock - (v_item->>'cantidad')::int
      where pt.producto_id = (v_item->>'producto_id')::uuid
        and pt.talla = v_item->>'talla';
  end loop;

  -- El envío lo calcula la base de datos (nunca el navegador).
  v_envio := calcular_envio(v_total);

  update pedidos p set total = v_total, costo_envio = v_envio where p.id = v_pedido_id;

  return query select v_pedido_id, v_total, v_envio;
end;
$$;

grant execute on function crear_pedido(text, text, text, jsonb) to anon, authenticated;

-- ---------- 4) "Consultar mi pedido" (solo si lo activas en Configuración) ----------
-- La clienta escribe su teléfono Y su correo (los dos deben coincidir con los de la compra).
-- Solo devuelve estado, fecha, prendas y montos de sus últimos 5 pedidos.
create or replace function consultar_pedido(p_telefono text, p_correo text)
returns table(pedido_id uuid, creado timestamptz, estado text, total numeric, costo_envio numeric, prendas text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo boolean;
  v_dig text;
begin
  select c.consulta_pedido_activo into v_activo from configuracion c where c.id = 1;
  if v_activo is not true then
    raise exception 'CONSULTA_NO_DISPONIBLE';
  end if;

  v_dig := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 8);
  if char_length(v_dig) < 7 or coalesce(p_correo, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'DATOS_INVALIDOS';
  end if;

  return query
    select p.id, p.created_at, p.estado, p.total, p.costo_envio,
           (select string_agg(d.cantidad || ' × ' || coalesce(pr.nombre, 'Prenda') || ' (talla ' || d.talla || ')',
                              ', ' order by pr.nombre)
              from detalle_pedidos d
              left join productos pr on pr.id = d.producto_id
              where d.pedido_id = p.id)
      from pedidos p
      join clientes c on c.id = p.cliente_id
      where lower(c.correo) = lower(btrim(p_correo))
        and right(regexp_replace(c.telefono, '\D', '', 'g'), 8) = v_dig
      order by p.created_at desc
      limit 5;
end;
$$;

revoke all on function consultar_pedido(text, text) from public;
grant execute on function consultar_pedido(text, text) to anon, authenticated;
