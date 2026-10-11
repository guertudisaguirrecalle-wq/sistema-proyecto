-- ============================================================
-- COUTURE BYTE MARKET — CONFIGURACIÓN DE LA TIENDA (envío y métodos de pago)
-- ============================================================
-- Esta tabla guarda datos que antes había que editar en un archivo de
-- código (js/config.js). Ahora se pueden cambiar desde el Panel de
-- Administrador → "Configuración", sin tocar ni una línea de código.
--
-- Es una tabla de una sola fila (id siempre = 1): se actualiza, nunca
-- se crean filas nuevas.

create table if not exists configuracion (
  id smallint primary key default 1,
  envio_info text not null default 'Coordinamos la entrega por delivery. El costo y tiempo se confirman por WhatsApp según tu zona.',

  qr_activo boolean not null default false,
  qr_imagen_url text,
  qr_banco text,
  qr_titular text,

  transferencia_activo boolean not null default false,
  transferencia_banco text,
  transferencia_cuenta text,
  transferencia_titular text,

  efectivo_activo boolean not null default true,

  updated_at timestamptz not null default now(),

  constraint configuracion_single_row check (id = 1)
);

insert into configuracion (id) values (1) on conflict (id) do nothing;

alter table configuracion enable row level security;

drop policy if exists "configuracion_lectura_publica" on configuracion;
create policy "configuracion_lectura_publica" on configuracion
  for select using (true);

drop policy if exists "configuracion_admin_actualiza" on configuracion;
create policy "configuracion_admin_actualiza" on configuracion
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
