// NubIA · NEXOVITAL — controlador principal (sin framework, sin backend).
import { $, $$, h, icono, urlSegura, fmtFecha, fmtFechaHora, haceTiempo, almacen, avisar, hoyISO } from "./util.js";
import { abrirCompartir } from "./compartir.js";
import { analizar, pintarResultado, EJEMPLOS } from "./verificar.js";
import { construirCorpus, Indice, responder, SUGERENCIAS } from "./rag.js";

const TABS = ["inicio", "novedades", "verificar", "nubia", "fuentes"];
const TIPOS = { lluvia: "Lluvia fuerte", cauce: "Cauce", calle: "Calle", servicios: "Agua o luz", otro: "Otro" };
const SEIS_HORAS = 6 * 3600e3;

const S = { ficha: null, prensa: null, vecinal: null, reportes: [], votos: almacen.get("votos", {}), filtro: "todo", indice: null };

/* ================= Datos ================= */
async function cargarJSON(ruta) {
  try {
    const r = await fetch(ruta);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch {
    return null;
  }
}

function armarReportes() {
  const ahora = Date.now();
  const demo = (S.vecinal?.reportes ?? []).map((r) => ({
    id: r.id, tipo: r.tipo, zona: r.zona, texto: r.texto, ts: ahora - r.hace_min * 60000, sigue: r.sigue, ya_no: r.ya_no, demo: true,
  }));
  const propios = almacen.get("reportes", []).map((r) => ({ ...r, propio: true }));
  S.reportes = [...propios, ...demo];
}

function reconstruirIndice() {
  S.indice = new Indice(construirCorpus({ ficha: S.ficha, prensa: S.prensa, reportes: S.reportes }));
}

/* ================= Navegación ================= */
let anclaPendiente = null; // tarjeta a resaltar cuando la pestaña ya sea visible

function irA(tab, ancla) {
  if (!TABS.includes(tab)) tab = "inicio";
  anclaPendiente = ancla ?? null;
  if (ancla && tab === "novedades" && S.filtro !== "todo") { S.filtro = "todo"; pintarFeed(); }
  if (location.hash !== `#${tab}`) location.hash = tab;
  else mostrarTab(tab);
}

function resaltar(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  el.classList.remove("resaltado");
  void el.offsetWidth;
  el.classList.add("resaltado");
}

function mostrarTab(tab) {
  const cambiar = () => {
    for (const t of TABS) $(`#${t}`).hidden = t !== tab;
    for (const a of $$(".tabbar a")) {
      if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    if (tab === "novedades") pintarFeed(); // refresca "hace X min" al entrar
    if (anclaPendiente) { resaltar(anclaPendiente); anclaPendiente = null; } else window.scrollTo(0, 0);
    $(`#t-${tab}`)?.focus({ preventScroll: true });
  };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Si otra transición la interrumpe, el navegador rechaza estas promesas; el cambio de pestaña igual se aplica.
    const t = document.startViewTransition(cambiar);
    t.ready.catch(() => {});
    t.finished.catch(() => {});
  } else cambiar();
}

function enRuta() {
  const tab = location.hash.slice(1);
  mostrarTab(TABS.includes(tab) ? tab : "inicio");
}

/* ================= Inicio: ficha ================= */
function fuentesTxt(fs) {
  return fs.map((f) => `${f.nombre}, ${fmtFecha(f.fecha)}`).join(" · ");
}

function itemFicha(it) {
  return h("li", { id: it.id },
    h("p", { text: it.texto }),
    h("p", { class: "fuente" }, h("b", { text: "Fuente: " }), fuentesTxt(it.fuentes)),
    it.alcance ? h("p", { class: "alcance", text: it.alcance }) : null,
  );
}

function bloque(titulo, ico, items, clase = "") {
  return h("section", { class: `bloque ${clase}`, "aria-label": titulo },
    h("header", {}, icono(ico), h("h2", { text: titulo })),
    h("ul", {}, items.map(itemFicha)),
  );
}

function pintarFicha() {
  const f = S.ficha;
  if (!f) {
    $("#ficha-meta").textContent = "No se pudo cargar la ficha. Conéctate una vez para guardarla.";
    return;
  }
  $("#ficha-meta").textContent = `Versión ${f.version} · actualizada ${fmtFecha(f.actualizado)} · vence ${fmtFecha(f.vence)} · ${f.territorio}. ${f.validacion}`;

  $("#ficha-resumen").replaceChildren(
    h("h2", { text: "En pocas palabras" }),
    h("ul", {}, (f.resumen ?? []).map((t) => h("li", { text: t }))),
  );

  // El riesgo residual va primero y abierto: no depende de un clic ni de un scroll largo.
  $("#ficha-bloques").replaceChildren(
    bloque("Lo que sigue siendo un riesgo", "alert", f.bloques.riesgo, "bloque-riesgo"),
    bloque("Qué falta", "feed", f.bloques.falta),
    bloque("Qué funciona hoy", "check", f.bloques.funciona),
    bloque("A quién escuchar en una emergencia", "phone", f.bloques.escuchar),
  );

  const clasEstado = (e) => (/^Terminado/.test(e) ? "terminado" : /construcci/i.test(e) ? "construccion" : /falta/i.test(e) ? "falta" : "sin");
  $("#obras-lista").replaceChildren(...f.obras.map((o) =>
    h("li", { class: "obra", id: `obra-${o.id}` },
      h("div", { class: "obra-cab" }, h("strong", { text: o.componente }), h("span", { class: "estado", "data-e": clasEstado(o.estado), text: o.estado })),
      h("p", { text: o.detalle }),
      h("p", { class: "fuente" }, h("b", { text: "Fuente: " }), fuentesTxt(o.fuentes)),
    )));

  // Vencimiento visible
  const venc = $("#banner-venc");
  if (hoyISO() > f.vence) {
    venc.hidden = false;
    venc.replaceChildren(icono("alert"), h("span", { text: `Esta ficha venció el ${fmtFecha(f.vence)}. Los datos pueden haber cambiado: comprueba en las fuentes oficiales.` }));
  } else venc.hidden = true;

  // Fuentes y contactos
  $("#fuentes-lista").replaceChildren(...f.fuentes_oficiales.map((s) =>
    h("li", {}, h("a", { class: "btn", style: "justify-content:flex-start;inline-size:100%", href: urlSegura(s.url), target: "_blank", rel: "noopener noreferrer" },
      icono("out"), h("span", {}, h("strong", { text: s.nombre }), h("br"), h("span", { class: "sub", text: s.descripcion }))))));
  $("#contactos-lista").replaceChildren(...f.contactos.map((c) =>
    h("li", {}, h("a", { class: "btn", style: "justify-content:flex-start;inline-size:100%", href: `tel:${c.numero}` },
      icono("phone"), h("span", {}, h("strong", { text: `${c.nombre}: ${c.numero}` }), h("br"), h("span", { class: "sub", text: c.nota }))))));
}

function textoFicha() {
  const f = S.ficha;
  const lista = (its) => its.map((i) => `• ${i.texto} (${i.fuentes[0].nombre}, ${fmtFecha(i.fuentes[0].fecha)})`).join("\n");
  return {
    titulo: "Ficha: quebradas San Ildefonso y San Carlos",
    cuerpo: `${f.resumen.map((t) => `• ${t}`).join("\n")}\n\n*Lo que sigue siendo un riesgo*\n${lista(f.bloques.riesgo.slice(0, 3))}\n\n*Qué falta*\n${lista(f.bloques.falta.slice(0, 3))}`,
    fuente: `NubIA, versión ${f.version}`, fecha: `actualizada ${fmtFecha(f.actualizado)}, vence ${fmtFecha(f.vence)}`,
  };
}

/* ================= Novedades: tarjetas ================= */
function itemsFeed() {
  const items = [];
  for (const a of S.ficha?.avisos_oficiales ?? []) {
    const ts = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) ? Date.parse(`${a.fecha}T12:00:00-05:00`) : 0;
    items.push({ kind: "oficial", id: a.id, ts, a });
  }
  for (const p of S.prensa?.items ?? []) items.push({ kind: "prensa", id: p.id, ts: Date.parse(p.fecha), p });
  for (const r of S.reportes) items.push({ kind: "vecinal", id: r.id, ts: r.ts, r });
  items.sort((x, y) => y.ts - x.ts);
  // El aviso oficial más reciente se fija arriba (en "Todo"); luego, lo más nuevo primero.
  if (S.filtro === "todo") {
    const fijos = items.filter((i) => i.kind === "oficial").slice(0, 1);
    return [...fijos, ...items.filter((i) => !fijos.includes(i))];
  }
  return items.filter((i) => i.kind === S.filtro);
}

