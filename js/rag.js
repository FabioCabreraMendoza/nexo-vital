// NubIA: RAG local. Recupera (BM25) fragmentos de lo recopilado y arma una respuesta
// extractiva con citas. No inventa: si no encuentra, lo dice. No decide qué es verdad.
// Punto de extensión: `generar()` podría pasar `contexto` a un LLM; hoy responde sin LLM.
import { tokens, norm } from "./texto.js";
import { fmtFecha, haceTiempo } from "./util.js";

const SINONIMOS = {
  huaico: ["aluvion", "huayco", "quebrada", "cauce"],
  aluvion: ["huaico"],
  quebrada: ["cauce", "huaico"],
  cauce: ["quebrada", "basura", "desmonte"],
  obra: ["avance", "construccion", "dique", "tunel", "defensa"],
  avance: ["obra", "construccion"],
  dique: ["obra", "defensa", "contencion"],
  defensa: ["dique", "obra", "ribereno"],
  tunel: ["trasvase", "moche", "obra"],
  alerta: ["aviso", "alarma", "comunicado", "sismate"],
  aviso: ["alerta", "comunicado"],
  alarma: ["alerta", "sismate"],
  nino: ["enfen", "fenomeno", "fen"],
  fen: ["nino", "enfen"],
  fenomeno: ["nino"],
  lluvia: ["precipitacion", "llover", "lluvioso"],
  llover: ["lluvia"],
  basura: ["desmonte", "residuo", "cauce"],
  desmonte: ["basura", "cauce"],
  luz: ["servicio", "corte"],
  agua: ["servicio", "corte"],
  vecino: ["reporte"],
  falta: ["pendiente", "completar"],
  pendiente: ["falta", "completar"],
  emergencia: ["indeci", "defensa", "telefono"],
  telefono: ["numero", "emergencia", "indeci"],
  numero: ["telefono"],
  mapa: ["zona"],
};

const PESO_KIND = { oficial: 1.25, ficha: 1.2, fuente: 0.9, prensa: 1, vecinal: 0.85 };
const ETIQUETA_KIND = {
  oficial: "Aviso oficial", ficha: "Ficha", fuente: "Fuente", prensa: "Prensa (titular)", vecinal: "Vecinos · sin verificar",
};

/* ---------- Corpus ---------- */
export function construirCorpus({ ficha, prensa, reportes = [] }) {
  const docs = [];
  const nombres = (fs) => fs.map((f) => f.nombre).join(" y ");

  if (ficha) {
    for (const [bloque, items] of Object.entries(ficha.bloques)) {
      for (const it of items) {
        docs.push({
          id: it.id, kind: "ficha", bloque, titulo: "", texto: `${it.texto} ${it.alcance ?? ""}`.trim(), mostrar: it.texto,
          fuente: nombres(it.fuentes), fecha: it.fuentes[0]?.fecha, nav: { tab: "inicio", id: it.id },
        });
      }
    }
    for (const o of ficha.obras) {
      docs.push({
        id: o.id, kind: "ficha", bloque: "obras", titulo: o.componente, texto: `${o.componente}. ${o.estado}. ${o.detalle}`,
        mostrar: `${o.componente}: ${o.estado}. ${o.detalle}`,
        fuente: nombres(o.fuentes), fecha: o.fuentes[0]?.fecha, nav: { tab: "inicio", id: `obra-${o.id}` },
      });
    }
    for (const a of ficha.avisos_oficiales) {
      docs.push({
        id: a.id, kind: "oficial", titulo: a.titulo, texto: `${a.titulo}. ${a.resumen} ${a.alcance}`, mostrar: `${a.titulo}. ${a.resumen}`,
        fuente: a.entidad, fecha: a.fecha, nav: { tab: "novedades", id: a.id }, url: a.url,
      });
    }
    for (const f of ficha.fuentes_oficiales) {
      docs.push({
        id: f.id, kind: "fuente", titulo: f.nombre, texto: `${f.nombre}. ${f.descripcion}`, mostrar: `${f.nombre}: ${f.descripcion}`,
        fuente: f.nombre, fecha: "", url: f.url,
      });
    }
    for (const c of ficha.contactos) {
      docs.push({
        id: `c-${c.numero}`, kind: "fuente", titulo: `Teléfono ${c.nombre}`, texto: `Teléfono de emergencia ${c.nombre} ${c.numero}`,
        mostrar: `${c.nombre}: ${c.numero} (confirmar número vigente)`, fuente: c.nombre, fecha: "", nav: { tab: "fuentes" },
      });
    }
  }
  for (const p of prensa?.items ?? []) {
    docs.push({
      id: p.id, kind: "prensa", titulo: p.titulo, texto: `${p.titulo}. ${p.temas?.join(" ") ?? ""}`, mostrar: p.titulo,
      fuente: p.fuente, fecha: p.fecha, nav: { tab: "novedades", id: p.id }, url: p.url,
    });
  }
  for (const r of reportes) {
    docs.push({
      id: r.id, kind: "vecinal", titulo: "", texto: `${r.texto} ${r.zona} ${r.tipo}`, mostrar: `${r.zona}: ${r.texto}`,
      fuente: "Reporte de vecinos", fecha: new Date(r.ts).toISOString(), ts: r.ts, nav: { tab: "novedades", id: r.id },
    });
  }
  return docs;
}

