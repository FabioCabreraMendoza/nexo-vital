// ¿Es oficial? Compara un mensaje con avisos oficiales conocidos.
// Regla de producto: NUNCA dice que algo es "falso". Dice qué encontró y dónde comprobarlo.
import { norm, tokens, contiene } from "./texto.js";
import { h, icono, fmtFecha, urlSegura } from "./util.js";

const ENTIDADES = [
  ["indeci", "INDECI"], ["senamhi", "SENAMHI"], ["enfen", "ENFEN"], ["sismate", "el SISMATE"], ["mtc", "el MTC"],
  ["defensa civil", "Defensa Civil"], ["ingemmet", "INGEMMET"], ["municipalidad", "la Municipalidad"], ["gobierno regional", "el Gobierno Regional"],
];
const NOMBRES_ENTIDAD = new Set(ENTIDADES.map(([k]) => k));

export const EJEMPLOS = [
  { etiqueta: "Parecido a un aviso oficial", texto: "ENFEN mantiene la alerta de El Niño costero con magnitud extraordinaria hasta febrero de 2027." },
  { etiqueta: "Parecido a un aviso oficial", texto: "SENAMHI emitió alerta roja por lluvias intensas en el norte, hasta 100 mm de precipitación en Tumbes." },
  { etiqueta: "Mensaje SIMULADO para probar", texto: "URGENTE!!! Se rompió el dique de San Ildefonso, EVACUEN YA. Reenvía a todos tus contactos. http://bit.ly/xyz" },
  { etiqueta: "Mensaje SIMULADO para probar", texto: "Atención vecinos de Trujillo: mañana a las 5 pm llegará un huaico de 3 metros." },
];

const SENALES = [
  { re: /\b(urgente|inmediat\w*|ahora mismo|ultima hora|alerta maxima|ya mismo)\b|!{2,}/i, txt: "Usa lenguaje de urgencia para que lo reenvíes sin pensar." },
  { re: /\b(reenvia\w*|reenvien|comparte|compartan|difunde|difundan|pasa la voz|cadena|a todos tus contactos)\b/i, txt: "Pide que lo reenvíes. Los avisos oficiales no piden eso." },
  { re: /https?:\/\/|\bwww\.|\bbit\.ly|\btinyurl|\bwa\.me/i, txt: "Trae un enlace. No lo abras si no conoces la página: escribe tú mismo la dirección oficial." },
  { re: /\b(clave|contrasena|dni|yape|plin|deposit\w*|transferenc\w*|tarjeta|codigo de verificacion|numero de cuenta|tu cuenta|cuenta bancaria)\b/i, txt: "Pide datos personales o dinero. Un aviso oficial no pide eso." },
  { re: /\b(evacu\w*|desaloj\w*|corran|salgan de sus casas|salgan ya)\b/i, txt: "Da órdenes de evacuar. Esas órdenes salen de INDECI o Defensa Civil por sus canales oficiales." },
  { re: /\b(en|dentro de|a las|manana a las)\s+\d+\s*(min|minutos|horas|h|pm|am)\b|\b\d+\s*(metros|m) de (altura|alto)\b/i, txt: "Da una hora o una cifra exacta sin citar de dónde sale." },
];

export function analizar(mensaje, { avisos, reportes = [], prensa = [] }) {
  const n = norm(mensaje);
  const toks = [...new Set(tokens(mensaje))];

  const ranking = avisos.map((a) => {
    const duras = a.claves.filter((c) => !NOMBRES_ENTIDAD.has(norm(c)));
    const hits = duras.filter((c) => contiene(n, c)).length;
    const bolsa = new Set(tokens(`${a.titulo} ${a.resumen}`));
    const comunes = toks.filter((t) => bolsa.has(t)).length;
    const ratio = toks.length ? comunes / toks.length : 0;
    return { aviso: a, hits, ratio, score: hits * 2 + ratio * 4 };
  }).sort((x, y) => y.score - x.score);

  const top = ranking[0];
  let nivel = "sin";
  if (top && (top.hits >= 2 || (top.ratio >= 0.5 && toks.length >= 4 && top.hits >= 1))) nivel = "coincide";
  else if (top && (top.hits >= 1 || (top.ratio >= 0.3 && toks.length >= 3))) nivel = "tema";

  const senales = SENALES.filter((s) => s.re.test(n) || s.re.test(mensaje)).map((s) => s.txt);
  const letras = mensaje.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "");
  if (letras.length >= 20 && mayus.length / letras.length > 0.5) senales.push("Está casi todo en MAYÚSCULAS, una forma de apurar al lector.");

  const entidades = ENTIDADES.filter(([k]) => contiene(n, k)).map(([, nombre]) => nombre);
  if (entidades.length && nivel !== "coincide") {
    senales.push(`Menciona a ${entidades.join(", ")}, pero cualquiera puede escribir un nombre oficial. Compara con la web de la entidad.`);
  }
  if (!entidades.length && !/\b(20\d\d|\d{1,2} de [a-z]+|\d{1,2}[:.]\d{2})\b/.test(n)) {
    senales.push("No dice claramente quién lo emite ni cuándo.");
  }

  const similitud = (texto) => {
    const bolsa = new Set(tokens(texto));
    const comunes = toks.filter((t) => bolsa.has(t)).length;
    return { comunes, ratio: toks.length ? comunes / toks.length : 0 };
  };
  const vecinos = reportes
    .map((r) => ({ r, ...similitud(`${r.texto} ${r.zona}`) }))
    .filter((x) => x.comunes >= 3 && x.ratio >= 0.4)
    .sort((a, b) => b.ratio - a.ratio).slice(0, 2).map((x) => x.r);
  const medios = prensa
    .map((p) => ({ p, ...similitud(p.titulo) }))
    .filter((x) => x.comunes >= 3 && x.ratio >= 0.35)
    .sort((a, b) => b.ratio - a.ratio).slice(0, 2).map((x) => x.p);

  return { nivel, top: nivel === "sin" ? null : top.aviso, senales, vecinos, medios, palabras: toks.length };
}

