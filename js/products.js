/* =========================================================
   PRODUCTOS — obtención desde Supabase y dibujado en pantalla
   ========================================================= */

/* Subtítulos "de fábrica" para las categorías con las que arranca la
   tienda. Cualquier categoría nueva que agregues desde el panel usa un
   subtítulo genérico — la sección entera ahora se arma con las
   categorías reales de Supabase, no con una lista fija. */
const CATEGORY_LABELS = {
  vestidos: { sub: "Para brillar en cada ocasión" },
  blusas: { sub: "Elegancia para el día a día" },
  pantalones: { sub: "Comodidad con estilo" },
  conjuntos: { sub: "Looks completos, sin esfuerzo" },
};

// Estado de la tienda: productos cargados y filtros activos en este momento.
let ALL_PRODUCTS = [];
let ALL_CATEGORIAS = [];
let ACTIVE_CATEGORY = "todas";
let ACTIVE_TALLA = "todas";
let ACTIVE_SORT = "recientes";
let ACTIVE_SEARCH = "";

// Consultas de productos a Supabase.
const ProductsAPI = {
  // Trae los productos activos con su categoría y el stock de cada talla.
  // Devuelve null si la carga FALLÓ (sin internet, Supabase caído...), para no confundirlo
  // con una tienda que de verdad no tiene productos ([]).
  async fetchAll() {
    if (!sb) return [];
    try {
      const { data, error } = await sb
        .from("productos")
        .select("*, categorias(nombre, slug), producto_tallas(talla, stock)")
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error al cargar productos:", error);
        return null;
      }

      return (data || []).map((p) => ({
        ...p,
        categoria_nombre: p.categorias ? p.categorias.nombre : "",
        categoria_slug: p.categorias ? p.categorias.slug : "",
        tallas: p.producto_tallas || [],
      }));
    } catch (err) {
      console.error("Error al cargar productos:", err);
      return null;
    }
  },

  // Devuelve cuántas unidades quedan de un producto en una talla.
  async getStockForTalla(producto_id, talla) {
    const producto = ALL_PRODUCTS.find((p) => p.id === producto_id);
    if (!producto) return 0;
    const t = producto.tallas.find((x) => x.talla === talla);
    return t ? t.stock : 0;
  },

  // Suma el stock de todas las tallas de un producto.
  totalStock(producto) {
    return (producto.tallas || []).reduce((sum, t) => sum + t.stock, 0);
  },
};

