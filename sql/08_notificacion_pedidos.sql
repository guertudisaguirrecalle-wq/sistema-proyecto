-- ============================================================
-- COUTURE BYTE MARKET — NOTIFICACIÓN DE PEDIDOS NUEVOS (numerito de aviso en el panel)
-- ============================================================
-- Guarda, para el admin, hasta qué fecha/hora ya revisó los pedidos.
-- El panel compara esta marca contra la fecha de cada pedido para
-- saber cuáles son "nuevos" y mostrar el numerito en el menú lateral.
--
-- Se guarda en Supabase (no en el navegador) para que el aviso esté
-- sincronizado sin importar desde qué computadora o celular entres
-- al panel.
--
-- Es una tabla de una sola fila (id siempre = 1), igual que "configuracion".

create table if not exists admin_estado (
  id smallint primary key default 1,
  pedidos_vistos_hasta timestamptz not null default now(),
  constraint admin_estado_single_row check (id = 1)
);

insert into admin_estado (id) values (1) on conflict (id) do nothing;

alter table admin_estado enable row level security;

-- Solo el admin (autenticado) puede leer o actualizar esta marca —
-- no tiene ningún sentido que la vea el público de la tienda.
drop policy if exists "admin_estado_solo_admin" on admin_estado;
create policy "admin_estado_solo_admin" on admin_estado
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
