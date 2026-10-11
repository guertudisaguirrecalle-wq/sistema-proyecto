# Revisión v12 — errores corregidos

Panel de administración
- Estadísticas: si un período no tenía ventas, las gráficas "Por categoría" y "Mejor día" perdían su lienzo (`<canvas>`) y al elegir después otro período con ventas fallaban todas las gráficas. Ahora el lienzo nunca se borra.
- Estadísticas: al cambiar de período rápido, una respuesta vieja podía pisar a la nueva. Ahora se descarta la respuesta vieja.
- Clientas nuevas/recurrentes y la pestaña Clientes usan la MISMA regla (utils.js). Antes "Clientes" mostraba una fila por pedido y Estadísticas contaba personas.
- Los nombres de archivo de los reportes usan la fecha local (antes, de noche, salía la fecha de mañana).
- Al abrir el panel, los botones se conectan primero y los datos se piden después (si una consulta fallaba, todo el panel quedaba sin botones).
- Productos: editar un producto inactivo ya no lo vuelve a publicar; las tallas se guardan en una sola operación (antes se borraban y se recreaban); no se guarda mientras la foto todavía se sube; si la subida falla, la vista previa vuelve a la foto anterior.
- La pestaña Productos se actualiza al abrirla (el stock cambia al cancelar pedidos o al vender).

Tienda
- Después de cada compra, initProducts() volvía a conectar todos los eventos (cada clic se procesaba varias veces) y reabría solo el producto del enlace compartido. Ahora los eventos se conectan una sola vez.
- Buscador: ya no salta de página mientras se escribe, y al elegir una sugerencia el catálogo no queda filtrado con la caja vacía.
- La bolsa se sincroniza con el catálogo real (precio, stock, productos que ya no existen).
- Checkout: el stock se vuelve a consultar de verdad en Supabase; se muestran los códigos de error que realmente lanza crear_pedido; ya no se envía el precio (la base de datos usa el real).
- El desplazamiento de la página ya no se desbloquea al cerrar una ventana si queda otra abierta debajo.
- Los avisos emergentes muestran el texto tal cual (un nombre de producto no puede romperlos).

# v13 — Clientas recurrentes y correcciones

Novedades (no requieren tablas nuevas ni cambios en Supabase)
- Clientes: nueva columna "Última compra" y la lista se ordena por esa fecha (quien compró hace poco sube al principio). Los pedidos cancelados no cuentan; quien solo tiene pedidos cancelados queda al final.
- Clientes: etiqueta "↻ Recurrente" (2 o más compras válidas), "Compra n.º X" en el historial y "Última compra" en el detalle.
- Pedidos: etiqueta "↻ Recurrente" junto al nombre cuando ese pedido es una recompra (la clienta ya tenía una compra anterior no cancelada). También se ve dentro del detalle del pedido.
- Menú lateral: junto al numerito de pedidos nuevos aparece "↻ n" con cuántos de esos pedidos son de clientas recurrentes.

Errores corregidos
- Pedidos y Clientes se cortaban en 1000 filas sin avisar (límite de Supabase). Ahora se traen todas, por páginas.
- Un nombre de producto o categoría con apóstrofe (ej. D'Lux) rompía el código de la foto (ampliar / foto de reemplazo) en la tienda y el panel. Ahora se escapa con jsArg() en utils.js.
- Revisión de bucles: no hay setInterval ni recursión sin salida; los eventos se conectan una sola vez.


# v14
- Clientes: "Cliente desde", "Última compra" y el historial de pedidos ahora muestran fecha y hora (ej. 04 oct 2026, 15:30).
- La etiqueta "↻ Recurrente" es más pequeña y discreta (letra chica, sin relleno).

# v15
- El detalle del pedido mostraba la fecha con segundos y en formato difícil de leer. Ahora usa fechaHora() (utils.js): "04 oct 2026, 3:30 pm", igual que en Clientes.

# v16
- Fecha y hora con am/pm (ej. "04 oct 2026, 3:30 pm") en vez de 24 horas; sigue sin segundos.

# v17 — Tienda (lado de la clienta)
- El botón "Dejar mi reseña" se rompía si el producto tenía apóstrofe en el nombre (ej. D'Lux). Corregido.
- Al confirmar un pedido en celular, el navegador podía bloquear la apertura de WhatsApp (el pedido se guardaba pero el chat no abría). Ahora, si lo bloquea, WhatsApp se abre en la misma pestaña.
- La imagen del QR de pago se escapa igual que el resto de textos.
- Bolsa y favoritos ya no se rompen si el navegador tiene datos guardados dañados.

# v18
- Si los productos no se pueden cargar (sin internet o Supabase caído), la tienda muestra "No pudimos cargar los productos" con un botón "Reintentar", en lugar de "No encontramos productos". Si ya había productos en pantalla, no se borran: solo sale un aviso.
- Este archivo de cambios ahora vive en la carpeta docs/.

# v19 — Revisión final
- Panel > Productos: al editar un producto, ya no se pisa el stock de las tallas que no cambiaste. Antes, si una clienta compraba mientras tenías el formulario abierto, al guardar (aunque solo cambiaras el precio) el stock volvía al número viejo. Ahora solo se guardan las tallas que realmente modificaste.
- Crear categoría: si el nombre no tiene letras ni números (solo símbolos o emojis) ahora avisa con un mensaje claro.
- Revisión automática de todo el código (variables sin definir, botones que llaman funciones inexistentes, bucles): sin errores. Las animaciones terminan solas y los eventos de scroll están limitados.


# v24
- Facebook editable desde Panel → Configuración (junto al WhatsApp e Instagram). Requiere volver a correr sql/13.
- El enlace "Contáctanos" del pie de página ahora usa el WhatsApp configurado.

# v25 — Seguridad y pedidos
- Seguridad del panel: desactivar "Allow new users to sign up" en Supabase (Authentication). Sin SQL nuevo.
- sql/14_opciones_tienda.sql (junto con lo de abajo): `crear_pedido` valida datos y cantidades, suma líneas repetidas contra el stock y limita pedidos en cadena (5 por hora por teléfono/correo, 40 cada 10 minutos en total).
- `actualizar_estado_pedido`: no deja reactivar un pedido sin prendas.
- Al reemplazar o quitar fotos (producto, portada, QR) o eliminar un producto, la foto vieja se borra del almacenamiento si nadie más la usa.


# v26 — Opciones de la tienda
- sql/14_opciones_tienda.sql: columnas de opciones en `configuracion` (todas apagadas), `pedidos.costo_envio`, `calcular_envio()`, `crear_pedido` con validaciones, freno anti-spam, tienda cerrada y envío, `consultar_pedido()`.
- Tienda: franja de aviso / tienda cerrada, horario, dirección y mapa, envío en el checkout y en el mensaje de WhatsApp, "Consultar mi pedido" (js/opciones.js).
- Panel: interruptores en Configuración, respaldo de pedidos y clientes a Excel, envío en el detalle/impresión/mensaje del pedido, frases rápidas de pago en la nota.
- Si el 14 no se ejecutó, la tienda y el panel funcionan igual que antes.


# v34
- Se quitó "Duplicar producto" (copiaba el stock de otro artículo).
- sql/12 ahora es `12_refuerzo_seguridad.sql`: le quita al público el permiso de `actualizar_estado_pedido` y borra `cancelar_parcial_pedido`.
