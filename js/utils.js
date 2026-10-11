/* =========================================================
   UTILIDADES GENERALES
   ========================================================= */

/** Formatea un número como moneda en Bolivianos. Ej: 180 -> "Bs. 180" */
function formatBs(valor) {
  const n = Number(valor) || 0;
  const conDecimales = n % 1 !== 0;
  return "Bs. " + n.toLocaleString("es-BO", {
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Muestra un aviso emergente (notificación) en la esquina superior derecha */
function showToast(mensaje, tipo = "success") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  const texto = document.createElement("span");
  texto.textContent = mensaje; // textContent: un nombre de producto con símbolos no puede romper el aviso
  toast.appendChild(texto);
  wrap.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/**
 * Genera el data-URI de la imagen de reemplazo elegante (percha + etiqueta) que
 * usa toda la tienda para fotos rotas o inexistentes. Se puede pedir
 * directo (por ejemplo, para una categoría que todavía no tiene fotos
 * reales) o dejar que handleImgError lo aplique cuando una imagen falla.
 */
function dressPlaceholderDataUri(etiqueta = "Couture Byte Market") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#F6C9D3"/>
        <stop offset="100%" stop-color="#E4D3F2"/>
      </linearGradient>
    </defs>
    <rect width="400" height="500" fill="url(#g)"/>
    <g transform="translate(200,220)" fill="none" stroke="#93697A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="0" cy="-58" r="14"/>
      <path d="M0 -44 L0 -20"/>
      <path d="M0 -20 L-55 40 L55 40 Z"/>
      <path d="M-55 10 L55 10"/>
    </g>
    <text x="200" y="330" font-family="Georgia, serif" font-size="22" fill="#93697A" text-anchor="middle">${etiqueta}</text>
    <text x="200" y="356" font-family="Arial, sans-serif" font-size="12" letter-spacing="2" fill="#B6A7A9" text-anchor="middle">COUTURE BYTE MARKET</text>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

/**
 * Plan B elegante para imágenes rotas o que no cargan.
 * Genera una imagen de reemplazo SVG en los colores de la marca, con
 * un pequeño ícono de percha, para que NUNCA se vea un ícono
 * de imagen rota en la tienda.
 * Uso: <img src="..." onerror="handleImgError(this,'vestido')">
 */
function handleImgError(imgEl, etiqueta = "Couture Byte Market") {
  // Evita bucles infinitos si la propia imagen de reemplazo fallara
  imgEl.onerror = null;
  imgEl.src = dressPlaceholderDataUri(etiqueta);
  imgEl.classList.add("img-fallback");
}

/** Espera a que la persona deje de escribir antes de buscar (técnica «debounce») */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Abre una ventana emergente (agrega la clase .open al fondo oscuro y bloquea el desplazamiento) */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

/** Indica si queda alguna capa abierta que deba mantener bloqueado el desplazamiento
 *  (otra ventana emergente, la imagen ampliada o el carrito). */
function hayCapaAbierta() {
  return !!document.querySelector(".modal-overlay.open, .lightbox-overlay.open, #cartDrawer.open");
}

/** Cierra una ventana emergente. El desplazamiento de la página solo se
 *  libera si no queda otra capa abierta (antes se liberaba siempre, y al
 *  cerrar la guía de tallas la página de atrás volvía a moverse). */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("open");
  if (!hayCapaAbierta()) document.body.style.overflow = "";
}

/** Escapa HTML para evitar inyección al mostrar texto de usuarios/productos */
/** Convierte un texto en un argumento seguro para un onclick/onerror escrito en HTML,
 *  ej.: onclick="abrir(${jsArg(nombre)})". Antes, un nombre con apóstrofe
 *  (D'Lux) rompía el código del botón y la foto dejaba de ampliarse. */
function jsArg(valor) {
  return escapeHtml(JSON.stringify(String(valor === null || valor === undefined ? "" : valor)));
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Valida un correo electrónico de forma básica */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Valida un teléfono (7 a 15 dígitos, admite espacios/guiones) */
function isValidPhone(phone) {
  const clean = phone.replace(/[\s\-()]/g, "");
  return /^\d{7,15}$/.test(clean);
}

/* =========================================================
   IMAGEN AMPLIADA (ventana con la foto en grande)
   Se usa tanto en la tienda (foto del producto en la ventana emergente de
   detalle) como en el panel admin (miniaturas de pedidos, clientes,
   reseñas y el ranking de productos más vendidos). Vive en utils.js
   porque ambas páginas (index.html y admin.html) lo comparten.
   Uso: <img onclick="openLightbox(url, 'Nombre del producto')">
   ========================================================= */
function openLightbox(src, alt) {
  if (!src) return; // si no hay foto real, no tiene sentido ampliar la imagen de reemplazo
  const overlay = document.getElementById("lightboxOverlay");
  const img = document.getElementById("lightboxImg");
  if (!overlay || !img) return;
  img.src = src;
  img.alt = alt || "";
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const overlay = document.getElementById("lightboxOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  // Si queda alguna otra ventana emergente abierta (ej. el detalle de producto o de
  // pedido desde donde se abrió la imagen), el desplazamiento sigue bloqueado.
  if (!hayCapaAbierta()) {
    document.body.style.overflow = "";
  }
}

function setupLightbox() {
  const overlay = document.getElementById("lightboxOverlay");
  const closeBtn = document.getElementById("lightboxClose");
  if (!overlay) return;
  overlay.addEventListener("click", closeLightbox);
  if (closeBtn) closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeLightbox();
  });
}

/** Convierte un arreglo de filas a un archivo Excel real (.xlsx) y dispara
 *  su descarga. Se usa para "Exportar ventas" y "Exportar stock bajo" en
 *  Estadísticas. Los números se guardan como números (no como texto) para
 *  que Excel pueda sumarlos, ordenarlos y filtrarlos. */
function downloadXlsx(filename, sheetName, headers, rows) {
  if (typeof XLSX === "undefined") {
    showToast("No se pudo cargar el generador de Excel. Revisa tu conexión.", "error");
    return false;
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Ancho de cada columna según su contenido más largo
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(
      40,
      Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? "").length)) + 2
    ),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  return true;
}

