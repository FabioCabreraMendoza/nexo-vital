// Utilidades pequeñas: DOM seguro (solo textContent), fechas, almacenamiento.

const SVG_NS = "http://www.w3.org/2000/svg";

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Crea un elemento. Nunca usa innerHTML: todo texto entra como texto. */
export function h(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

export function icono(nombre) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ico");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${nombre}`);
  svg.append(use);
  return svg;
}

/** Solo permite enlaces http(s). Los datos recopilados son contenido de terceros. */
export function urlSegura(u) {
  try {
    const url = new URL(u, location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-09" → "9 nov 2026"; "2026-11" → "nov 2026"; texto libre se deja igual. */
export function fmtFecha(valor) {
  if (!valor) return "sin información";
  const s = String(valor);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (isNaN(d)) return s;
    const p = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "numeric", month: "short", year: "numeric" })
      .format(d).replace(/\./g, "");
    return p;
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MESES[+m[2] - 1]} ${m[1]}`;
  return s;
}

export function fmtFechaHora(ms) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ms)).replace(/\./g, "");
}

export function haceTiempo(ts, ahora = Date.now()) {
  const min = Math.max(0, Math.round((ahora - ts) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.round(hr / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

const KEY = "nexovital.v1.";
export const almacen = {
  get(clave, defecto) {
    try {
      const v = localStorage.getItem(KEY + clave);
      return v == null ? defecto : JSON.parse(v);
    } catch {
      return defecto;
    }
  },
  set(clave, valor) {
    try {
      localStorage.setItem(KEY + clave, JSON.stringify(valor));
      return true;
    } catch {
      return false;
    }
  },
};

let toastTimer;
export function avisar(texto) {
  const el = $("#toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
}

export const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
