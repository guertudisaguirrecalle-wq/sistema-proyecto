-- ============================================================
-- COUTURE BYTE MARKET — FOTO DE PORTADA EDITABLE
-- ============================================================
-- Agrega a la tabla "configuracion" una columna para guardar la foto
-- principal (portada) de la tienda. Se sube desde el Panel de
-- Administrador -> Configuracion -> "Foto de portada".
-- Si esta columna queda vacia, la tienda muestra la foto por defecto.
-- No crea tablas nuevas y es seguro ejecutarlo mas de una vez.

alter table configuracion add column if not exists portada_url text;
