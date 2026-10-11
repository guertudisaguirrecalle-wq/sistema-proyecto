-- ============================================================
-- COUTURE BYTE MARKET — ESQUEMA DE BASE DE DATOS (Supabase / Postgres)
-- ============================================================
-- Ejecutar este archivo completo en Supabase → SQL Editor → New query → Run
-- Luego ejecutar, EN ORDEN: 02_funcion_pedidos.sql, 03_seguridad_rls.sql,
-- y opcionalmente 04_datos_ejemplo.sql

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABLA: categorias
-- ------------------------------------------------------------
create table if not exists categorias (
  id serial primary key,
  nombre text not null unique,
  slug text not null unique
);

insert into categorias (nombre, slug) values
  ('Vestidos', 'vestidos'),
  ('Blusas', 'blusas'),
  ('Pantalones', 'pantalones'),
  ('Conjuntos', 'conjuntos')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- TABLA: productos
-- ------------------------------------------------------------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  precio numeric(10,2) not null check (precio >= 0),
  categoria_id integer not null references categorias(id),
  imagen_url text,
  destacado boolean not null default false,
  nuevo boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABLA: producto_tallas  (stock independiente por talla y producto)
-- ------------------------------------------------------------
create table if not exists producto_tallas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  talla text not null check (talla in ('XS','S','M','L','XL')),
  stock integer not null default 0 check (stock >= 0),
  unique (producto_id, talla)
);

-- ------------------------------------------------------------
-- TABLA: clientes
-- ------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  telefono text not null,
  correo text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABLA: pedidos  (un cliente puede tener varios pedidos)
-- ------------------------------------------------------------
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  total numeric(10,2) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','enviado','cancelado')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABLA: detalle_pedidos  (un pedido contiene varios productos)
-- ------------------------------------------------------------
create table if not exists detalle_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  talla text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

create index if not exists idx_producto_tallas_producto on producto_tallas(producto_id);
create index if not exists idx_detalle_pedido on detalle_pedidos(pedido_id);
create index if not exists idx_pedidos_cliente on pedidos(cliente_id);
create index if not exists idx_productos_categoria on productos(categoria_id);
