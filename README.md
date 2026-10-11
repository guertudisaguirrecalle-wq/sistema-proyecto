# 🎀 Couture Byte Market

Tienda de ropa femenina en línea, con panel de administración. La clienta elige sus prendas, hace el pedido y le llega el mensaje por WhatsApp. La dueña controla productos, stock, pedidos y ventas desde el panel.

**Tecnologías:** HTML, CSS y JavaScript puro (sin instalar nada) + **Supabase** (base de datos, inicio de sesión y almacenamiento de fotos).

> El historial completo de versiones está en `docs/HISTORIAL_README.md` y `docs/CAMBIOS_REVISION.md`.

---

## ¿Qué hace?

**Tienda (lo que ve la clienta)**
- Catálogo con filtros por categoría, buscador y favoritos (♡).
- Ficha de producto con tallas, stock real por talla, guía de tallas, reseñas, ampliar foto y compartir (enlace y QR).
- Bolsa de compras y pedido con nombre, teléfono y correo. Métodos de pago: QR, transferencia o efectivo.
- Al confirmar, el pedido se guarda y se abre WhatsApp con el mensaje ya escrito.
- "Consultar mi pedido": la clienta ve el estado de sus últimos pedidos con teléfono y correo.
- Reseñas: se publican solo cuando la administradora las aprueba.

**Panel de administración (`admin.html`)**
- **Estadísticas:** ventas por período, por categoría y por día, productos más vendidos, clientas nuevas y recurrentes. Cuentan como venta todos los pedidos que no están cancelados (un pedido *pendiente* ya reservó stock; si se cancela, el stock vuelve y la venta deja de contar).
- **Pedidos:** filtros, buscador, estados (pendiente, confirmado, enviado, cancelado), notas internas, aviso por WhatsApp e impresión. Al cancelar, el stock vuelve solo.
- **Productos:** agregar, editar, desactivar o eliminar, con foto y stock por talla.
- **Clientes:** historial de compras de cada clienta.
- **Reseñas:** aprobar o borrar.
- **Configuración:** contacto, envío, métodos de pago, portada, tienda abierta o cerrada, aviso, horario, dirección y respaldo en Excel.

---

## Estructura

```
├── index.html, admin.html     → tienda y panel
├── css/                       → estilos
├── js/                        → código de la tienda (js/admin/ = panel)
├── sql/                       → archivos para crear la base de datos
└── docs/                      → historial y cambios
```

---

## Instalación

**1. Crear el proyecto en Supabase.** En [supabase.com](https://supabase.com): New Project, con nombre, contraseña y una región cercana.

**2. Crear la base de datos.** En Supabase → **SQL Editor**, copia el contenido de cada archivo de `sql/`, pégalo y pulsa **Run**, en este orden:

`01` → `02` → `03` → `04` (opcional, productos de ejemplo) → `06` → `07` → `08` → `09` → `10` → `11` → `12` → `13` → `14` → `15`

El `05` no hace falta. Quedan **9 tablas**. Casi todos se pueden repetir, con una excepción: el `14` reemplaza la función `crear_pedido` del `02` (y el `15` reemplaza `consultar_pedido` del `14`), así que **no vuelvas a correr el `02` después del `14`**: daría error.

**3. Conectar las claves.** En Supabase → Project Settings → API, copia **Project URL** y la clave **anon public** (nunca la `service_role`). Pégalas en `js/config.js`. Ahí mismo se cambian el WhatsApp y las redes por defecto.

**4. Crear tu usuario administrador.** En Supabase → Authentication → Users → Add user, con tu correo y contraseña (marca *Auto Confirm User*). Con ese correo entras a `admin.html`.

**5. Abrir la tienda.** Para probar: en la carpeta del proyecto ejecuta `python3 -m http.server 8000` y abre `http://localhost:8000`. Para publicarla: sube la carpeta a Netlify, Vercel o GitHub Pages.

---

## Seguridad

- Cualquiera puede **ver** productos, categorías y stock. Nadie puede modificarlos sin sesión de administrador (políticas RLS).
- Los pedidos se crean **solo** con la función `crear_pedido()`, que revisa el stock y calcula el total con los precios reales de la base de datos. No se puede comprar una talla agotada ni más unidades de las que hay.
- Los clientes y pedidos solo los lee quien tiene sesión iniciada.
- Cambiar el estado de un pedido solo lo puede hacer la administradora (`sql/12_refuerzo_seguridad.sql`).
- **Importante:** en Supabase → Authentication → Sign In / Providers, **desactiva "Allow new users to sign up"** y deja solo tu cuenta. Así nadie más puede crear un usuario y entrar al panel.

---

## Problemas comunes

- **Los productos no aparecen:** revisa `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `js/config.js` y que hayas corrido los SQL en orden.
- **No se suben fotos:** corre completo `sql/03_seguridad_rls.sql` (crea el almacenamiento de imágenes) e inicia sesión como administradora.
- **"Correo o contraseña incorrectos":** confirma que creaste el usuario en Supabase y marcaste *Auto Confirm User*.
- **El botón de cambiar estado no funciona:** falta `sql/09_actualizar_estado_pedido.sql`.
- **Configuración muestra un aviso:** falta correr el SQL que ella indica (`10`, `13` o `14`). Nada se rompe: solo esas opciones quedan sin usar.
