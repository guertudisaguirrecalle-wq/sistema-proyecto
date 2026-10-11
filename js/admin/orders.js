/* =========================================================
   ADMIN — Pedidos
   Muestra el historial de pedidos con sus productos, tallas,
   cantidades y totales. Solo lectura (los pedidos se crean
   desde la tienda, vía la función crear_pedido en Supabase).
   ========================================================= */

let ADMIN_ORDERS = [];
let ORDER_FILTER = "todos"; // todos | pendiente | confirmado | enviado | cancelado | nota
let ORDER_SEARCH = "";
let ADMIN_COMPRA_N = new Map(); // id de pedido -> n.º de compra de esa clienta (ver numerarCompras)

/* ---------- Notificación de pedidos nuevos (numerito de aviso en el menú) ----------
   La marca de "hasta cuándo ya vi los pedidos" se guarda en Supabase
   (tabla admin_estado), no en el navegador, para que el aviso esté
   igual sin importar desde qué dispositivo entres al panel. */

async function fetchPedidosVistosHasta() {
  const { data, error } = await sb.from("admin_estado").select("pedidos_vistos_hasta").eq("id", 1).single();
  if (error || !data) return new Date(0).toISOString(); // si falla, se asume que nada se ha visto
  return data.pedidos_vistos_hasta;
}

/** Se llama al iniciar el panel para que el numerito ya aparezca en el
 *  menú lateral aunque todavía no se haya entrado a la pestaña "Pedidos". */
async function refreshPedidosBadge() {
  const badge = document.getElementById("pedidosNuevosBadge");
  const badgeRec = document.getElementById("pedidosRecurrentesBadge");
  if (!badge) return;

  const vistosHasta = await fetchPedidosVistosHasta();
  const { count, error } = await sb
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .gt("created_at", vistosHasta);
  if (error) return;

  if (count > 0) {
    badge.textContent = count;
    badge.title = count === 1 ? "1 pedido nuevo" : `${count} pedidos nuevos`;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }

  // Cuántos de esos pedidos nuevos son recompras de clientas que ya habían comprado.
  if (!badgeRec) return;
  badgeRec.style.display = "none";
  if (!(count > 0)) return;
  try {
    const todos = await traerPaginado(() => sb
      .from("pedidos")
      .select("id, estado, created_at, clientes ( correo, telefono )")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }));
    const numeros = numerarCompras(todos);
    const limite = new Date(vistosHasta).getTime();
    const recompras = todos.filter(
      (p) => new Date(p.created_at).getTime() > limite && (numeros.get(p.id) || 0) >= 2
    ).length;
    if (recompras > 0) {
      badgeRec.textContent = "↻ " + recompras;
      badgeRec.title = recompras === 1
        ? "1 de los pedidos nuevos es de una clienta recurrente"
        : `${recompras} de los pedidos nuevos son de clientas recurrentes`;
      badgeRec.style.display = "inline-flex";
    }
  } catch (err) {
    console.error("No se pudo calcular el aviso de recurrentes:", err);
  }
}

/** Se llama apenas se entra a la pestaña "Pedidos": marca todo como
 *  visto (sin que la clienta o el admin tengan que apretar nada más)
 *  y oculta el numerito de aviso de inmediato. */
async function marcarPedidosVistos() {
  const badge = document.getElementById("pedidosNuevosBadge");
  if (badge) badge.style.display = "none"; // respuesta inmediata, no espera a Supabase
  const badgeRec = document.getElementById("pedidosRecurrentesBadge");
  if (badgeRec) badgeRec.style.display = "none";

  const { error } = await sb
    .from("admin_estado")
    .update({ pedidos_vistos_hasta: new Date().toISOString() })
    .eq("id", 1);
  if (error) console.error("No se pudo marcar los pedidos como vistos:", error);
}

/** ¿La tabla pedidos ya tiene la columna costo_envio (sql/14)? Se averigua una sola vez.
 *  Así, si todavía no se ejecutó el 14, la lista de pedidos sigue funcionando igual que antes. */
let PEDIDOS_TIENEN_ENVIO = null;
async function columnaEnvioPedidos() {
  if (PEDIDOS_TIENEN_ENVIO === null) {
    const { error } = await sb.from("pedidos").select("costo_envio").limit(1);
    PEDIDOS_TIENEN_ENVIO = !error;
  }
  return PEDIDOS_TIENEN_ENVIO ? "costo_envio, " : "";
}