/* ---------- Dibujado de la grilla de categorías ---------- */
function renderCategoryGrid() {
  const grid = document.getElementById("categoryGrid");
  const section = document.getElementById("coleccion");
  if (!grid) return;

  // Si Supabase todavía no está conectado (o no hay categorías creadas),
  // no mostramos nada inventado: se oculta la sección entera en vez de
  // simular contenido con fotos que no son de la tienda.
  if (!ALL_CATEGORIAS.length) {
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "";

  grid.innerHTML = ALL_CATEGORIAS
    .map((cat) => {
      const sub = (CATEGORY_LABELS[cat.slug] && CATEGORY_LABELS[cat.slug].sub) || "Descubre la colección";
      // La foto de portada es la del producto más reciente de esa
      // categoría (dato real, no una foto genérica de internet). Si todavía no
      // tiene ningún producto cargado, se usa la misma imagen de reemplazo
      // elegante que ya se usa en toda la tienda para fotos faltantes.
      const productoDeMuestra = ALL_PRODUCTS.find((p) => p.categoria_slug === cat.slug && p.imagen_url);
      const imgSrc = productoDeMuestra ? productoDeMuestra.imagen_url : dressPlaceholderDataUri(cat.nombre);

      return `
      <a class="cat-card" href="#catalogo" onclick="filterByCategory('${cat.slug}')">
        <img src="${imgSrc}" alt="${escapeHtml(cat.nombre)}" onerror="handleImgError(this,${jsArg(cat.nombre)})">
        <div class="cat-card-label">
          <b>${escapeHtml(cat.nombre)}</b>
          <span>${sub}</span>
        </div>
      </a>`;
    })
    .join("");
  staggerReveal(grid.querySelectorAll(".cat-card"), { step: 0.08 });
}

/* ---------- Tarjeta de producto (reutilizable) ---------- */
function productCardHtml(p) {
  const stockTotal = ProductsAPI.totalStock(p);
  const agotado = stockTotal <= 0;
  const img = p.imagen_url || "";

  let tagsHtml = "";
  if (agotado) tagsHtml += `<span class="tag tag-out">Agotado</span>`;
  else if (p.nuevo) tagsHtml += `<span class="tag tag-new">Nuevo</span>`;
  if (p.destacado && !agotado) tagsHtml += `<span class="tag tag-feat">Destacado</span>`;

  return `
  <article class="product-card">
    <div class="product-media" onclick="openProductModal('${p.id}')" style="cursor:pointer;">
      <div class="product-tags">${tagsHtml}</div>
      <img src="${img}" alt="${escapeHtml(p.nombre)}" onerror="handleImgError(this,${jsArg(p.categoria_nombre)})">
      <button class="fav-btn ${Favorites.has(p.id) ? "active" : ""}" data-fav-id="${p.id}" onclick="event.stopPropagation(); toggleFavorite('${p.id}', this)" aria-label="Guardar en favoritos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${Favorites.has(p.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      </button>
      ${!agotado ? `
      <button class="product-quickadd" onclick="event.stopPropagation(); openProductModal('${p.id}')" aria-label="Ver y agregar al carrito">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      </button>` : ""}
    </div>
    <div class="product-body">
      <span class="product-cat">${escapeHtml(p.categoria_nombre)}</span>
      <h3 class="product-name" style="cursor:pointer;" onclick="openProductModal('${p.id}')">${escapeHtml(p.nombre)}</h3>
      <p class="product-desc">${escapeHtml(p.descripcion || "")}</p>
      <div class="product-footer">
        <span class="product-price">${formatBs(p.precio)}</span>
        <span class="product-stock-mini">${agotado ? "Sin stock" : stockTotal + " disp."}</span>
      </div>
    </div>
  </article>`;
}

/* ---------- Grilla de destacados (página de inicio) ---------- */
function renderFeaturedGrid() {
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;
  const destacados = ALL_PRODUCTS.filter((p) => p.destacado).slice(0, APP_CONFIG.MAX_DESTACADOS);
  const lista = destacados.length ? destacados : ALL_PRODUCTS.slice(0, APP_CONFIG.MAX_DESTACADOS);

  if (!lista.length) {
    grid.innerHTML = emptyStateHtml("Aún no hay productos destacados", "Vuelve pronto para descubrir nuestra selección.");
    return;
  }
  grid.innerHTML = lista.map(productCardHtml).join("");
  staggerReveal(grid.querySelectorAll(".product-card"), { step: 0.07, max: 0.42 });
}

/* ---------- Grilla del catálogo completo (con filtros) ---------- */
function renderCatalogGrid() {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;

  // Se parte de todos los productos y se descartan los que no cumplen los filtros.
  let lista = [...ALL_PRODUCTS];

  if (ACTIVE_CATEGORY !== "todas") {
    lista = lista.filter((p) => p.categoria_slug === ACTIVE_CATEGORY);
  }
  if (ACTIVE_TALLA !== "todas") {
    lista = lista.filter((p) =>
      p.tallas.some((t) => t.talla === ACTIVE_TALLA && t.stock > 0)
    );
  }
  if (ACTIVE_SEARCH.trim()) {
    const q = ACTIVE_SEARCH.trim().toLowerCase();
    lista = lista.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion || "").toLowerCase().includes(q) ||
        (p.categoria_nombre || "").toLowerCase().includes(q)
    );
  }

  // Ordenar según la opción elegida en el selector.
  switch (ACTIVE_SORT) {
    case "precio-asc":
      lista.sort((a, b) => a.precio - b.precio);
      break;
    case "precio-desc":
      lista.sort((a, b) => b.precio - a.precio);
      break;
    case "nombre":
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      break;
    default:
      // recientes: ya vienen ordenados por fecha de creación (created_at), del más nuevo al más antiguo, desde la consulta
      break;
  }

  if (!lista.length) {
    grid.innerHTML = emptyStateHtml(
      "No encontramos productos con estos filtros",
      "Prueba con otra categoría, talla o término de búsqueda."
    );
    return;
  }

  grid.innerHTML = lista.map(productCardHtml).join("");
  staggerReveal(grid.querySelectorAll(".product-card"), { step: 0.05, max: 0.4 });
}

