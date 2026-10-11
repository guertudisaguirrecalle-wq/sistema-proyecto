/* =========================================================
   ADMIN — Estadísticas
   Calcula y muestra gráficos reales a partir de los pedidos ya
   registrados en Supabase (no hay datos inventados). Usa Chart.js
   (cargado por CDN en admin.html).

   Organización:
   1) Funciones que TRAEN datos de Supabase
   2) Funciones que CALCULAN/AGRUPAN esos datos
   3) Funciones que DIBUJAN cada gráfico, tabla o alerta
   ========================================================= */

let STATS_CHARTS = { dia: null, categorias: null, mejorDia: null };
let STATS_PEDIDOS_ACTUALES = [];
let STATS_PERIODO_ACTUAL = null; // { inicio, dias } del período que se está mostrando
// Número de la última carga pedida. Si la persona cambia de período (o de
// pestaña) mientras todavía se está cargando uno anterior, la respuesta vieja
// llega tarde y se descarta en vez de pisar los datos nuevos.
let STATS_CARGA_ACTUAL = 0;

// Umbrales de "stock bajo" en UN solo lugar, para que tablas, alertas y
// reportes coincidan entre sí y con el resto del sistema.
const STOCK_BAJO_TALLA = 3;     // por talla (igual que el aviso "quedan pocas" de la tienda)
const STOCK_BAJO_PRODUCTO = 5;  // total del producto (igual que "Stock bajo (≤5)" del panel de productos)

/* ---------------------------------------------------------
   UTILIDADES COMUNES (fechas, paginación, identidad de clientas)
   --------------------------------------------------------- */

// Fecha local "AAAA-MM-DD" (toISOString usaría hora UTC y movería de día
// a los pedidos hechos de noche en Bolivia).
function fechaLocalISO(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Textos del período. Con "Hoy" (1 día) se habla de "hoy" y "ayer" en vez de "1 días". */
function textoPeriodo(dias) { return dias === 1 ? "hoy" : `${dias} días`; }
function textoPeriodoAnterior(dias) { return dias === 1 ? "ayer" : `${dias} días anteriores`; }

/** Períodos por DÍAS COMPLETOS (hora local), incluyendo hoy:
 *  - actual:   desde `inicio` hasta ahora (dias días, el último es hoy).
 *  - anterior: los `dias` días justo antes de `inicio`.
 *  Todo el módulo (tarjetas, gráficos, comparación, exportaciones) usa
 *  estos mismos límites, así los números siempre cuadran entre sí. */
function rangoPeriodo(dias) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - (dias - 1));
  const inicioAnterior = new Date(inicio);
  inicioAnterior.setDate(inicioAnterior.getDate() - dias);
  return { inicio, inicioAnterior };
}

/** Supabase devuelve máximo 1000 filas por consulta. Esta función pide
 *  por páginas hasta traer todo, para no calcular con datos incompletos. */
async function traerPaginado(armarConsulta) {
  const TAM = 1000;
  let todo = [];
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await armarConsulta().range(desde, desde + TAM - 1);
    if (error) {
      console.error(error);
      return todo;
    }
    todo = todo.concat(data || []);
    if (!data || data.length < TAM) break;
  }
  return todo;
}

/* La identidad de las clientas (clavesPersona / agruparPorContacto) vive en
 * utils.js y es la MISMA que usa la pestaña "Clientes", así que los números
 * de "Clientas nuevas/recurrentes" siempre cuadran con esa lista. */

/* ---------------------------------------------------------
   1) TRAER DATOS DE SUPABASE
   --------------------------------------------------------- */

async function fetchStatsData(dias) {
  const { inicio } = rangoPeriodo(dias);
  return traerPaginado(() => sb
    .from("pedidos")
    .select(`
      id, total, estado, created_at, cliente_id,
      clientes ( correo, telefono ),
      detalle_pedidos ( cantidad, subtotal, productos ( id, nombre, imagen_url, categorias ( nombre ) ) )
    `)
    .gte("created_at", inicio.toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }));
}

/** Los `dias` días completos justo ANTES del período actual — así se puede
 * comparar "¿vendí más o menos que el período pasado?" con la misma
 * cantidad de días. */