/** Lo que paga la clienta: prendas + envío (el envío es 0 si no se cobró). */
function totalAPagar(o) {
  return Number(o.total) + (Number(o.costo_envio) || 0);
}

// Consultas de pedidos a Supabase.
const AdminOrders = {
  // Trae todos los pedidos con su cliente y el detalle de productos.
  async fetchAll() {
    // traerPaginado (stats.js) pide de 1000 en 1000: sin eso, Supabase cortaba la lista en 1000 pedidos sin avisar.
    const colEnvio = await columnaEnvioPedidos();
    const data = await traerPaginado(() => sb
      .from("pedidos")
      .select(`
        id, total, ${colEnvio}estado, created_at, notas_internas,
        clientes ( nombre_completo, telefono, correo ),
        detalle_pedidos ( id, talla, cantidad, precio_unitario, subtotal, productos ( nombre, imagen_url, categorias ( nombre ) ) )
      `)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }));

    ADMIN_ORDERS = data || [];
    ADMIN_COMPRA_N = numerarCompras(ADMIN_ORDERS);
    return ADMIN_ORDERS;
  },

  // Cambia el estado de un pedido usando la función de Supabase
  // "actualizar_estado_pedido", que además devuelve o vuelve a
  // descontar el stock según corresponda (ver sql/09_actualizar_estado_pedido.sql).
  // No se hace con un UPDATE directo a la tabla porque eso dejaría el
  // stock desincronizado al cancelar o reactivar un pedido.
  async updateEstado(id, estado) {
    const { error } = await sb.rpc("actualizar_estado_pedido", {
      p_pedido_id: id,
      p_nuevo_estado: estado,
    });
    if (error) throw error;
  },

  // Guarda la nota interna del pedido (solo la ve el admin; ver sql/07 y sql/11).
  async updateNotas(id, texto) {
    const { error } = await sb.from("pedidos").update({ notas_internas: texto }).eq("id", id);
    if (error) throw error;
  },
};

// Texto y color (clase CSS) que se muestra para cada estado de pedido.
const ESTADO_LABELS = {
  pendiente: { texto: "Pendiente", clase: "badge-warn" },
  confirmado: { texto: "Confirmado", clase: "badge-ok" },
  enviado: { texto: "Enviado", clase: "badge-ok" },
  cancelado: { texto: "Cancelado", clase: "badge-off" },
};

