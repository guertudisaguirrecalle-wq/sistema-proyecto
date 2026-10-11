-- ============================================================
-- COUTURE BYTE MARKET — WHATSAPP, INSTAGRAM Y FACEBOOK EDITABLES
-- ============================================================
-- Antes el número de WhatsApp y el enlace de Instagram estaban escritos
-- dentro de js/config.js y para cambiarlos había que editar un archivo.
-- Con estas tres columnas se cambian desde Panel → Configuración.
--
-- Si quedan vacías, la tienda sigue usando los valores de js/config.js,
-- así que nada se rompe. La tabla ya tiene lectura pública (06) y solo el
-- admin puede modificarla: no hace falta ninguna política nueva.
-- Es seguro ejecutarlo varias veces.

alter table configuracion add column if not exists whatsapp text;
alter table configuracion add column if not exists instagram_url text;
alter table configuracion add column if not exists facebook_url text;