function votosDe(r) {
  const mio = S.votos[r.id];
  return { sigue: r.sigue + (mio === "sigue" ? 1 : 0), ya_no: r.ya_no + (mio === "ya_no" ? 1 : 0), mio };
}

function estadoVotos(v) {
  const total = v.sigue + v.ya_no;
  if (total < 3) return "Pocos votos todavía.";
  if (v.ya_no / total >= 0.6) return `${v.ya_no} de ${total} vecinos dicen que ya no está.`;
  if (v.sigue / total >= 0.6) return `${v.sigue} de ${total} vecinos dicen que sigue ahí.`;
  return `Opiniones divididas (${total} votos).`;
}

function accionesTarjeta(item) {
  return h("button", { type: "button", class: "btn btn-sm push", onclick: () => abrirCompartir(compartible(item)) }, icono("share"), "Compartir");
}

function compartible(item) {
  if (item.kind === "oficial") {
    return { titulo: item.a.titulo, cuerpo: item.a.resumen, fuente: item.a.entidad, fecha: fmtFecha(item.a.fecha), url: urlSegura(item.a.url) };
  }
  if (item.kind === "prensa") {
    return { titulo: item.p.titulo, cuerpo: "Titular de prensa recopilado por NubIA.", fuente: item.p.fuente, fecha: fmtFecha(item.p.fecha), url: urlSegura(item.p.url) };
  }
  const v = votosDe(item.r);
  return {
    titulo: `${TIPOS[item.r.tipo] ?? "Reporte"} en ${item.r.zona}`, cuerpo: `${item.r.texto}\n(Reporte de vecinos SIN VERIFICAR. ${v.sigue} dicen que sigue, ${v.ya_no} que ya no está.)`,
    fuente: "Reporte de vecinos", fecha: haceTiempo(item.r.ts),
  };
}

