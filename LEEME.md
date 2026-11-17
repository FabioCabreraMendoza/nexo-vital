# NubIA · NEXOVITAL — prototipo (PWA)

Web app móvil sin framework y sin backend. 156 KB en total. Funciona sin conexión tras la primera visita.

## Cómo abrirla

```bash
node tools/servir.mjs          # http://localhost:5173
```

- Los service workers (modo sin conexión) solo funcionan en **HTTPS o localhost**. Para probar en un celular:
  sube la carpeta a Netlify Drop, GitHub Pages o Cloudflare Pages (gratis, HTTPS automático).
- Abrir `index.html` con doble clic muestra la app, pero **sin** modo sin conexión y sin cargar los datos (el navegador bloquea `fetch` desde `file://`).

## Qué incluye

| Pestaña | Qué hace |
|---|---|
| Inicio | Ficha única con fuente y fecha: riesgo que sigue (primero y abierto), qué falta, qué funciona, a quién escuchar, y obras por componente. Muestra versión, fecha y vencimiento. Compartir e imprimir. |
| Novedades | Tarjetas estilo Waze: **oficial** (resaltado), **prensa** (recopilada) y **vecinos** (botones “Sigue ahí” / “Ya no está” con contador). Botón *Reportar*. |
| ¿Es oficial? | Compara un mensaje con avisos oficiales conocidos. Nunca dice “falso”: dice qué encontró, pistas a revisar y dónde comprobar. |
| NubIA | Chat con RAG local (BM25) sobre todo lo recopilado. Cita fuente y fecha. Si no encuentra, lo dice. |
| Fuentes | Enlaces oficiales, teléfonos, instalar app, límites de la app. |

Compartir (cada tarjeta y la ficha): WhatsApp (texto), imagen ligera, menú del sistema y copiar.

## Actualizar los datos

| Archivo | Cómo se actualiza |
|---|---|
| `data/ficha.json` | A mano. Sube `actualizado` y `vence`. Los `TODO` marcan lo que falta confirmar. |
| `data/recopilado.json` | `node tools/recopilar.mjs` (consulta RSS público de Google Noticias, solo titular + medio + fecha + enlace). |
| `data/vecinal.json` | Ejemplos de demostración. Los reportes reales del usuario se guardan en su dispositivo. |

### Imágenes

- **Vecinos:** al reportar se puede adjuntar una foto (opcional). Se reduce a JPEG de 640 px, se borra su ubicación GPS (EXIF) y se guarda solo en ese dispositivo.
- **Prensa y ejemplos de vecinos:** copia el archivo a `data/img/` y añade al item `"imagen": "data/img/mi-foto.jpg"` y, si es de un medio, `"imagen_credito": "Diario Correo"`. También acepta una URL `https://`. Al volver a ejecutar `recopilar.mjs` se conservan las imágenes de los enlaces que sigan en la lista.
- **Derechos:** las fotos de los medios tienen derechos de autor. Usa solo las que tengas autorizadas y pon siempre el crédito.
- No se aceptan SVG, `http://` ni rutas fuera de `data/img/`.

Después de cambiar archivos, sube `VERSION` en `service-worker.js` para que los celulares limpien la caché.

## Lo que es real y lo que es demostración

- **Real:** ficha (datos del documento de contexto, con fuente), titulares de prensa recopilados hoy.
- **Demostración:** los 4 reportes de vecinos de `data/vecinal.json` (llevan la etiqueta “Ejemplo de demostración”). No hay evidencia local de reportes vecinales de El Porvenir.
- **Sin servidor:** los votos y reportes quedan solo en el dispositivo. Para que varios vecinos vean los mismos contadores se necesita un backend (hoja de ruta).
- **Facebook / grupos:** no se recopilan. Requieren sesión, incumplen sus términos y exponen datos personales. Alternativa: que los vecinos publiquen dentro de la app.
- **“Web scraping”:** corre en `tools/recopilar.mjs`, no en el navegador, porque los navegadores bloquean leer otras páginas (CORS).
- **IA:** NubIA recupera y cita, no genera texto libre. Eso evita inventar. Un LLM puede añadirse en `js/rag.js` (`responder`) usando los fragmentos recuperados como contexto.

## Reglas de contenido que el código respeta

Sin “protegido”, “seguro” (salvo “punto seguro” de Defensa Civil) ni semáforo. Riesgo residual visible sin clics. Sin órdenes de evacuación inventadas. Sin datos personales ni analítica. Todo texto de terceros se inserta como texto (no HTML) y solo se permiten enlaces http(s).

## Pendientes antes de las 15:00

1. Confirmar fecha y fuente exacta de las cifras de obras (`TODO` en `data/ficha.json`).
2. Confirmar números de emergencia y enlaces oficiales.
3. Decidir territorio piloto y quién actualiza la ficha.
4. Llamar a un alcalde territorial / Defensa Civil (hipótesis H1 y H5) y registrar qué esperaban, qué encontraron y qué ajustaron.
5. Probar en un Android y un iPhone, con y sin conexión.
