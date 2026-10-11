/* =========================================================
   MAIN — Inicialización de la tienda
   ========================================================= */

/* ---------- Menú móvil: abrir y cerrar el panel lateral ---------- */
// Abre el panel, bloquea el desplazamiento de la página de atrás y lleva el foco al botón Cerrar.
function openMobileNav() {
  document.getElementById("mobileNav").classList.add("open");
  document.getElementById("mobileNavBackdrop").classList.add("open");
  document.documentElement.classList.add("menu-open");
  const toggle = document.getElementById("navToggle");
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "Cerrar menú");
  setTimeout(() => document.getElementById("closeMobileNavBtn").focus({ preventScroll: true }), 50);
}

// Cierra el panel y devuelve la página a la normalidad (si ya estaba cerrado, no hace nada).
function closeMobileNav({ devolverFoco = false } = {}) {
  const panel = document.getElementById("mobileNav");
  if (!panel || !panel.classList.contains("open")) return;
  panel.classList.remove("open");
  document.getElementById("mobileNavBackdrop").classList.remove("open");
  document.documentElement.classList.remove("menu-open");
  const toggle = document.getElementById("navToggle");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Abrir menú");
  if (devolverFoco) toggle.focus({ preventScroll: true });
}

// Cuando la página termina de cargar: se conectan los botones y se cargan los datos.
document.addEventListener("DOMContentLoaded", () => {
  // Carrito
  document.getElementById("openCartBtn").addEventListener("click", () => Cart.open());
  document.getElementById("closeCartBtn").addEventListener("click", () => Cart.close());
  document.getElementById("overlay").addEventListener("click", () => {
    Cart.close();
    closeMobileNav();
  });
  document.getElementById("checkoutBtn").addEventListener("click", openCheckout);
  document.getElementById("checkoutForm").addEventListener("submit", submitCheckout);
  document.getElementById("resenaForm").addEventListener("submit", submitResenaForm);

  // Ventanas emergentes
  document.getElementById("closeProductModal").addEventListener("click", () => closeModal("productModal"));
  document.getElementById("productModal").addEventListener("click", (e) => {
    if (e.target.id === "productModal") closeModal("productModal");
  });
  document.getElementById("checkoutModal").addEventListener("click", (e) => {
    if (e.target.id === "checkoutModal") closeModal("checkoutModal");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const lightbox = document.getElementById("lightboxOverlay");
      if (lightbox && lightbox.classList.contains("open")) return; // la imagen ampliada ya maneja su propia tecla Escape
      closeModal("productModal");
      closeModal("checkoutModal");
      Cart.close();
      closeMobileNav({ devolverFoco: true });
    }
  });

  // Menú móvil (botón ☰)
  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");
  navToggle.addEventListener("click", () => {
    mobileNav.classList.contains("open") ? closeMobileNav() : openMobileNav();
  });
  document.getElementById("closeMobileNavBtn").addEventListener("click", () => closeMobileNav({ devolverFoco: true }));
  document.getElementById("mobileNavBackdrop").addEventListener("click", () => closeMobileNav());
  // Al elegir cualquier opción del menú, este se cierra solo
  mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => closeMobileNav()));
  // Si la pantalla se ensancha (ej. girar el celular), el panel ya no hace falta
  window.matchMedia("(min-width: 1261px)").addEventListener("change", (e) => {
    if (e.matches) closeMobileNav();
  });

  // Enlaces de contacto: primero con los valores de config.js; cuando llega la
  // configuración de Supabase (loadStoreConfig) se vuelven a poner con lo que editó la dueña.
  aplicarContactoTienda();

  Cart.updateCount();

  // Año actual automático en "Colección 2026", la cinta y el © del pie de página.
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // Cargar configuración de envío y métodos de pago desde Supabase
  // (si el admin los cambió desde el panel, se reflejan aquí al instante).
  loadStoreConfig().finally(() => {
    // Cargar productos desde Supabase
    initProducts();
  });
});

// Pone el WhatsApp, el Instagram y el Facebook en todos los enlaces de la página.
function aplicarContactoTienda() {
  const waLink = `https://wa.me/${APP_CONFIG.WHATSAPP_NUMBER}`;
  const hola = `?text=${encodeURIComponent("Hola, quisiera más información sobre Couture Byte Market")}`;
  document.getElementById("waLocationLink").href = waLink + hola;
  document.getElementById("footerWaIcon").href = waLink;
  document.getElementById("footerWaText").textContent = "+" + APP_CONFIG.WHATSAPP_NUMBER;
  document.getElementById("floatWaBtn").href = waLink + hola;
  document.getElementById("footerContactLink").href = waLink + hola;
  document.getElementById("footerIgIcon").href = APP_CONFIG.INSTAGRAM_URL;
  document.getElementById("footerFbIcon").href = APP_CONFIG.FACEBOOK_URL;
}

// Trae de Supabase la información de envío y los métodos de pago que configuró el admin.
async function loadStoreConfig() {
  try {
    const { data, error } = await sb.from("configuracion").select("*").eq("id", 1).single();
    if (error || !data) return; // si falla, se usan los valores por defecto de config.js

    if (data.envio_info) APP_CONFIG.ENVIO_INFO = data.envio_info;

    // WhatsApp e Instagram editados desde el panel. Si el dato guardado no es válido
    // se ignora y queda el de config.js (la tienda nunca se queda sin contacto).
    const wa = normalizarWhatsAppNumero(data.whatsapp);
    if (wa) APP_CONFIG.WHATSAPP_NUMBER = wa;
    const ig = normalizarInstagramUrl(data.instagram_url);
    if (ig) APP_CONFIG.INSTAGRAM_URL = ig;
    const fb = normalizarFacebookUrl(data.facebook_url);
    if (fb) APP_CONFIG.FACEBOOK_URL = fb;
    aplicarContactoTienda();
    aplicarOpcionesTienda(data);   // aviso, tienda cerrada, horario, dirección, envío (js/opciones.js)

    // Foto de portada elegida por el admin (si no hay, queda la foto por defecto del HTML).
    if (data.portada_url) {
      const heroImg = document.querySelector(".hero-image-wrap img");
      if (heroImg) heroImg.src = data.portada_url;
    }
    APP_CONFIG.METODOS_PAGO = {
      qr: {
        activo: !!data.qr_activo,
        imagen_url: data.qr_imagen_url || "",
        banco: data.qr_banco || "",
        titular: data.qr_titular || "",
      },
      transferencia: {
        activo: !!data.transferencia_activo,
        banco: data.transferencia_banco || "",
        numero_cuenta: data.transferencia_cuenta || "",
        titular: data.transferencia_titular || "",
      },
      efectivo: {
        activo: data.efectivo_activo !== false,
      },
    };
  } catch (err) {
    console.error("No se pudo cargar la configuración de la tienda:", err);
  }
}
