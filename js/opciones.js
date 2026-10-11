/* =========================================================
   OPCIONES DE LA TIENDA (todas se prenden desde Panel → Configuración)
   ---------------------------------------------------------
   Aviso arriba, tienda cerrada, horario, dirección y mapa propios,
   costo de envío y "Consultar mi pedido".
   Todo viene APAGADO: si no activas nada, la tienda se ve igual que siempre.
   Los valores salen de la tabla "configuracion" (sql/14_opciones_tienda.sql).
   ========================================================= */

const OPCIONES = {
  abierta: true,
  mensajeCerrada: "",
  envioActivo: false,
  envioCosto: 0,
  envioGratisDesde: null,
};

const MENSAJE_CERRADA_POR_DEFECTO = "Por ahora no estamos tomando pedidos. ¡Vuelve pronto!";

/** Cuánto se cobra de envío para un subtotal dado (0 si está apagado o si ya llegó al mínimo de envío gratis).
 *  Es solo para MOSTRAR: el monto que se guarda lo calcula la base de datos. */
function calcularEnvio(subtotal) {
  if (!OPCIONES.envioActivo) return 0;
  if (OPCIONES.envioGratisDesde != null && subtotal >= OPCIONES.envioGratisDesde) return 0;
  return OPCIONES.envioCosto || 0;
}

/** Lee la configuración guardada y muestra u oculta cada opción. Se llama desde loadStoreConfig (main.js). */
function aplicarOpcionesTienda(data) {
  try {
    // ----- Tienda abierta / cerrada y aviso -----
    OPCIONES.abierta = data.tienda_abierta !== false;
    OPCIONES.mensajeCerrada = String(data.mensaje_cerrada || "").trim() || MENSAJE_CERRADA_POR_DEFECTO;

    const aviso = document.getElementById("storeNotice");
    const textoAviso = document.getElementById("storeNoticeText");
    const avisoTexto = String(data.aviso_texto || "").trim();
    if (!OPCIONES.abierta) {
      textoAviso.textContent = OPCIONES.mensajeCerrada;
      aviso.classList.add("cerrada");
      aviso.hidden = false;
    } else if (data.aviso_activo && avisoTexto && !avisoCerradoEnEstaVisita(avisoTexto)) {
      textoAviso.textContent = avisoTexto;
      aviso.classList.remove("cerrada");
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }

    // ----- Horario de atención -----
    const horarioTexto = String(data.horario_texto || "").trim();
    const horarioItem = document.getElementById("horarioItem");
    if (data.horario_activo && horarioTexto) {
      document.getElementById("horarioTexto").textContent = horarioTexto;
      horarioItem.hidden = false;
    } else {
      horarioItem.hidden = true;
    }

    // ----- Dirección y mapa propios (si no, quedan los que trae la página) -----
    const direccion = String(data.direccion_texto || "").trim();
    if (data.direccion_activo && direccion) {
      document.getElementById("direccionTexto").textContent = direccion;
      document.getElementById("mapFrame").src =
        "https://www.google.com/maps?q=" + encodeURIComponent(direccion) + "&output=embed";
      const lista = document.getElementById("footerDireccion");
      lista.innerHTML = "";
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = direccion;
      li.appendChild(span);
      lista.appendChild(li);
    }

    // ----- Costo de envío -----
    OPCIONES.envioActivo = !!data.envio_costo_activo;
    OPCIONES.envioCosto = Number(data.envio_costo) || 0;
    OPCIONES.envioGratisDesde = data.envio_gratis_desde != null ? Number(data.envio_gratis_desde) : null;

    // ----- Consultar mi pedido -----
    // Mismo interruptor para los tres lugares: encabezado, menú del celular y pie de página.
    ["consultaPedidoNav", "consultaPedidoMnav", "consultaPedidoLi"].forEach((id) => {
      document.getElementById(id).hidden = !data.consulta_pedido_activo;
    });
  } catch (err) {
    console.error("No se pudieron aplicar las opciones de la tienda:", err);
  }
}

