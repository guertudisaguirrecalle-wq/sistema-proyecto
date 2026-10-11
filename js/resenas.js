/* =========================================================
   RESEÑAS DE PRODUCTOS

   Cómo funciona (importante para la defensa): cualquier clienta puede
   escribir una reseña, pero NO aparece en la tienda inmediatamente.
   Queda guardada como "pendiente" hasta que la administradora la
   aprueba desde el panel. Esto evita reseñas falsas, correo basura (spam), o
   comentarios ofensivos publicados sin control. La política de
   seguridad (RLS) en Supabase es la que realmente impone esta regla:
   incluso si alguien manipulara el código del navegador, la base de
   datos NO deja insertar una reseña ya marcada como "aprobada=true"
   desde el público — ver sql/07_resenas_y_notas.sql.
   ========================================================= */

const ResenasAPI = {
  /** Trae solo las reseñas ya aprobadas de un producto (lo que ve la clienta). */
  async fetchAprobadas(productoId) {
    const { data, error } = await sb
      .from("resenas")
      .select("*")
      .eq("producto_id", productoId)
      .eq("aprobada", true)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  },

  /** Envía una reseña nueva. Siempre queda con aprobada=false. */
  async enviar(productoId, nombre, calificacion, comentario) {
    const { error } = await sb.from("resenas").insert({
      producto_id: productoId,
      nombre_clienta: nombre,
      calificacion,
      comentario,
      aprobada: false,
    });
    if (error) throw error;
  },
};

// Muestra en el detalle del producto las reseñas aprobadas y el promedio de estrellas.
async function renderResenasSection(productoId, nombreProducto) {
  const wrap = document.getElementById("resenasWrap");
  wrap.innerHTML = `<p style="font-size:13px; color:var(--text-faint);">Cargando reseñas...</p>`;

  const resenas = await ResenasAPI.fetchAprobadas(productoId);
  const promedio = resenas.length
    ? (resenas.reduce((s, r) => s + r.calificacion, 0) / resenas.length).toFixed(1)
    : null;

  const estrellasHtml = (n) => {
    let html = "";
    for (let i = 1; i <= 5; i++) html += i <= n ? "★" : "☆";
    return html;
  };

  const listaHtml = resenas.length
    ? resenas.map((r) => `
        <div style="padding:12px 0; border-bottom:1px solid var(--champagne);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <b style="font-size:13.5px;">${escapeHtml(r.nombre_clienta)}</b>
            <span style="color:var(--rose-deep-dk); font-size:13px; letter-spacing:1px;">${estrellasHtml(r.calificacion)}</span>
          </div>
          <p style="font-size:13px; color:var(--text-soft); line-height:1.5;">${escapeHtml(r.comentario)}</p>
        </div>`).join("")
    : `<p style="font-size:13px; color:var(--text-faint);">Todavía no hay reseñas de este producto. ¡Sé la primera en dejar la tuya!</p>`;

  wrap.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <h3 style="font-size:16px; margin:0;">
        Reseñas ${promedio ? `<span style="color:var(--rose-deep-dk); font-size:14px; font-weight:700;">★ ${promedio} · ${resenas.length} opinión${resenas.length === 1 ? "" : "es"}</span>` : ""}
      </h3>
      <button type="button" class="size-guide-link" onclick="openResenaForm(${jsArg(productoId)}, ${jsArg(nombreProducto)})">✏️ Dejar mi reseña</button>
    </div>
    <div id="resenasList">${listaHtml}</div>
  `;
}

// Abre el formulario para escribir una reseña de este producto.
function openResenaForm(productoId, nombreProducto) {
  document.getElementById("resenaProductoNombre").textContent = nombreProducto;
  document.getElementById("resenaProductoId").value = productoId;
  document.getElementById("resenaForm").reset();
  document.getElementById("resenaProductoId").value = productoId;
  RESENA_CALIFICACION_SELECCIONADA = 0;
  actualizarEstrellasForm();
  openModal("resenaFormModal");
}

// Estrellas que eligió la clienta (0 = todavía no eligió).
let RESENA_CALIFICACION_SELECCIONADA = 0;

function seleccionarEstrella(n) {
  RESENA_CALIFICACION_SELECCIONADA = n;
  actualizarEstrellasForm();
}

// Pinta las estrellas llenas (★) o vacías (☆) según la calificación elegida.
function actualizarEstrellasForm() {
  document.querySelectorAll("#resenaEstrellasInput .estrella-input").forEach((el) => {
    const valor = parseInt(el.dataset.valor, 10);
    el.textContent = valor <= RESENA_CALIFICACION_SELECCIONADA ? "★" : "☆";
  });
}

// Valida el formulario y envía la reseña (queda pendiente hasta que la apruebe la administradora).
async function submitResenaForm(e) {
  e.preventDefault();
  const btn = document.getElementById("resenaSubmitBtn");

  if (RESENA_CALIFICACION_SELECCIONADA === 0) {
    showToast("Selecciona una calificación de estrellas.", "error");
    return;
  }
  const nombre = document.getElementById("resenaNombre").value.trim();
  const comentario = document.getElementById("resenaComentario").value.trim();
  const productoId = document.getElementById("resenaProductoId").value;

  if (!nombre || !comentario) {
    showToast("Completa tu nombre y tu comentario.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    await ResenasAPI.enviar(productoId, nombre, RESENA_CALIFICACION_SELECCIONADA, comentario);
    closeModal("resenaFormModal");
    showToast("¡Gracias! Tu reseña se publicará apenas la revisemos.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo enviar tu reseña. Intenta nuevamente.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar reseña";
  }
}
