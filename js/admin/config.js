/* =========================================================
   ADMIN — Configuración de la tienda
   Envío y métodos de pago, editables sin tocar código.
   Se guardan en la tabla "configuracion" de Supabase (fila única).
   ========================================================= */

let CONFIG_QR_UPLOADED_URL = null;
let CONFIG_QR_GUARDADO = null;          // QR que está guardado en la base (para limpiar el viejo al reemplazarlo)
let CONFIG_PORTADA_URL = null;          // URL de la portada elegida (null = usar la foto por defecto)
let CONFIG_TIENE_CONTACTO = false;        // false si todavía no se ejecutó sql/13_contacto_tienda.sql
let CONFIG_TIENE_OPCIONES = false;        // false si todavía no se ejecutó sql/14_opciones_tienda.sql
let CONFIG_PORTADA_TIENE_COLUMNA = false; // false si todavía no se ejecutó sql/10_portada.sql

// Lee y guarda la configuración de la tienda (envío y métodos de pago).
const AdminConfig = {
  // Trae la única fila de configuración (id = 1).
  async fetch() {
    const { data, error } = await sb.from("configuracion").select("*").eq("id", 1).single();
    if (error) {
      console.error(error);
      return null;
    }
    return data;
  },

  // Guarda los cambios en esa fila de configuración.
  async save(payload) {
    const { error } = await sb.from("configuracion").update(payload).eq("id", 1);
    if (error) throw error;
  },

  // Sube la foto de portada a Supabase Storage.
  async uploadPortada(file) {
    const ext = file.name.split(".").pop();
    const fileName = `portada_${Date.now()}.${ext}`;
    const { error } = await sb.storage
      .from(APP_CONFIG.STORAGE_BUCKET)
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from(APP_CONFIG.STORAGE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  },

  // Sube la imagen del QR de pago a Supabase Storage.
  async uploadQrImage(file) {
    const ext = file.name.split(".").pop();
    const fileName = `qr_pago_${Date.now()}.${ext}`;
    const { error } = await sb.storage
      .from(APP_CONFIG.STORAGE_BUCKET)
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from(APP_CONFIG.STORAGE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  },
};

// Rellena el formulario con la configuración guardada.
async function loadConfigView() {
  const cfg = await AdminConfig.fetch();
  if (!cfg) {
    showToast("No se pudo cargar la configuración. Revisa que hayas ejecutado sql/06_configuracion.sql", "error");
    return;
  }

  document.getElementById("cfgEnvioInfo").value = cfg.envio_info || "";

  // Contacto: si no hay nada guardado se muestran los valores actuales de js/config.js.
  CONFIG_TIENE_CONTACTO = "whatsapp" in cfg && "instagram_url" in cfg && "facebook_url" in cfg;
  document.getElementById("cfgWhatsapp").value = cfg.whatsapp || APP_CONFIG.WHATSAPP_NUMBER || "";
  document.getElementById("cfgInstagram").value = cfg.instagram_url || APP_CONFIG.INSTAGRAM_URL || "";
  document.getElementById("cfgFacebook").value = cfg.facebook_url || APP_CONFIG.FACEBOOK_URL || "";

  // Opciones extra (sql/14): si las columnas no existen se avisa y no se guardan.
  CONFIG_TIENE_OPCIONES = "tienda_abierta" in cfg && "envio_costo_activo" in cfg;
  document.getElementById("cfgOpcionesAviso").style.display = CONFIG_TIENE_OPCIONES ? "none" : "block";
  document.querySelectorAll(".cfg-opcion, #cfgTiendaAbierta").forEach((el) => {
    el.closest(".admin-panel") && (el.closest(".admin-panel").style.opacity = CONFIG_TIENE_OPCIONES ? "" : "0.55");
  });
  if (CONFIG_TIENE_OPCIONES) {
    document.getElementById("cfgTiendaAbierta").checked = cfg.tienda_abierta !== false;
    document.getElementById("cfgMensajeCerrada").value = cfg.mensaje_cerrada || "";
    document.getElementById("cfgAvisoActivo").checked = !!cfg.aviso_activo;
    document.getElementById("cfgAvisoTexto").value = cfg.aviso_texto || "";
    document.getElementById("cfgHorarioActivo").checked = !!cfg.horario_activo;
    document.getElementById("cfgHorarioTexto").value = cfg.horario_texto || "";
    document.getElementById("cfgDireccionActivo").checked = !!cfg.direccion_activo;
    document.getElementById("cfgDireccionTexto").value = cfg.direccion_texto || "";
    document.getElementById("cfgEnvioCostoActivo").checked = !!cfg.envio_costo_activo;
    document.getElementById("cfgEnvioCosto").value = cfg.envio_costo != null && Number(cfg.envio_costo) > 0 ? cfg.envio_costo : "";
    document.getElementById("cfgEnvioGratisDesde").value = cfg.envio_gratis_desde != null ? cfg.envio_gratis_desde : "";
    document.getElementById("cfgConsultaActivo").checked = !!cfg.consulta_pedido_activo;
  }

  CONFIG_PORTADA_TIENE_COLUMNA = "portada_url" in cfg;
  CONFIG_PORTADA_URL = cfg.portada_url || null;
  renderPortadaPreview();

  document.getElementById("cfgQrActivo").checked = !!cfg.qr_activo;
  document.getElementById("cfgQrBanco").value = cfg.qr_banco || "";
  document.getElementById("cfgQrTitular").value = cfg.qr_titular || "";
  CONFIG_QR_UPLOADED_URL = cfg.qr_imagen_url || null;
  CONFIG_QR_GUARDADO = cfg.qr_imagen_url || null;
  if (cfg.qr_imagen_url) {
    document.getElementById("cfgQrPreviewImg").src = cfg.qr_imagen_url;
    document.getElementById("cfgQrPreviewWrap").style.display = "block";
  } else {
    // Sin QR guardado: se limpia la vista previa para no mostrar una imagen que no se guardó.
    document.getElementById("cfgQrPreviewWrap").style.display = "none";
  }

  document.getElementById("cfgTransferenciaActivo").checked = !!cfg.transferencia_activo;
  document.getElementById("cfgTransferenciaBanco").value = cfg.transferencia_banco || "";
  document.getElementById("cfgTransferenciaCuenta").value = cfg.transferencia_cuenta || "";
  document.getElementById("cfgTransferenciaTitular").value = cfg.transferencia_titular || "";

  document.getElementById("cfgEfectivoActivo").checked = cfg.efectivo_activo !== false;
}

// Muestra (u oculta) la vista previa de la portada y el botón de "volver a la de por defecto".
function renderPortadaPreview() {
  const wrap = document.getElementById("cfgPortadaPreviewWrap");
  const img = document.getElementById("cfgPortadaPreviewImg");
  const quitar = document.getElementById("cfgPortadaQuitarBtn");
  if (CONFIG_PORTADA_URL) {
    img.src = CONFIG_PORTADA_URL;
    wrap.style.display = "block";
    quitar.style.display = "inline-flex";
  } else {
    wrap.style.display = "none";
    quitar.style.display = "none";
  }
}

// Conecta la zona de subida de la foto de portada.
function setupConfigPortadaUpload() {
  const input = document.getElementById("cfgPortadaInput");
  const zone = document.getElementById("cfgPortadaUploadZone");

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (file) await handlePortadaFile(file);
    input.value = "";
  });
  ["dragover", "dragleave", "drop"].forEach((evt) => zone.addEventListener(evt, (e) => e.preventDefault()));
  zone.addEventListener("dragover", () => zone.classList.add("dragover"));
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", async (e) => {
    zone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) await handlePortadaFile(file);
  });

  document.getElementById("cfgPortadaQuitarBtn").addEventListener("click", async () => {
    if (!CONFIG_PORTADA_TIENE_COLUMNA) return;
    try {
      const portadaAnterior = CONFIG_PORTADA_URL;
      await AdminConfig.save({ portada_url: null });
      CONFIG_PORTADA_URL = null;
      borrarImagenSiHuerfana(portadaAnterior);
      renderPortadaPreview();
      showToast("Se volvió a la foto de portada por defecto.", "success");
    } catch (err) {
      console.error(err);
      showToast("No se pudo restablecer la portada.", "error");
    }
  });
}