/* ---------- Aviso: la clienta lo puede cerrar y no vuelve a salir en esa visita ---------- */
function avisoCerradoEnEstaVisita(texto) {
  try { return sessionStorage.getItem("cbm_aviso_cerrado") === texto; } catch (_) { return false; }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("storeNoticeClose").addEventListener("click", () => {
    const aviso = document.getElementById("storeNotice");
    try { sessionStorage.setItem("cbm_aviso_cerrado", document.getElementById("storeNoticeText").textContent); } catch (_) {}
    aviso.hidden = true;
  });

  // Los tres accesos abren la misma ventana.
  const abrirConsulta = (e) => {
    if (e) e.preventDefault();
    document.getElementById("consultaResultado").innerHTML = "";
    openModal("consultaModal");
  };
  ["consultaPedidoBtn", "consultaPedidoNav", "consultaPedidoMnav"].forEach((id) => {
    document.getElementById(id).addEventListener("click", abrirConsulta);
  });
  document.getElementById("consultaForm").addEventListener("submit", consultarMisPedidos);
});

/* ---------- Consultar mi pedido ---------- */
const ESTADOS_PEDIDO_TEXTO = {
  pendiente: "Pendiente de confirmar",
  confirmado: "Confirmado",
  enviado: "Enviado",
  cancelado: "Cancelado",
};

/* Las prendas del pedido, con foto. Con sql/15 la base las manda una por una (lista);
   sin ese SQL llegan como un solo texto y se muestran como antes. */
function prendasConsultaHtml(prendas) {
  if (!Array.isArray(prendas)) {
    return `<div style="margin-top:6px;">${escapeHtml(prendas || "Sin prendas")}</div>`;
  }
  if (!prendas.length) return `<div style="margin-top:6px;">Sin prendas</div>`;
  return `<div class="consulta-prendas">${prendas.map((d) => {
    const nombre = d.nombre || "Prenda";
    const foto = d.imagen ? String(d.imagen) : "";
    return `
      <div class="order-summary-row">
        <div class="osr-thumb">
          <img src="${escapeHtml(foto)}" alt="${escapeHtml(nombre)}" loading="lazy"
               onerror="handleImgError(this,${jsArg(nombre)})"
               onclick="openLightbox(${jsArg(foto)},${jsArg(nombre)})">
        </div>
        <div class="osr-info">
          <span class="osr-name">${escapeHtml(nombre)}</span>
          <span class="osr-meta">Talla ${escapeHtml(d.talla)} × ${Number(d.cantidad) || 0}</span>
        </div>
        <span class="osr-price">${formatBs(d.subtotal)}</span>
      </div>`;
  }).join("")}</div>`;
}

async function consultarMisPedidos(e) {
  e.preventDefault();
  const tel = document.getElementById("consultaTelefono").value.trim();
  const correo = document.getElementById("consultaEmail").value.trim();
  const out = document.getElementById("consultaResultado");
  const btn = document.getElementById("consultaBtn");

  if (!isValidPhone(tel) || !isValidEmail(correo)) {
    out.innerHTML = `<p class="form-hint">Revisa tu teléfono y tu correo.</p>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Buscando...";
  try {
    const { data, error } = await sb.rpc("consultar_pedido", { p_telefono: tel, p_correo: correo });
    if (error) {
      const msg = error.message || "";
      out.innerHTML = `<p class="form-hint">${
        msg.includes("CONSULTA_NO_DISPONIBLE") ? "Esta consulta no está disponible por ahora. Escríbenos por WhatsApp."
        : msg.includes("DATOS_INVALIDOS") ? "Revisa tu teléfono y tu correo."
        : "No pudimos consultar tu pedido. Intenta de nuevo."}</p>`;
      return;
    }
    if (!data || !data.length) {
      out.innerHTML = `<p class="form-hint">No encontramos pedidos con esos datos. Revisa que sean los mismos que usaste al comprar.</p>`;
      return;
    }
    out.innerHTML = data.map((p) => {
      const envio = Number(p.costo_envio) || 0;
      const total = Number(p.total) + envio;
      const fecha = new Date(p.creado).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
      return `
        <div class="consulta-pedido">
          <div><span class="consulta-estado ${escapeHtml(p.estado)}">${escapeHtml(ESTADOS_PEDIDO_TEXTO[p.estado] || p.estado)}</span> · ${escapeHtml(fecha)}</div>
          ${prendasConsultaHtml(p.prendas)}
          <div style="margin-top:6px;"><b>Total: ${formatBs(total)}</b>${envio > 0 ? ` (incluye envío ${formatBs(envio)})` : ""}</div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error(err);
    out.innerHTML = `<p class="form-hint">No pudimos consultar tu pedido. Intenta de nuevo.</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Ver mis pedidos";
  }
}