// Carga los pedidos y dibuja los totales y la tabla.
async function loadOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Cargando pedidos...</td></tr>`;

  await AdminOrders.fetchAll();

  // El buscador se conecta una sola vez.
  const buscador = document.getElementById("orderSearch");
  if (buscador && !buscador.dataset.listo) {
    buscador.dataset.listo = "1";
    buscador.addEventListener("input", debounce((e) => {
      ORDER_SEARCH = e.target.value;
      renderOrdersTable();
    }, 250));
  }

  renderOrderStats();
  renderOrderFilters();
  renderOrdersTable();
}

// Texto sin tildes ni mayúsculas, para que "perez" encuentre "Pérez".
function normalizarTexto(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Aplica el filtro de estado y el buscador a la lista de pedidos.
function pedidosFiltrados() {
  const q = normalizarTexto(ORDER_SEARCH.trim());
  return ADMIN_ORDERS.filter((o) => {
    if (ORDER_FILTER === "nota") { if (!(o.notas_internas || "").trim()) return false; }
    else if (ORDER_FILTER !== "todos" && o.estado !== ORDER_FILTER) return false;
    if (!q) return true;
    const c = o.clientes || {};
    return normalizarTexto(`${c.nombre_completo} ${c.telefono} ${c.correo}`).includes(q);
  });
}

// Botones de filtro con el conteo de cada estado.
function renderOrderFilters() {
  const wrap = document.getElementById("orderStateFilters");
  if (!wrap) return;
  const cuenta = (est) => ADMIN_ORDERS.filter((o) => o.estado === est).length;
  const conNota = ADMIN_ORDERS.filter((o) => (o.notas_internas || "").trim()).length;
  const filtros = [
    ["todos", `Todos (${ADMIN_ORDERS.length})`],
    ["pendiente", `Pendientes (${cuenta("pendiente")})`],
    ["confirmado", `Confirmados (${cuenta("confirmado")})`],
    ["enviado", `Enviados (${cuenta("enviado")})`],
    ["cancelado", `Cancelados (${cuenta("cancelado")})`],
  ];
  if (conNota > 0) filtros.push(["nota", `Con nota (${conNota})`]);
  // Si el filtro elegido ya no existe (ej. se borró la última nota), se vuelve a "Todos".
  if (!filtros.some(([k]) => k === ORDER_FILTER)) ORDER_FILTER = "todos";
  wrap.innerHTML = filtros.map(([k, txt]) =>
    `<button class="pill ${ORDER_FILTER === k ? "active" : ""}" data-f="${k}">${txt}</button>`).join("");
  wrap.querySelectorAll(".pill").forEach((b) => b.addEventListener("click", () => {
    ORDER_FILTER = b.dataset.f;
    renderOrderFilters();
    renderOrdersTable();
  }));
}

// Calcula y muestra las tarjetas de resumen de pedidos.
function renderOrderStats() {
  const total = ADMIN_ORDERS.length;
  const pendientes = ADMIN_ORDERS.filter((o) => o.estado === "pendiente").length;
  const ventasTotal = ADMIN_ORDERS
    .filter((o) => o.estado !== "cancelado")
    .reduce((s, o) => s + Number(o.total), 0);

  document.getElementById("orderStats").innerHTML = `
    <div class="stat-card"><span>Pedidos totales</span><b>${total}</b></div>
    <div class="stat-card"><span>Pendientes</span><b>${pendientes}</b></div>
    <div class="stat-card"><span>Ventas registradas</span><b>${formatBs(ventasTotal)}</b></div>
  `;
}

// Dibuja una fila por cada pedido.
function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");

  if (!ADMIN_ORDERS.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Todavía no se ha registrado ningún pedido.</td></tr>`;
    return;
  }

  const lista = pedidosFiltrados();
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Ningún pedido coincide con el filtro o la búsqueda.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((o) => {
    const fecha = new Date(o.created_at).toLocaleDateString("es-BO", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const cliente = o.clientes || {};
    const nProductos = (o.detalle_pedidos || []).reduce((s, d) => s + d.cantidad, 0);
    const estado = ESTADO_LABELS[o.estado] || ESTADO_LABELS.pendiente;

    return `
    <tr style="cursor:pointer;" onclick="openOrderDetail('${o.id}')">
      <td>${fecha}</td>
      <td>${escapeHtml(cliente.nombre_completo || "—")} ${etiquetaRecurrente(ADMIN_COMPRA_N.get(o.id))}${o.notas_internas ? `<span class="badge badge-nota" title="${escapeHtml(o.notas_internas)}">✎ Nota</span>` : ""}</td>
      <td>${escapeHtml(cliente.telefono || "—")}</td>
      <td>${nProductos} prenda(s)</td>
      <td><b>${formatBs(o.total)}</b></td>
      <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
    </tr>`;
  }).join("");
}

/* ---------- Avisar a la clienta por WhatsApp ----------
   Arma el enlace con el número de la clienta y un mensaje ya escrito según el estado
   actual del pedido (con las prendas y el total vigentes, ya sin lo que se canceló). */
// (La normalización del teléfono y el armado del enlace están en utils.js: normalizarWhatsAppNumero / enlaceWhatsApp.)