// Valida, sube y GUARDA la portada al instante (no hace falta "Guardar configuración").
async function handlePortadaFile(file) {
  if (!CONFIG_PORTADA_TIENE_COLUMNA) {
    showToast("Primero ejecuta sql/10_portada.sql en Supabase (SQL Editor).", "error");
    return;
  }
  if (!file.type.startsWith("image/")) {
    showToast("Por favor selecciona un archivo de imagen (JPG, PNG o WEBP).", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("La imagen es muy pesada. Usa una de máximo 5MB.", "error");
    return;
  }

  const progress = document.getElementById("cfgPortadaUploadProgress");
  const bar = document.getElementById("cfgPortadaUploadProgressBar");
  progress.style.display = "block";
  bar.style.width = "40%";
  try {
    const url = await AdminConfig.uploadPortada(file);
    const portadaAnterior = CONFIG_PORTADA_URL;
    await AdminConfig.save({ portada_url: url });
    bar.style.width = "100%";
    CONFIG_PORTADA_URL = url;
    borrarImagenSiHuerfana(portadaAnterior);
    renderPortadaPreview();
    showToast("Portada actualizada. Ya se ve en la tienda.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo subir la portada. Revisa la configuración de Supabase Storage.", "error");
  } finally {
    setTimeout(() => (progress.style.display = "none"), 600);
  }
}

// Conecta la zona de subida de la imagen del QR de pago.
function setupConfigQrUpload() {
  const input = document.getElementById("cfgQrImageInput");
  const zone = document.getElementById("cfgQrUploadZone");

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (file) await handleConfigQrFile(file);
    input.value = ""; // permite volver a elegir el mismo archivo
  });

  ["dragover", "dragleave", "drop"].forEach((evt) => {
    zone.addEventListener(evt, (e) => e.preventDefault());
  });
  zone.addEventListener("dragover", () => zone.classList.add("dragover"));
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", async (e) => {
    zone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) await handleConfigQrFile(file);
  });
}