async function fetchStatsDataAnterior(dias) {
  const { inicio, inicioAnterior } = rangoPeriodo(dias);
  return traerPaginado(() => sb
    .from("pedidos")
    .select("id, total, estado, created_at")
    .gte("created_at", inicioAnterior.toISOString())
    .lt("created_at", inicio.toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }));
}

/** Datos de contacto (como claves de persona) de todos los pedidos NO
 * cancelados anteriores al período actual: sirve para saber si una
 * clienta ya había comprado antes. */
async function fetchClavesHistorial(inicio) {
  const filas = await traerPaginado(() => sb
    .from("pedidos")
    .select("id, created_at, clientes ( correo, telefono )")
    .neq("estado", "cancelado")
    .lt("created_at", inicio.toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }));
  const claves = new Set();
  filas.forEach((f) => clavesPersona(f.clientes).forEach((k) => claves.add(k)));
  return claves;
}

/** Trae el stock ACTUAL de cada producto (sumando todas sus tallas). */
async function fetchStockPorProducto() {
  const { data, error } = await sb.from("producto_tallas").select("producto_id, stock");
  if (error) {
    console.error(error);
    return {};
  }
  const stockPorProducto = {};
  (data || []).forEach((fila) => {
    stockPorProducto[fila.producto_id] = (stockPorProducto[fila.producto_id] || 0) + fila.stock;
  });
  return stockPorProducto;
}

/** Muestra un mensaje en lugar del gráfico SIN borrar el <canvas>.
 *  (Antes se reemplazaba el contenido del contenedor: el <canvas> desaparecía
 *  y, al elegir luego un período con ventas, el gráfico ya no tenía dónde
 *  dibujarse y fallaba todo el resto de las estadísticas.) */
function mostrarGraficoVacio(canvas, mensaje) {
  canvas.style.display = "none";
  let aviso = canvas.parentElement.querySelector(".chart-empty");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.className = "empty-admin chart-empty";
    canvas.parentElement.appendChild(aviso);
  }
  aviso.textContent = mensaje;
  aviso.style.display = "";
}

// Vuelve a mostrar el <canvas> y esconde el mensaje de "sin datos".
function mostrarGraficoConDatos(canvas) {
  canvas.style.display = "";
  const aviso = canvas.parentElement.querySelector(".chart-empty");
  if (aviso) aviso.style.display = "none";
}