function mensajeWhatsAppPedido(o) {
  const nombre = ((o.clientes || {}).nombre_completo || "").trim().split(/\s+/)[0];
  const items = (o.detalle_pedidos || [])
    .map((d) => `• ${d.cantidad} × ${(d.productos || {}).nombre || "Producto"} (talla ${d.talla})`).join("\n");
  const saludo = `Hola${nombre ? " " + nombre : ""}, te escribimos de Couture Byte Market.`;
  const envio = Number(o.costo_envio) || 0;
  const total = envio > 0 ? `${formatBs(totalAPagar(o))} (incluye envío ${formatBs(envio)})` : formatBs(o.total);
  if (o.estado === "cancelado" || !items) {
    return `${saludo}\n\nTu pedido fue cancelado. Si tienes dudas o quieres hacer uno nuevo, escríbenos.`;
  }
  const cuerpo = {
    pendiente: "Recibimos tu pedido:",
    confirmado: "Tu pedido está confirmado ✅",
    enviado: "Tu pedido ya fue enviado 🚚",
  }[o.estado] || "Sobre tu pedido:";
  const cierre = {
    pendiente: "En cuanto confirmemos tu pago te avisamos.",
    confirmado: "Coordinamos contigo la entrega.",
    enviado: "¡Gracias por tu compra!",
  }[o.estado] || "";
  return `${saludo}\n\n${cuerpo}\n${items}\nTotal: ${total}\n\n${cierre}`.trim();
}

function botonWhatsAppPedido(o) {
  const url = enlaceWhatsApp((o.clientes || {}).telefono, mensajeWhatsAppPedido(o));
  if (!url) {
    return `<div class="btn btn-ghost btn-block btn-wa disabled">Avisar por WhatsApp</div>
      <p class="form-hint">El teléfono de esta clienta no parece válido para WhatsApp.</p>`;
  }
  return `<a class="btn btn-ghost btn-block btn-wa" href="${url}" target="_blank" rel="noopener">💬 Avisar a la clienta por WhatsApp</a>
    <p class="form-hint">Se abre WhatsApp con el mensaje ya escrito según el estado del pedido. Tú decides si lo envías.</p>`;
}

/* ---------- Imprimir el pedido (hoja para armar el paquete de entrega) ----------
   Arma una hoja limpia en un marco invisible y abre el cuadro de impresión del navegador:
   clienta, prendas con talla y cantidad, total y la nota interna. No toca la base de datos. */
function imprimirPedido() {
  const o = ORDEN_EN_DETALLE;
  if (!o) return;
  const c = o.clientes || {};
  const estado = (ESTADO_LABELS[o.estado] || ESTADO_LABELS.pendiente).texto;
  // Si hay una nota escrita en pantalla (aunque no se haya guardado) es la que se imprime.
  const ta = document.getElementById("orderNotasInput");
  const nota = (ta ? ta.value : o.notas_internas || "").trim();

  const filas = (o.detalle_pedidos || []).map((d) => {
    const unit = d.precio_unitario != null ? Number(d.precio_unitario) : Number(d.subtotal) / (d.cantidad || 1);
    return `<tr>
      <td class="chk">☐</td>
      <td>${escapeHtml((d.productos || {}).nombre || "Producto")}</td>
      <td class="c">${escapeHtml(d.talla)}</td>
      <td class="c">${d.cantidad}</td>
      <td class="r">${formatBs(unit)}</td>
      <td class="r">${formatBs(d.subtotal)}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pedido ${escapeHtml(o.id.slice(0, 8).toUpperCase())}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 13px; }
    h1 { font-size: 20px; margin: 0 0 2px; } .sub { color: #666; margin-bottom: 18px; }
    .box { border: 1px solid #bbb; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { text-align: left; border-bottom: 2px solid #222; padding: 6px 4px; font-size: 12px; }
    td { border-bottom: 1px solid #ddd; padding: 8px 4px; }
    .c { text-align: center; } .r { text-align: right; } .chk { width: 22px; font-size: 16px; }
    .total { text-align: right; font-size: 18px; font-weight: bold; margin-bottom: 18px; }
    .nota { white-space: pre-wrap; min-height: 40px; }
    .firma { margin-top: 36px; display: flex; gap: 40px; } .firma div { flex: 1; border-top: 1px solid #222; padding-top: 4px; font-size: 12px; color: #555; }
  </style></head><body>
    <h1>Couture Byte Market</h1>
    <div class="sub">Pedido ${escapeHtml(o.id.slice(0, 8).toUpperCase())} · ${fechaHora(o.created_at)} · Estado: ${escapeHtml(estado)}</div>
    <div class="box">
      <b>Clienta:</b> ${escapeHtml(c.nombre_completo || "—")}<br>
      <b>Teléfono:</b> ${escapeHtml(c.telefono || "—")}<br>
      <b>Correo:</b> ${escapeHtml(c.correo || "—")}
    </div>
    <table>
      <thead><tr><th></th><th>Prenda</th><th class="c">Talla</th><th class="c">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${filas || `<tr><td colspan="6" class="c">Este pedido no tiene prendas.</td></tr>`}</tbody>
    </table>
    ${Number(o.costo_envio) > 0 ? `<div style="text-align:right;">Prendas: ${formatBs(o.total)} · Envío: ${formatBs(o.costo_envio)}</div>` : ""}
    <div class="total">${Number(o.costo_envio) > 0 ? "Total a pagar" : "Total"}: ${formatBs(totalAPagar(o))}</div>
    <div class="box"><b>Nota:</b><div class="nota">${nota ? escapeHtml(nota) : "—"}</div></div>
    <div class="firma"><div>Preparado por</div><div>Recibido por</div></div>
  </body></html>`;

  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0;";
  document.body.appendChild(marco);
  const doc = marco.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    marco.contentWindow.focus();
    marco.contentWindow.print();
    setTimeout(() => marco.remove(), 2000);
  }, 300);
}