// HTML del mensaje que se muestra cuando no hay resultados.
function emptyStateHtml(titulo, sub) {
  return `
  <div class="empty-state">
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 22V12h6v10M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    <h3>${titulo}</h3>
    <p>${sub}</p>
  </div>`;
}

/* ---------- Aviso cuando no se pudieron cargar los productos ---------- */
// Se muestra en lugar de "No encontramos productos", que confundiría a la clienta.
function errorCargaHtml() {
  return `
  <div class="empty-state">
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <h3>No pudimos cargar los productos</h3>
    <p>Revisa tu conexión a internet e inténtalo de nuevo.</p>
    <button type="button" class="btn btn-primary" style="margin-top:14px;" onclick="initProducts()">Reintentar</button>
  </div>`;
}

/* ---------- Filtros de categoría (dinámicos, según la base de datos) ---------- */
async function renderCategoryFilterPills() {
  const wrap = document.getElementById("categoryFilters");
  if (!wrap || !sb) return;

  const { data, error } = await sb.from("categorias").select("*").order("id");
  if (error) { console.error(error); return; }
  ALL_CATEGORIAS = data || [];

  // Si la categoría que estaba filtrada ya no existe, se vuelve a "todas".
  if (ACTIVE_CATEGORY !== "todas" && !ALL_CATEGORIAS.some((c) => c.slug === ACTIVE_CATEGORY)) {
    ACTIVE_CATEGORY = "todas";
  }

  const pillsHtml = ["todas", ...ALL_CATEGORIAS.map((c) => c.slug)]
    .map((slug) => {
      const activa = slug === ACTIVE_CATEGORY ? "active" : "";
      if (slug === "todas") {
        return `<button class="pill ${activa}" data-cat="todas">Todas</button>`;
      }
      const cat = ALL_CATEGORIAS.find((c) => c.slug === slug);
      return `<button class="pill ${activa}" data-cat="${slug}">${escapeHtml(cat.nombre)}</button>`;
    })
    .join("");

  wrap.innerHTML = pillsHtml;
}

/* ---------- Filtros: categoría, talla, orden, búsqueda ---------- */
function filterByCategory(slug) {
  ACTIVE_CATEGORY = slug;
  document.querySelectorAll("#categoryFilters .pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === slug);
  });
  renderCatalogGrid();
}

function setupFilterListeners() {
  // Delegación de eventos: así los botones de categoría creados
  // dinámicamente (incluidas categorías nuevas agregadas desde el admin)
  // funcionan sin tener que volver a registrar el evento.
  document.getElementById("categoryFilters").addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (btn) filterByCategory(btn.dataset.cat);
  });
  document.getElementById("tallaFilter").addEventListener("change", (e) => {
    ACTIVE_TALLA = e.target.value;
    renderCatalogGrid();
  });
  document.getElementById("ordenarSelect").addEventListener("change", (e) => {
    ACTIVE_SORT = e.target.value;
    renderCatalogGrid();
  });
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce((e) => {
        // El catálogo se filtra mientras se escribe, pero la página NO se desplaza sola:
        // antes saltaba al catálogo en cada pausa y tapaba la caja de sugerencias.
        ACTIVE_SEARCH = e.target.value;
        renderCatalogGrid();
      }, 350)
    );
  }

  setupSearchSuggestions("searchInput", "searchSuggestions");
  setupSearchSuggestions("mobileSearchInput", "mobileSearchSuggestions", { isMobile: true });
}

/* ---------- Buscador con sugerencias en vivo ----------
   Usa ALL_PRODUCTS (ya cargado en memoria) para sugerir coincidencias
   mientras la clienta escribe, sin llamadas adicionales al servidor. */
