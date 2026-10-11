# 🎀 Couture Byte Market — Tienda de ropa online (versión Supabase)

Tienda de moda femenina completa: catálogo con imágenes ya cargadas, carrito,
control de tallas y stock real, checkout con datos del cliente, pedido
automático por WhatsApp, y panel de administrador con subida directa de
fotografías (sin URLs). Todo conectado a **Supabase** (base de datos +
autenticación + almacenamiento de imágenes).

No necesitas saber programar para configurarla: solo sigue los pasos de
este documento en orden.

---

## ✨ Funciones agregadas para vender mejor

- **Favoritos (♡)**: cada clienta puede guardar productos sin necesidad de
  cuenta (se guarda en su navegador). Ícono de corazón en el header con
  contador, y panel para verlos todos.
- **Guía de tallas**: enlace "¿Qué talla soy?" en cada producto, con tabla
  de medidas de referencia. Edítala en `index.html` (sección "MODAL: GUÍA
  DE TALLAS") si quieres poner las medidas reales de tus prendas.
- **Aviso de últimas unidades**: cuando quedan 3 unidades o menos de una
  talla, se resalta con un punto y el mensaje "¡Últimas X unidades!".
- **Compartir producto**: botón de compartir en la ficha de cada producto.
  Genera un enlace directo a esa prenda (con QR y opción de enviar por
  WhatsApp) para que la clienta se lo mande a una amiga.
- **Compartir tienda (QR)**: botón en el pie de página que muestra un
  código QR de tu tienda — útil para tarjetas de presentación o flyers
  impresos.
- **Información de envío en el checkout**: se muestra automáticamente
  antes de confirmar el pedido.
- **Métodos de pago (QR, transferencia, efectivo)**: el checkout muestra
  al instante los métodos que actives — incluyendo la foto real de tu QR
  para que la clienta pueda escanearlo y pagar ahí mismo.
- **Panel de "Configuración" en el admin** (nuevo): agrega o cambia tu QR
  de pago (subiendo la foto directamente, sin URLs ni código), los datos
  de transferencia bancaria, si aceptas efectivo, y el texto de envío —
  todo desde una pantalla, con guardado al instante.
- **Alerta de stock bajo en el admin**: una tarjeta más en "Productos" que
  cuenta cuántas prendas tienen 5 unidades o menos en total, para que
  sepas cuándo reponer.
- **Logo con monograma propio**: se reemplazó el texto simple "CB" por un
  distintivo con un pequeño detalle floral, a juego con los colores de la
  marca.
- **Panel de Estadísticas** (nuevo, primera pantalla del admin): gráficos
  reales calculados con tus pedidos — ventas por día, ventas por
  categoría, y productos más vendidos. Cambia el rango (7/30/90 días) con
  el selector de arriba.
- **Métodos de pago con pestañas**: en el checkout, la clienta elige cómo
  quiere pagar (QR / Transferencia / Efectivo) tocando una pestaña, y solo
  ve la información de esa opción. Al confirmar, el mensaje de WhatsApp
  incluye el método elegido y, si no es efectivo, un recordatorio de
  enviar el comprobante por el mismo chat.
- **Sección "Sobre nosotros"**: un breve texto de marca antes de los
  íconos de confianza, para darle más personalidad a la página. Edítalo
  en `index.html` (sección "NUESTRA HISTORIA + VALORES").

Todo funciona igual de simple que antes tanto para tus clientas como para
vos en el panel — no se agregó ningún paso extra obligatorio.

### Cómo activar tu QR de pago real

1. Entra al Panel de Administrador → **Configuración**.
2. En "Pago con QR", sube la foto de tu QR bancario (el mismo que usas
   para recibir transferencias — la mayoría de bancos en Bolivia lo llaman
   "QR Simple" dentro de su app).
3. Completa el banco y a nombre de quién está, activa el interruptor y
   presiona "Guardar configuración".
4. Listo — aparecerá automáticamente en el checkout de tu tienda, visible
   y lista para escanear.

## 📁 Estructura del proyecto

```
couture-byte-market/
├── index.html              → Tienda (lo que ve la clienta)
├── admin.html               → Panel de administrador
├── css/
│   ├── style.css            → Estilos de la tienda
│   └── admin.css             → Estilos del panel admin
├── js/
│   ├── config.js             → ⚠️ AQUÍ EDITAS TUS CLAVES DE SUPABASE
│   ├── supabaseClient.js     → Conexión con Supabase
│   ├── utils.js              → Funciones de ayuda (moneda, notificaciones...)
│   ├── products.js           → Catálogo, filtros, buscador
│   ├── cart.js                → Carrito de compras
│   ├── checkout.js            → Datos del cliente + registro de pedido + WhatsApp
│   ├── main.js                 → Inicialización de la tienda
│   └── admin/
│       ├── auth.js             → Inicio de sesión del administrador
│       ├── products.js          → Agregar/editar/eliminar productos + subir fotos
│       ├── orders.js             → Ver pedidos
│       ├── customers.js           → Ver clientes
│       └── main.js                 → Inicialización del panel
└── sql/
    ├── 01_schema.sql          → Crea las tablas
    ├── 02_funcion_pedidos.sql  → Función que registra pedidos de forma segura
    ├── 03_seguridad_rls.sql     → Políticas de seguridad + bucket de imágenes
    └── 04_datos_ejemplo.sql      → 16 productos de muestra con fotos ya cargadas
└── fotos-productos/
    ├── GUIA_FOTOS_REALES.md     → Cómo subir tus 16 fotos reales (2 min)
    └── (16 fotografías .jpg)     → Tus fotos reales, rescatadas de tu proyecto anterior
```

---

## 🔄 Qué cambió respecto a tu proyecto anterior

- **Antes**: catálogo fijo escrito directamente en `script.js` (sin base de
  datos real), sin control de tallas ni stock, y el formulario de pedido
  solo dejaba los datos en la consola del navegador con una nota de "esto
  se conectará a PHP/MySQL más adelante".
- **Ahora**: todo vive en **Supabase** (Postgres real). Hay stock
  independiente por talla, un panel de administrador completo, subida de
  fotos sin URLs, y el pedido se registra de verdad en la base de datos
  antes de abrir WhatsApp con el mensaje ya armado — nada de PHP ni MySQL.
- **Tus fotos reales**: encontré las 16 fotografías de productos que ya
  tenías (`img/` en tu proyecto anterior) y las dejé listas en
  `fotos-productos/`, con nombres de archivo limpios y una guía con
  nombre comercial, categoría y precio sugerido para cada una — así no
  empiezas con fotos genéricas de internet. Instrucciones abajo.

---

## 🚀 Paso 1 — Crear tu proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (es gratis).
2. Haz clic en **"New Project"**.
3. Ponle un nombre (ej. `couture-byte-market`), crea una contraseña de base de datos
   (guárdala en un lugar seguro) y elige una región cercana a Bolivia
   (por ejemplo, São Paulo).
4. Espera 1-2 minutos a que el proyecto termine de crearse.

---

## 🗄️ Paso 2 — Crear las tablas (base de datos)

1. En el menú izquierdo de Supabase, entra a **SQL Editor**.
2. Haz clic en **"New query"**.
3. Abre el archivo `sql/01_schema.sql` de este proyecto, copia todo su
   contenido, pégalo en el editor y presiona **Run**.
4. Repite el mismo proceso, EN ESTE ORDEN, con:
   - `sql/02_funcion_pedidos.sql`
   - `sql/03_seguridad_rls.sql` *(este paso también crea automáticamente
     el bucket de imágenes "productos-imagenes" — no necesitas crearlo a mano)*
   - `sql/04_datos_ejemplo.sql` *(opcional: agrega 16 productos de muestra
     con fotos ya funcionando, para que veas la tienda completa de inmediato)*

> Si en algún momento ejecutaste antes `05_categoria_uniformes_medicos.sql`
> (una categoría de ejemplo que ya no viene en este proyecto) y quieres
> quitarla de tu Supabase, corre `sql/05_quitar_categoria_uniformes_medicos_OPCIONAL.sql`.

**Además, ejecuta `sql/06_configuracion.sql`** — crea la tabla que guarda
la información de envío y los métodos de pago, editable desde el Panel de
Administrador → "Configuración" (sin tocar código).
> Si nunca la agregaste, ignora este archivo.

**Y ejecuta también `sql/07_resenas_y_notas.sql`** — crea la tabla de
reseñas (con su seguridad: cualquiera puede escribir una, pero solo se
ve en la tienda cuando la apruebas desde el panel, en la pestaña
"Reseñas"). Sin este script, la sección de reseñas del producto y esa
pestaña del panel no van a funcionar.

**Y por último `sql/08_notificacion_pedidos.sql`** — crea la tabla que
recuerda hasta cuándo ya revisaste los pedidos, para mostrar el
numerito de "pedidos nuevos" en el menú del panel (desaparece solo al
entrar a la pestaña "Pedidos", y queda igual sin importar desde qué
computadora o celular entres). Sin este script, esa pestaña sigue
funcionando normal, solo que no vas a ver el aviso.

**Y ejecuta también `sql/09_actualizar_estado_pedido.sql`** — crea la
función que el panel usa para cambiar el estado de un pedido. Es la
que hace que, al cancelar un pedido, el stock de esas tallas vuelva
automáticamente (y que, si lo reactivas, se vuelva a descontar, o la
función avise si ya no hay stock suficiente). **Sin este script el
botón de cambiar estado del panel deja de funcionar**, así que no es
opcional.

**Y ejecuta `sql/10_portada.sql`** — agrega la columna para la foto de
portada. Con esto puedes cambiarla desde Panel → Configuración → "Foto de
portada". Si no lo ejecutas, la tienda sigue funcionando con la foto por defecto.

Con esto ya tienes: tablas de categorías, productos, tallas/stock, clientes,
pedidos y detalle de pedidos, más la función que registra un pedido completo
de forma seguraa (sin permitir comprar más stock del disponible).

---

## 🔑 Paso 3 — Conectar tus claves de Supabase

1. En Supabase, ve a **Project Settings → API**.
2. Copia el valor de **Project URL**.
3. Copia el valor de **anon public** (la clave pública, NO la "service_role").
4. Abre el archivo `js/config.js` de este proyecto y reemplaza:

```js
SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
SUPABASE_ANON_KEY: "TU-ANON-KEY-AQUI",
```

con tus valores reales. Guarda el archivo.

---

## 👤 Paso 4 — Crear tu usuario administrador

El panel de administrador usa Supabase Auth (correo + contraseña). Debes
crear el usuario manualmente una sola vez:

1. En Supabase, ve a **Authentication → Users**.
2. Haz clic en **"Add user" → "Create new user"**.
3. Escribe tu correo (ej. `admin@couturebite.com`) y una contraseña segura.
4. Marca la opción de **"Auto Confirm User"** si aparece, para no tener que
   verificar el correo.
5. Guarda. Ese correo y contraseña son con los que entrarás en
   `admin.html`.

> Puedes crear más de un usuario si varias personas van a administrar la
> tienda.

---

## 💻 Paso 5 — Abrir la tienda

Como el proyecto es HTML/CSS/JS puro (sin instalaciones), puedes:

**Opción A — Ver rápido en tu computadora:**
Haz doble clic en `index.html` (algunos navegadores restringen ciertas
funciones al abrir así; si algo no carga, usa la Opción B).

**Opción B — Servidor local simple** (recomendado):
Si tienes Python instalado, abre una terminal en la carpeta del proyecto y
ejecuta:
```
python3 -m http.server 8000
```
Luego abre `http://localhost:8000` en tu navegador.

**Opción C — Publicarla en internet (recomendado para el negocio real):**
Sube la carpeta completa a un servicio gratuito como **Netlify**,
**Vercel** o **GitHub Pages** (arrastra la carpeta a Netlify y listo, no
requiere configuración adicional).

---

## 🛍️ Cómo funciona la tienda (resumen)

1. La clienta entra, navega y busca productos libremente — sin necesidad de
   crear una cuenta.
2. Elige un producto, selecciona talla y cantidad (las tallas sin stock
   aparecen como **"Agotada"** y no se pueden elegir).
3. Agrega al carrito, revisa cantidades y precios.
4. Al presionar **"Finalizar pedido por WhatsApp"**, se le pide: nombre
   completo, teléfono y correo.
5. El sistema **vuelve a verificar el stock en tiempo real** (por si alguien
   más compró justo antes) y luego registra todo en Supabase en un solo paso
   seguro: cliente, pedido, detalle del pedido y descuento del stock.
6. Se abre WhatsApp automáticamente con el mensaje del pedido ya escrito,
   listo para enviar.

---

## 🛠️ Cómo usar el Panel de Administrador

1. Entra a `admin.html` (o haz clic en el botón **"Administrador"** del
   menú de la tienda).
2. Inicia sesión con el correo y contraseña que creaste en el Paso 4.

**Agregar una categoría nueva (sin tocar SQL):**
- Dentro de "Agregar producto" o "Editar producto", junto al selector de
  categoría hay un botón **"+ Categoría"**.
- Escribe el nombre (ej. "Accesorios", "Calzado") y presiona **"Crear
  categoría"**. Aparece al instante en el selector y también como filtro
  nuevo en la tienda — no hace falta editar ningún archivo ni ejecutar SQL.

**Agregar un producto:**
- Clic en **"Agregar producto"**.
- Toca la zona de **"Toca aquí para seleccionar una foto"** y elige una
  imagen desde tu computadora o celular (no necesitas ningún enlace ni URL).
  > 💡 Si quieres usar tus fotos reales ya listas, revisa
  > `fotos-productos/GUIA_FOTOS_REALES.md` — tiene el nombre comercial y
  > categoría sugeridos para cada una de tus 16 fotos.
- Completa nombre, descripción, precio y categoría.
- En **"Stock disponible por talla"**, escribe cuántas unidades hay de cada
  talla (XS, S, M, L, XL). Si dejas una talla en 0, aparecerá como agotada
  automáticamente en la tienda.
- Guarda.

**Editar o reemplazar la foto de un producto:**
- Clic en el ícono de lápiz de ese producto.
- Toca la vista previa de la imagen o la zona de subida para elegir una
  foto nueva; se reemplaza automáticamente al guardar.

**Eliminar un producto:** clic en el ícono de basurero y confirma. Si el
producto ya tiene pedidos registrados, el sistema no lo deja eliminar (para
no perder ese historial de ventas) y te ofrece **desactivarlo** en su
lugar: desaparece de la tienda al instante, pero sus datos y pedidos
pasados se conservan.

**Ver pedidos:** pestaña "Pedidos" — muestra fecha, cliente, teléfono,
productos y total de cada pedido. Puedes hacer clic en un pedido para ver
el detalle completo y cambiar su estado (pendiente / confirmado / enviado /
cancelado).

**Ver clientes:** pestaña "Clientes" — se llena automáticamente cada vez
que alguien completa un pedido. Si una misma clienta compra varias veces
(mismo correo o mismo teléfono), aparece UNA sola vez con todos sus pedidos
juntos. Es la misma regla que usan las tarjetas "Clientas nuevas" y
"Clientas recurrentes" de Estadísticas, así que los números siempre cuadran.

---

## ✏️ Cómo cambiar los datos de contacto

Todo se edita en un único lugar: `js/config.js`

**Cambiar el número de WhatsApp:**
```js
WHATSAPP_NUMBER: "59178411020",
```
Reemplaza por el nuevo número (código de país + número, sin espacios ni "+").

**Cambiar Instagram y Facebook:** se hace desde el Panel → Configuración →
"Contacto de la tienda" (junto con el WhatsApp). Los de `js/config.js` quedan
solo como respaldo por si el dato guardado está vacío o no es válido:
```js
INSTAGRAM_URL: "https://instagram.com/couturebite",
FACEBOOK_URL: "https://facebook.com/couturebite",
```

**Cambiar la dirección / ubicación:**
Edita `DIRECCION` en `js/config.js`, y también el texto de la dirección
dentro de `index.html` (sección "Ubicación", cerca del `<iframe>` del mapa)
y el enlace del mapa si cambias de ciudad.

---

## 🔒 Seguridad (ya configurada)

- Cualquier visitante puede **ver** productos, categorías y stock — no
  necesita cuenta.
- Nadie puede modificar productos, tallas, precios ni imágenes desde
  afuera: solo un administrador con sesión iniciada (`auth.role() =
  'authenticated'` en las políticas RLS).
- Los pedidos y clientes se crean **únicamente** a través de la función
  `crear_pedido()`, que valida el stock disponible antes de registrar nada.
  Esto evita que alguien compre una talla agotada, compre más unidades de
  las disponibles, o que se generen pedidos duplicados o incompletos.
- Solo el administrador autenticado puede leer la lista de clientes y
  pedidos.

---

## ❓ Problemas comunes

- **"No se pudo cargar la librería de Supabase"** → revisa tu conexión a
  internet; el proyecto carga el cliente de Supabase desde un CDN.
- **Los productos no aparecen** → revisa que hayas puesto correctamente
  `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `js/config.js`, y que hayas
  ejecutado los archivos SQL en orden (ver "Orden completo de los SQL" al final).
- **No puedo subir imágenes desde el panel** → asegúrate de haber
  ejecutado `sql/03_seguridad_rls.sql` completo (crea el bucket
  "productos-imagenes" y sus permisos) y de haber iniciado sesión como
  administrador.
- **"Correo o contraseña incorrectos" en el panel admin** → confirma que
  creaste el usuario en Supabase → Authentication → Users, y que marcaste
  "Auto Confirm User".

---

Hecho con cariño para Couture Byte Market 🎀


---

## Nota interna en cada pedido (v20)

**Ejecuta `sql/11_notas_pedidos.sql`** en Supabase → SQL Editor (es seguro aunque ya hayas corrido el 07).

En el panel → **Pedidos** → abre un pedido: abajo del estado hay un cuadro **"Nota interna"** para escribir, por ejemplo, *"canceló la mitad del pedido"*. Tiene frases rápidas y el botón **Guardar nota**. Los pedidos con nota muestran la etiqueta **✎ Nota** en la lista. La clienta nunca ve la nota.

> La nota solo **documenta**: no cambia el total ni devuelve stock. Para devolver todo el stock se sigue usando el estado "Cancelado".


---

## Cancelar solo parte de un pedido (v21) — ya no existe

Esta opción se quitó en v31: para cancelar se usa el estado **Cancelado** del pedido (devuelve todo el stock). Ver las novedades de v31 más abajo.

---

## Mejoras de lógica del panel (v22) — no requiere SQL nuevo

- **Stock con una sola regla.** Antes "Stock bajo" se calculaba distinto en Productos (≤5 en total) y en Estadísticas (≤3 por talla). Ahora todo usa la misma regla: un producto está en **stock bajo** si le quedan 5 unidades o menos en total **o** si alguna talla con unidades está por agotarse (3 o menos). **Agotado** = 0 unidades en total. Una talla en 0 no cuenta como alerta (puede ser una talla que ese modelo no maneja). Los umbrales se cambian en un solo lugar: `STOCK_BAJO_TALLA` y `STOCK_BAJO_PRODUCTO` en `js/admin/stats.js`.
- **Aviso automático en el menú:** el número junto a **Productos** indica cuántos productos activos están agotados o con stock bajo. Se actualiza al abrir el panel y cada vez que un pedido se cancela o se reactiva.
- **Tarjetas de producto:** muestran el stock de cada talla (en rosa las que están por agotarse) y la etiqueta "Stock bajo".
- **Pedidos:** botones de filtro por estado (con conteo y "Con nota") y buscador por nombre, teléfono o correo (sin importar tildes ni mayúsculas).
- **Confirmaciones:** el panel pide confirmar antes de cancelar un pedido completo, reactivar uno cancelado o regresar un pedido a un estado anterior. Si dices que no, el estado vuelve a como estaba.
- **Avisar por WhatsApp:** en el detalle del pedido, un botón abre WhatsApp con el número de la clienta y un mensaje ya escrito según el estado (con las prendas y el total vigentes). Tú decides si lo envías. Acepta números bolivianos de 8 dígitos o con +591.
- Al cancelar prendas sueltas, si habías escrito una nota sin guardar, se guarda primero para no perderla.

---

## Novedades v23

**Ejecuta en Supabase (SQL Editor), en este orden, lo que todavía no hayas corrido:** `sql/11_notas_pedidos.sql` → `sql/12_refuerzo_seguridad.sql` → `sql/13_contacto_tienda.sql`.

- **Clientas → "Escribir por WhatsApp":** en la ficha de cada clienta hay un botón (uno por cada teléfono válido) que abre el chat con un saludo ya escrito. Usa `enlaceWhatsApp()` de `js/utils.js`, la misma función que arma los avisos en Pedidos.
- **Pedidos → "Imprimir pedido":** abre una hoja limpia con la clienta, las prendas (con casilla para marcar al armar el paquete), el total, la nota y líneas de "Preparado por / Recibido por".
- **Estadísticas → "Hoy":** el selector tiene la opción *Hoy*. Compara contra *ayer*, muestra las ventas **hora por hora**, y oculta (con un aviso) los gráficos que no tienen sentido en un solo día (mejor día de la semana y stock sin ventas).
- **Configuración → "Contacto de la tienda":** el WhatsApp y el Instagram se editan desde el panel (columnas `whatsapp` e `instagram_url`, `sql/13`). Se validan antes de guardar y, si quedan vacíos o inválidos, la tienda usa los de `js/config.js`: nunca se queda sin contacto. El número acepta `78411020` o `+591 78411020`; el Instagram acepta `@usuario` o el enlace.
- **Compra → recordar datos:** si la clienta ya compró, el formulario viene con su nombre, teléfono y correo. Se guardan **solo en su navegador** (no en la base de datos), después de que el pedido se registra, y hay un enlace "No soy yo / borrar mis datos".


---

## Novedades v24 — Facebook editable

**Ejecuta `sql/13_contacto_tienda.sql`** en Supabase (si ya lo habías corrido, córrelo otra vez: es seguro y agrega la columna de Facebook).

- **Configuración → "Contacto de la tienda"** ahora tiene **WhatsApp, Instagram y Facebook**. Facebook acepta `couturebite`, `@couturebite` o el enlace completo, y rechaza enlaces que no sean de Facebook.
- El link **"Contáctanos"** del pie de página ahora también cambia cuando editas el WhatsApp (antes se quedaba con el número viejo).

---

## Novedades v25 — Seguridad y pedidos más firmes

**Ejecuta en Supabase (SQL Editor):** `sql/14_opciones_tienda.sql` (incluye las validaciones de pedidos de esta sección).

### 1) Cerrar los registros de Supabase — IMPORTANTE (no requiere SQL)
El panel y las políticas de seguridad tratan como administradora a cualquier usuario con sesión iniciada. Para que nadie pueda crearse una cuenta con tu clave pública, en Supabase → **Authentication → Sign In / Providers** desactiva **"Allow new users to sign up"**. Así los únicos usuarios con sesión son los que tú creas a mano en Authentication → Users (el paso 4 de esta guía).

### 2) Pedidos validados en la base de datos (dentro de `sql/14_opciones_tienda.sql`)
- Nombre, teléfono, correo y cantidades se validan **en la base de datos** (el navegador se puede saltar).
- Si la misma prenda y talla llega en dos líneas, se compara el **total** contra el stock.
- Freno contra pedidos falsos en cadena: máximo 5 pedidos activos por hora con el mismo teléfono o correo, y máximo 40 en 10 minutos en toda la tienda. La clienta ve "Hay muchos pedidos seguidos…".

### 3) Otros arreglos
- **Un pedido que se quedó sin prendas** (se cancelaron una por una) ya no se puede "reactivar": quedaba vacío y con total 0. El panel lo explica.
- **Fotos viejas:** al reemplazar la foto de un producto, la portada o el QR, o al eliminar un producto, la foto anterior se borra del almacenamiento (solo si ningún producto ni la configuración la sigue usando).
- Nombre del proyecto unificado en el README ("Couture Byte Market").

### Orden completo de los SQL (instalación nueva)
`01` → `02` → `03` → `04` (opcional, datos de ejemplo) → `06` → `07` → `08` → `09` → `10` → `11` → `12` → `13` → `14`.
El `05` es opcional y solo se usa si alguna vez creaste la categoría de uniformes médicos.


---

## Novedades v26 — Opciones de la tienda (todas apagadas hasta que las actives)

**Ejecuta `sql/14_opciones_tienda.sql`** en Supabase (SQL Editor). No crea tablas nuevas: solo agrega columnas a `configuracion` y `pedidos` y algunas funciones. Mientras no actives nada, la tienda funciona exactamente igual que antes. Si no lo ejecutas, el panel te avisa en Configuración y no rompe nada.

En **Panel → Configuración** hay un interruptor por cada opción:

- **Tienda abierta / cerrada:** al cerrarla, la tienda se ve pero no recibe pedidos; muestra una franja roja con tu mensaje, el checkout avisa y la base de datos también rechaza el pedido (no se puede saltar).
- **Aviso en la tienda:** franja arriba con tu texto (promos, feriados). La clienta puede cerrarla.
- **Horario de atención:** aparece en "Dónde estamos".
- **Dirección y mapa:** cambian el texto, el mapa y el pie de página.
- **Costo de envío:** monto fijo y, si quieres, "gratis desde Bs X". Se suma al total que paga la clienta y se guarda en cada pedido (si cambias la tarifa, los pedidos viejos no cambian). El monto lo calcula la base de datos, no el navegador. En Pedidos, imprimir y el mensaje de WhatsApp se ve: prendas + envío = total a pagar. Las Estadísticas siguen contando solo las ventas de prendas.
- **Consultar mi pedido:** enlace en el encabezado (ícono de paquete), al inicio del menú ☰ del celular y en el pie de la tienda. La clienta escribe su teléfono **y** su correo (los dos deben coincidir) y ve el estado, las prendas y el total de sus últimos 5 pedidos.
- **Respaldo:** botones para descargar **pedidos** y **clientes** en Excel.
- **Nota del pedido:** nuevas frases rápidas "Pagó la mitad", "Pagó todo", "Pagó un adelanto" y "Falta pagar" para anotar pagos parciales sin escribir.

Probado en una base de datos de prueba (envío, tienda cerrada, consulta, límites) y en un navegador simulado (tienda con todo apagado, sin el `14` y con todo encendido; panel con administradora y con cuenta no autorizada).


---

## Novedades v31 — No requiere SQL nuevo

- **Se quitó "Cancelar prendas"** del detalle del pedido (el control "Cancelar 1 de 1"). Para cancelar un pedido se sigue usando el estado **Cancelado** (devuelve todo el stock). El archivo `sql/12` ahora se llama `12_refuerzo_seguridad.sql`: solo le quita al público el permiso de cambiar estados de pedido y borra la función vieja de cancelar prendas. **Ejecútalo** (es seguro repetirlo).
- **"Consultar mi pedido" más a la vista:** además del pie de página, ahora hay un **ícono de paquete en el encabezado** (junto al corazón y la bolsa) y, en el celular, la opción **"¿Dónde está mi pedido?"** es lo primero del menú ☰. Los tres accesos se prenden y apagan juntos con el interruptor de Panel → Configuración → *Consultar mi pedido*.
- **Encabezado en pantallas medianas:** entre 861 y 1260 px de ancho (tablet horizontal, laptops chicas) el encabezado se salía de la pantalla. Ahora en ese rango se usa el menú ☰ (igual que en el celular), y en laptops el buscador se angosta un poco.


---

## Novedades v32 — "Consultar mi pedido" con fotos

**Ejecuta `sql/15_consulta_con_fotos.sql`** en Supabase (SQL Editor, después del 14; es seguro repetirlo).

- Al consultar su pedido, la clienta ahora **ve cada prenda con su foto**, nombre, talla, cantidad y precio. Al tocar la foto, se agranda.
- Si todavía no ejecutaste el `15`, la consulta sigue funcionando como antes (las prendas en texto): la tienda detecta sola qué versión tiene la base.
- Las reglas no cambian: hay que escribir teléfono **y** correo, y solo se ven los últimos 5 pedidos.
- Orden completo de los SQL (instalación nueva): `01` → `02` → `03` → `04` (opcional) → `06` → `07` → `08` → `09` → `10` → `11` → `12` → `13` → `14` → `15`. (El `12` ahora es solo un refuerzo de seguridad: no crea tablas.)


---

## Novedades v33

- **Se quitó el numerito junto a "Productos"** en el menú del panel (el aviso de productos agotados o con stock bajo). Los avisos de **Pedidos** y **Reseñas** siguen igual. El stock bajo se sigue viendo en las tarjetas de cada producto, en la pestaña Productos y en Estadísticas. No requiere SQL.


---

## Novedades v34

**Ejecuta `sql/12_refuerzo_seguridad.sql`** en Supabase (SQL Editor). Es seguro repetirlo y no crea tablas.

- **Se quitó "Duplicar" de Productos.** Copiaba el stock de la prenda original, y una prenda nueva es otro artículo: se podía vender stock que no existe. Para agregar un producto parecido se usa **Agregar producto**.
- **Seguridad:** la función que cambia el estado de un pedido (`actualizar_estado_pedido`) solo quedaba protegida si se ejecutaba el antiguo `12_cancelar_parcial_pedido.sql`, que el README decía que se podía saltar. Ahora el archivo 12 es un refuerzo corto y obligatorio que le quita el permiso al público y borra la función vieja de cancelar prendas.
- README: se quitaron las instrucciones de "Cancelar prendas" y "Duplicar", que ya no existen.
