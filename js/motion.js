/* =========================================================
   MOTION — Revelado al desplazarse por la página, contadores animados,
   efecto de profundidad (parallax) de la portada y encabezado dinámico.
   Todo con lógica real: IntersectionObserver + rAF, nada decorativo
   que no responda a algo (desplazamiento, mouse, carga de la página).
   ========================================================= */

/* ---------- Revelado al desplazarse por la página ---------- */
let _revealObserver = null;

function observeReveals(root = document) {
  if (!_revealObserver) {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in-view"));
      return;
    }
    _revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            _revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
  }
  root.querySelectorAll(".reveal:not(.reveal-bound)").forEach((el) => {
    el.classList.add("reveal-bound");
    _revealObserver ? _revealObserver.observe(el) : el.classList.add("in-view");
  });
}

/** Aplica la clase .reveal a una lista de elementos con un pequeño
 *  escalonado entre ellos (cascada), y los pone en observación.
 *  Se usa después de renderizar grillas dinámicas (categorías, productos). */
function staggerReveal(elements, { step = 0.07, max = 0.56 } = {}) {
  elements.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.setProperty("--reveal-delay", Math.min(i * step, max) + "s");
  });
  observeReveals();
}

/* ---------- Contadores animados ----------
   - data-count-to="N": número fijo (ej. el 100% de la portada).
   - data-count-live="prendas|categorias": número REAL que llega desde
     Supabase; lo pone updateHeroStats() (en products.js) cuando ya cargaron
     los productos, con la misma animación. */
let COUNTER_OBSERVER = null;

function animateCounter(el) {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const end = parseFloat(el.dataset.countTo);
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  if (prefersReduced) { el.textContent = prefix + end + suffix; return; }

  const duration = 1400;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3); // desaceleración suave al final (fórmula «easeOutCubic»)

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(end * ease(progress));
    el.textContent = prefix + value + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Anima el contador cuando entra en pantalla.
function observeCounter(el) {
  if (!COUNTER_OBSERVER) {
    COUNTER_OBSERVER = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            COUNTER_OBSERVER.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
  }
  COUNTER_OBSERVER.observe(el);
}

function initCounters() {
  document.querySelectorAll("[data-count-to]").forEach(observeCounter);
}

// Pone un valor real en un contador "vivo" y lo anima.
function setLiveCounter(name, value) {
  const el = document.querySelector(`[data-count-live="${name}"]`);
  if (!el) return;
  el.dataset.countTo = String(value);
  observeCounter(el);
}

/* ---------- Encabezado que se compacta al desplazarse por la página ---------- */
function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  let ticking = false;

  const update = () => {
    header.classList.toggle("scrolled", window.scrollY > 30);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

/* ---------- Encabezado que se oculta al bajar y reaparece al subir (solo celular) ---------- */
function initHeaderAutoHide() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  // Mismo punto de corte donde aparece el botón ☰: en computadora no se activa nada.
  const esCelular = window.matchMedia("(max-width: 860px)");
  const MOVIMIENTO_MIN = 8;   // píxeles mínimos para considerar que la persona cambió de dirección
  const ZONA_SUPERIOR = 80;   // cerca del inicio de la página el encabezado siempre se ve
  let ultimoY = window.scrollY;
  let ticking = false;

  const mostrar = () => header.classList.remove("header-hidden");
  const ocultar = () => header.classList.add("header-hidden");

  const actualizar = () => {
    ticking = false;
    const y = Math.max(window.scrollY, 0); // en iOS el "rebote" puede dar valores negativos

    if (!esCelular.matches || document.documentElement.classList.contains("menu-open")) {
      mostrar();
      ultimoY = y;
      return;
    }

    const diferencia = y - ultimoY;
    if (y <= ZONA_SUPERIOR) {
      mostrar();
    } else if (diferencia > MOVIMIENTO_MIN) {
      ocultar();   // bajando
    } else if (diferencia < -MOVIMIENTO_MIN) {
      mostrar();   // subiendo
    } else {
      return;      // movimiento muy pequeño: se ignora
    }
    ultimoY = y;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(actualizar);
      ticking = true;
    }
  }, { passive: true });

  // Al cambiar entre celular y computadora (ej. girar la pantalla) se restablece
  esCelular.addEventListener("change", () => { mostrar(); ultimoY = window.scrollY; });
}

/* ---------- Efecto de profundidad (parallax) suave de la forma decorativa de la portada (según el mouse) ---------- */
function initHeroParallax() {
  const hero = document.querySelector(".hero");
  const blob = document.querySelector(".hero-blob");
  if (!hero || !blob) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(pointer: coarse)").matches) return; // sin mouse real (táctil): se omite

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    blob.style.setProperty("--mx", (relX * 26).toFixed(1));
    blob.style.setProperty("--my", (relY * 26).toFixed(1));
  });
  hero.addEventListener("mouseleave", () => {
    blob.style.setProperty("--mx", 0);
    blob.style.setProperty("--my", 0);
  });
}

/* ---------- Inclinación 3D suave en tarjetas al pasar el mouse ----------
   Usa delegación de eventos porque las tarjetas se regeneran dinámicamente
   (filtros, búsqueda, categorías). Se omite en táctil y con «movimiento reducido» activado. */
function initCardTilt() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const TILT_SELECTOR = ".product-card, .cat-card";
  let activeCard = null;

  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
    if (!card) {
      if (activeCard) {
        activeCard.style.setProperty("--tilt-x", "0deg");
        activeCard.style.setProperty("--tilt-y", "0deg");
        activeCard = null;
      }
      return;
    }
    activeCard = card;
    const rect = card.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-x", (relY * -6).toFixed(2) + "deg");
    card.style.setProperty("--tilt-y", (relX * 6).toFixed(2) + "deg");
  });

  document.addEventListener("mouseout", (e) => {
    const card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
    if (card && !card.contains(e.relatedTarget)) {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    }
  });
}

/* ---------- Inicialización ---------- */
document.addEventListener("DOMContentLoaded", () => {
  observeReveals();
  initCounters();
  initHeaderScroll();
  initHeaderAutoHide();
  initHeroParallax();
  initCardTilt();
});