function tarjeta(item) {
  if (item.kind === "oficial") {
    const a = item.a;
    const u = urlSegura(a.url);
    return h("article", { class: "card card-oficial", id: a.id },
      h("div", { class: "card-cab" }, h("span", { class: "insignia", text: "Oficial" }), h("span", { class: "tiempo", text: fmtFecha(a.fecha) })),
      h("h3", { text: a.titulo }),
      h("p", { text: a.resumen }),
      h("p", { class: "alcance", text: `${a.entidad} · ${a.alcance}` }),
      h("div", { class: "card-pie" },
        u ? h("a", { class: "btn btn-sm", href: u, target: "_blank", rel: "noopener noreferrer" }, icono("out"), "Ver fuente") : null,
        accionesTarjeta(item)),
    );
  }
  if (item.kind === "prensa") {
    const p = item.p;
    const u = urlSegura(p.url);
    return h("article", { class: "card card-prensa", id: p.id },
      h("div", { class: "card-cab" }, h("span", { class: "insignia", text: "Prensa" }), h("span", { class: "tiempo", text: `${fmtFecha(p.fecha)} · ${haceTiempo(item.ts)}` })),
      h("h3", { text: p.titulo }),
      h("p", { class: "fuente" }, h("b", { text: p.fuente }), " · titular recopilado, no verificado por NubIA"),
      h("div", { class: "card-pie" },
        u ? h("a", { class: "btn btn-sm", href: u, target: "_blank", rel: "noopener noreferrer" }, icono("out"), "Leer en el medio") : null,
        accionesTarjeta(item)),
    );
  }
  const r = item.r;
  const v = votosDe(r);
  const viejo = Date.now() - r.ts > SEIS_HORAS;
  const btnVoto = (clave, texto) =>
    h("button", {
      type: "button", class: "btn", "aria-pressed": String(v.mio === clave),
      onclick: () => votar(r.id, clave),
    }, h("span", { text: texto }), h("span", { class: "cuenta", text: `${clave === "sigue" ? v.sigue : v.ya_no} ${(clave === "sigue" ? v.sigue : v.ya_no) === 1 ? "vecino" : "vecinos"}` }));
  return h("article", { class: `card card-vecinal${viejo ? " antiguo" : ""}`, id: r.id },
    h("div", { class: "card-cab" },
      h("span", { class: "insignia", text: `Vecinos · ${TIPOS[r.tipo] ?? "Reporte"}` }),
      h("span", { class: "tiempo", text: haceTiempo(r.ts) })),
    h("h3", { text: r.zona }),
    h("p", { text: r.texto }),
    h("p", { class: "fuente" },
      r.demo ? h("span", { class: "demo-tag", text: "Ejemplo de demostración" }) : null, r.demo ? " " : null,
      "Sin verificar", viejo ? " · reporte antiguo" : ""),
    viejo ? null : h("div", { class: "votos", role: "group", "aria-label": "¿Sigue ahí?" }, btnVoto("sigue", "Sigue ahí"), btnVoto("ya_no", "Ya no está")),
    h("p", { class: "estado-voto", text: estadoVotos(v) }),
    h("div", { class: "card-pie" }, accionesTarjeta(item)),
  );
}

