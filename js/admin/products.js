/* =========================================================
   ADMIN — Gestión de productos, imágenes y stock por talla
   ========================================================= */

let ADMIN_CATEGORIAS = [];
let ADMIN_PRODUCTS = [];
let ADMIN_PRODUCT_SEARCH = "";
let UPLOADED_IMAGE_URL = null;
let IMAGEN_AL_ABRIR = null;   // foto que tenía el producto al abrir el formulario (para limpiar la vieja si se reemplaza)
// Controla la subida de imagen en curso: evita guardar el producto sin su foto
// mientras todavía se está subiendo, y evita que una subida vieja (de un
// formulario ya cerrado) le ponga su foto al producto equivocado.
let IMAGEN_SUBIENDO = false;
let IMAGEN_SUBIDA_ID = 0;
// Id del producto que se está editando (null = se está creando uno nuevo).
let EDITING_PRODUCT_ID = null;
// Stock de cada talla tal como estaba al ABRIR el formulario. Al guardar, solo se escriben las
// tallas que la administradora realmente cambió: si mientras tenía el formulario abierto una
// clienta compró, esa venta ya no se borra al guardar un cambio de precio o de nombre.
let STOCK_AL_ABRIR = {};

// Consultas y cambios de productos y categorías en Supabase.
const AdminProducts = {
  // Trae todas las categorías.
  async fetchCategorias() {
    const { data, error } = await sb.from("categorias").select("*").order("id");
    if (error) { console.error(error); return []; }
    ADMIN_CATEGORIAS = data || [];
    return ADMIN_CATEGORIAS;
  },

  // Crea una categoría nueva.
  async createCategoria(nombre) {
    const slug = nombre
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) throw Object.assign(new Error("NOMBRE_INVALIDO"), { code: "NOMBRE_INVALIDO" });

    const { data, error } = await sb
      .from("categorias")
      .insert({ nombre: nombre.trim(), slug })
      .select()
      .single();
    if (error) throw error;
    await this.fetchCategorias();
    return data;
  },

  // Elimina una categoría.
  async deleteCategoria(id) {
    const { error } = await sb.from("categorias").delete().eq("id", id);
    if (error) {
      // 23503 = hay productos usando esta categoría (llave foránea protegida)
      if (error.code === "23503") {
        const bloqueada = new Error("CATEGORIA_CON_PRODUCTOS");
        bloqueada.code = "CATEGORIA_CON_PRODUCTOS";
        throw bloqueada;
      }
      throw error;
    }
    await this.fetchCategorias();
  },

  // Trae todos los productos (activos e inactivos) con sus tallas y stock.
  async fetchAll() {
    const { data, error } = await sb
      .from("productos")
      .select("*, categorias(nombre, slug), producto_tallas(id, talla, stock)")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    ADMIN_PRODUCTS = data || [];
    return ADMIN_PRODUCTS;
  },

  // Suma el stock de todas las tallas de un producto.
  totalStock(p) {
    return (p.producto_tallas || []).reduce((s, t) => s + t.stock, 0);
  },

  /** Sube una imagen a la carpeta de almacenamiento (bucket) de Supabase Storage y retorna la URL pública */
  async uploadImage(file) {
    const ext = file.name.split(".").pop();
    const fileName = `producto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await sb.storage
      .from(APP_CONFIG.STORAGE_BUCKET)
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) throw error;

    const { data } = sb.storage.from(APP_CONFIG.STORAGE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  },

  // Crea o actualiza un producto y guarda el stock de cada talla.
  async saveProduct(payload, tallasStock, productId) {
    let prodId = productId;

    if (prodId) {
      const { error } = await sb.from("productos").update(payload).eq("id", prodId);
      if (error) throw error;
    } else {
      const { data, error } = await sb.from("productos").insert(payload).select().single();
      if (error) throw error;
      prodId = data.id;
    }

    // Actualizar tallas y stock en UNA sola operación ("crear o actualizar": crea la talla si no
    // existe y actualiza su stock si ya existe). Antes se borraban todas las tallas y
    // luego se volvían a crear: si el segundo paso fallaba, el producto se quedaba
    // sin tallas ni stock. La restricción de talla única por producto del esquema (sql/01) lo permite.
    const filas = Object.entries(tallasStock).map(([talla, stock]) => ({
      producto_id: prodId,
      talla,
      stock: Number(stock) || 0,
    }));
    if (filas.length) {
      const { error: errTallas } = await sb
        .from("producto_tallas")
        .upsert(filas, { onConflict: "producto_id,talla" });
      if (errTallas) throw errTallas;
    }

    return prodId;
  },

  // Elimina un producto de forma permanente.
  async deleteProduct(id) {
    const { error } = await sb.from("productos").delete().eq("id", id);
    if (error) {
      // Código 23503 = violación de llave foránea: el producto ya tiene
      // pedidos registrados (detalle_pedidos), así que la base de datos
      // protege ese historial y no permite borrarlo por completo.
      if (error.code === "23503") {
        const bloqueado = new Error("PRODUCTO_CON_PEDIDOS");
        bloqueado.code = "PRODUCTO_CON_PEDIDOS";
        throw bloqueado;
      }
      throw error;
    }
  },

  // Oculta el producto de la tienda sin borrarlo (activo = false).
  async deactivateProduct(id) {
    const { error } = await sb.from("productos").update({ activo: false }).eq("id", id);
    if (error) throw error;
  },
};

/* ---------- Lógica de stock (UNA sola regla para tarjetas, resumen y aviso del menú) ----------
   Los umbrales viven en stats.js (STOCK_BAJO_TALLA = 3, STOCK_BAJO_PRODUCTO = 5).
   - Agotado: el producto no tiene ninguna unidad en total.
   - Stock bajo: quedan pocas en total (≤ 5) O alguna talla con unidades está por agotarse (1 a 3).
   Una talla en 0 NO se cuenta como alerta por sí sola: puede ser una talla que ese modelo
   nunca se trabaja (el formulario guarda las 5 tallas aunque dejes alguna en 0). */
const ORDEN_TALLAS = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };

function evaluarStock(tallas) {
  const lista = (tallas || []).map((t) => ({ talla: t.talla, stock: Number(t.stock) || 0 }));
  const total = lista.reduce((s, t) => s + t.stock, 0);
  const porAgotarse = lista
    .filter((t) => t.stock > 0 && t.stock <= STOCK_BAJO_TALLA)
    .sort((a, b) => (ORDEN_TALLAS[a.talla] ?? 9) - (ORDEN_TALLAS[b.talla] ?? 9));
  const agotado = total <= 0;
  const bajo = !agotado && (total <= STOCK_BAJO_PRODUCTO || porAgotarse.length > 0);
  return { total, agotado, bajo, porAgotarse };
}

/* ---------- Dibujado de la grilla de productos (organizada por categoría) ---------- */
let ADMIN_CATEGORY_FILTER = "todas";

// Carga los productos y dibuja el panel.
async function loadProductsTable() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = `<p class="empty-admin">Cargando productos...</p>`;

  await AdminProducts.fetchAll();
  renderProductStats();
  renderAdminCategoryFilters();
  renderProductsGrid();
}

// Muestra los totales: productos, destacados, agotados y con stock bajo.
function renderProductStats() {
  const total = ADMIN_PRODUCTS.length;
  const destacados = ADMIN_PRODUCTS.filter((p) => p.destacado).length;
  const agotados = ADMIN_PRODUCTS.filter((p) => AdminProducts.totalStock(p) <= 0).length;
  const stockBajo = ADMIN_PRODUCTS.filter((p) => evaluarStock(p.producto_tallas).bajo).length;
  const valorInventario = ADMIN_PRODUCTS.reduce((s, p) => s + p.precio * AdminProducts.totalStock(p), 0);

  document.getElementById("productStats").innerHTML = `
    <div class="stat-card"><span>Total productos</span><b>${total}</b></div>
    <div class="stat-card"><span>Destacados</span><b>${destacados}</b></div>
    <div class="stat-card"><span>Agotados</span><b>${agotados}</b></div>
    <div class="stat-card ${stockBajo > 0 ? "stat-card-warn" : ""}"><span title="Producto con 5 unidades o menos en total, o con alguna talla por agotarse (3 o menos)">Stock bajo</span><b>${stockBajo}</b></div>
    <div class="stat-card"><span>Valor de inventario</span><b>${formatBs(valorInventario)}</b></div>
  `;
}

// Dibuja los botones de filtro por categoría (con el conteo de productos).
function renderAdminCategoryFilters() {
  const wrap = document.getElementById("adminCategoryFilters");

  // Cuenta cuántos productos hay por categoría, para mostrarlo en el botón
  const conteoTotal = ADMIN_PRODUCTS.length;
  const pills = [`<button class="pill ${ADMIN_CATEGORY_FILTER === "todas" ? "active" : ""}" data-cat="todas">Todas (${conteoTotal})</button>`];

  ADMIN_CATEGORIAS.forEach((c) => {
    const n = ADMIN_PRODUCTS.filter((p) => p.categoria_id === c.id).length;
    pills.push(
      `<button class="pill ${ADMIN_CATEGORY_FILTER === c.slug ? "active" : ""}" data-cat="${c.slug}">${escapeHtml(c.nombre)} (${n})</button>`
    );
  });

  wrap.innerHTML = pills.join("");
  wrap.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      ADMIN_CATEGORY_FILTER = btn.dataset.cat;
      renderAdminCategoryFilters();
      renderProductsGrid();
    });
  });
}

// Dibuja las tarjetas de productos aplicando el filtro de categoría y el buscador.
function renderProductsGrid() {
  const grid = document.getElementById("productsGrid");
  let lista = [...ADMIN_PRODUCTS];

  if (ADMIN_CATEGORY_FILTER !== "todas") {
    lista = lista.filter((p) => p.categorias && p.categorias.slug === ADMIN_CATEGORY_FILTER);
  }

  if (ADMIN_PRODUCT_SEARCH.trim()) {
    const q = ADMIN_PRODUCT_SEARCH.trim().toLowerCase();
    lista = lista.filter((p) => p.nombre.toLowerCase().includes(q));
  }

  if (!lista.length) {
    grid.innerHTML = `<p class="empty-admin">No hay productos que coincidan. Agrega el primero con el botón "Agregar producto".</p>`;
    return;
  }

  grid.innerHTML = lista
    .map((p) => {
      const stock = AdminProducts.totalStock(p);
      const catNombre = p.categorias ? p.categorias.nombre : "—";
      let estadoBadge = `<span class="badge badge-ok">Activo</span>`;
      const ev = evaluarStock(p.producto_tallas);
      if (ev.agotado) estadoBadge = `<span class="badge badge-warn">Agotado</span>`;
      else if (ev.bajo) estadoBadge = `<span class="badge badge-warn">Stock bajo</span>`;
      if (!p.activo) estadoBadge = `<span class="badge badge-off">Inactivo</span>`;

      return `
      <div class="admin-product-card">
        <div class="admin-product-thumb-wrap">
          <img src="${p.imagen_url || ""}" onerror="handleImgError(this,'CB')" alt="${escapeHtml(p.nombre)}">
          <span class="admin-product-badge">${estadoBadge}</span>
        </div>
        <div class="admin-product-body">
          <span class="admin-product-cat">${escapeHtml(catNombre)}</span>
          <h4 class="admin-product-name">${escapeHtml(p.nombre)}</h4>
          <div class="admin-product-meta">
            <span class="admin-product-price">${formatBs(p.precio)}</span>
            <span class="admin-product-stock">${stock} unid.</span>
          </div>
          ${(p.producto_tallas || []).some((t) => t.stock > 0) ? `<div class="stock-chips">${[...p.producto_tallas]
            .filter((t) => t.stock > 0)
            .sort((a, b) => (ORDEN_TALLAS[a.talla] ?? 9) - (ORDEN_TALLAS[b.talla] ?? 9))
            .map((t) => `<span class="stock-chip ${t.stock <= STOCK_BAJO_TALLA ? "low" : ""}" title="Talla ${escapeHtml(t.talla)}: ${t.stock} unid.">${escapeHtml(t.talla)} · ${t.stock}</span>`).join("")}</div>` : ""}
          <div class="admin-product-actions">
            <button class="icon-action" title="Editar" onclick="openProductForm('${p.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-action danger" title="Eliminar" onclick="askDeleteProduct('${p.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

/* ---------- Formulario: abrir para agregar/editar ---------- */
function renderCategoriaOptions() {
  const select = document.getElementById("productCategoria");
  select.innerHTML =
    `<option value="">Selecciona...</option>` +
    ADMIN_CATEGORIAS.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
}

// Dibuja un campo de stock por cada talla disponible.
function renderTallasManager(stockPorTalla = {}) {
  const wrap = document.getElementById("tallasManager");
  wrap.innerHTML = APP_CONFIG.TALLAS_DISPONIBLES.map(
    (t) => `
    <div class="talla-row">
      <label>${t}</label>
      <input type="number" min="0" step="1" class="talla-stock-input" data-talla="${t}"
        value="${stockPorTalla[t] ?? 0}" placeholder="Unidades disponibles">
    </div>`
  ).join("");
}

// Lee del formulario el stock escrito para cada talla.
function getTallasStockFromForm() {
  const inputs = document.querySelectorAll(".talla-stock-input");
  const result = {};
  inputs.forEach((inp) => {
    result[inp.dataset.talla] = Math.max(0, parseInt(inp.value || "0", 10));
  });
  return result;
}

// Abre el formulario para crear un producto (id = null) o editar uno existente.
function openProductForm(id = null) {
  EDITING_PRODUCT_ID = id;
  UPLOADED_IMAGE_URL = null;
  IMAGEN_AL_ABRIR = null;
  IMAGEN_SUBIDA_ID++;      // cualquier subida anterior que siga en curso queda descartada
  IMAGEN_SUBIENDO = false;
  document.getElementById("productForm").reset();
  document.getElementById("uploadPreviewWrap").style.display = "none";
  document.getElementById("uploadProgress").style.display = "none";

  if (id) {
    const p = ADMIN_PRODUCTS.find((x) => x.id === id);
    document.getElementById("productFormTitle").textContent = "Editar producto";
    document.getElementById("productId").value = p.id;
    document.getElementById("productNombre").value = p.nombre;
    document.getElementById("productDescripcion").value = p.descripcion || "";
    document.getElementById("productPrecio").value = p.precio;
    document.getElementById("productCategoria").value = p.categoria_id || "";
    document.getElementById("productDestacado").checked = !!p.destacado;
    document.getElementById("productNuevo").checked = !!p.nuevo;

    if (p.imagen_url) {
      UPLOADED_IMAGE_URL = p.imagen_url;
      IMAGEN_AL_ABRIR = p.imagen_url;
      document.getElementById("uploadPreviewImg").src = p.imagen_url;
      document.getElementById("uploadPreviewWrap").style.display = "block";
    }

    const stockMap = {};
    (p.producto_tallas || []).forEach((t) => (stockMap[t.talla] = t.stock));
    STOCK_AL_ABRIR = { ...stockMap };
    renderTallasManager(stockMap);
  } else {
    STOCK_AL_ABRIR = {};
    document.getElementById("productFormTitle").textContent = "Agregar producto";
    document.getElementById("productId").value = "";
    renderTallasManager();
  }

  openModal("productFormModal");
}

/* ---------- Subida de imagen ---------- */
function setupImageUpload() {
  const input = document.getElementById("productImageInput");
  const zone = document.getElementById("uploadZone");

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    await handleImageFile(file);
    input.value = ""; // permite volver a elegir el mismo archivo si falló
  });

  ["dragover", "dragleave", "drop"].forEach((evt) => {
    zone.addEventListener(evt, (e) => e.preventDefault());
  });
  zone.addEventListener("dragover", () => zone.classList.add("dragover"));
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", async (e) => {
    zone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) await handleImageFile(file);
  });
}

