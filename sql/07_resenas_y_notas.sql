-- ============================================================
-- COUTURE BYTE MARKET — RESEÑAS DE PRODUCTOS + NOTAS INTERNAS DE PEDIDOS
-- ============================================================

-- ------------------------------------------------------------
-- RESEÑAS: cualquier clienta puede escribir una, pero NO se muestra
-- públicamente hasta que vos la apruebes desde el panel admin. Así
-- nunca aparece una reseña falsa o correo basura (spam) sin que la revises primero.
-- ------------------------------------------------------------
create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  nombre_clienta text not null,
  calificacion smallint not null check (calificacion between 1 and 5),
  comentario text not null,
  aprobada boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_resenas_producto on resenas(producto_id);

alter table resenas enable row level security;

-- Cualquiera puede ver las reseñas YA aprobadas (esto es lo que se
-- muestra en la ficha de producto).
drop policy if exists "resenas_lectura_publica_aprobadas" on resenas;
create policy "resenas_lectura_publica_aprobadas" on resenas
  for select using (aprobada = true);

-- Cualquiera puede escribir una reseña nueva (queda pendiente hasta
-- que el admin la apruebe — no se puede insertar ya "aprobada").
drop policy if exists "resenas_insercion_publica" on resenas;
create policy "resenas_insercion_publica" on resenas
  for insert with check (aprobada = false);

-- Solo el admin puede ver TODAS las reseñas (incluidas las pendientes)
-- y puede aprobarlas o eliminarlas.
drop policy if exists "resenas_admin_todo" on resenas;
create policy "resenas_admin_todo" on resenas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- NOTAS INTERNAS en cada pedido (solo las ve el admin, nunca la
-- clienta). Útil para anotar cosas como "pidió cambio de talla por
-- WhatsApp" o "entregar en la tarde".
-- ------------------------------------------------------------
alter table pedidos add column if not exists notas_internas text default '';
-- No hace falta una política nueva: la tabla "pedidos" ya solo permite
-- lectura/escritura a usuarios autenticados (ver 03_seguridad_rls.sql),
-- así que esta columna queda automáticamente protegida igual que el
-- resto del pedido.