// Devuelve n colores de la paleta de la marca (se repiten si hacen falta más).
function paletaColores(n) {
  const base = ["#E27B95", "#7C4FA6", "#E3B79C", "#7E9E7A", "#B8823B", "#93697A", "#E4D3F2", "#B23E62"];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

/* ---------------------------------------------------------
   FUNCIÓN PRINCIPAL
   --------------------------------------------------------- */
async function loadStatsView() {
  const miCarga = ++STATS_CARGA_ACTUAL;
  const dias = parseInt(document.getElementById("statsRangeSelect").value, 10);
  const { inicio } = rangoPeriodo(dias);

  try {
    // AdminProducts.fetchAll refresca la lista de productos (activo, fecha de
    // creación) para que "Stock muerto" use datos al día y no una copia vieja.
    const [pedidos, pedidosPeriodoAnterior, stockPorProducto] = await Promise.all([
      fetchStatsData(dias),
      fetchStatsDataAnterior(dias),
      fetchStockPorProducto(),
      AdminProducts.fetchAll(),
    ]);

    const pedidosValidos = pedidos.filter((p) => p.estado !== "cancelado");
    const pedidosAnterioresValidos = pedidosPeriodoAnterior.filter((p) => p.estado !== "cancelado");

    // Datos que dependen de otra consulta (historial de compras previas).
    const resumenClientas = await calcularClientas(pedidosValidos, inicio);

    // Si mientras tanto se pidió otra carga, esta ya quedó vieja: se descarta.
    if (miCarga !== STATS_CARGA_ACTUAL) return;

    STATS_PERIODO_ACTUAL = { inicio, dias };
    STATS_PEDIDOS_ACTUALES = pedidosValidos;

    renderStatsSummary(pedidosValidos, dias);
    renderComparativaYClientas(pedidosValidos, pedidosAnterioresValidos, dias, resumenClientas);
    renderChartVentasDia(pedidosValidos, dias);
    renderChartCategorias(pedidosValidos);
    renderChartMejorDia(pedidosValidos, dias, inicio);

    const ranking = calcularRankingProductos(pedidosValidos, stockPorProducto);
    renderRankingProductos(ranking);
    renderTablaTopProductos(ranking);
    renderAlertaProductoEstrella(ranking);
    renderStockMuerto(ranking, stockPorProducto, inicio, dias);

    await loadStockBajoReport(miCarga);
  } catch (err) {
    // Un error en una sola gráfica ya no deja el panel a medias sin avisar.
    console.error("Error al cargar las estadísticas:", err);
    if (miCarga === STATS_CARGA_ACTUAL) {
      showToast("No se pudieron cargar las estadísticas. Intenta de nuevo.", "error");
    }
  }
}

/* ---------------------------------------------------------
   2) CALCULAR / AGRUPAR
   --------------------------------------------------------- */

/** Decide qué mostrar al comparar ventas actuales vs. período anterior.
 *  Siempre devuelve un resultado coherente con los montos:
 *   - Antes hubo ventas: porcentaje real. Si al redondear da 0%, se muestra
 *     "Sin cambios" (nunca una flecha ▲/▼ junto a un 0%).
 *   - Antes NO hubo ventas: no se puede sacar porcentaje (dividir entre 0),
 *     así que se muestra un texto según lo que pasó ahora.
 */
function calcularComparativaVentas(totalActual, totalAnterior) {
  if (totalAnterior > 0) {
    const variacion = ((totalActual - totalAnterior) / totalAnterior) * 100;
    const redondeado = Math.round(variacion);
    if (redondeado === 0) {
      return { texto: "= Sin cambios", color: "var(--text-faint)", pequeno: true };
    }
    const subio = redondeado > 0;
    return {
      texto: `${subio ? "▲" : "▼"} ${Math.abs(redondeado).toLocaleString("es-BO")}%`,
      color: subio ? "#1E9E5A" : "#D8434B",
      pequeno: false,
    };
  }
  if (totalActual > 0) {
    return { texto: "▲ Sin ventas antes", color: "#1E9E5A", pequeno: true };
  }
  return { texto: "— Sin ventas", color: "var(--text-faint)", pequeno: true };
}

/** Cuenta cuántas PERSONAS (no pedidos) de este período son nuevas (primera
 * compra) o recurrentes (ya habían comprado antes del período, sin contar
 * pedidos cancelados). Es la única parte que necesita una consulta extra. */
async function calcularClientas(pedidosActuales, inicio) {
  const personas = agruparPorContacto(pedidosActuales, (p) => p.clientes);
  let recurrentes = 0;
  if (personas.length) {
    const clavesHistorial = await fetchClavesHistorial(inicio);
    recurrentes = personas.filter((pedidosDeLaPersona) =>
      pedidosDeLaPersona.some((p) => clavesPersona(p.clientes).some((k) => clavesHistorial.has(k)))
    ).length;
  }
  return { nuevas: personas.length - recurrentes, recurrentes };
}

/** Compara el período actual contra el mismo largo de días inmediatamente
 * anterior y muestra además las clientas nuevas vs. recurrentes. */
function renderComparativaYClientas(pedidosActuales, pedidosAnteriores, dias, clientas) {
  const totalActual = pedidosActuales.reduce((s, p) => s + Number(p.total), 0);
  const totalAnterior = pedidosAnteriores.reduce((s, p) => s + Number(p.total), 0);
  const comp = calcularComparativaVentas(totalActual, totalAnterior);

  document.getElementById("statsComparativaRow").innerHTML = `
    <div class="stat-card">
      <span>Ventas vs. ${textoPeriodoAnterior(dias)}</span>
      <b style="color:${comp.color};${comp.pequeno ? " font-size:18px;" : ""}">${comp.texto}</b>
      <span style="font-size:11px; color:var(--text-faint);">ahora: ${formatBs(totalActual)} · antes: ${formatBs(totalAnterior)}</span>
    </div>
    <div class="stat-card">
      <span>Clientas nuevas</span><b>${clientas.nuevas}</b>
      <span style="font-size:11px; color:var(--text-faint);">primera compra en este período</span>
    </div>
    <div class="stat-card">
      <span>Clientas recurrentes</span><b>${clientas.recurrentes}</b>
      <span style="font-size:11px; color:var(--text-faint);">ya habían comprado antes de este período</span>
    </div>
  `;
}

// Muestra las tarjetas resumen: ventas totales, pedidos, ticket promedio y prendas vendidas.
function renderStatsSummary(pedidos, dias) {
  const totalVentas = pedidos.reduce((s, p) => s + Number(p.total), 0);
  const totalPedidos = pedidos.length;
  const ticketPromedio = totalPedidos ? totalVentas / totalPedidos : 0;
  const prendas = pedidos.reduce(
    (s, p) => s + (p.detalle_pedidos || []).reduce((s2, d) => s2 + d.cantidad, 0),
    0
  );

  document.getElementById("statsSummaryRow").innerHTML = `
    <div class="stat-card"><span>Ventas (${textoPeriodo(dias)})</span><b>${formatBs(totalVentas)}</b></div>
    <div class="stat-card"><span>Pedidos</span><b>${totalPedidos}</b></div>
    <div class="stat-card"><span>Ticket promedio</span><b>${formatBs(ticketPromedio)}</b></div>
    <div class="stat-card"><span>Prendas vendidas</span><b>${prendas}</b></div>
  `;
}

/** Ranking de productos más vendidos: unidades, ingresos, stock actual
 * e imagen — combina lo que se vendió con lo que queda disponible. */
function calcularRankingProductos(pedidos, stockPorProducto) {
  const porProducto = {};

  pedidos.forEach((p) => {
    (p.detalle_pedidos || []).forEach((d) => {
      const prod = d.productos;
      if (!prod) return; // el producto pudo haber sido eliminado después de la venta
      if (!porProducto[prod.id]) {
        porProducto[prod.id] = {
          id: prod.id, nombre: prod.nombre, imagen_url: prod.imagen_url || "",
          categoria: prod.categorias ? prod.categorias.nombre : "",
          unidades: 0, ingresos: 0,
        };
      }
      porProducto[prod.id].unidades += d.cantidad;
      porProducto[prod.id].ingresos += Number(d.subtotal);
    });
  });

  return Object.values(porProducto)
    .map((p) => ({ ...p, stockActual: stockPorProducto[p.id] ?? 0 }))
    .sort((a, b) => b.unidades - a.unidades);
}

/* ---------------------------------------------------------
   3) DIBUJAR GRÁFICOS, TABLAS Y ALERTAS
   --------------------------------------------------------- */

function renderChartVentasHoy(pedidos) {
  const porHora = new Array(24).fill(0);
  pedidos.forEach((p) => { porHora[new Date(p.created_at).getHours()] += Number(p.total); });
  const labels = porHora.map((_, h) => `${String(h).padStart(2, "0")}h`);

  if (STATS_CHARTS.dia) { STATS_CHARTS.dia.destroy(); STATS_CHARTS.dia = null; }
  const ctx = document.getElementById("chartVentasDia").getContext("2d");
  STATS_CHARTS.dia = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Ventas (Bs.)", data: porHora, backgroundColor: "rgba(201,139,146,0.35)", borderColor: "#E27B95", borderWidth: 2, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#F0E4D7" } },
      },
    },
  });
}

