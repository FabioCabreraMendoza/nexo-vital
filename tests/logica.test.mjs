// Pruebas de las reglas que más importan: el verificador, NubIA y el contenido de la ficha.
// Ejecutar: npm test   (o: node --test tests/*.test.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analizar, EJEMPLOS } from "../js/verificar.js";
import { construirCorpus, Indice, responder } from "../js/rag.js";

const datos = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const ficha = datos("ficha");
const prensa = datos("recopilado");
const indice = new Indice(construirCorpus({ ficha, prensa }));
const verificar = (msg) => analizar(msg, { avisos: ficha.avisos_oficiales });
const preguntar = (q) => responder(q, indice, { ficha, recopilado: prensa });
const textoDe = (r) => JSON.stringify(r);

test("verificador: los dos ejemplos oficiales coinciden con su aviso", () => {
  assert.equal(verificar(EJEMPLOS[0].texto).top?.id, "a-enfen");
  assert.equal(verificar(EJEMPLOS[1].texto).top?.id, "a-senamhi-rojo");
  assert.equal(verificar(EJEMPLOS[0].texto).nivel, "coincide");
});

test("verificador: un mensaje simulado no coincide y muestra pistas (incluida la orden de evacuar)", () => {
  const r = verificar(EJEMPLOS[2].texto);
  assert.notEqual(r.nivel, "coincide");
  assert.ok(r.senales.some((s) => /evacuar/.test(s)), "debe avisar de la orden de evacuar");
  assert.ok(r.senales.some((s) => /reenv/.test(s)));
});

test("verificador: 'tener en cuenta' no se confunde con pedir datos de cuenta", () => {
  const r = verificar("Tenga en cuenta que SENAMHI actualizará el pronóstico mañana.");
  assert.ok(!r.senales.some((s) => /datos personales o dinero/.test(s)));
});

test("ficha: toda afirmación tiene fuente y fecha, e ids únicos y ASCII", () => {
  const items = [...Object.values(ficha.bloques).flat(), ...ficha.obras];
  for (const it of items) assert.ok(it.fuentes?.length && it.fuentes.every((f) => f.nombre && f.fecha), it.id);
  const ids = [...items, ...ficha.avisos_oficiales, ...ficha.fuentes_oficiales].map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((i) => /^[\w-]+$/.test(i)), "ids con caracteres no ASCII");
});

test("contenido: sin 'protegido' ni semáforo en la ficha ni en los ejemplos", () => {
  const texto = JSON.stringify([ficha, datos("vecinal")]);
  assert.ok(!/protegid|sem[aá]foro/i.test(texto));
});

test("NubIA: ante '¿estoy a salvo?' no promete seguridad y muestra el riesgo residual", () => {
  const r = preguntar("¿Estoy a salvo si vivo cerca de la quebrada?");
  assert.match(r.intro, /No puedo decirte/);
  assert.ok(r.puntos.length > 0);
  assert.ok(!/\b(estás a salvo|es seguro|protegid)/i.test(r.puntos.map((p) => p.texto).join(" ")));
});

test("NubIA: fuera de tema no inventa y manda a fuentes oficiales con URL", () => {
  const r = preguntar("receta de ceviche");
  assert.equal(r.puntos.length, 0);
  assert.match(r.intro, /no voy a inventar/);
  assert.ok(r.acciones.every((a) => /^https:/.test(a.url)));
});

test("NubIA: toda respuesta con datos cita fuente y fecha", () => {
  const r = preguntar("¿Qué falta en San Ildefonso?");
  assert.ok(r.puntos.length > 0);
  assert.ok(r.puntos.every((p) => p.cita.label.includes("·")), textoDe(r.puntos));
});