// Valida la imagen elegida y la sube a Supabase Storage.
async function handleImageFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Por favor selecciona un archivo de imagen (JPG, PNG o WEBP).", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("La imagen es muy pesada. Usa una de máximo 5MB.", "error");
    return;
  }

  // Foto que había antes de este intento (para volver a ella si la subida falla)
  const urlAnterior = UPLOADED_IMAGE_URL;
  const miSubida = ++IMAGEN_SUBIDA_ID;
  IMAGEN_SUBIENDO = true;

  // Vista previa inmediata
  const reader = new FileReader();
  reader.onload = (e) => {
    if (miSubida !== IMAGEN_SUBIDA_ID) return;
    document.getElementById("uploadPreviewImg").src = e.target.result;
    document.getElementById("uploadPreviewWrap").style.display = "block";
  };
  reader.readAsDataURL(file);

  const progress = document.getElementById("uploadProgress");
  const bar = document.getElementById("uploadProgressBar");
  progress.style.display = "block";
  bar.style.width = "40%";

  try {
    const url = await AdminProducts.uploadImage(file);
    if (miSubida !== IMAGEN_SUBIDA_ID) return; // se cerró o reabrió el formulario mientras subía
    bar.style.width = "100%";
    UPLOADED_IMAGE_URL = url;
    document.getElementById("uploadPreviewImg").src = url;
    showToast("Imagen subida correctamente.", "success");
    setTimeout(() => (progress.style.display = "none"), 600);
  } catch (err) {
    console.error(err);
    if (miSubida !== IMAGEN_SUBIDA_ID) return;
    // La vista previa mostraba la foto nueva, pero NO se subió: se vuelve a la anterior
    // para que lo que se ve coincida con lo que realmente se va a guardar.
    if (urlAnterior) {
      document.getElementById("uploadPreviewImg").src = urlAnterior;
    } else {
      document.getElementById("uploadPreviewWrap").style.display = "none";
    }
    showToast("No se pudo subir la imagen. Revisa la configuración de Supabase Storage.", "error");
    progress.style.display = "none";
  } finally {
    if (miSubida === IMAGEN_SUBIDA_ID) IMAGEN_SUBIENDO = false;
  }
}