function renderChartVentasDia(pedidos, dias) {
  // Con "Hoy" un solo día no sirve de gráfico: se muestra hora por hora.
  const titulo = document.getElementById("chartVentasTitulo");
  const sub = document.getElementById("chartVentasSub");
  if (titulo) titulo.textContent = dias === 1 ? "Ventas de hoy por hora" : "Ventas por día";
  if (sub) sub.textContent = dias === 1
    ? "Total vendido (Bs.) en cada hora de hoy, sin contar pedidos cancelados."
    : "Total vendido (Bs.) cada día, sin contar pedidos cancelados.";
  if (dias === 1) { renderChartVentasHoy(pedidos); return; }

  // Un casillero por cada día completo del período (hora local). Como el
  // período empieza a las 00:00 del primer día, TODOS los pedidos caen en
  // un casillero y la suma del gráfico coincide con la tarjeta de ventas.
  const { inicio } = rangoPeriodo(dias);
  const porDia = {};
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    porDia[fechaLocalISO(d)] = 0;
  }
  const claves = Object.keys(porDia);
  const ultima = claves[claves.length - 1];
  pedidos.forEach((p) => {
    let key = fechaLocalISO(new Date(p.created_at));
    if (!(key in porDia)) key = ultima; // reloj del servidor ligeramente adelantado
    porDia[key] += Number(p.total);
  });

  const labels = Object.keys(porDia).map((k) => {
    const d = new Date(k + "T00:00:00");
    return d.toLocaleDateString("es-BO", { day: "2-digit", month: "short" });
  });
  const valores = Object.values(porDia);

  if (STATS_CHARTS.dia) { STATS_CHARTS.dia.destroy(); STATS_CHARTS.dia = null; }
  const ctx = document.getElementById("chartVentasDia").getContext("2d");
  STATS_CHARTS.dia = new Chart(ctx, {
    type: dias > 30 ? "line" : "bar",
    data: {
      labels,
      datasets: [{
        label: "Ventas (Bs.)",
        data: valores,
        backgroundColor: "rgba(201,139,146,0.35)",
        borderColor: "#E27B95",
        borderWidth: 2,
        borderRadius: 6,
        tension: 0.3,
        fill: dias > 30,
        pointRadius: dias > 30 ? 2 : 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#F0E4D7" } },
      },
    },
  });
}

