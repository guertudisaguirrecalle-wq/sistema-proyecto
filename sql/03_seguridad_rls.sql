-- ============================================================
-- COUTURE BYTE MARKET — SEGURIDAD (Row Level Security)
-- ============================================================
-- Regla general:
--  - Cualquier visitante (anon) puede LEER categorías, productos y
--    tallas/stock (para que la tienda se vea sin necesidad de iniciar
--    sesión).
--  - Nadie puede modificar productos/tallas/stock/categorías directamente
--    EXCEPTO un administrador que haya iniciado sesión (usuario
--    autenticado de Supabase Auth).
--  - Clientes y pedidos NO se pueden crear directamente desde el público:
--    se crean únicamente a través de la función crear_pedido() (ver
--    02_funcion_pedidos.sql), que corre con privilegios elevados.
--  - Solo el administrador autenticado puede leer clientes y pedidos
--    (para el panel de "Ver clientes" / "Ver pedidos").

alter table categorias enable row level security;
alter table productos enable row level security;
alter table producto_tallas enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table detalle_pedidos enable row level security;

-- ---------- CATEGORIAS ----------
drop policy if exists "categorias_lectura_publica" on categorias;
create policy "categorias_lectura_publica" on categorias
  for select using (true);

drop policy if exists "categorias_admin_todo" on categorias;
create policy "categorias_admin_todo" on categorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- PRODUCTOS ----------
drop policy if exists "productos_lectura_publica" on productos;
create policy "productos_lectura_publica" on productos
  for select using (true);

drop policy if exists "productos_admin_todo" on productos;
create policy "productos_admin_todo" on productos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- PRODUCTO_TALLAS ----------
drop policy if exists "tallas_lectura_publica" on producto_tallas;
create policy "tallas_lectura_publica" on producto_tallas
  for select using (true);

drop policy if exists "tallas_admin_todo" on producto_tallas;
create policy "tallas_admin_todo" on producto_tallas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- CLIENTES (solo admin lee; nadie inserta directo, solo la función) ----------
drop policy if exists "clientes_admin_lectura" on clientes;
create policy "clientes_admin_lectura" on clientes
  for select using (auth.role() = 'authenticated');

-- ---------- PEDIDOS (solo admin lee/edita; nadie inserta directo, solo la función) ----------
drop policy if exists "pedidos_admin_lectura" on pedidos;
create policy "pedidos_admin_lectura" on pedidos
  for select using (auth.role() = 'authenticated');

drop policy if exists "pedidos_admin_actualiza" on pedidos;
create policy "pedidos_admin_actualiza" on pedidos
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- DETALLE_PEDIDOS (solo admin lee; nadie inserta directo) ----------
drop policy if exists "detalle_admin_lectura" on detalle_pedidos;
create policy "detalle_admin_lectura" on detalle_pedidos
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE: carpeta (bucket) para imágenes de productos
-- ============================================================
-- Crea la carpeta (bucket) "productos-imagenes" como público para lectura (para que
-- las fotos se vean en la tienda) y restringe subir/editar/borrar solo a
-- administradores autenticados.

insert into storage.buckets (id, name, public)
  values ('productos-imagenes', 'productos-imagenes', true)
  on conflict (id) do nothing;

drop policy if exists "storage_lectura_publica" on storage.objects;
create policy "storage_lectura_publica" on storage.objects
  for select using (bucket_id = 'productos-imagenes');

drop policy if exists "storage_admin_sube" on storage.objects;
create policy "storage_admin_sube" on storage.objects
  for insert with check (bucket_id = 'productos-imagenes' and auth.role() = 'authenticated');

drop policy if exists "storage_admin_actualiza" on storage.objects;
create policy "storage_admin_actualiza" on storage.objects
  for update using (bucket_id = 'productos-imagenes' and auth.role() = 'authenticated');

drop policy if exists "storage_admin_borra" on storage.objects;
create policy "storage_admin_borra" on storage.objects
  for delete using (bucket_id = 'productos-imagenes' and auth.role() = 'authenticated');
