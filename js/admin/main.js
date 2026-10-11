/* =========================================================
   ADMIN — Inicialización del panel
   ========================================================= */

function switchAdminView(viewId) {
  document.querySelectorAll(".admin-view").forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  document.querySelectorAll(".admin-nav-item[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  // Cada pestaña vuelve a pedir sus datos al abrirse, así nunca muestra cifras viejas
  // (por ejemplo, el stock que cambió al cancelar un pedido o al vender desde la tienda).
  if (viewId === "viewProductos") loadProductsTable();
  if (viewId === "viewPedidos") { loadOrdersTable(); marcarPedidosVistos(); }
  if (viewId === "viewClientes") loadCustomersTable();
  if (viewId === "viewResenas") loadResenasView();
  if (viewId === "viewConfig") loadConfigView();
  if (viewId === "viewStats") loadStatsView();
}

// Evita que el panel se inicie dos veces (conectaría cada botón por duplicado).
let ADMIN_PANEL_INICIADO = false;

// Conecta todos los botones y luego carga los datos iniciales del panel.
// Primero se conectan los botones y DESPUÉS se piden los datos: así, aunque una
// consulta falle, el menú y los botones siguen funcionando.
async function initAdminPanel() {
  if (ADMIN_PANEL_INICIADO) return;
  ADMIN_PANEL_INICIADO = true;

  document.getElementById("statsRangeSelect").addEventListener("change", loadStatsView);
  document.getElementById("exportVentasBtn").addEventListener("click", exportarVentasExcel);
  document.getElementById("exportStockBajoBtn").addEventListener("click", exportarStockBajoExcel);
  document.getElementById("exportVentasPdfBtn").addEventListener("click", exportarVentasPdf);
  document.getElementById("exportStockBajoPdfBtn").addEventListener("click", exportarStockBajoPdf);

  document.querySelectorAll(".admin-nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchAdminView(btn.dataset.view));
  });

  document.getElementById("openAddProductBtn").addEventListener("click", () => openProductForm(null));
  document.getElementById("productForm").addEventListener("submit", submitProductForm);
  document.getElementById("confirmDeleteBtn").addEventListener("click", confirmDeleteProduct);
  document.getElementById("confirmDeactivateBtn").addEventListener("click", confirmDeactivateProduct);
  document.getElementById("newCategoriaBtn").addEventListener("click", openNewCategoriaModal);
  document.getElementById("saveNewCategoriaBtn").addEventListener("click", saveNewCategoria);
  document.getElementById("newCategoriaNombre").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveNewCategoria(); }
  });

  document.getElementById("adminProductSearch").addEventListener(
    "input",
    debounce((e) => {
      ADMIN_PRODUCT_SEARCH = e.target.value;
      renderProductsGrid();
    }, 300)
  );

  setupImageUpload();
  setupConfigQrUpload();
  setupConfigPortadaUpload();
  setupLightbox();
  document.getElementById("saveConfigBtn").addEventListener("click", saveConfig);
  document.getElementById("respaldoPedidosBtn").addEventListener("click", exportarPedidosExcel);
  document.getElementById("respaldoClientesBtn").addEventListener("click", exportarClientesExcel);

  // Cerrar las ventanas emergentes al hacer clic fuera o con Escape
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.open").forEach((m) => closeModal(m.id));
    }
  });

  // Datos iniciales. Cada bloque está protegido: si uno falla, los demás se cargan igual.
  const pasos = [
    async () => { await AdminProducts.fetchCategorias(); renderCategoriaOptions(); },
    loadProductsTable,
    loadStatsView,
    refreshResenasBadge,
    refreshPedidosBadge,
  ];
  for (const paso of pasos) {
    try {
      await paso();
    } catch (err) {
      console.error("Error al cargar datos iniciales del panel:", err);
    }
  }
}

// Al abrir el panel: primero se verifica la sesión y, solo si es válida, se inicia el panel.
document.addEventListener("DOMContentLoaded", async () => {
  const autenticado = await initAuthGate();
  if (autenticado) {
    initAdminPanel();
  }
});