// Abre el detalle de un pedido que ya está cargado en memoria.
function openOrderDetail(id) {
  const o = ADMIN_ORDERS.find((x) => x.id === id);
  if (!o) return;
  renderOrderDetailModal(o, { readonly: false, compraN: ADMIN_COMPRA_N.get(o.id) });
}

/** Abre el detalle de un pedido a partir de su ID, consultándolo directo
 * a Supabase. Se usa desde la vista de Clientes, donde puede que el
 * pedido todavía no esté cargado en ADMIN_ORDERS (esa lista solo se
 * llena al visitar la pestaña "Pedidos"). Se muestra en modo solo
 * lectura: el estado del pedido solo se cambia desde "Pedidos". */
async function openOrderDetailById(id, compraN) {
  const colEnvio = await columnaEnvioPedidos();
  const { data, error } = await sb
    .from("pedidos")
    .select(`
      id, total, ${colEnvio}estado, created_at, notas_internas,
      clientes ( nombre_completo, telefono, correo ),
      detalle_pedidos ( id, talla, cantidad, precio_unitario, subtotal, productos ( nombre, imagen_url, categorias ( nombre ) ) )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error(error);
    showToast("No se pudo cargar el detalle de este pedido.", "error");
    return;
  }
  renderOrderDetailModal(data, { readonly: true, compraN });
}

// Arma el contenido del detalle del pedido (cliente, productos y estado).
let ORDEN_EN_DETALLE = null; // el pedido que se está viendo en la ventana (lo usa "Imprimir")

function renderOrderDetailModal(o, { readonly = false, compraN } = {}) {
  ORDEN_EN_DETALLE = o;
  const cliente = o.clientes || {};
  const fecha = fechaHora(o.created_at);

  const filas = (o.detalle_pedidos || []).map((d) => {
    const prod = d.productos || {};
    const catNombre = prod.categorias ? prod.categorias.nombre : "";
    return `
    <div class="order-summary-row">
      <div class="osr-thumb">
        <img src="${prod.imagen_url || ""}" alt="" onerror="handleImgError(this,${jsArg(catNombre || (prod.nombre || "prenda"))})"
             onclick="openLightbox(${jsArg(prod.imagen_url || "")},${jsArg(prod.nombre || "Producto")})">
      </div>
      <div class="osr-info">
        <span class="osr-name">${escapeHtml(prod.nombre || "Producto")}</span>
        <span class="osr-meta">Talla ${escapeHtml(d.talla)} × ${d.cantidad}</span>
      </div>
      <span class="osr-price">${formatBs(d.subtotal)}</span>
    </div>`;
  }).join("");

  const estadoActual = ESTADO_LABELS[o.estado] || ESTADO_LABELS.pendiente;
  const sinPrendas = !(o.detalle_pedidos || []).length;
  const estadoBloque = (readonly || sinPrendas)
    ? `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-alt); padding:12px 16px; border-radius:var(--radius-sm);">
        <span style="font-size:13px; font-weight:700;">Estado del pedido</span>
        <span class="badge ${estadoActual.clase}">${estadoActual.texto}</span>
      </div>
      <p class="form-hint" style="margin-top:8px;">${sinPrendas ? "Este pedido quedó sin prendas, por eso su estado ya no se puede cambiar." : "El estado del pedido solo se puede cambiar desde la pestaña \"Pedidos\"."}</p>`
    : `
      <label style="font-size:13px; font-weight:700; display:block; margin-bottom:8px;">Estado del pedido</label>
      <select class="select-elegant" id="orderEstadoSelect" style="width:100%;" onchange="changeOrderEstado('${o.id}', this.value)">
        ${Object.entries(ESTADO_LABELS).map(([val, l]) =>
          `<option value="${val}" ${o.estado === val ? "selected" : ""}>${l.texto}</option>`
        ).join("")}
      </select>`;

  const notaActual = o.notas_internas || "";
  const notasBloque = readonly
    ? (notaActual ? `
      <div class="order-notes">
        <label style="font-size:13px; font-weight:700; display:block; margin-bottom:8px;">Nota interna</label>
        <div class="nota-readonly">${escapeHtml(notaActual)}</div>
        <p class="form-hint">La nota solo se puede editar desde la pestaña "Pedidos".</p>
      </div>` : "")
    : `
      <div class="order-notes form-group">
        <label for="orderNotasInput">Nota interna <span style="font-weight:400; color:var(--text-faint);">(solo la ves tú, la clienta no)</span></label>
        <textarea id="orderNotasInput" rows="3" maxlength="500" placeholder="Ej: pagó la mitad, canceló una prenda, cambio de talla, entregar en la tarde...">${escapeHtml(notaActual)}</textarea>
        <div class="nota-chips">
          ${["Pagó la mitad", "Pagó todo", "Pagó un adelanto", "Falta pagar", "Cambio de talla", "Entregar en la tarde"].map((s) =>
            `<button type="button" class="nota-chip" onclick="insertarNotaRapida(${jsArg(s)})">${s}</button>`).join("")}
        </div>
        <button type="button" class="btn btn-primary btn-block" onclick="saveOrderNotas('${o.id}')">Guardar nota</button>
      </div>`;

  document.getElementById("orderDetailContent").innerHTML = `
    <div style="margin-bottom:16px; font-size:14px; color:var(--text-soft); line-height:1.8;">
      <div><b style="color:var(--text);">Cliente:</b> ${escapeHtml(cliente.nombre_completo || "—")} ${etiquetaRecurrente(compraN)}</div>
      <div><b style="color:var(--text);">Teléfono:</b> ${escapeHtml(cliente.telefono || "—")}</div>
      <div><b style="color:var(--text);">Correo:</b> ${escapeHtml(cliente.correo || "—")}</div>
      <div><b style="color:var(--text);">Fecha:</b> ${fecha}</div>
    </div>
    <div class="order-summary-box">${filas}</div>
    ${Number(o.costo_envio) > 0 ? `<div class="cart-total-row" style="margin:16px 0 0; font-size:14px; font-weight:400;"><span>Prendas</span><span>${formatBs(o.total)}</span></div>
    <div class="cart-total-row" style="margin:6px 0 0; font-size:14px; font-weight:400;"><span>Envío</span><span>${formatBs(o.costo_envio)}</span></div>` : ""}
    <div class="cart-total-row" style="margin:${Number(o.costo_envio) > 0 ? "6px" : "16px"} 0 16px;"><span>${Number(o.costo_envio) > 0 ? "Total a pagar" : "Total"}</span><b>${formatBs(totalAPagar(o))}</b></div>
    ${estadoBloque}
    ${botonWhatsAppPedido(o)}
    <button type="button" class="btn btn-ghost btn-block btn-wa" style="margin-top:10px;" onclick="imprimirPedido()">🖨️ Imprimir pedido</button>
    ${notasBloque}
  `;
  openModal("orderDetailModal");
}

// Agrega una frase rápida al cuadro de nota (sin borrar lo que ya se escribió).
function insertarNotaRapida(frase) {
  const ta = document.getElementById("orderNotasInput");
  if (!ta) return;
  const actual = ta.value.trim();
  ta.value = actual ? `${actual}. ${frase}` : frase;
  ta.focus();
}

// Guarda la nota interna del pedido y actualiza la tabla sin recargar todo.
async function saveOrderNotas(id) {
  const ta = document.getElementById("orderNotasInput");
  if (!ta) return;
  const texto = ta.value.trim();
  try {
    await AdminOrders.updateNotas(id, texto);
    const o = ADMIN_ORDERS.find((x) => x.id === id);
    if (o) o.notas_internas = texto;
    renderOrderFilters();
    renderOrdersTable();
    showToast(texto ? "Nota guardada." : "Nota borrada.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar la nota. Verifica que ejecutaste sql/11_notas_pedidos.sql en Supabase.", "error");
  }
}

// Guarda el nuevo estado del pedido y recarga la tabla.
const ORDEN_ESTADO = { pendiente: 0, confirmado: 1, enviado: 2 };

// Mensaje de confirmación cuando el cambio de estado es delicado (null si no hace falta).
function avisoCambioEstado(actual, nuevo) {
  if (!actual || actual === nuevo) return null;
  if (nuevo === "cancelado") return "¿Cancelar el pedido completo? Se devolverá el stock de todas sus prendas.";
  if (actual === "cancelado") return "¿Reactivar este pedido? Se volverá a descontar el stock de sus prendas.";
  if (ORDEN_ESTADO[nuevo] < ORDEN_ESTADO[actual]) return "Vas a regresar el pedido a un estado anterior. ¿Continuar?";
  return null;
}

// Vuelve a dibujar el detalle con los datos nuevos, sin perder la nota que se estaba escribiendo.
function reabrirDetalle(id) {
  const ta = document.getElementById("orderNotasInput");
  const escrito = ta ? ta.value : null;
  const o = ADMIN_ORDERS.find((x) => x.id === id);
  if (!o) return;
  renderOrderDetailModal(o, { readonly: false, compraN: ADMIN_COMPRA_N.get(o.id) });
  const nuevo = document.getElementById("orderNotasInput");
  if (nuevo && escrito !== null && escrito !== (o.notas_internas || "")) nuevo.value = escrito;
}

async function changeOrderEstado(id, estado) {
  const actual = (ADMIN_ORDERS.find((x) => x.id === id) || {}).estado;
  const aviso = avisoCambioEstado(actual, estado);
  if (aviso && !confirm(aviso)) {
    // El <select> ya cambió visualmente: se vuelve a dibujar con el estado real.
    reabrirDetalle(id);
    return;
  }
  try {
    await AdminOrders.updateEstado(id, estado);
    const mensaje = estado === "cancelado"
      ? "Pedido cancelado. El stock de las tallas fue devuelto."
      : "Estado del pedido actualizado.";
    showToast(mensaje, "success");
    await loadOrdersTable();
    reabrirDetalle(id); // actualiza el enlace de WhatsApp y los controles con el estado nuevo
  } catch (err) {
    console.error(err);
    showToast(explicarErrorEstadoPedido(err), "error");

    // El <select> del modal ya quedó visualmente en el valor nuevo aunque
    // la base de datos no cambió (la función falló). Se vuelve a dibujar
    // el modal con el estado real para que no quede desincronizado.
    const o = ADMIN_ORDERS.find((x) => x.id === id);
    if (o) renderOrderDetailModal(o, { readonly: false, compraN: ADMIN_COMPRA_N.get(o.id) });
  }
}

// Traduce los códigos de error que puede lanzar actualizar_estado_pedido
// (ver sql/09_actualizar_estado_pedido.sql) a un mensaje claro para el admin.
function explicarErrorEstadoPedido(err) {
  const msg = err?.message || "";
  if (msg.startsWith("STOCK_INSUFICIENTE_REACTIVAR")) {
    const [, talla, stock] = msg.split(":");
    return `No se puede reactivar: ya no hay stock suficiente en la talla ${talla} (quedan ${stock}).`;
  }
  if (msg.startsWith("PEDIDO_NO_ENCONTRADO")) {
    return "Este pedido ya no existe.";
  }
  if (msg.startsWith("PEDIDO_SIN_PRENDAS")) {
    return "No se puede reactivar: este pedido se quedó sin prendas (se cancelaron todas una por una).";
  }
  if (msg.startsWith("NO_AUTORIZADO")) {
    return "Tu sesión de administrador expiró o esta cuenta no tiene permiso. Vuelve a entrar al panel.";
  }
  return "No se pudo actualizar el estado del pedido.";
}