/* ---------- BM25 ---------- */
export class Indice {
  constructor(docs) {
    this.docs = docs;
    this.tf = docs.map((d) => {
      const m = new Map();
      for (const t of [...tokens(d.titulo), ...tokens(d.titulo), ...tokens(d.texto)]) m.set(t, (m.get(t) ?? 0) + 1);
      return m;
    });
    this.len = this.tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
    this.avg = this.len.reduce((a, b) => a + b, 0) / Math.max(1, docs.length);
    this.df = new Map();
    for (const m of this.tf) for (const t of m.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
  }

  consulta(pregunta) {
    const base = [...new Set(tokens(pregunta))];
    const q = new Map(base.map((t) => [t, 1]));
    for (const t of base) for (const s of SINONIMOS[t] ?? []) if (!q.has(s)) q.set(s, 0.45);
    return q;
  }

  buscar(pregunta, { k = 4, sesgo = {} } = {}) {
    const q = this.consulta(pregunta);
    const N = this.docs.length, k1 = 1.4, b = 0.75;
    const puntajes = this.docs.map((d, i) => {
      let s = 0;
      for (const [t, w] of q) {
        const f = this.tf[i].get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - this.df.get(t) + 0.5) / (this.df.get(t) + 0.5));
        s += w * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.len[i]) / this.avg)));
      }
      const antiguo = d.kind === "vecinal" && d.ts && Date.now() - d.ts > 6 * 3600e3 ? 0.5 : 1;
      return { d, s: s * (PESO_KIND[d.kind] ?? 1) * (sesgo[d.kind] ?? 1) * antiguo };
    }).filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s);

    if (!puntajes.length) return [];
    const mejor = puntajes[0].s;
    const elegidos = [];
    for (const x of puntajes) {
      if (elegidos.length >= k || x.s < mejor * 0.45) break;
      const tk = new Set(tokens(x.d.mostrar));
      const repetido = elegidos.some((e) => {
        const te = new Set(tokens(e.d.mostrar));
        const inter = [...tk].filter((t) => te.has(t)).length;
        return inter / Math.max(1, Math.min(tk.size, te.size)) > 0.75;
      });
      if (!repetido) elegidos.push(x);
    }
    return elegidos;
  }
}

/* ---------- Respuesta ---------- */
const UMBRAL = 2.2;
const recorta = (s, n = 230) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);

function cita(d) {
  const f = d.fecha ? fmtFecha(d.fecha) : "sin fecha";
  return { label: `${d.fuente} · ${f}`, nav: d.nav, url: d.url && d.kind === "prensa" ? d.url : undefined };
}

export const SUGERENCIAS = [
  "¿Qué falta en San Ildefonso?",
  "¿Estoy a salvo si vivo cerca de la quebrada?",
  "¿Qué dice ENFEN del Niño?",
  "¿Qué reportan los vecinos?",
  "¿A quién llamo en una emergencia?",
  "¿Cómo sé si una alerta es oficial?",
];

