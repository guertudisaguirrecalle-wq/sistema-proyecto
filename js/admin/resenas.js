/* =========================================================
   ADMIN — Moderación de reseñas
   Cualquier clienta puede escribir una reseña, pero no aparece en la
   tienda hasta que se aprueba acá. Esto evita reseñas falsas, correo basura (spam) o
   comentarios ofensivos publicados sin control (la política RLS en
   Supabase es la que realmente impone la regla — ver sql/07_resenas_y_notas.sql).
   ========================================================= */

let ADMIN_RESENAS = [];

const AdminResenas = {
  // El admin (autenticado) sí puede ver TODAS las reseñas, incluidas
  // las pendientes — la política RLS "resenas_admin_todo" lo permite.
  async fetchAll() {
    const { data, error } = await sb
      .from("resenas")
      .select("*, productos ( nombre, imagen_url, categorias ( nombre ) )")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    ADMIN_RESENAS = data || [];
    return ADMIN_RESENAS;
  },

  // Marca la reseña como aprobada para que se vea en la tienda.
  async aprobar(id) {
    const { error } = await sb.from("resenas").update({ aprobada: true }).eq("id", id);
    if (error) throw error;
  },

  // Borra la reseña definitivamente.
  async eliminar(id) {
    const { error } = await sb.from("resenas").delete().eq("id", id);
    if (error) throw error;
  },
};

// Carga las reseñas y las separa en pendientes y aprobadas.
async function loadResenasView() {
  document.getElementById("resenasPendientesList").innerHTML = `<p class="empty-admin">Cargando reseñas...</p>`;
  document.getElementById("resenasAprobadasList").innerHTML = "";

  await AdminResenas.fetchAll();

  const pendientes = ADMIN_RESENAS.filter((r) => !r.aprobada);
  const aprobadas = ADMIN_RESENAS.filter((r) => r.aprobada);

  document.getElementById("resenasStats").innerHTML = `
    <div class="stat-card ${pendientes.length ? "stat-card-warn" : ""}"><span>Pendientes</span><b>${pendientes.length}</b></div>
    <div class="stat-card"><span>Aprobadas</span><b>${aprobadas.length}</b></div>
    <div class="stat-card"><span>Total</span><b>${ADMIN_RESENAS.length}</b></div>
  `;

  document.getElementById("resenasPendientesList").innerHTML = pendientes.length
    ? pendientes.map((r) => resenaAdminRowHtml(r, true)).join("")
    : `<p class="empty-admin">No hay reseñas pendientes por revisar. ✨</p>`;

  document.getElementById("resenasAprobadasList").innerHTML = aprobadas.length
    ? aprobadas.map((r) => resenaAdminRowHtml(r, false)).join("")
    : `<p class="empty-admin">Todavía no has aprobado ninguna reseña.</p>`;

  actualizarBadgeResenasPendientes(pendientes.length);
}

// Muestra u oculta el numerito de reseñas pendientes en el menú.
function actualizarBadgeResenasPendientes(pendientes) {
  const badge = document.getElementById("resenasPendientesBadge");
  if (!badge) return;
  if (pendientes > 0) {
    badge.textContent = pendientes;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

/** Se llama al iniciar el panel para que el número de pendientes ya
 *  aparezca en el menú lateral aunque todavía no se haya entrado a
 *  la pestaña "Reseñas". */
async function refreshResenasBadge() {
  const { count, error } = await sb
    .from("resenas")
    .select("id", { count: "exact", head: true })
    .eq("aprobada", false);
  if (error) return;
  actualizarBadgeResenasPendientes(count || 0);
}

// HTML de una reseña en el panel (con el botón Aprobar si está pendiente).
function resenaAdminRowHtml(r, esPendiente) {
  const prod = r.productos || {};
  const fecha = new Date(r.created_at).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
  const estrellas = "★".repeat(r.calificacion) + "☆".repeat(5 - r.calificacion);
  const catNombre = prod.categorias ? prod.categorias.nombre : "";

  return `
  <div class="resena-admin-row ${esPendiente ? "resena-admin-row-pending" : ""}">
    <img class="order-item-thumb" src="${prod.imagen_url || ""}" alt="${escapeHtml(prod.nombre || "Producto")}"
         onerror="handleImgError(this,${jsArg(catNombre)})"
         onclick="openLightbox(${jsArg(prod.imagen_url || "")},${jsArg(prod.nombre || "")})">
    <div class="resena-admin-body">
      <div class="resena-admin-head">
        <b>${escapeHtml(prod.nombre || "Producto eliminado")}</b>
        <span style="color:var(--rose-deep-dk); letter-spacing:1px;">${estrellas}</span>
      </div>
      <span class="resena-admin-author">${escapeHtml(r.nombre_clienta)} · ${fecha}</span>
      <p class="resena-admin-comment">${escapeHtml(r.comentario)}</p>
    </div>
    <div class="resena-admin-actions">
      ${esPendiente ? `<button class="btn btn-primary" style="padding:8px 16px; font-size:12.5px;" onclick="aprobarResena('${r.id}')">Aprobar</button>` : ""}
      <button class="icon-action danger" title="Eliminar reseña" onclick="eliminarResena('${r.id}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  </div>`;
}

// Aprueba la reseña y refresca la lista.
async function aprobarResena(id) {
  try {
    await AdminResenas.aprobar(id);
    showToast("Reseña aprobada, ya es visible en la tienda.", "success");
    await loadResenasView();
  } catch (err) {
    console.error(err);
    showToast("No se pudo aprobar la reseña.", "error");
  }
}

// Pide confirmación, elimina la reseña y refresca la lista.
async function eliminarResena(id) {
  if (!confirm("¿Eliminar esta reseña? No se puede deshacer.")) return;
  try {
    await AdminResenas.eliminar(id);
    showToast("Reseña eliminada.", "success");
    await loadResenasView();
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar la reseña.", "error");
  }
}