// Valida el archivo (que sea imagen y pese máximo 5 MB) y lo sube.
async function handleConfigQrFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Por favor selecciona un archivo de imagen (JPG, PNG o WEBP).", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("La imagen es muy pesada. Usa una de máximo 5MB.", "error");
    return;
  }

  const urlAnterior = CONFIG_QR_UPLOADED_URL; // para volver a ella si la subida falla
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("cfgQrPreviewImg").src = e.target.result;
    document.getElementById("cfgQrPreviewWrap").style.display = "block";
  };
  reader.readAsDataURL(file);

  const progress = document.getElementById("cfgQrUploadProgress");
  const bar = document.getElementById("cfgQrUploadProgressBar");
  progress.style.display = "block";
  bar.style.width = "40%";

  try {
    const url = await AdminConfig.uploadQrImage(file);
    bar.style.width = "100%";
    CONFIG_QR_UPLOADED_URL = url;
    document.getElementById("cfgQrPreviewImg").src = url;
    showToast("Imagen de QR subida correctamente.", "success");
    setTimeout(() => (progress.style.display = "none"), 600);
  } catch (err) {
    console.error(err);
    // La vista previa mostraba la imagen nueva, pero NO se subió: se vuelve a la guardada.
    if (urlAnterior) {
      document.getElementById("cfgQrPreviewImg").src = urlAnterior;
    } else {
      document.getElementById("cfgQrPreviewWrap").style.display = "none";
    }
    showToast("No se pudo subir la imagen. Revisa la configuración de Supabase Storage.", "error");
    progress.style.display = "none";
  }
}

