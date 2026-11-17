#!/usr/bin/env node
// Servidor estático mínimo para probar la PWA en localhost (los service workers requieren HTTPS o localhost).
// Uso: node tools/servir.mjs [puerto]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUERTO = Number(process.argv[2] ?? 5173);
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".md": "text/markdown; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (ruta.endsWith("/")) ruta += "index.html";
    const archivo = join(RAIZ, normalize(ruta));
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    const datos = await readFile(archivo);
    res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(datos);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No encontrado");
  }
}).listen(PUERTO, "0.0.0.0", () => {
  console.log(`NubIA en http://localhost:${PUERTO}`);
  for (const l of Object.values(networkInterfaces()).flat()) {
    if (l && l.family === "IPv4" && !l.internal) console.log(`En tu red (celular en el mismo Wi-Fi): http://${l.address}:${PUERTO}  (sin HTTPS no habrá modo sin conexión)`);
  }
});