// Gráfico de las ventas agrupadas por categoría.
function renderChartCategorias(pedidos) {
  const porCategoria = {};
  pedidos.forEach((p) => {
    (p.detalle_pedidos || []).forEach((d) => {
      const cat = d.productos?.categorias?.nombre || "Sin categoría";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.subtotal);
    });
  });

  const labels = Object.keys(porCategoria);
  const valores = Object.values(porCategoria);

  if (STATS_CHARTS.categorias) { STATS_CHARTS.categorias.destroy(); STATS_CHARTS.categorias = null; }
  const canvas = document.getElementById("chartCategorias");

  if (!labels.length) {
    mostrarGraficoVacio(canvas, "Todavía no hay ventas registradas en este período.");
    return;
  }
  mostrarGraficoConDatos(canvas);
  const ctx = canvas.getContext("2d");

  STATS_CHARTS.categorias = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: valores, backgroundColor: paletaColores(labels.length), borderWidth: 2, borderColor: "#fff" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
    },
  });
}

/** Promedio vendido en cada día de la semana durante el período.
 * Se usa el PROMEDIO (total ÷ cuántas veces ocurrió ese día) y no el total,
 * porque en períodos de 30 o 90 días algunos días de la semana se repiten
 * más veces que otros y ganarían solo por eso. */
function renderChartMejorDia(pedidos, dias, inicio) {
  if (dias < 7) {
    if (STATS_CHARTS.mejorDia) { STATS_CHARTS.mejorDia.destroy(); STATS_CHARTS.mejorDia = null; }
    mostrarGraficoVacio(document.getElementById("chartMejorDia"), "Elige 7 días o más para comparar los días de la semana.");
    return;
  }
  const nombresDias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const totalPorDia = [0, 0, 0, 0, 0, 0, 0];
  const ocurrencias = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    ocurrencias[d.getDay()]++;
  }
  pedidos.forEach((p) => {
    totalPorDia[new Date(p.created_at).getDay()] += Number(p.total);
  });
  const promedioPorDia = totalPorDia.map((t, i) => (ocurrencias[i] ? t / ocurrencias[i] : 0));

  if (STATS_CHARTS.mejorDia) { STATS_CHARTS.mejorDia.destroy(); STATS_CHARTS.mejorDia = null; }
  const canvas = document.getElementById("chartMejorDia");

  if (!promedioPorDia.some((v) => v > 0)) {
    mostrarGraficoVacio(canvas, "Todavía no hay ventas registradas en este período.");
    return;
  }
  mostrarGraficoConDatos(canvas);
  const ctx = canvas.getContext("2d");

  const mejorIndice = promedioPorDia.indexOf(Math.max(...promedioPorDia));
  const colores = promedioPorDia.map((_, i) => (i === mejorIndice ? "#FF6B1A" : "#E3B79C"));

  STATS_CHARTS.mejorDia = new Chart(ctx, {
    type: "bar",
    data: {
      labels: nombresDias.map((d) => d.slice(0, 3)),
      datasets: [{
        label: "Promedio por día (Bs.)",
        data: promedioPorDia.map((v) => Math.round(v * 100) / 100),
        backgroundColor: colores,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#F0E4D7" } },
      },
    },
  });
}