/** Devuelve { intro, puntos[], extra[], acciones[], pie } */
export function responder(pregunta, indice, { ficha, recopilado }) {
  const n = norm(pregunta);
  const contactos = ficha?.contactos ?? [];
  const telefonos = contactos.map((c) => `${c.nombre} ${c.numero}`).join(", ");

  if (/\b(auxilio|socorro|ayuda|atrapad|herid|me estoy inundando|se esta inundando|se inunda)\b/.test(n)) {
    return {
      intro: `Si estás en una emergencia ahora, llama ya: ${telefonos || "INDECI 115"} (números por confirmar). NubIA no envía alertas ni puede enviar ayuda.`,
      puntos: [], extra: ["Si puedes, ve a tu punto de reunión acordado y sigue lo que indiquen Defensa Civil o INDECI."],
      acciones: [{ label: "Ver teléfonos y fuentes", tab: "fuentes" }],
    };
  }
  if (/^(hola|buenas|buenos dias|buen dia|hey|saludos)\b/.test(n)) {
    return {
      intro: "Hola, soy NubIA. Respondo con lo que se recopiló sobre El Niño y las quebradas de Trujillo (ficha, avisos oficiales, prensa y reportes de vecinos) y siempre te digo la fuente.",
      puntos: [], extra: ["No emito alertas ni predigo lluvias. ¿Qué quieres saber?"], acciones: [],
    };
  }
  if (/\b(quien eres|que eres|que haces|que puedes|como funcionas)\b/.test(n)) {
    return {
      intro: "Soy NubIA, un asistente de orientación. Busco en la información recopilada y te muestro los fragmentos con su fuente y fecha. No decido qué es verdad ni emito alertas: solo INDECI lo hace.",
      puntos: [], extra: [], acciones: [{ label: "Qué es y qué no es esta app", tab: "fuentes" }],
    };
  }
  if (/(a salvo|estamos seguros|es seguro|esta seguro|estoy seguro|puedo quedarme|hay peligro|protegid|ya paso el peligro|tranquil|me protege|se va a inundar|va a haber|habra huaico|va a llover|va a caer|cuando llega|cuando llueve|predic|pronostic)/.test(n)) {
    const riesgo = indice.docs.filter((d) => d.kind === "ficha" && d.bloque === "riesgo").slice(0, 3);
    return {
      intro: "No puedo decirte si estás a salvo ni predecir cuándo lloverá: ni NubIA ni una obra en construcción pueden asegurarlo. Esto es lo que sí consta en las fuentes:",
      puntos: riesgo.map((d) => ({ texto: recorta(d.mostrar), tipo: ETIQUETA_KIND[d.kind], cita: cita(d) })),
      extra: ["Confirma tu punto seguro y tu ruta de salida con Defensa Civil de la Municipalidad. Para el tiempo, mira SENAMHI; para alertas, INDECI."],
      acciones: [{ label: "SENAMHI", url: "https://www.senamhi.gob.pe" }, { label: "INDECI", url: "https://www.gob.pe/indeci" }],
      pie: pieFecha(recopilado),
    };
  }

  if (/\b(vecino|vecinos|reporte|reportes|reportan|reportaron|publican|publicaron)\b/.test(n)) {
    const recientes = indice.docs.filter((d) => d.kind === "vecinal" && Date.now() - d.ts < 6 * 3600e3).sort((a, b) => b.ts - a.ts);
    const afines = indice.buscar(pregunta, { k: 6, sesgo: { vecinal: 3 } }).map((x) => x.d).filter((d) => d.kind === "vecinal");
    const lista = (afines.length ? afines : recientes).slice(0, 3);
    return {
      intro: lista.length ? "Esto reportan los vecinos en las últimas horas:" : "No hay reportes recientes de vecinos en este momento.",
      puntos: lista.map((d) => ({ texto: `${recorta(d.mostrar)} (${haceTiempo(d.ts)})`, tipo: ETIQUETA_KIND.vecinal, cita: cita(d) })),
      extra: ["Los reportes de vecinos no están verificados: sirven de pista, no de aviso oficial. Ante duda, comprueba con INDECI o la Municipalidad."],
      acciones: [{ label: "Ver todas las tarjetas", tab: "novedades" }],
      pie: "Los reportes se guardan solo en este dispositivo (prototipo sin servidor).",
    };
  }

  const sesgo = {};
  if (/\b(prensa|noticia|noticias|medios|periodico|dicen)\b/.test(n)) sesgo.prensa = 1.8;
  if (/\b(oficial|oficiales|aviso|avisos|comunicado)\b/.test(n)) sesgo.oficial = 1.5;

  const hallados = indice.buscar(pregunta, { k: 4, sesgo });
  const verifica = /\b(mensaje|cadena|me llego|es real|es verdad|es oficial|verificar|comprobar|rumor|bulo|circula|reenvi)/.test(n);
  const acciones = verifica ? [{ label: "Comprobar un mensaje", tab: "verificar" }] : [];

  if (!hallados.length || hallados[0].s < UMBRAL) {
    return {
      intro: verifica
        ? "Para comprobar un mensaje usa la sección “¿Es oficial?”. No digo si es falso o cierto: te muestro qué encontré y dónde comprobarlo."
        : "No encontré eso en lo que tengo recopilado, y no voy a inventar una respuesta.",
      puntos: [],
      extra: verifica ? [] : ["Prueba con otras palabras, o consulta directamente las fuentes oficiales."],
      acciones: [...acciones, { label: "INDECI", url: "https://www.gob.pe/indeci" }, { label: "Municipalidad de Trujillo", url: "https://www.munitrujillo.gob.pe" }],
      pie: pieFecha(recopilado),
    };
  }

  const extra = [];
  if (hallados.some((x) => x.d.kind === "ficha" && ["falta", "obras", "funciona"].includes(x.d.bloque))) {
    extra.push("Recuerda: aunque la obra avance, el riesgo sigue. Terminada o no, prepárate igual.");
  }
  if (hallados.some((x) => x.d.kind === "vecinal")) {
    extra.push("Los reportes de vecinos no están verificados: sirven de pista, no de aviso oficial.");
  }
  return {
    intro: "Esto encontré en lo que tengo recopilado:",
    puntos: hallados.map(({ d }) => ({ texto: recorta(d.mostrar), tipo: ETIQUETA_KIND[d.kind], cita: cita(d) })),
    extra, acciones, pie: pieFecha(recopilado),
  };
}

function pieFecha(recopilado) {
  const f = recopilado?.generadoEn ? fmtFecha(recopilado.generadoEn) : "fecha desconocida";
  return `Respuesta armada solo con datos recopilados (prensa al ${f}). Compruébalo en la fuente.`;
}