/* =========================================================
   IDENTIDAD DE CLIENTAS (compartida por Estadísticas y Clientes)
   El sistema crea una fila NUEVA en "clientes" por cada pedido (ver
   crear_pedido en sql/02), así que un cliente_id identifica un PEDIDO,
   no a una persona. Para saber si dos pedidos son de la misma persona se
   comparan sus datos de contacto: correo (sin mayúsculas ni espacios) o
   teléfono (solo dígitos, últimos 8, para ignorar el prefijo +591).
   Vive aquí para que "Clientas nuevas/recurrentes" y la pestaña
   "Clientes" cuenten a las personas con la misma regla y los números
   siempre cuadren entre sí.
   ========================================================= */

/** Claves de identidad de un cliente: ["c:correo", "t:últimos8dígitos"]. */
function clavesPersona(cliente) {
  const claves = [];
  const correo = String((cliente && cliente.correo) || "").trim().toLowerCase();
  const digitos = String((cliente && cliente.telefono) || "").replace(/\D/g, "");
  if (correo) claves.push("c:" + correo);
  if (digitos) claves.push("t:" + digitos.slice(-8));
  return claves;
}

/** Agrupa elementos (pedidos o filas de clientes) en PERSONAS únicas: dos
 *  elementos son de la misma persona si comparten correo o teléfono, aunque
 *  sea de forma indirecta (A y B comparten correo, B y C comparten teléfono
 *  => A, B y C son la misma persona).
 *  `obtenerContacto(elemento)` debe devolver { correo, telefono }.
 *  Devuelve un arreglo de grupos; cada grupo es un arreglo de elementos.
 *  Un elemento sin ningún dato de contacto queda como su propia persona. */
function agruparPorContacto(elementos, obtenerContacto) {
  // Unión de conjuntos: cada clave apunta a una "raíz" común; dos claves con la misma raíz son la misma persona.
  const padre = new Map();
  const buscar = (k) => {
    let raiz = k;
    while (padre.get(raiz) !== raiz) raiz = padre.get(raiz);
    // Compresión de camino: deja todo apuntando directo a la raíz
    while (padre.get(k) !== raiz) {
      const siguiente = padre.get(k);
      padre.set(k, raiz);
      k = siguiente;
    }
    return raiz;
  };

  const clavesDe = elementos.map((el) => clavesPersona(obtenerContacto(el)));
  clavesDe.forEach((claves) => {
    claves.forEach((k) => { if (!padre.has(k)) padre.set(k, k); });
    for (let i = 1; i < claves.length; i++) {
      const ra = buscar(claves[0]);
      const rb = buscar(claves[i]);
      if (ra !== rb) padre.set(ra, rb);
    }
  });

  const grupos = new Map();
  const sueltos = [];
  elementos.forEach((el, i) => {
    if (!clavesDe[i].length) { sueltos.push([el]); return; }
    const raiz = buscar(clavesDe[i][0]);
    if (!grupos.has(raiz)) grupos.set(raiz, []);
    grupos.get(raiz).push(el);
  });
  return [...grupos.values(), ...sueltos];
}

/** Numera las compras de cada PERSONA (misma regla de identidad de arriba).
 *  Recibe pedidos con { id, estado, created_at, clientes: { correo, telefono } }
 *  y devuelve un Map: id del pedido -> número de compra de esa persona
 *  (1 = primera compra, 2 o más = recompra, o sea clienta recurrente).
 *  Los pedidos cancelados no cuentan como compra y no aparecen en el Map. */
function numerarCompras(pedidos) {
  const numeros = new Map();
  agruparPorContacto(pedidos, (p) => p.clientes).forEach((grupo) => {
    grupo
      .filter((p) => p.estado !== "cancelado")
      .sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || String(a.id).localeCompare(String(b.id)))
      .forEach((p, i) => numeros.set(p.id, i + 1));
  });
  return numeros;
}