/** Ranking visual (con foto real, ampliable) de los productos más
 * vendidos en el período. */
function renderRankingProductos(ranking) {
  const wrap = document.getElementById("topProductosRanking");
  if (!wrap) return;

  const top6 = ranking.slice(0, 6);
  if (!top6.length) {
    wrap.innerHTML = `<p class="empty-admin">Todavía no hay ventas registradas en este período.</p>`;
    return;
  }

  const max = top6[0].unidades;

  wrap.innerHTML = top6.map((p, i) => {
    const pct = Math.max((p.unidades / max) * 100, 6);
    return `
    <div class="tpr-row">
      <span class="tpr-rank">${i === 0 ? "⭐" : "#" + (i + 1)}</span>
      <div class="tpr-thumb">
        <img src="${p.imagen_url || ""}" alt="" onerror="handleImgError(this,${jsArg(p.categoria)})"
             onclick="openLightbox(${jsArg(p.imagen_url || "")},${jsArg(p.nombre)})">
      </div>
      <div class="tpr-body">
        <div class="tpr-top">
          <span class="tpr-name">${escapeHtml(p.nombre)}</span>
          <span class="tpr-count">${p.unidades} unid.</span>
        </div>
        <div class="tpr-bar-track"><div class="tpr-bar-fill" style="--tpr-pct:${pct}%"></div></div>
      </div>
    </div>`;
  }).join("");
}

/** Tabla debajo del ranking: unidades, ingresos y stock actual de
 * cada producto, para complementar la foto rápida con el detalle. */
function renderTablaTopProductos(ranking) {
  const tbody = document.getElementById("topProductosTablaBody");
  if (!tbody) return;
  const top10 = ranking.slice(0, 10);

  if (!top10.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-admin">Todavía no hay ventas en este período.</td></tr>`;
    return;
  }

  tbody.innerHTML = top10.map((p, i) => {
    let stockBadge = `<span class="badge badge-ok">${p.stockActual} unid.</span>`;
    if (p.stockActual <= 0) stockBadge = `<span class="badge badge-warn">Agotado</span>`;
    else if (p.stockActual <= STOCK_BAJO_PRODUCTO) stockBadge = `<span class="badge badge-warn">${p.stockActual} unid. (bajo)</span>`;

    return `
    <tr>
      <td><b>#${i + 1}</b></td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${p.unidades}</td>
      <td>${formatBs(p.ingresos)}</td>
      <td>${stockBadge}</td>
    </tr>`;
  }).join("");
}

/** ALERTA — "producto estrella con poco stock": de los 5 productos que
 * más se venden, ¿cuáles se están quedando sin stock? Reponer esos
 * primero, porque son los que más ventas sostienen. */