function matchProducts(query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = ALL_PRODUCTS.map((p) => {
    const nombre = p.nombre.toLowerCase();
    const cat = (p.categoria_nombre || "").toLowerCase();
    const desc = (p.descripcion || "").toLowerCase();
    // Puntaje de coincidencia: 3 = el nombre empieza igual, 2 = lo contiene, 1 = la categoría, 0 = la descripción.
    let score = -1;
    if (nombre.startsWith(q)) score = 3;
    else if (nombre.includes(q)) score = 2;
    else if (cat.includes(q)) score = 1;
    else if (desc.includes(q)) score = 0;
    return { p, score };
  }).filter((x) => x.score >= 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

// HTML de una sugerencia del buscador (miniatura, nombre y precio).
function suggestionItemHtml(p, index) {
  const stockTotal = ProductsAPI.totalStock(p);
  return `
    <button type="button" class="sg-item" data-sg-id="${p.id}" data-sg-index="${index}">
      <div class="sg-thumb"><img src="${p.imagen_url || ""}" alt="" onerror="handleImgError(this,${jsArg(p.categoria_nombre)})"></div>
      <div class="sg-info">
        <b>${escapeHtml(p.nombre)}</b>
        <span>${escapeHtml(p.categoria_nombre)}${stockTotal <= 0 ? " · Agotado" : ""}</span>
      </div>
      <span class="sg-price">${formatBs(p.precio)}</span>
    </button>`;
}

// Conecta un campo de búsqueda con su caja de sugerencias en vivo (escritorio y móvil).
function setupSearchSuggestions(inputId, boxId, opts = {}) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  if (!input || !box) return;

  let activeIndex = -1;
  let currentMatches = [];

  const closeBox = () => { box.classList.remove("open"); activeIndex = -1; };

  const renderBox = () => {
    const q = input.value;
    currentMatches = matchProducts(q, 6);
    activeIndex = -1;

    if (!q.trim()) { closeBox(); return; }

    if (!currentMatches.length) {
      box.innerHTML = `<div class="sg-empty">No encontramos nada para "${escapeHtml(q)}". Prueba con otra palabra.</div>`;
      box.classList.add("open");
      return;
    }

    box.innerHTML =
      currentMatches.map((p, i) => suggestionItemHtml(p, i)).join("") +
      `<button type="button" class="sg-footer" data-sg-seeall="1">Ver todos los resultados para "${escapeHtml(q)}"</button>`;
    box.classList.add("open");
  };

  const goToProduct = (id) => {
    closeBox();
    input.value = "";
    // Si el catálogo seguía filtrado por lo que se escribió, se limpia: antes quedaba
    // filtrado aunque la caja de búsqueda ya estuviera vacía.
    if (ACTIVE_SEARCH) {
      ACTIVE_SEARCH = "";
      renderCatalogGrid();
    }
    if (opts.isMobile) closeMobileNav();
    openProductModal(id);
  };

  const seeAll = () => {
    ACTIVE_SEARCH = input.value;
    // Las dos cajas de búsqueda (computadora y celular) muestran lo mismo.
    ["searchInput", "mobileSearchInput"].forEach((idCaja) => {
      const caja = document.getElementById(idCaja);
      if (caja) caja.value = input.value;
    });
    closeBox();
    if (opts.isMobile) closeMobileNav();
    renderCatalogGrid();
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
  };

  input.addEventListener("input", debounce(renderBox, 150));
  input.addEventListener("focus", () => { if (input.value.trim()) renderBox(); });

  input.addEventListener("keydown", (e) => {
    const items = box.querySelectorAll(".sg-item");
    if (e.key === "ArrowDown") {
      if (!box.classList.contains("open")) return;
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      if (!box.classList.contains("open")) return;
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && currentMatches[activeIndex]) {
        e.preventDefault();
        goToProduct(currentMatches[activeIndex].id);
      } else if (input.value.trim()) {
        e.preventDefault();
        seeAll();
      }
    } else if (e.key === "Escape") {
      closeBox();
      input.blur();
    }
  });

  box.addEventListener("click", (e) => {
    const item = e.target.closest("[data-sg-id]");
    if (item) { goToProduct(item.getAttribute("data-sg-id")); return; }
    if (e.target.closest("[data-sg-seeall]")) seeAll();
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !box.contains(e.target)) closeBox();
  });
}

/* ---------- Imagen ampliada del producto ----------
   openLightbox / closeLightbox / setupLightbox viven en utils.js
   porque también las usa el panel admin (pedidos, clientes, reseñas). */

/* ---------- Ventana emergente de detalle de producto ---------- */
let PRODUCT_MODAL_SELECTED_TALLA = null;