/** Etiqueta "Recurrente" lista para pegar en HTML (vacía si es su primera compra). */
function etiquetaRecurrente(numeroCompra, titulo) {
  if (!numeroCompra || numeroCompra < 2) return "";
  const ayuda = titulo || `Compra n.º ${numeroCompra} de esta clienta`;
  return `<span class="badge badge-recurrente" title="${ayuda}">↻ Recurrente</span>`;
}

/** Fecha y hora legibles, SIN segundos y con am/pm, ej. "04 oct 2026, 3:30 pm" (hora local).
 *  Se usa en Clientes y en el detalle de pedidos para que se vea igual en todos lados. */
function fechaHora(iso) {
  return new Date(iso)
    .toLocaleString("es-BO", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    })
    // El navegador escribe "p. m." (con puntos y espacios raros): se deja como "pm" / "am".
    .replace(/[\s\u00a0\u202f]*([ap])\.?[\s\u00a0\u202f]*m\.?/i, (_, x) => " " + x.toLowerCase() + "m");
}


/* ---------- Fotos: borrar del almacenamiento las que ya nadie usa (solo panel admin) ----------
   Al reemplazar o quitar una foto, la anterior se quedaba guardada para siempre en Supabase
   Storage (que tiene espacio limitado). Esta función la borra, pero SOLO si:
   - es una foto de nuestro bucket (nunca una dirección externa), y
   - ningún producto ni la configuración (portada / QR) la sigue usando.
   Ante cualquier duda o error NO borra nada: es mejor una foto de más que una foto menos. */
async function borrarImagenSiHuerfana(url) {
  try {
    if (!url || typeof url !== "string") return;
    const marca = `/object/public/${APP_CONFIG.STORAGE_BUCKET}/`;
    const i = url.indexOf(marca);
    if (i < 0) return;
    const ruta = decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
    if (!ruta) return;

    const consultas = [
      sb.from("productos").select("id", { count: "exact", head: true }).eq("imagen_url", url),
      sb.from("configuracion").select("id", { count: "exact", head: true }).eq("portada_url", url),
      sb.from("configuracion").select("id", { count: "exact", head: true }).eq("qr_imagen_url", url),
    ];
    const resultados = await Promise.all(consultas);
    // Si alguna consulta falla (ej. columna que no existe todavía) o la foto sigue en uso, no se borra.
    if (resultados.some((r) => r.error || (r.count || 0) > 0)) return;

    await sb.storage.from(APP_CONFIG.STORAGE_BUCKET).remove([ruta]);
  } catch (err) {
    console.warn("No se pudo limpiar la foto anterior:", err);
  }
}


/* ---------- Contacto: WhatsApp e Instagram (usados por la tienda y por el panel) ---------- */
const CODIGO_PAIS_BOLIVIA = "591";

// Devuelve el número listo para wa.me (solo dígitos, con código de país) o null si no sirve.
//   "78411020" -> "59178411020" · "+591 7841-1020" -> "59178411020" · "123" -> null
function normalizarWhatsAppNumero(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) return CODIGO_PAIS_BOLIVIA + d;                        // celular boliviano sin código
  if (d.startsWith(CODIGO_PAIS_BOLIVIA) && d.length === 11) return d;        // ya trae el 591
  if (d.length >= 10 && d.length <= 15) return d;                            // otro país, con código
  return null;
}

// Convierte lo que escriba la dueña en un enlace de Instagram válido, o null si no sirve.
//   "@couturebite" / "couturebite" / "instagram.com/couturebite" / "https://instagram.com/couturebite"
function normalizarInstagramUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try { return new URL(s).hostname.includes("instagram.com") ? s : null; } catch { return null; }
  }
  if (/^(www\.)?instagram\.com\//i.test(s)) return "https://" + s.replace(/^www\./i, "");
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? `https://instagram.com/${s}` : null;
}

// Convierte lo que escriba la dueña en un enlace de Facebook válido, o null si no sirve.
//   "couturebite" / "@couturebite" / "facebook.com/couturebite" / "https://facebook.com/couturebite"
function normalizarFacebookUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  const esFb = (h) => /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(h);
  if (/^https?:\/\//i.test(s)) {
    try { return esFb(new URL(s).hostname) ? s : null; } catch { return null; }
  }
  if (/^(www\.|m\.)?(facebook|fb)\.com\//i.test(s)) return "https://" + s.replace(/^(www\.|m\.)/i, "");
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9.]{5,50}$/.test(s) ? `https://facebook.com/${s}` : null;
}

// Arma el enlace de WhatsApp con el mensaje ya escrito (null si el teléfono no sirve).
function enlaceWhatsApp(telefonoRaw, mensaje) {
  const tel = normalizarWhatsAppNumero(telefonoRaw);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje || "")}` : null;
}