/* ---------- Guardar producto ---------- */
async function submitProductForm(e) {
  e.preventDefault();
  if (IMAGEN_SUBIENDO) {
    showToast("Espera a que termine de subirse la imagen para guardar.", "error");
    return;
  }
  const btn = document.getElementById("saveProductBtn");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const payload = {
      nombre: document.getElementById("productNombre").value.trim(),
      descripcion: document.getElementById("productDescripcion").value.trim(),
      precio: parseFloat(document.getElementById("productPrecio").value),
      categoria_id: parseInt(document.getElementById("productCategoria").value, 10),
      destacado: document.getElementById("productDestacado").checked,
      nuevo: document.getElementById("productNuevo").checked,
    };
    // Un producto NUEVO nace activo. Al EDITAR no se toca "activo": antes, guardar
    // cualquier cambio volvía a publicar en la tienda un producto que se había desactivado.
    if (!EDITING_PRODUCT_ID) payload.activo = true;

    if (UPLOADED_IMAGE_URL) payload.imagen_url = UPLOADED_IMAGE_URL;

    if (!payload.nombre || !(payload.precio > 0) || !payload.categoria_id) {
      showToast("Completa nombre, precio (mayor a 0) y categoría.", "error");
      btn.disabled = false;
      btn.textContent = "Guardar producto";
      return;
    }

    const tallasForm = getTallasStockFromForm();
    // Producto nuevo: se guardan todas las tallas. Editando: solo las que cambiaron o que todavía no existían.
    const tallasStock = {};
    Object.entries(tallasForm).forEach(([talla, stock]) => {
      if (!EDITING_PRODUCT_ID || STOCK_AL_ABRIR[talla] === undefined || STOCK_AL_ABRIR[talla] !== stock) {
        tallasStock[talla] = stock;
      }
    });
    await AdminProducts.saveProduct(payload, tallasStock, EDITING_PRODUCT_ID);

    // Si se reemplazó la foto, la anterior ya no sirve: se borra del almacenamiento.
    if (EDITING_PRODUCT_ID && IMAGEN_AL_ABRIR && UPLOADED_IMAGE_URL !== IMAGEN_AL_ABRIR) {
      borrarImagenSiHuerfana(IMAGEN_AL_ABRIR);
    }

    showToast("Producto guardado correctamente.", "success");
    closeModal("productFormModal");
    loadProductsTable();
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar el producto. Intenta nuevamente.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar producto";
  }
}