const TITULOS = {
  coincide: (a) => a.tipo === "advertencia"
    ? `Se parece a una alerta falsa ya conocida (${fmtFecha(a.fecha)}): comprueba en los canales oficiales.`
    : `Coincide con un aviso oficial de ${a.entidad} del ${fmtFecha(a.fecha)}.`,
  tema: (a) => `No encontré un aviso oficial igual. Sí hay uno de ${a.entidad} sobre un tema parecido.`,
  sin: () => "No encontré un aviso oficial que coincida.",
};

export function pintarResultado(res, { fuentes, irA }) {
  const caja = h("div", { class: "resultado" });

  const v = h("section", { class: "veredicto", "data-n": res.nivel, "aria-labelledby": "t-veredicto" },
    h("h2", { id: "t-veredicto", text: TITULOS[res.nivel](res.top) }));
  if (res.top) {
    v.append(
      h("p", { text: res.top.resumen }),
      h("p", { class: "alcance", text: `Alcance: ${res.top.alcance}` }),
    );
  }
  if (res.nivel === "coincide") {
    v.append(h("p", { text: "Aun así, compara los detalles (lugar, hora, cifras) con la fuente: un mensaje puede copiar un aviso y cambiar datos." }));
  } else if (res.nivel === "tema") {
    v.append(h("p", { text: "Compara con la fuente: los datos de tu mensaje no coinciden con ese aviso." }));
  } else {
    v.append(h("p", { text: "Eso no confirma ni descarta el mensaje. Comprueba en INDECI, SENAMHI o la Municipalidad antes de reenviarlo." }));
  }
  caja.append(v);

  if (res.senales.length) {
    caja.append(h("section", { class: "caja" },
      h("h2", { text: "Qué conviene revisar", style: "margin:0;font-size:1.05rem" }),
      h("ul", { class: "senales" }, res.senales.map((s) => h("li", { text: s }))),
      h("p", { class: "sub", text: "Son pistas, no un veredicto." }),
    ));
  }

  if (res.vecinos.length) {
    caja.append(h("section", { class: "caja" },
      h("h2", { text: "Reportes de vecinos parecidos", style: "margin:0;font-size:1.05rem" }),
      h("p", { class: "sub", text: "Sin verificar. Pueden ayudar, pero no son un aviso oficial." }),
      h("ul", { class: "lista-puntos" }, res.vecinos.map((r) => h("li", {},
        h("button", { type: "button", class: "btn btn-sm btn-plano", onclick: () => irA("novedades", r.id) }, `${r.zona}: ${r.texto}`)))),
    ));
  }
  if (res.medios.length) {
    caja.append(h("section", { class: "caja" },
      h("h2", { text: "Prensa que habla de esto", style: "margin:0;font-size:1.05rem" }),
      h("ul", { class: "lista-puntos" }, res.medios.map((p) => {
        const u = urlSegura(p.url);
        return h("li", {}, u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer", text: p.titulo }) : p.titulo,
          h("span", { class: "fuente", text: ` — ${p.fuente}, ${fmtFecha(p.fecha)}` }));
      })),
    ));
  }

  const ids = ["s-indeci", "s-senamhi", "s-mpt", "s-enfen"];
  const enlaces = fuentes.filter((f) => ids.includes(f.id));
  const extra = res.top && urlSegura(res.top.url) && !enlaces.some((f) => f.url === res.top.url)
    ? [{ nombre: `Fuente: ${res.top.entidad}`, url: res.top.url }] : [];
  caja.append(h("section", { class: "caja" },
    h("h2", { text: "Dónde comprobarlo", style: "margin:0;font-size:1.05rem" }),
    h("div", { class: "enlaces" }, [...extra, ...enlaces].map((f) =>
      h("a", { class: "btn btn-sm", href: urlSegura(f.url), target: "_blank", rel: "noopener noreferrer" }, icono("out"), f.nombre))),
  ));
  return caja;
}