function pintarFeed() {
  const feed = $("#feed");
  const items = itemsFeed();
  feed.replaceChildren(...(items.length ? items.map(tarjeta) : [h("p", { class: "vacio", text: "No hay tarjetas en esta categoría todavía." })]));
  const g = S.prensa?.generadoEn;
  $("#novedades-meta").textContent = g
    ? `Prensa recopilada el ${fmtFechaHora(Date.parse(g))}. Los reportes de vecinos no están verificados.`
    : "Sin datos de prensa guardados. Conéctate una vez para recopilarlos.";
  for (const b of $$("#filtros .chip-btn")) b.setAttribute("aria-pressed", String(b.dataset.f === S.filtro));
}

function votar(id, clave) {
  if (S.votos[id] === clave) delete S.votos[id];
  else S.votos[id] = clave;
  almacen.set("votos", S.votos);
  const y = window.scrollY;
  pintarFeed();
  window.scrollTo(0, y);
}

/* ---- reportar ---- */
function iniciarReportar() {
  const dlg = $("#dlg-reportar"), form = $("#form-reportar"), err = $("#err-reportar");
  $("#btn-reportar").addEventListener("click", () => { err.hidden = true; dlg.showModal(); });
  $("#cerrar-reportar").addEventListener("click", () => dlg.close());
  $("#cancelar-reportar").addEventListener("click", () => dlg.close());
  // Respaldo de cierre al tocar fuera donde `closedby` no existe (Safari).
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    for (const d of $$("dialog[closedby='any']")) {
      let abajo = false;
      const fuera = (e) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
      d.addEventListener("pointerdown", (e) => { abajo = fuera(e); });
      d.addEventListener("pointerup", (e) => { if (abajo && fuera(e)) d.close(); });
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const tipo = $("#rep-tipo").value, zona = $("#rep-zona").value.trim(), texto = $("#rep-texto").value.trim();
    let msg = "";
    if (zona.length < 3) msg = "Escribe el sector o la urbanización.";
    else if (texto.length < 8) msg = "Cuéntalo con un poco más de detalle (mínimo 8 letras).";
    else if (/\d[\d\s.-]{6,}\d|@|https?:\/\//i.test(texto + " " + zona)) msg = "Quita teléfonos, correos y enlaces. No pongas datos personales.";
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    const propios = almacen.get("reportes", []);
    const id = `r-${Date.now().toString(36)}`;
    propios.unshift({ id, tipo, zona, texto, ts: Date.now(), sigue: 0, ya_no: 0 });
    almacen.set("reportes", propios.slice(0, 30));
    S.votos[id] = "sigue"; // quien reporta ya cuenta como un voto; no puede sumar otro
    almacen.set("votos", S.votos);
    form.reset();
    dlg.close();
    armarReportes(); reconstruirIndice(); S.filtro = "todo"; pintarFeed();
    avisar("Reporte publicado en este dispositivo");
    window.scrollTo(0, 0);
  });
}

