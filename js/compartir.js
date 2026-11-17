// Compartir por WhatsApp (texto), imagen ligera, Web Share API y copiar.
import { $, h, icono, avisar } from "./util.js";

const PIE = "Informativo: no es una alerta oficial. Comprueba en INDECI (115) o en la Municipalidad de Trujillo.";

/** Arma el texto a compartir. `item` = { titulo, cuerpo, fuente, fecha, url? } */
function armarTexto(item) {
  const lineas = [`*${item.titulo}*`];
  if (item.cuerpo) lineas.push(item.cuerpo);
  if (item.fuente) lineas.push(`Fuente: ${item.fuente}${item.fecha ? ` (${item.fecha})` : ""}`);
  if (item.url) lineas.push(item.url);
  lineas.push("", PIE, `NubIA · ${location.origin}${location.pathname}`);
  return lineas.join("\n");
}

/** Dibuja una imagen ligera (PNG) con el contenido, pensada para WhatsApp. */
function crearImagen(item) {
  const W = 1080, P = 64;
  const c = document.createElement("canvas");
  c.width = W;
  const ctx = c.getContext("2d");
  const fam = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

  const envolver = (texto, fuente, ancho) => {
    ctx.font = fuente;
    const palabras = String(texto).split(/\s+/);
    const lineas = [];
    let l = "";
    for (const p of palabras) {
      const prueba = l ? `${l} ${p}` : p;
      if (ctx.measureText(prueba).width > ancho && l) { lineas.push(l); l = p; } else l = prueba;
    }
    if (l) lineas.push(l);
    return lineas;
  };

  const fTitulo = `800 58px ${fam}`, fCuerpo = `400 40px ${fam}`, fFuente = `600 32px ${fam}`, fPie = `400 28px ${fam}`;
  const titulo = envolver(item.titulo, fTitulo, W - 2 * P);
  const cuerpo = item.cuerpo ? envolver(item.cuerpo, fCuerpo, W - 2 * P) : [];
  const fuente = envolver(`Fuente: ${item.fuente ?? "—"}${item.fecha ? ` · ${item.fecha}` : ""}`, fFuente, W - 2 * P);
  const pie = envolver(PIE, fPie, W - 2 * P);

  const alto = 150 + titulo.length * 70 + 30 + cuerpo.length * 56 + 40 + fuente.length * 44 + 50 + pie.length * 38 + P;
  c.height = Math.max(alto, 540);

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, c.height);
  ctx.fillStyle = "#562EC6"; ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = "#ffffff"; ctx.font = `800 44px ${fam}`; ctx.textBaseline = "alphabetic";
  ctx.fillText("NubIA · NEXOVITAL", P, 72);

  let y = 150;
  const pintar = (lineas, fuenteTxt, color, paso) => {
    ctx.font = fuenteTxt; ctx.fillStyle = color;
    for (const l of lineas) { y += paso; ctx.fillText(l, P, y); }
  };
  pintar(titulo, fTitulo, "#231B3D", 70);
  y += 30;
  pintar(cuerpo, fCuerpo, "#231B3D", 56);
  y += 40;
  pintar(fuente, fFuente, "#562EC6", 44);
  y += 50;
  ctx.fillStyle = "#ECE8F7"; ctx.fillRect(P, y - 26, W - 2 * P, 3);
  pintar(pie, fPie, "#4D4072", 38);

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = h("textarea", { "aria-hidden": "true", style: "position:fixed;opacity:0" });
    ta.value = texto;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* sin permiso */ }
    ta.remove();
    return ok;
  }
}

export function abrirCompartir(item) {
  const dlg = $("#dlg-compartir");
  const texto = armarTexto(item);
  const estado = $("#compartir-estado");
  estado.textContent = "";
  $("#compartir-vista").textContent = texto;

  const botones = $("#compartir-botones");
  botones.replaceChildren();

  botones.append(
    h("a", {
      class: "btn btn-primario",
      href: `https://wa.me/?text=${encodeURIComponent(texto)}`,
      target: "_blank", rel: "noopener noreferrer",
    }, icono("send"), "Enviar por WhatsApp"),
  );

  botones.append(h("button", {
    type: "button", class: "btn",
    onclick: async () => {
      estado.textContent = "Preparando imagen…";
      try {
        const blob = await crearImagen(item);
        const archivo = new File([blob], "nubia.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [archivo] })) {
          await navigator.share({ files: [archivo], text: PIE });
          estado.textContent = "";
        } else {
          const enlace = h("a", { href: URL.createObjectURL(blob), download: "nubia.png" });
          document.body.append(enlace); enlace.click(); enlace.remove();
          setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
          estado.textContent = "Imagen descargada. Adjúntala en WhatsApp.";
        }
      } catch (e) {
        estado.textContent = e?.name === "AbortError" ? "" : "No se pudo crear la imagen.";
      }
    },
  }, icono("image"), "Imagen ligera (para WhatsApp)"));

  if (navigator.share) {
    botones.append(h("button", {
      type: "button", class: "btn",
      onclick: async () => {
        try { await navigator.share({ title: item.titulo, text: texto }); }
        catch (e) { if (e?.name !== "AbortError") estado.textContent = "No se pudo abrir el menú de compartir."; }
      },
    }, icono("share"), "Más opciones…"));
  }

  botones.append(h("button", {
    type: "button", class: "btn",
    onclick: async () => {
      const ok = await copiar(texto);
      estado.textContent = ok ? "Texto copiado." : "No se pudo copiar. Selecciona el texto de arriba.";
      if (ok) avisar("Texto copiado");
    },
  }, icono("copy"), "Copiar texto"));

  dlg.showModal();
}
