/* =========================================================
   FAVORITOS
   Se guardan en el navegador de la clienta (localStorage), sin
   necesidad de crear una cuenta. Si limpia el navegador o cambia
   de dispositivo, se pierden — es una lista de deseos temporal,
   no un dato del negocio.
   ========================================================= */

const FAV_STORAGE_KEY = "cb_favoritos";

const Favorites = {
  // Lee del navegador la lista de ids de productos favoritos.
  _get() {
    try {
      const guardado = JSON.parse(localStorage.getItem(FAV_STORAGE_KEY));
      return Array.isArray(guardado) ? guardado : [];
    } catch {
      return [];
    }
  },
  // Guarda la lista de favoritos en el navegador.
  _save(ids) {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Almacenamiento bloqueado: el favorito no se recordará al recargar, pero no se rompe nada.
    }
  },
  // Indica si un producto ya está en favoritos.
  has(id) {
    return this._get().includes(id);
  },
  // Si el producto no es favorito lo agrega; si ya lo era, lo quita.
  toggle(id) {
    const ids = this._get();
    const i = ids.indexOf(id);
    if (i >= 0) {
      ids.splice(i, 1);
    } else {
      ids.push(id);
    }
    this._save(ids);
    return ids.includes(id);
  },
  all() {
    return this._get();
  },
  count() {
    return this._get().length;
  },
};

// Actualiza el número que aparece junto al corazón del encabezado.
function updateFavCount() {
  const el = document.getElementById("favCount");
  if (!el) return;
  const newCount = Favorites.count();
  const changed = el.textContent !== String(newCount);
  el.textContent = newCount;
  if (changed) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
}

// Se ejecuta al tocar un corazón: cambia el favorito y actualiza la pantalla.
function toggleFavorite(id, btnEl) {
  const nowActive = Favorites.toggle(id);
  if (btnEl) {
    btnEl.classList.toggle("active", nowActive);
    const svg = btnEl.querySelector("svg");
    if (svg) svg.setAttribute("fill", nowActive ? "currentColor" : "none");
  }
  updateFavCount();
  showToast(nowActive ? "Agregado a tus favoritos." : "Quitado de tus favoritos.", "success");

  if (document.getElementById("favDrawer").classList.contains("open")) {
    renderFavoritesDrawer();
  }
  document.querySelectorAll(`.fav-btn[data-fav-id="${id}"]`).forEach((b) => {
    b.classList.toggle("active", nowActive);
    const svg = b.querySelector("svg");
    if (svg) svg.setAttribute("fill", nowActive ? "currentColor" : "none");
  });
}

// Abre el panel lateral de favoritos.
function openFavDrawer() {
  renderFavoritesDrawer();
  document.getElementById("favDrawer").classList.add("open");
  document.getElementById("favOverlay").classList.add("open");
}

// Cierra el panel lateral de favoritos.
function closeFavDrawer() {
  document.getElementById("favDrawer").classList.remove("open");
  document.getElementById("favOverlay").classList.remove("open");
}

// Dibuja dentro del panel los productos marcados como favoritos.
function renderFavoritesDrawer() {
  const wrap = document.getElementById("favItemsWrap");
  const ids = Favorites.all();
  const productos = ALL_PRODUCTS.filter((p) => ids.includes(p.id));

  if (!productos.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <p>Todavía no guardaste ningún favorito.</p>
        <p style="font-size:13px; color:var(--text-faint);">Toca el corazón ♡ en cualquier producto para guardarlo aquí.</p>
      </div>`;
    return;
  }

  wrap.innerHTML = productos.map((p) => `
    <div class="cart-item">
      <img src="${p.imagen_url || ""}" onerror="handleImgError(this,${jsArg(p.categoria_nombre)})" alt="${escapeHtml(p.nombre)}">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(p.nombre)}</div>
        <div class="cart-item-meta">${formatBs(p.precio)}</div>
        <div style="display:flex; gap:10px; margin-top:8px;">
          <button class="btn btn-primary" style="padding:7px 14px; font-size:12.5px;" onclick="closeFavDrawer(); openProductModal('${p.id}');">Ver producto</button>
          <button class="cart-item-remove" onclick="toggleFavorite('${p.id}'); renderFavoritesDrawer();" title="Quitar de favoritos">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`).join("");
}

// Al cargar la página: muestra el contador y conecta los botones del panel.
document.addEventListener("DOMContentLoaded", () => {
  updateFavCount();
  document.getElementById("openFavBtn").addEventListener("click", openFavDrawer);
  document.getElementById("closeFavBtn").addEventListener("click", closeFavDrawer);
  document.getElementById("favOverlay").addEventListener("click", closeFavDrawer);
});