function renderAlertaProductoEstrella(ranking) {
  const box = document.getElementById("alertaProductoEstrella");
  if (!box) return;

  const top5 = ranking.slice(0, 5);
  const enRiesgo = top5.filter((p) => p.stockActual <= STOCK_BAJO_PRODUCTO);

  if (!enRiesgo.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "block";
  box.innerHTML = `
    <div class="admin-panel" style="padding:18px 22px; border-left:4px solid #B8823B; background:#FCF3E9;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="font-size:20px;">⚠️</span>
        <h3 style="margin:0; color:#8A5F1F;">Atención: producto${enRiesgo.length > 1 ? "s" : ""} estrella con poco stock</h3>
      </div>
      <p style="font-size:13.5px; color:#6B5030; margin-bottom:10px;">
        ${enRiesgo.length > 1 ? "Estos productos están" : "Este producto está"} entre los más vendidos de tu tienda,
        pero se ${enRiesgo.length > 1 ? "están quedando" : "está quedando"} sin stock. Conviene reponer${enRiesgo.length > 1 ? "los" : "lo"} antes que otros.
      </p>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${enRiesgo.map((p) => `
          <div style="display:flex; justify-content:space-between; font-size:13.5px;">
            <span><b>${escapeHtml(p.nombre)}</b> — ${p.unidades} unidades vendidas en este período</span>
            <span style="font-weight:700; color:${p.stockActual <= 0 ? "#D8434B" : "#B8823B"};">
              ${p.stockActual <= 0 ? "Agotado" : `Quedan ${p.stockActual} unid.`}
            </span>
          </div>`).join("")}
      </div>
    </div>
  `;
}

/** "Stock muerto": productos activos con stock disponible que no
 * vendieron ni una unidad en este período — candidatos a bajar de
 * precio, dejar de reponer, o revisar por qué no se venden.
 * Solo cuentan los productos que YA existían al empezar el período: uno
 * publicado hace 3 días no puede considerarse "muerto" en un período de 30. */
function renderStockMuerto(ranking, stockPorProducto, inicio, dias) {
  const tbody = document.getElementById("stockMuertoTablaBody");
  if (!tbody) return;

  // En un solo día es normal que muchos productos no se hayan vendido: no sirve para decidir.
  if (dias < 7) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-admin">Para ver el stock sin ventas elige 7 días o más: en un solo día casi todo parece sin ventas.</td></tr>`;
    return;
  }

  const idsQueSiVendieron = new Set(ranking.map((p) => p.id));
  const sinVentas = (ADMIN_PRODUCTS || []).filter((p) => {
    const stock = stockPorProducto[p.id] ?? 0;
    const yaExistiaAlInicio = new Date(p.created_at) < inicio;
    return p.activo && stock > 0 && yaExistiaAlInicio && !idsQueSiVendieron.has(p.id);
  });

  if (!sinVentas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-admin">Todos tus productos con stock tuvieron al menos una venta en este período. ✓</td></tr>`;
    return;
  }

  const LIMITE = 15;
  const filas = sinVentas.slice(0, LIMITE).map((p) => `
    <tr>
      <td><b>${escapeHtml(p.nombre)}</b></td>
      <td>${escapeHtml(p.categorias?.nombre || "—")}</td>
      <td>${stockPorProducto[p.id] ?? 0} unid.</td>
      <td>${formatBs(p.precio)}</td>
    </tr>`).join("");
  const resto = sinVentas.length - LIMITE;
  tbody.innerHTML = filas + (resto > 0
    ? `<tr><td colspan="4" class="empty-admin">… y ${resto} producto${resto === 1 ? "" : "s"} más sin ventas.</td></tr>`
    : "");
}

/* ---------- Exportar ventas a Excel (.xlsx) ---------- */
function exportarVentasExcel() {
  if (!STATS_PEDIDOS_ACTUALES.length) {
    showToast("No hay ventas en este período para exportar.", "error");
    return;
  }
  const headers = ["Fecha", "N° Pedido", "Producto", "Cantidad", "Subtotal (Bs)"];
  const rows = [];
  STATS_PEDIDOS_ACTUALES.forEach((p) => {
    const fecha = new Date(p.created_at).toLocaleDateString("es-BO");
    (p.detalle_pedidos || []).forEach((d) => {
      rows.push([
        fecha,
        p.id.slice(0, 8),
        d.productos ? d.productos.nombre : "Producto eliminado",
        d.cantidad,
        Number(d.subtotal),
      ]);
    });
  });
  if (downloadXlsx(`ventas_${fechaLocalISO(new Date())}.xlsx`, "Ventas", headers, rows)) {
    showToast("Reporte de ventas descargado.", "success");
  }
}

