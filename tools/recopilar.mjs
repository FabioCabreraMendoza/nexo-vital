#!/usr/bin/env node
// NEXOVITAL · Recopilador de noticias (data-mining ligero)
// Uso:  node tools/recopilar.mjs
//
// Por qué es un script y no código del navegador: la web app no tiene backend y los
// navegadores bloquean (CORS) leer páginas de otros sitios. Este script se ejecuta
// antes de publicar/demostrar, consulta RSS públicos (Google Noticias) y deja el
// resultado en data/recopilado.json, que la app guarda en caché para uso sin conexión.
//
// No hace scraping de Facebook ni de grupos privados: requiere sesión, incumple sus
// términos y expone datos personales. Los reportes vecinales se crean dentro de la app.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, "..", "data", "recopilado.json");

const CONSULTAS = [
  "quebrada San Ildefonso Trujillo",
  "quebrada San Carlos Trujillo obras",
  "Fenómeno El Niño Trujillo",
  "El Porvenir Trujillo lluvias huaico",
  "ENFEN alerta El Niño costero",
  "Defensa Civil Trujillo",
  "INDECI La Libertad",
];

const RELEVANTE = /(ni[ñn]o|huaico|quebrada|lluvia|dique|ildefonso|san carlos|enfen|indeci|defensa civil|el porvenir|sismate|inundaci|aluvi|anin|contralor)/i;
const EXCLUIR = /(fujimori|keiko|candidat|campa[ñn]a electoral|elecci|partido|congres)/i;
const MAX_DIAS = 150;
const MAX_ITEMS = 30;

const decodificar = (s = "") =>
  s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "").trim();

const etiqueta = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodificar(m[1]) : "";
};

function temas(texto) {
  const t = texto.toLowerCase();
  const out = [];
  if (/ildefonso/.test(t)) out.push("San Ildefonso");
  if (/san carlos/.test(t)) out.push("San Carlos");
  if (/ni[ñn]o|enfen/.test(t)) out.push("El Niño");
  if (/huaico|aluvi|lluvia/.test(t)) out.push("Lluvias");
  if (/dique|obra|anin|contralor/.test(t)) out.push("Obras");
  if (/indeci|defensa civil|sismate|alerta/.test(t)) out.push("Alertas");
  return out;
}

async function consultar(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:" + MAX_DIAS + "d")}&hl=es-419&gl=PE&ceid=PE:es-419`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0 (compatible; NexovitalRecopilador/0.1)" } });
  if (!r.ok) throw new Error(`${q}: HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const tituloCompleto = etiqueta(it, "title");
    const fuente = etiqueta(it, "source") || (tituloCompleto.split(" - ").at(-1) ?? "");
    const titulo = tituloCompleto.replace(new RegExp(`\\s+-\\s+${fuente.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    const fecha = new Date(etiqueta(it, "pubDate"));
    return { titulo, fuente, url: etiqueta(it, "link"), fecha: isNaN(fecha) ? null : fecha.toISOString() };
  });
}

const vistos = new Map();
const errores = [];
for (const q of CONSULTAS) {
  try {
    for (const n of await consultar(q)) {
      const clave = n.titulo.toLowerCase().replace(/\W+/g, " ").slice(0, 80);
      if (!n.fecha || vistos.has(clave) || !RELEVANTE.test(n.titulo) || EXCLUIR.test(n.titulo)) continue;
      vistos.set(clave, { ...n, temas: temas(n.titulo) });
    }
    console.log(`✔ ${q}`);
  } catch (e) {
    errores.push(String(e.message));
    console.warn(`✖ ${e.message}`);
  }
}

const items = [...vistos.values()]
  .sort((a, b) => b.fecha.localeCompare(a.fecha))
  .slice(0, MAX_ITEMS)
  .map((n, i) => ({ id: `prensa-${i + 1}`, ...n }));

const paquete = {
  generadoEn: new Date().toISOString(),
  metodo: "RSS público de Google Noticias, filtrado por palabras clave. Solo titular, medio, fecha y enlace; no se copian notas.",
  consultas: CONSULTAS,
  errores,
  items,
};

if (!items.length) {
  console.error("Sin resultados: no se sobrescribe data/recopilado.json");
  process.exit(1);
}
await writeFile(SALIDA, JSON.stringify(paquete, null, 2), "utf8");
console.log(`\n${items.length} titulares guardados en data/recopilado.json`);