// Abre el detalle de un producto: foto, tallas, precio y reseñas.
function openProductModal(id) {
  const p = ALL_PRODUCTS.find((x) => x.id === id);
  if (!p) return;
  PRODUCT_MODAL_SELECTED_TALLA = null;
  window.__activeModalProductId = id; // lo usa updateModalStockHint

  const stockTotal = ProductsAPI.totalStock(p);
  const agotado = stockTotal <= 0;

  const tallasHtml = (p.tallas.length ? p.tallas : APP_CONFIG.TALLAS_DISPONIBLES.map(t => ({talla: t, stock: 0})))
    .map((t) => {
      const disabled = t.stock <= 0;
      const lowStock = !disabled && t.stock <= 3;
      return `<button type="button" class="talla-opt ${disabled ? "disabled" : ""} ${lowStock ? "low-stock" : ""}"
        ${disabled ? "disabled" : ""}
        data-talla="${t.talla}"
        title="${lowStock ? `¡Últimas ${t.stock} unidades!` : ""}"
        onclick="selectModalTalla('${t.talla}')">${t.talla}${disabled ? " · Agotada" : ""}</button>`;
    })
    .join("");

  document.getElementById("productModalContent").innerHTML = `
    <div class="product-modal-img">
      <img src="${p.imagen_url || ""}" alt="${escapeHtml(p.nombre)}" onerror="handleImgError(this,${jsArg(p.categoria_nombre)})"
           style="cursor:zoom-in;" onclick="openLightbox(${jsArg(p.imagen_url || "")}, ${jsArg(p.nombre)})">
      <button type="button" class="zoom-hint-btn" onclick="openLightbox(${jsArg(p.imagen_url || "")}, ${jsArg(p.nombre)})" aria-label="Ver imagen ampliada">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        Ampliar
      </button>
      <button type="button" class="fav-btn-modal ${Favorites.has(p.id) ? "active" : ""}" onclick="toggleFavorite('${p.id}', this)" aria-label="Guardar en favoritos">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${Favorites.has(p.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      </button>
      <button type="button" class="share-btn-modal" onclick="openShareProduct('${p.id}')" aria-label="Compartir producto">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
    </div>
    <div class="product-modal-body">
      <span class="product-cat">${escapeHtml(p.categoria_nombre)}</span>
      <h2 style="font-size:26px; margin:10px 0 8px;">${escapeHtml(p.nombre)}</h2>
      <p style="color:var(--text-soft); font-size:14px; line-height:1.6; margin-bottom:18px;">${escapeHtml(p.descripcion || "")}</p>
      <div class="product-price" style="font-size:24px; margin-bottom:20px;">${formatBs(p.precio)}</div>

      ${agotado ? `
        <div style="background:var(--rose); padding:14px 16px; border-radius:12px; font-size:13.5px; margin-bottom:10px;">
          Esta pieza está agotada por el momento. Vuelve pronto ✨
        </div>` : `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <label style="font-size:13px; font-weight:700;">Selecciona tu talla</label>
          <button type="button" class="size-guide-link" onclick="openModal('sizeGuideModal')">📏 ¿Qué talla soy?</button>
        </div>
        <div class="talla-select-grid" id="modalTallaGrid">${tallasHtml}</div>

        <div style="display:flex; align-items:center; gap:16px; margin-top:22px;">
          <label style="font-size:13px; font-weight:700;">Cantidad</label>
          <div class="qty-control">
            <button type="button" onclick="changeModalQty(-1)">−</button>
            <span id="modalQty">1</span>
            <button type="button" onclick="changeModalQty(1)">+</button>
          </div>
        </div>
        <span class="form-hint" id="modalStockHint" style="display:block; margin-top:8px;"></span>

        <button class="btn btn-primary btn-block" style="margin-top:22px;" onclick="addModalItemToCart('${p.id}')">
          Agregar a mi bolsa
        </button>
      `}

      <div id="resenasWrap" style="margin-top:30px; border-top:1px solid var(--champagne); padding-top:22px;">
        <!-- Generado por resenas.js -->
      </div>
    </div>`;

  openModal("productModal");
  renderResenasSection(p.id, p.nombre);
}

// Marca la talla elegida y actualiza el aviso de stock.
function selectModalTalla(talla) {
  PRODUCT_MODAL_SELECTED_TALLA = talla;
  document.querySelectorAll("#modalTallaGrid .talla-opt").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.talla === talla);
  });
  updateModalStockHint();
}

// Sube o baja la cantidad (mínimo 1).
function changeModalQty(delta) {
  const el = document.getElementById("modalQty");
  let qty = parseInt(el.textContent, 10) + delta;
  if (qty < 1) qty = 1;
  el.textContent = qty;
  updateModalStockHint();
}