/* ---------- Exportar ventas a PDF (para compartir o imprimir) ---------- */
function exportarVentasPdf() {
  if (!STATS_PEDIDOS_ACTUALES.length) {
    showToast("No hay ventas en este período para exportar.", "error");
    return;
  }
  const headers = [["Fecha", "N° Pedido", "Producto", "Cantidad", "Subtotal (Bs)"]];
  const rows = [];
  let totalGeneral = 0;
  STATS_PEDIDOS_ACTUALES.forEach((p) => {
    const fecha = new Date(p.created_at).toLocaleDateString("es-BO");
    (p.detalle_pedidos || []).forEach((d) => {
      const subtotal = Number(d.subtotal);
      totalGeneral += subtotal;
      rows.push([
        fecha,
        p.id.slice(0, 8),
        d.productos ? d.productos.nombre : "Producto eliminado",
        d.cantidad,
        subtotal.toFixed(2),
      ]);
    });
  });

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Couture Byte Market — Reporte de ventas", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-BO")}`, 14, 24);
  if (STATS_PERIODO_ACTUAL) {
    doc.text(
      `Período: ${STATS_PERIODO_ACTUAL.inicio.toLocaleDateString("es-BO")} al ${new Date().toLocaleDateString("es-BO")} (${textoPeriodo(STATS_PERIODO_ACTUAL.dias)}, sin pedidos cancelados)`,
      14, 29
    );
  }

  doc.autoTable({
    head: headers,
    body: rows,
    startY: 35,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [190, 130, 150] },
    foot: [["", "", "", "Total", `Bs ${totalGeneral.toFixed(2)}`]],
    footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: "bold" },
  });

  doc.save(`ventas_${fechaLocalISO(new Date())}.pdf`);
  showToast("Reporte de ventas (PDF) descargado.", "success");
}

/* ---------- Reporte de stock bajo / agotados (por talla) ---------- */
let STATS_STOCK_BAJO = [];

// Busca las tallas con stock bajo de productos activos.
async function loadStockBajoReport(miCarga) {
  const { data, error } = await sb
    .from("producto_tallas")
    .select("talla, stock, productos!inner( id, nombre, activo, categorias(nombre) )")
    .lte("stock", STOCK_BAJO_TALLA)
    .eq("productos.activo", true)
    .order("stock", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }
  // Si mientras esperaba se pidió otra carga, esta respuesta ya quedó vieja.
  if (miCarga !== undefined && miCarga !== STATS_CARGA_ACTUAL) return;
  STATS_STOCK_BAJO = data || [];
  renderStockBajoTable();
}

// Dibuja la tabla de tallas con stock bajo.
function renderStockBajoTable() {
  const tbody = document.getElementById("stockBajoTableBody");
  const badge = document.getElementById("stockBajoCount");
  if (badge) badge.textContent = STATS_STOCK_BAJO.length;
  if (!tbody) return;

  if (!STATS_STOCK_BAJO.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-admin">✅ Todas las tallas tienen buen nivel de stock.</td></tr>`;
    return;
  }

  tbody.innerHTML = STATS_STOCK_BAJO.map((row) => {
    const prod = row.productos || {};
    const agotado = row.stock <= 0;
    return `
    <tr>
      <td>${escapeHtml(prod.nombre || "—")}</td>
      <td>${escapeHtml(prod.categorias ? prod.categorias.nombre : "—")}</td>
      <td>Talla ${escapeHtml(row.talla)}</td>
      <td><span class="badge ${agotado ? "badge-off" : "badge-warn"}">${agotado ? "Agotado" : row.stock + " unid."}</span></td>
    </tr>`;
  }).join("");
}

// Descarga el reporte de stock bajo como archivo Excel (.xlsx).
function exportarStockBajoExcel() {
  if (!STATS_STOCK_BAJO.length) {
    showToast("No hay tallas con stock bajo para exportar.", "error");
    return;
  }
  const headers = ["Producto", "Categoría", "Talla", "Stock actual"];
  const rows = STATS_STOCK_BAJO.map((row) => [
    row.productos ? row.productos.nombre : "",
    row.productos && row.productos.categorias ? row.productos.categorias.nombre : "",
    row.talla,
    row.stock,
  ]);
  if (downloadXlsx(`stock_bajo_${fechaLocalISO(new Date())}.xlsx`, "Stock bajo", headers, rows)) {
    showToast("Reporte de stock bajo descargado.", "success");
  }
}

/* ---------- Exportar stock bajo a PDF (para compartir o imprimir) ---------- */
function exportarStockBajoPdf() {
  if (!STATS_STOCK_BAJO.length) {
    showToast("No hay tallas con stock bajo para exportar.", "error");
    return;
  }
  const headers = [["Producto", "Categoría", "Talla", "Stock actual"]];
  const rows = STATS_STOCK_BAJO.map((row) => [
    row.productos ? row.productos.nombre : "",
    row.productos && row.productos.categorias ? row.productos.categorias.nombre : "",
    row.talla,
    row.stock <= 0 ? "Agotado" : `${row.stock} unid.`,
  ]);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Couture Byte Market — Reporte de stock bajo", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-BO")}`, 14, 24);

  doc.autoTable({
    head: headers,
    body: rows,
    startY: 30,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [190, 130, 150] },
  });

  doc.save(`stock_bajo_${fechaLocalISO(new Date())}.pdf`);
  showToast("Reporte de stock bajo (PDF) descargado.", "success");
}