/* ================= Verificar ================= */
function iniciarVerificar() {
  const form = $("#form-verificar"), campo = $("#msg-verificar"), err = $("#err-verificar"), out = $("#resultado-verificar");
  $("#ejemplos").replaceChildren(...EJEMPLOS.map((ej) => h("li", {},
    h("button", { type: "button", class: "btn btn-sm", style: "text-align:start;inline-size:100%;justify-content:flex-start",
      onclick: () => { campo.value = ej.texto; form.requestSubmit(); } },
    h("span", {}, h("span", { class: "tipo-doc", text: ej.etiqueta }), h("br"), ej.texto)))));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (texto.length < 6) {
      err.textContent = "Escribe o pega un mensaje para comprobarlo.";
      err.hidden = false; out.replaceChildren(); campo.focus(); return;
    }
    err.hidden = true;
    const res = analizar(texto, { avisos: S.ficha?.avisos_oficiales ?? [], reportes: S.reportes, prensa: S.prensa?.items ?? [] });
    out.replaceChildren(pintarResultado(res, { fuentes: S.ficha?.fuentes_oficiales ?? [], irA }));
    out.firstElementChild.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  form.addEventListener("reset", () => { out.replaceChildren(); err.hidden = true; });
}

/* ================= NubIA (chat) ================= */
function mensajeBot(r) {
  const caja = h("div", { class: "msg msg-bot" });
  caja.append(h("p", { text: r.intro }));
  if (r.puntos.length) {
    caja.append(h("ul", {}, r.puntos.map((p) => {
      const c = p.cita;
      const chip = c.url && urlSegura(c.url)
        ? h("a", { class: "cita", href: urlSegura(c.url), target: "_blank", rel: "noopener noreferrer" }, icono("out"), c.label)
        : c.nav ? h("button", { type: "button", class: "cita", onclick: () => irA(c.nav.tab, c.nav.id) }, icono("link"), c.label)
        : h("span", { class: "cita", text: c.label });
      return h("li", {}, h("span", { class: "tipo-doc", text: p.tipo }), h("br"), p.texto, h("div", { class: "citas" }, chip));
    })));
  }
  for (const e of r.extra ?? []) caja.append(h("p", { text: e }));
  if (r.acciones?.length) {
    caja.append(h("div", { class: "citas" }, r.acciones.map((a) =>
      a.url ? h("a", { class: "cita", href: urlSegura(a.url), target: "_blank", rel: "noopener noreferrer" }, icono("out"), a.label)
            : h("button", { type: "button", class: "cita", onclick: () => irA(a.tab) }, a.label))));
  }
  if (r.pie) caja.append(h("p", { class: "pie", text: r.pie }));
  return caja;
}

function iniciarChat() {
  const log = $("#chat-log"), form = $("#form-chat"), input = $("#chat-input");
  log.append(h("div", { class: "msg msg-bot" },
    h("p", { text: "Hola, soy NubIA. Puedo contarte qué falta en las obras, qué dicen los avisos oficiales, la prensa y los vecinos. Siempre te digo de dónde sale." })));
  $("#chat-sugerencias").replaceChildren(...SUGERENCIAS.map((q) =>
    h("button", { type: "button", class: "chip-btn", onclick: () => preguntar(q) }, q)));

  function preguntar(q) {
    q = q.trim();
    if (!q) return;
    log.append(h("div", { class: "msg msg-yo" }, h("p", { text: q })));
    const espera = h("div", { class: "msg msg-bot" }, h("p", { class: "escribiendo", text: "Buscando en lo recopilado…" }));
    log.append(espera);
    espera.scrollIntoView({ block: "end", behavior: "smooth" });
    setTimeout(() => {
      let nodo;
      try {
        nodo = mensajeBot(responder(q, S.indice, { ficha: S.ficha, recopilado: S.prensa }));
      } catch (e) {
        console.error(e);
        nodo = h("div", { class: "msg msg-bot" }, h("p", { text: "Algo falló al buscar. Prueba de nuevo o consulta INDECI directamente." }));
      }
      espera.replaceWith(nodo);
      nodo.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 350);
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); const q = input.value; input.value = ""; preguntar(q); });
}

