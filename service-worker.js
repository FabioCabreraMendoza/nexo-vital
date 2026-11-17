// Service worker: la app completa abre sin conexión tras la primera visita.
// Estrategia única: red primero (con límite de 3 s) y respaldo en caché.
// Así, con red siempre se ve la última versión; sin red o con red muy lenta se usa lo guardado.
// Al editar archivos, sube VERSION para limpiar cachés antiguas.
const VERSION = "nexovital-v2";
const CASCARON = [
  "./", "index.html", "manifest.webmanifest", "css/estilos.css",
  "js/app.js", "js/util.js", "js/compartir.js", "js/verificar.js", "js/rag.js", "js/texto.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "data/ficha.json", "data/recopilado.json", "data/vecinal.json",
];
const LIMITE_RED_MS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CASCARON)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function redConLimite(req) {
  return new Promise((ok, fallo) => {
    const t = setTimeout(() => fallo(new Error("red lenta")), LIMITE_RED_MS);
    fetch(req).then((r) => { clearTimeout(t); ok(r); }, (err) => { clearTimeout(t); fallo(err); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // enlaces externos: no se interceptan

  e.respondWith((async () => {
    try {
      const r = await redConLimite(req);
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
      return r;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") return (await caches.match("index.html")) ?? Response.error();
      return Response.error();
    }
  })());
});
