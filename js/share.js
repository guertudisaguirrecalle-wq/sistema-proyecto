/* =========================================================
   COMPARTIR
   Permite compartir el enlace de un producto puntual (para que
   la clienta se lo mande a una amiga) o el de toda la tienda
   (con un código QR, útil para tarjetas o flyers impresos).
   No requiere ninguna librería: usa un servicio gratuito de
   generación de QR por imagen.
   ========================================================= */

let SHARE_CURRENT = { tipo: "tienda", link: "", texto: "" };

// Devuelve la dirección base de la tienda, sin 'index.html' al final.
function baseStoreUrl() {
  return window.location.origin + window.location.pathname.replace(/index\.html$/, "");
}

// Prepara y abre la ventana para compartir el enlace de un producto.
function openShareProduct(id) {
  const p = ALL_PRODUCTS.find((x) => x.id === id);
  if (!p) return;
  const link = `${baseStoreUrl()}?producto=${id}`;
  SHARE_CURRENT = {
    tipo: "producto",
    link,
    texto: `Mira "${p.nombre}" en Couture Byte Market ✨ ${link}`,
  };
  document.getElementById("shareModalTitle").textContent = "Compartir producto";
  document.getElementById("shareModalSub").textContent = `Envía el enlace directo a "${p.nombre}".`;
  fillShareModal(link);
}

// Prepara y abre la ventana para compartir el enlace de toda la tienda.
function openShareStore() {
  const link = baseStoreUrl();
  SHARE_CURRENT = {
    tipo: "tienda",
    link,
    texto: `Descubre Couture Byte Market, moda femenina con estilo propio ✨ ${link}`,
  };
  document.getElementById("shareModalTitle").textContent = "Compartir tienda";
  document.getElementById("shareModalSub").textContent = "Comparte este enlace o el código QR (ideal para tarjetas o flyers impresos).";
  fillShareModal(link);
}

// Rellena la ventana con el enlace y genera el código QR.
function fillShareModal(link) {
  document.getElementById("shareLinkInput").value = link;
  document.getElementById("shareLinkInput").parentElement.style.display = "flex";
  const waBtn = document.querySelector('#shareModal button[onclick="shareViaWhatsApp()"]');
  if (waBtn) waBtn.style.display = "block";
  document.getElementById("shareQrImg").src =
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
  openModal("shareModal");
}

// Copia el enlace al portapapeles.
function copyShareLink() {
  const input = document.getElementById("shareLinkInput");
  input.select();
  navigator.clipboard?.writeText(input.value).then(
    () => showToast("Enlace copiado.", "success"),
    () => showToast("No se pudo copiar. Selecciona y copia manualmente.", "error")
  );
}

// Abre WhatsApp con el mensaje listo para enviar.
function shareViaWhatsApp() {
  const url = `https://wa.me/?text=${encodeURIComponent(SHARE_CURRENT.texto)}`;
  window.open(url, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("shareStoreBtn");
  if (btn) btn.addEventListener("click", openShareStore);
});

/* ---------- Enlace directo a un producto (?producto=ID) ---------- */
// Si alguien abre un enlace compartido de un producto puntual, se lo
// mostramos automáticamente apenas cargan los productos.
function checkProductDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("producto");
  if (id && ALL_PRODUCTS.some((p) => p.id === id)) {
    openProductModal(id);
  }
}