/* ================= Tema: botón claro / oscuro del encabezado ================= */
// Sin valor guardado = sigue al sistema. Al pulsar se elige lo contrario de lo que se ve; si eso coincide
// con el sistema se borra el valor (no se fija contra futuros cambios del sistema). Clave: localStorage["color-scheme"].
function iniciarTema() {
  const meta = $('meta[name="color-scheme"]');
  const btn = $("#btn-tema");
  const oscuroSistema = matchMedia("(prefers-color-scheme: dark)");
  const sistema = () => (oscuroSistema.matches ? "dark" : "light");
  const visible = () => (meta.content === "light dark" ? sistema() : meta.content);
  const pintar = () => {
    const oscuro = visible() === "dark";
    btn.replaceChildren(icono(oscuro ? "sun" : "moon"));
    btn.setAttribute("aria-label", oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
  };
  const aplicar = (v) => { meta.content = v ?? "light dark"; pintar(); };
  try { aplicar(localStorage.getItem("color-scheme")); } catch { pintar(); /* sin almacenamiento: el tema igual se aplica */ }
  oscuroSistema.addEventListener("change", pintar);
  btn.addEventListener("click", () => {
    const objetivo = visible() === "dark" ? "light" : "dark";
    const v = objetivo === sistema() ? null : objetivo;
    try { v ? localStorage.setItem("color-scheme", v) : localStorage.removeItem("color-scheme"); } catch { /* idem */ }
    aplicar(v);
  });
  addEventListener("storage", (e) => { if (e.key === "color-scheme") aplicar(e.newValue); });
}

/* ================= Red, instalación, sin conexión ================= */
function iniciarRed() {
  const chip = $("#estado-red"), banner = $("#banner-offline");
  const actualizar = () => {
    const on = navigator.onLine;
    chip.classList.toggle("offline", !on);
    chip.replaceChildren(icono(on ? "check" : "off"), h("span", { text: on ? "En línea" : "Sin conexión" }));
    banner.hidden = on;
    if (!on) {
      banner.replaceChildren(icono("off"), h("span", { text: `Sin conexión. Estás viendo datos guardados${S.prensa?.generadoEn ? ` (prensa al ${fmtFecha(S.prensa.generadoEn)})` : ""}.` }));
    }
  };
  addEventListener("online", actualizar);
  addEventListener("offline", actualizar);
  actualizar();

  // Instalación (beforeinstallprompt, solo Chrome/Edge). El botón se oculta si no hay soporte.
  const btn = $("#btn-instalar");
  let diferido;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); diferido = e; btn.hidden = false; });
  btn.addEventListener("click", async () => {
    if (!diferido) return;
    const ev = diferido; diferido = undefined;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === "accepted") { btn.hidden = true; avisar("App instalada"); }
  });
  addEventListener("appinstalled", () => { btn.hidden = true; });
}

async function iniciarSW() {
  const el = $("#offline-estado");
  if (!("serviceWorker" in navigator)) { el.textContent = "Este navegador no permite el modo sin conexión."; return; }
  if (!window.isSecureContext) { el.textContent = "El modo sin conexión necesita HTTPS (o localhost)."; return; }
  try {
    const reg = await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    el.textContent = reg.active ? "Listo para usarse sin conexión: la ficha, las tarjetas y NubIA quedaron guardadas en este dispositivo." : "Guardando datos para uso sin conexión…";
  } catch {
    el.textContent = "No se pudo activar el modo sin conexión.";
  }
}

/* ================= Arranque ================= */
async function iniciar() {
  const [ficha, prensa, vecinal] = await Promise.all([cargarJSON("data/ficha.json"), cargarJSON("data/recopilado.json"), cargarJSON("data/vecinal.json")]);
  Object.assign(S, { ficha, prensa, vecinal });
  armarReportes();
  reconstruirIndice();

  pintarFicha();
  pintarFeed();
  iniciarReportar();
  iniciarVerificar();
  iniciarChat();
  iniciarTema();
  iniciarRed();

  for (const b of $$("#filtros .chip-btn")) b.addEventListener("click", () => { S.filtro = b.dataset.f; pintarFeed(); });
  $("#btn-compartir-ficha").addEventListener("click", () => S.ficha && abrirCompartir(textoFicha()));
  $("#btn-imprimir").addEventListener("click", () => print());
  $("#cerrar-compartir").addEventListener("click", () => $("#dlg-compartir").close());

  addEventListener("hashchange", enRuta);
  enRuta();
  iniciarSW();
}

iniciar();
