# pinestic-web v2

Sitio estático de PINESTIC: HTML, CSS y JavaScript sin dependencias. Se publica en Vercel desde la rama `main`.

## Estructura
- `index.html`: página de inicio.
- `styles.css`: estilos de todo el sitio (colores oficiales en `:root`).
- `main.js`: menú móvil, pestañas de servicios, cifras animadas, apariciones al desplazarse y diagrama de red.
- `blog/index.html`: listado del blog.
- `blog/<nombre-del-articulo>/index.html`: cada artículo en su propia carpeta.
- `plantillas/articulo.html`: plantilla para artículos nuevos (no se publica, ver `.vercelignore`).
- `og-image.png`: imagen que aparece al compartir el enlace en redes y WhatsApp.

## Publicar un artículo nuevo
1. Copia `plantillas/articulo.html` en `blog/nombre-del-articulo/index.html`.
2. Reemplaza todo lo que está EN MAYÚSCULAS.
3. Agrega la tarjeta en `blog/index.html` (y, si es el más reciente, en la sección Blog de `index.html`).
4. Agrega la dirección en `sitemap.xml`.
5. Haz commit: Vercel lo publica solo en uno o dos minutos.

## Logos de tecnologías
Guarda los logos oficiales en `logos/` con el nombre indicado en `logos/LEEME.txt` y actívalos en `index.html`, en el atributo `data-logos=""`. Los que no actives se muestran como texto.

## Recorrido 3D del inicio
- `datacenter.js` construye el datacenter 3D con three.js (`vendor/three.min.js`, versión 0.158.0, licencia MIT en `vendor/three-LICENSE.txt`).
- Los servicios del recorrido son los bloques `<article class="station">` dentro de la sección `data-tour` de `index.html`. Para agregar o quitar una parada, agrega o borra un bloque y ajusta `--stops` (número de paradas + 2).
- `data-color="coral"` pinta ese portal en coral; sin ese atributo es cian.
- Si el visitante tiene activado "reducir movimiento" o su navegador no soporta 3D, ve los servicios como tarjetas normales.