/* ---------- Eliminar producto ---------- */
let PRODUCT_TO_DELETE = null;

// Guarda qué producto se quiere eliminar y abre el aviso de confirmación.
function askDeleteProduct(id) {
  PRODUCT_TO_DELETE = id;
  openModal("deleteConfirmModal");
}

// Si la administradora confirma, elimina el producto.
async function confirmDeleteProduct() {
  if (!PRODUCT_TO_DELETE) return;
  try {
    const fotoDelProducto = (ADMIN_PRODUCTS.find((x) => x.id === PRODUCT_TO_DELETE) || {}).imagen_url;
    await AdminProducts.deleteProduct(PRODUCT_TO_DELETE);
    borrarImagenSiHuerfana(fotoDelProducto);
    showToast("Producto eliminado.", "success");
    closeModal("deleteConfirmModal");
    PRODUCT_TO_DELETE = null;
    loadProductsTable();
  } catch (err) {
    closeModal("deleteConfirmModal");
    if (err.code === "PRODUCTO_CON_PEDIDOS") {
      // No lo borramos: le ofrecemos a la administradora desactivarlo.
      openModal("cannotDeleteModal");
      return;
    }
    console.error(err);
    showToast("No se pudo eliminar el producto. Intenta nuevamente.", "error");
  }
}