// Muestra cuántas unidades quedan en la talla elegida (con aviso si quedan pocas).
function updateModalStockHint() {
  const hint = document.getElementById("modalStockHint");
  if (!hint) return;
  if (!PRODUCT_MODAL_SELECTED_TALLA) {
    hint.textContent = "Elige una talla para ver el stock disponible.";
    return;
  }
  const qty = parseInt(document.getElementById("modalQty").textContent, 10);
  ProductsAPI.getStockForTalla(currentModalProductId(), PRODUCT_MODAL_SELECTED_TALLA).then((stock) => {
    if (stock <= 3 && stock > 0) {
      hint.textContent = `¡Últimas ${stock} unidad(es) en talla ${PRODUCT_MODAL_SELECTED_TALLA}!`;
      hint.style.color = "var(--rose-deep-dk)";
      hint.style.fontWeight = "700";
    } else {
      hint.textContent = `${stock} unidad(es) disponibles en talla ${PRODUCT_MODAL_SELECTED_TALLA}.`;
      hint.style.color = qty > stock ? "var(--danger)" : "var(--text-faint)";
      hint.style.fontWeight = "400";
    }
  });
}

function currentModalProductId() {
  // El id se recupera desde el botón de "Agregar a mi bolsa" al hacer clic,
  // pero lo guardamos también en una variable global al abrir la ventana emergente.
  return window.__activeModalProductId;
}

// Comprueba que haya una talla elegida y agrega el producto al carrito.
function addModalItemToCart(id) {
  window.__activeModalProductId = id;
  const p = ALL_PRODUCTS.find((x) => x.id === id);
  if (!p) return;

  if (!PRODUCT_MODAL_SELECTED_TALLA) {
    showToast("Por favor selecciona una talla.", "error");
    return;
  }
  const qty = parseInt(document.getElementById("modalQty").textContent, 10);
  const stock = p.tallas.find((t) => t.talla === PRODUCT_MODAL_SELECTED_TALLA)?.stock || 0;

  const ok = Cart.addItem(p, PRODUCT_MODAL_SELECTED_TALLA, qty, stock);
  if (ok) {
    closeModal("productModal");
    Cart.open();
  }
}

/* ---------- Inicialización de productos ---------- */
// Cifras de la portada con datos REALES: prendas con stock y categorías existentes.
function updateHeroStats() {
  if (typeof setLiveCounter !== "function") return;
  const disponibles = ALL_PRODUCTS.filter((p) => ProductsAPI.totalStock(p) > 0).length;
  setLiveCounter("prendas", disponibles);
  setLiveCounter("categorias", ALL_CATEGORIAS.length);
}

// Los eventos (filtros, buscador, imagen ampliada) se conectan UNA sola vez.
// Antes, initProducts() se volvía a ejecutar después de cada compra y conectaba
// todo otra vez: cada tecla del buscador, cada clic o cada Enter se procesaba
// varias veces, y además se reabría solo el producto del enlace compartido.
let TIENDA_INICIADA = false;

// Pide los productos y categorías a Supabase y vuelve a dibujar todo.
async function cargarYDibujarProductos() {
  const productos = await ProductsAPI.fetchAll();

  if (productos === null) {
    // La carga falló. Si ya había productos en pantalla se dejan (no se borra la tienda por un
    // error de red); si no había ninguno, se avisa y se ofrece reintentar.
    if (ALL_PRODUCTS.length) {
      showToast("No pudimos actualizar los productos. Revisa tu conexión.", "error");
    } else {
      ["featuredGrid", "catalogGrid"].forEach((id) => {
        const grid = document.getElementById(id);
        if (grid) grid.innerHTML = errorCargaHtml();
      });
    }
    return;
  }

  ALL_PRODUCTS = productos;
  await renderCategoryFilterPills();
  Cart.sincronizarConCatalogo(); // precios y stock de la bolsa al día con el catálogo real
  updateHeroStats();
  renderCategoryGrid();
  renderFeaturedGrid();
  renderCatalogGrid();
}

async function initProducts() {
  if (TIENDA_INICIADA) {
    await cargarYDibujarProductos(); // llamada repetida: solo se refrescan los datos
    return;
  }
  TIENDA_INICIADA = true;
  await cargarYDibujarProductos();
  setupFilterListeners();
  setupLightbox();
  checkProductDeepLink();
}