// Lee el formulario y guarda la configuración en Supabase.
async function saveConfig() {
  const btn = document.getElementById("saveConfigBtn");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const qrActivo = document.getElementById("cfgQrActivo").checked;
  if (qrActivo && !CONFIG_QR_UPLOADED_URL) {
    showToast("Activa el QR solo después de subir la imagen.", "error");
    btn.disabled = false;
    btn.textContent = "Guardar configuración";
    return;
  }

  // Contacto: se valida ANTES de guardar para no dejar la tienda con un número o enlace roto.
  const waRaw = document.getElementById("cfgWhatsapp").value.trim();
  const igRaw = document.getElementById("cfgInstagram").value.trim();
  const fbRaw = document.getElementById("cfgFacebook").value.trim();
  const waNorm = waRaw ? normalizarWhatsAppNumero(waRaw) : null;
  const igNorm = igRaw ? normalizarInstagramUrl(igRaw) : null;
  const fbNorm = fbRaw ? normalizarFacebookUrl(fbRaw) : null;
  if ((waRaw && !waNorm) || (igRaw && !igNorm) || (fbRaw && !fbNorm)) {
    showToast(waRaw && !waNorm
      ? "El número de WhatsApp no es válido. Escríbelo así: 78411020."
      : igRaw && !igNorm
        ? "El Instagram no es válido. Escríbelo así: @tu_usuario."
        : "El Facebook no es válido. Escríbelo así: tu_pagina o pega el enlace.", "error");
    btn.disabled = false;
    btn.textContent = "Guardar configuración";
    return;
  }
  if (!CONFIG_TIENE_CONTACTO && (waRaw || igRaw || fbRaw)) {
    // Solo avisa si cambió algo respecto a lo que ya usa la tienda.
    const cambioWa = waNorm && waNorm !== normalizarWhatsAppNumero(APP_CONFIG.WHATSAPP_NUMBER);
    const cambioIg = igNorm && igNorm !== APP_CONFIG.INSTAGRAM_URL;
    const cambioFb = fbNorm && fbNorm !== APP_CONFIG.FACEBOOK_URL;
    if (cambioWa || cambioIg || cambioFb) {
      showToast("Para guardar WhatsApp, Instagram y Facebook primero ejecuta sql/13_contacto_tienda.sql en Supabase.", "error");
      btn.disabled = false;
      btn.textContent = "Guardar configuración";
      return;
    }
  }

  // Opciones extra: se validan ANTES de guardar.
  let opciones = null;
  if (CONFIG_TIENE_OPCIONES) {
    const avisoActivo = document.getElementById("cfgAvisoActivo").checked;
    const avisoTexto = document.getElementById("cfgAvisoTexto").value.trim();
    const horarioActivo = document.getElementById("cfgHorarioActivo").checked;
    const horarioTexto = document.getElementById("cfgHorarioTexto").value.trim();
    const direccionActiva = document.getElementById("cfgDireccionActivo").checked;
    const direccionTexto = document.getElementById("cfgDireccionTexto").value.trim();
    const envioActivo = document.getElementById("cfgEnvioCostoActivo").checked;
    const costoRaw = document.getElementById("cfgEnvioCosto").value.trim();
    const gratisRaw = document.getElementById("cfgEnvioGratisDesde").value.trim();
    const costo = costoRaw === "" ? 0 : Number(costoRaw);
    const gratis = gratisRaw === "" ? null : Number(gratisRaw);

    let problema = null;
    if (avisoActivo && !avisoTexto) problema = "Escribe el texto del aviso o apaga ese interruptor.";
    else if (horarioActivo && !horarioTexto) problema = "Escribe el horario o apaga ese interruptor.";
    else if (direccionActiva && !direccionTexto) problema = "Escribe la dirección o apaga ese interruptor.";
    else if (!Number.isFinite(costo) || costo < 0 || costo > 10000) problema = "El costo de envío debe ser un número entre 0 y 10000.";
    else if (envioActivo && costo <= 0 && gratis === null) problema = "Escribe el costo de envío o apaga ese interruptor.";
    else if (gratis !== null && (!Number.isFinite(gratis) || gratis <= 0)) problema = "\"Gratis desde\" debe ser un monto mayor a 0 (o déjalo vacío).";
    if (problema) {
      showToast(problema, "error");
      btn.disabled = false;
      btn.textContent = "Guardar configuración";
      return;
    }
    opciones = {
      tienda_abierta: document.getElementById("cfgTiendaAbierta").checked,
      mensaje_cerrada: document.getElementById("cfgMensajeCerrada").value.trim() || null,
      aviso_activo: avisoActivo, aviso_texto: avisoTexto || null,
      horario_activo: horarioActivo, horario_texto: horarioTexto || null,
      direccion_activo: direccionActiva, direccion_texto: direccionTexto || null,
      envio_costo_activo: envioActivo, envio_costo: costo, envio_gratis_desde: gratis,
      consulta_pedido_activo: document.getElementById("cfgConsultaActivo").checked,
    };
  }

  const payload = {
    envio_info: document.getElementById("cfgEnvioInfo").value.trim(),
    qr_activo: qrActivo,
    qr_imagen_url: CONFIG_QR_UPLOADED_URL,
    qr_banco: document.getElementById("cfgQrBanco").value.trim(),
    qr_titular: document.getElementById("cfgQrTitular").value.trim(),
    transferencia_activo: document.getElementById("cfgTransferenciaActivo").checked,
    transferencia_banco: document.getElementById("cfgTransferenciaBanco").value.trim(),
    transferencia_cuenta: document.getElementById("cfgTransferenciaCuenta").value.trim(),
    transferencia_titular: document.getElementById("cfgTransferenciaTitular").value.trim(),
    efectivo_activo: document.getElementById("cfgEfectivoActivo").checked,
  };
  if (opciones) Object.assign(payload, opciones);
  // Vacío = null = la tienda usa el valor de js/config.js.
  if (CONFIG_TIENE_CONTACTO) {
    payload.whatsapp = waNorm;
    payload.instagram_url = igNorm;
    payload.facebook_url = fbNorm;
  }

  try {
    await AdminConfig.save(payload);
    if (CONFIG_QR_GUARDADO && CONFIG_QR_GUARDADO !== CONFIG_QR_UPLOADED_URL) borrarImagenSiHuerfana(CONFIG_QR_GUARDADO);
    CONFIG_QR_GUARDADO = CONFIG_QR_UPLOADED_URL;
    showToast("Configuración guardada.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar la configuración.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar configuración";
  }
}


/* ---------- Respaldo: pedidos y clientes a Excel ----------
   Solo LEE la base de datos y descarga un archivo. No cambia nada en la tienda. */
async function exportarPedidosExcel() {
  const btn = document.getElementById("respaldoPedidosBtn");
  btn.disabled = true;
  try {
    const pedidos = await AdminOrders.fetchAll();
    if (!pedidos.length) {
      showToast("Todavía no hay pedidos para descargar.", "error");
      return;
    }
    const headers = ["Fecha", "N° Pedido", "Cliente", "Teléfono", "Correo", "Estado", "Prendas", "Total prendas (Bs)", "Envío (Bs)", "Total a pagar (Bs)", "Nota interna"];
    const rows = pedidos.map((p) => {
      const c = p.clientes || {};
      const prendas = (p.detalle_pedidos || [])
        .map((d) => `${d.cantidad} × ${(d.productos || {}).nombre || "Producto eliminado"} (talla ${d.talla})`).join("; ");
      return [
        fechaHora(p.created_at), p.id.slice(0, 8), c.nombre_completo || "", c.telefono || "", c.correo || "",
        p.estado, prendas, Number(p.total), Number(p.costo_envio) || 0, totalAPagar(p), p.notas_internas || "",
      ];
    });
    if (downloadXlsx(`pedidos_${fechaLocalISO(new Date())}.xlsx`, "Pedidos", headers, rows)) {
      showToast("Respaldo de pedidos descargado.", "success");
    }
  } catch (err) {
    console.error(err);
    showToast("No se pudo preparar el respaldo de pedidos.", "error");
  } finally {
    btn.disabled = false;
  }
}

async function exportarClientesExcel() {
  const btn = document.getElementById("respaldoClientesBtn");
  btn.disabled = true;
  try {
    const clientes = await AdminCustomers.fetchAll();
    if (!clientes.length) {
      showToast("Todavía no hay clientes para descargar.", "error");
      return;
    }
    const headers = ["Nombre", "Teléfono", "Correo", "Pedidos realizados", "Compras válidas", "Total gastado (Bs)", "Cliente desde", "Última compra"];
    const rows = clientes.map((c) => [
      c.nombre_completo || c.nombre || "", c.telefono || "", c.correo || "",
      c.pedidos.length, comprasValidasOrdenadas(c.pedidos).length, totalGastadoPorPedidos(c.pedidos),
      fechaHora(c.cliente_desde), c.ultima_compra ? fechaHora(c.ultima_compra) : "",
    ]);
    if (downloadXlsx(`clientes_${fechaLocalISO(new Date())}.xlsx`, "Clientes", headers, rows)) {
      showToast("Respaldo de clientes descargado.", "success");
    }
  } catch (err) {
    console.error(err);
    showToast("No se pudo preparar el respaldo de clientes.", "error");
  } finally {
    btn.disabled = false;
  }
}