// Alternativa a eliminar: lo desactiva para que deje de verse en la tienda.
async function confirmDeactivateProduct() {
  if (!PRODUCT_TO_DELETE) return;
  try {
    await AdminProducts.deactivateProduct(PRODUCT_TO_DELETE);
    showToast("Producto desactivado: ya no aparece en la tienda.", "success");
    closeModal("cannotDeleteModal");
    loadProductsTable();
  } catch (err) {
    console.error(err);
    showToast("No se pudo desactivar el producto.", "error");
  } finally {
    PRODUCT_TO_DELETE = null;
  }
}

/* ---------- Crear categoría nueva desde el formulario de producto ---------- */
function renderCategoriaList() {
  const wrap = document.getElementById("categoriaListWrap");
  if (!ADMIN_CATEGORIAS.length) {
    wrap.innerHTML = `<p style="font-size:13px; color:var(--text-soft);">Todavía no hay categorías.</p>`;
    return;
  }
  wrap.innerHTML = ADMIN_CATEGORIAS.map((c) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:9px 12px; background:var(--bg-alt); border-radius:10px;">
      <span style="font-size:14px; font-weight:600;">${escapeHtml(c.nombre)}</span>
      <button type="button" class="icon-action danger" title="Eliminar categoría" onclick="askDeleteCategoria(${c.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>`).join("");
}

// Abre la ventana para crear categorías y muestra las que ya existen.
function openNewCategoriaModal() {
  document.getElementById("newCategoriaNombre").value = "";
  document.getElementById("errNewCategoria").classList.remove("show");
  renderCategoriaList();
  openModal("newCategoriaModal");
}

// Pide confirmación antes de eliminar una categoría (avisa si está en uso).
async function askDeleteCategoria(id) {
  const cat = ADMIN_CATEGORIAS.find((c) => c.id === id);
  if (!cat) return;

  const enUso = ADMIN_PRODUCTS.filter((p) => p.categoria_id === id).length;
  if (enUso > 0) {
    document.getElementById("cannotDeleteCategoriaMsg").textContent =
      `"${cat.nombre}" tiene ${enUso} producto${enUso === 1 ? "" : "s"} asignado${enUso === 1 ? "" : "s"}. ` +
      `Cambia esos productos a otra categoría o elimínalos primero, y luego podrás borrar esta categoría.`;
    openModal("cannotDeleteCategoriaModal");
    return;
  }

  if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Esta acción no se puede deshacer.`)) return;

  try {
    await AdminProducts.deleteCategoria(id);
    renderCategoriaOptions();
    renderCategoriaList();
    showToast(`Categoría "${cat.nombre}" eliminada.`, "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar la categoría.", "error");
  }
}

// Valida el nombre y crea la categoría nueva.
async function saveNewCategoria() {
  const input = document.getElementById("newCategoriaNombre");
  const errEl = document.getElementById("errNewCategoria");
  const nombre = input.value.trim();

  if (!nombre) {
    errEl.textContent = "Escribe un nombre para la categoría.";
    errEl.classList.add("show");
    return;
  }

  const btn = document.getElementById("saveNewCategoriaBtn");
  btn.disabled = true;
  btn.textContent = "Creando...";

  try {
    const nueva = await AdminProducts.createCategoria(nombre);
    renderCategoriaOptions();
    renderCategoriaList();
    document.getElementById("productCategoria").value = nueva.id;
    input.value = "";
    errEl.classList.remove("show");
    showToast(`Categoría "${nueva.nombre}" creada.`, "success");
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      errEl.textContent = "Ya existe una categoría con ese nombre.";
    } else if (err.code === "NOMBRE_INVALIDO") {
      errEl.textContent = "Usa letras o números en el nombre de la categoría.";
    } else {
      errEl.textContent = "No se pudo crear la categoría. Intenta nuevamente.";
    }
    errEl.classList.add("show");
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear categoría";
  }
}

