-- ============================================================
-- COUTURE BYTE MARKET — "CONSULTAR MI PEDIDO" CON FOTOS (v32)
-- ============================================================
-- Antes la consulta devolvía las prendas como un texto ("2 × Vestido (talla M)").
-- Ahora las devuelve una por una con su foto, nombre, talla, cantidad y subtotal,
-- para que la clienta VEA lo que pidió.
--
-- Ejecútalo DESPUÉS del 14. Es seguro repetirlo. Si no lo ejecutas, la consulta sigue
-- funcionando como antes (en texto); la tienda detecta sola cuál versión tiene la base.
-- Mismas reglas de siempre: hay que escribir teléfono Y correo, y solo se ven los últimos 5 pedidos.

drop function if exists consultar_pedido(text, text);

create or replace function consultar_pedido(p_telefono text, p_correo text)
returns table(pedido_id uuid, creado timestamptz, estado text, total numeric, costo_envio numeric, prendas jsonb)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
           (select coalesce(
                     jsonb_agg(
                       jsonb_build_object(
                         'nombre',   coalesce(pr.nombre, 'Prenda'),
                         'talla',    d.talla,
                         'cantidad', d.cantidad,
                         'subtotal', d.subtotal,
                         'imagen',   pr.imagen_url
                       )
                       order by pr.nombre, d.talla
                     ),
                     '[]'::jsonb)
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
