# NEXOVITAL: especificación del prototipo (MVP para hoy)

Contexto: Desafío UPAO 2026, equipo NubIA. Presentación hoy a las 15:00. Este prototipo debe estar listo para probarse con 8-10 personas antes de ~13:30 (hoy es 17-nov-2026). Es una web app (PWA) estática, en español, sin backend.

## 0. Prompt de arranque para Claude Code (pegar tal cual)

```
Lee PROTOTYPE_SPEC.md y data/ficha.json. Construye el MVP descrito, en este orden y con commits pequeños:
1) estructura y página "Inicio" que muestre la ficha desde data/ficha.json;
2) página "Obras" por componente con estado, fecha y fuente;
3) página "¿Es oficial?";
4) página "Fuentes oficiales";
5) service worker + manifest para uso sin conexión;
6) botón "Compartir por WhatsApp".
Reglas: HTML, CSS y JavaScript sin frameworks ni backend; peso total menor a 500 KB; texto en español claro; accesible desde un celular Android económico. No uses las palabras "protegido" ni un semáforo. No inventes datos: si falta un dato, muestra "sin información" y deja un TODO en data/ficha.json. Al terminar cada paso, dime qué probar a mano.
```

## 1. Objetivo y condición de riesgo

- **Condición de riesgo que modifica:** vulnerabilidad informativa. Los vecinos tienen información dispersa sobre qué obras protegen y qué falta, y pueden recibir avisos no oficiales.
- **Qué hace el prototipo:** reúne en una ficha única, con fuente y fecha, el estado de las obras de contención, el riesgo que sigue existiendo y a quién escuchar en una emergencia. Explica la diferencia entre aviso oficial y mensaje no confirmado.
- **Qué NO hace:** no emite alertas, no predice, no reemplaza al SISMATE ni a INDECI, no declara "falso" ningún mensaje.

## 2. Alcance del MVP de hoy

**Incluye**
1. **Inicio:** ficha de una página con 4 bloques: *Qué funciona hoy*, *Qué falta*, *Lo que sigue siendo un riesgo*, *A quién escuchar en una emergencia*. Muestra siempre versión, fecha de actualización y fecha de vencimiento.
2. **Obras:** lista por componente (diques, túnel de trasvase, defensas ribereñas, río Moche) con estado (Funciona / En construcción / Sin información), fecha y fuente.
3. **¿Es oficial?:** el usuario pega o escribe un mensaje. La app busca coincidencias en una lista curada de avisos oficiales conocidos (`data/ficha.json`). Resultados posibles: "Coincide con un aviso oficial de [entidad] del [fecha]" o "No encontré un aviso oficial. Verifica en INDECI, SENAMHI o la Municipalidad." con enlaces. Nunca dice "es falso".
4. **Fuentes oficiales:** enlaces a INDECI, SENAMHI, ENFEN, MPT y ANIN.
5. **Compartir:** botón que usa la Web Share API (con respaldo de copiar texto) para enviar la ficha por WhatsApp.
6. **Sin conexión:** service worker que guarda la ficha y las páginas. Debe abrir sin internet tras la primera visita.
7. **Aviso de límites:** pantalla corta "Qué es y qué no es esta app".

**Excluye (queda como hoja de ruta)**
- Inteligencia artificial, red social comunitaria, notificaciones push, cuentas de usuario, backend, base de datos, mapa interactivo.

## 3. Reglas de contenido (obligatorias)

- Cada afirmación lleva **fuente y fecha**. Si dos fuentes difieren (por ejemplo, 79,84% y 81%), mostrar ambas.
- Sin lenguaje de falsa seguridad: no usar "protegido", "seguro", "listo" ni semáforo verde. El bloque de riesgo residual es obligatorio y aparece sin necesidad de hacer clic.
- No dar instrucciones de evacuación inventadas. Las indicaciones deben salir de INDECI o Defensa Civil. Mientras no estén validadas, mostrar "Confirma tu punto seguro con Defensa Civil de la Municipalidad".
- Lenguaje claro, frases cortas, sin tecnicismos. Si hay un término técnico, explicarlo en una línea.
- No recolectar datos personales ni usar analítica.

## 4. Requisitos técnicos

- HTML + CSS + JavaScript puro, sin framework ni dependencias externas. Sin CDN (debe funcionar sin conexión).
- Peso total menor a 500 KB. Probar con red lenta.
- Responsive, pensado primero para celular. Tamaño de letra legible, contraste alto, botones grandes.
- `manifest.webmanifest` con nombre, íconos y `display: standalone`.
- `service-worker.js` con caché de la ficha y las páginas.
- Los datos viven solo en `data/ficha.json`. Actualizar la ficha = editar ese archivo y subir la versión.
- En iPhone, las notificaciones push de una PWA requieren instalarla en la pantalla de inicio (iOS 16.4+). No depender de push.

## 5. Estructura sugerida

```
nexovital-prototipo/
  index.html        (Inicio)
  obras.html
  verificar.html    (¿Es oficial?)
  fuentes.html
  limites.html
  css/estilos.css
  js/app.js
  js/verificar.js
  service-worker.js
  manifest.webmanifest
  data/ficha.json
```

## 6. Criterios de aceptación (ligados a la validación)

- **H2 Comprensión:** una persona nueva lee la Inicio en menos de 2 minutos y puede decir qué falta de la obra y qué debe hacer.
- **H3 Sin falsa seguridad:** el bloque de riesgo residual se ve sin hacer scroll largo ni abrir menús.
- **H4 Verificador:** dados 10 mensajes (5 oficiales conocidos, 5 simulados), la app responde sin errores y sin decir "falso".
- **Sin conexión:** tras abrir una vez, la ficha carga con el modo avión activado.
- **Peso y velocidad:** carga en menos de 3 segundos con red lenta y pesa menos de 500 KB.

## 7. Pruebas manuales para hoy

1. Abrir en un Android y en un iPhone, y probar sin conexión.
2. Probar el botón de compartir por WhatsApp.
3. Probar el verificador con mensajes oficiales, no oficiales y vacíos.
4. Pedir a 2 personas ajenas al equipo que lean la ficha y digan qué falta de la obra.
5. Revisar que ninguna parte diga "protegido" ni muestre un semáforo.

## 8. Despliegue

Un sitio estático gratuito sirve (por ejemplo GitHub Pages o Netlify). Verificar que el sitio use HTTPS, requisito del service worker. Alternativa si no hay tiempo: abrir los archivos desde una carpeta compartida para la demostración.

## 9. Lo que el equipo debe decidir antes o durante el desarrollo

1. Territorio piloto de la ficha (El Porvenir completo, o Mampuesto y Río Seco).
2. Validación del contenido por Defensa Civil de la MPT o INDECI (sin confirmar).
3. Quién actualiza la ficha y cada cuánto.
4. Nombre final y logo (NEXOVITAL / NubIA).

## 10. Riesgos para recordar mientras se construye

- Efecto dique: mostrar solo avances puede dar falsa seguridad.
- La app compite con otras oficiales (Senamhi Perú Móvil, Perú en Alerta de INGEMMET, AlertaMinedu). El valor es lo local y comprensible.
- Si no hay luz ni batería, la app no sirve. Radio y ficha impresa siguen siendo canales necesarios.
- Los datos de obras cambian. La ficha debe vencer visiblemente.
