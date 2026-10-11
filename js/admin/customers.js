/* =========================================================
   ADMIN — Clientes
   Muestra a las PERSONAS que han hecho pedidos. En la base de datos,
   cada pedido crea una fila nueva en "clientes" (ver crear_pedido en
   sql/02), así que si una misma clienta compra 3 veces hay 3 filas.
   Aquí esas filas se juntan en UNA sola persona usando la misma regla
   que Estadísticas (mismo correo o mismo teléfono, ver utils.js), para
   que "Clientas nuevas/recurrentes" y esta lista siempre cuadren.
   Cada fila es clicable y muestra el detalle: todos sus pedidos,
   con fecha, estado y total — y cada pedido se puede abrir para
   ver sus prendas con foto.
   ========================================================= */

let ADMIN_CUSTOMERS = []; // lista de PERSONAS (ya agrupadas)

// Junta en un solo texto los valores distintos (ej. dos correos de la misma persona).
function valoresUnicos(lista) {
  return [...new Set(lista.filter(Boolean))];
}

// Convierte las filas de "clientes" en personas únicas, con todos sus pedidos juntos.
function construirPersonas(filas) {
  const grupos = agruparPorContacto(filas, (fila) => fila);

  return grupos.map((grupo) => {
    // Del más reciente al más antiguo: el nombre/teléfono/correo que se muestra es el último usado.
    const ordenadas = [...grupo].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const pedidos = ordenadas.flatMap((fila) => fila.pedidos || []);
    return {
      id: ordenadas[0].id, // id de la fila más reciente: identifica a la persona en pantalla
      nombre_completo: ordenadas[0].nombre_completo,
      telefonos: valoresUnicos(ordenadas.map((f) => f.telefono)),
      correos: valoresUnicos(ordenadas.map((f) => f.correo)),
      cliente_desde: ordenadas[ordenadas.length - 1].created_at,
      // Última compra = el pedido más reciente que NO fue cancelado (null si todos se cancelaron).
      ultima_compra: ultimaCompra(pedidos),
      pedidos,
    };
  }).sort(compararPorUltimaCompra);
}

// Fecha del pedido no cancelado más reciente (o null).
function ultimaCompra(pedidos) {
  const fechas = pedidos
    .filter((p) => p.estado !== "cancelado")
    .map((p) => new Date(p.created_at).getTime());
  return fechas.length ? new Date(Math.max(...fechas)).toISOString() : null;
}

// Quien compró más recientemente va primero; quienes no tienen compras válidas, al final.
function compararPorUltimaCompra(a, b) {
  const ta = a.ultima_compra ? new Date(a.ultima_compra).getTime() : -Infinity;
  const tb = b.ultima_compra ? new Date(b.ultima_compra).getTime() : -Infinity;
  if (ta !== tb) return tb > ta ? 1 : -1;
  return new Date(b.cliente_desde) - new Date(a.cliente_desde);
}

// Compras válidas (no canceladas) de una persona, de la más antigua a la más nueva.
function comprasValidasOrdenadas(pedidos) {
  return pedidos
    .filter((p) => p.estado !== "cancelado")
    .sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || String(a.id).localeCompare(String(b.id)));
}

