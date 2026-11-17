// Normalización de texto en español para búsqueda (sin tildes, sin plurales).
const STOP = new Set(("a al algo ante con como cual cuales cuando de del el ella ellas en entre es esta estan este esto esa eso fue ha han hay " +
  "la las le les lo los me mi mis muy ni no nos o para pero por que se si sin sobre son su sus te tu un una uno y ya yo mas cada donde quien " +
  "soy ser era hoy ahora").split(" "));

export const norm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function raiz(w) {
  if (w.length > 5 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

export const tokens = (s) =>
  norm(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(raiz);

/** ¿La frase aparece como palabras completas dentro del texto ya normalizado? */
export const contiene = (textoNorm, frase) => ` ${textoNorm} `.includes(` ${norm(frase)} `);