const AdminCustomers = {
  // Trae los clientes junto con sus pedidos y los agrupa en personas.
  async fetchAll() {
    // traerPaginado (stats.js): Supabase corta en 1000 filas por consulta; así se traen todas.
    const data = await traerPaginado(() => sb
      .from("clientes")
      .select("id, nombre_completo, telefono, correo, created_at, pedidos(id, total, estado, created_at)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }));
    ADMIN_CUSTOMERS = construirPersonas(data || []);
    return ADMIN_CUSTOMERS;
  },
};

// Carga los clientes y dibuja la tabla.
async function loadCustomersTable() {
  const tbody = document.getElementById("customersTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Cargando clientes...</td></tr>`;

  await AdminCustomers.fetchAll();
  renderCustomersTable();
}

// Suma lo gastado en pedidos NO cancelados.
function totalGastadoPorPedidos(pedidos) {
  return pedidos
    .filter((p) => p.estado !== "cancelado")
    .reduce((s, p) => s + Number(p.total), 0);
}

// Dibuja una fila por cada persona.
function renderCustomersTable() {
  const tbody = document.getElementById("customersTableBody");

  if (!ADMIN_CUSTOMERS.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-admin">Todavía no hay clientes registrados. Aparecerán aquí apenas se complete el primer pedido.</td></tr>`;
    return;
  }

  tbody.innerHTML = ADMIN_CUSTOMERS.map((c) => {
    const fecha = fechaHora(c.cliente_desde);
    const ultima = c.ultima_compra ? fechaHora(c.ultima_compra) : "—";
    const nPedidos = c.pedidos.length;
    const recurrente = comprasValidasOrdenadas(c.pedidos).length >= 2;

    return `
    <tr style="cursor:pointer;" onclick="openCustomerDetail('${c.id}')">
      <td><div class="admin-prod-name">${escapeHtml(c.nombre_completo)} ${recurrente ? etiquetaRecurrente(2, "Tiene 2 o más compras") : ""}</div></td>
      <td>${escapeHtml(c.telefonos.join(" / ") || "—")}</td>
      <td>${escapeHtml(c.correos.join(" / ") || "—")}</td>
      <td>${nPedidos} pedido${nPedidos === 1 ? "" : "s"} · <b>${formatBs(totalGastadoPorPedidos(c.pedidos))}</b></td>
      <td>${fecha}</td>
      <td><b>${ultima}</b></td>
    </tr>`;
  }).join("");
}

// Abre el detalle de una persona con su historial de pedidos.
function openCustomerDetail(id) {
  const c = ADMIN_CUSTOMERS.find((x) => x.id === id);
  if (!c) return;

  const pedidos = [...c.pedidos].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const totalGastado = totalGastadoPorPedidos(pedidos);
  // n.º de compra de cada pedido válido (1 = primera). Los cancelados no cuentan.
  const numeroDe = new Map(comprasValidasOrdenadas(pedidos).map((p, i) => [p.id, i + 1]));
  const esRecurrente = numeroDe.size >= 2;

  const filasPedidos = pedidos.length
    ? pedidos.map((p) => {
        const fecha = fechaHora(p.created_at);
        const estado = ESTADO_LABELS[p.estado] || ESTADO_LABELS.pendiente;
        return `
        <div class="customer-order-row" onclick="closeModal('customerDetailModal'); openOrderDetailById('${p.id}', ${numeroDe.get(p.id) || 0});">
          <div class="customer-order-info">
            <span class="customer-order-date">${fecha}</span>
            <span class="badge ${estado.clase}">${estado.texto}</span>
            ${numeroDe.get(p.id) ? `<span class="customer-order-n">Compra n.º ${numeroDe.get(p.id)}</span>` : ""}
          </div>
          <div class="customer-order-right">
            <b>${formatBs(p.total)}</b>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>`;
      }).join("")
    : `<p class="empty-admin" style="padding:14px 0;">Este cliente todavía no tiene pedidos.</p>`;

  // Botón de WhatsApp: reutiliza enlaceWhatsApp (utils.js), la misma función que usa Pedidos.
  const primerNombre = (c.nombre_completo || "").trim().split(/\s+/)[0];
  const saludo = `Hola${primerNombre ? " " + primerNombre : ""}, te escribimos de Couture Byte Market.`;
  const botonesWa = c.telefonos
    .map((tel) => ({ tel, url: enlaceWhatsApp(tel, saludo) }))
    .filter((x) => x.url)
    .map((x, _, arr) => `<a class="btn btn-ghost btn-block btn-wa" style="margin-top:8px;" href="${x.url}" target="_blank" rel="noopener">💬 Escribir por WhatsApp${arr.length > 1 ? " · " + escapeHtml(x.tel) : ""}</a>`)
    .join("");
  const bloqueWa = botonesWa || `<p class="form-hint">Esta clienta no tiene un teléfono válido para WhatsApp.</p>`;

  document.getElementById("customerDetailContent").innerHTML = `
    <div style="margin-bottom:18px; font-size:14px; color:var(--text-soft); line-height:1.8;">
      <div><b style="color:var(--text);">Nombre:</b> ${escapeHtml(c.nombre_completo)} ${esRecurrente ? etiquetaRecurrente(2, "Tiene 2 o más compras") : ""}</div>
      <div><b style="color:var(--text);">Teléfono:</b> ${escapeHtml(c.telefonos.join(" / ") || "—")}</div>
      <div><b style="color:var(--text);">Correo:</b> ${escapeHtml(c.correos.join(" / ") || "—")}</div>
      ${bloqueWa}
    </div>
    <div class="stats-row" style="margin-bottom:18px;">
      <div class="stat-card"><span>Pedidos</span><b>${pedidos.length}</b></div>
      <div class="stat-card"><span>Total gastado</span><b>${formatBs(totalGastado)}</b></div>
      <div class="stat-card"><span>Última compra</span><b style="font-size:16px;">${c.ultima_compra ? fechaHora(c.ultima_compra) : "—"}</b></div>
    </div>
    <label style="font-size:13px; font-weight:700; display:block; margin-bottom:8px;">Historial de pedidos</label>
    <div class="customer-orders-list">${filasPedidos}</div>
  `;

  openModal("customerDetailModal");
}
