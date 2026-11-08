# ¿Qué plan hacemos? · Madrid +80 km

Aplicación web estática y responsive para descubrir y compartir planes en Madrid y hasta 80 km alrededor.

## Inicio rápido en Windows

1. Descomprime **toda** la carpeta.
2. Haz doble clic en **`iniciar-app.bat`**.
3. Se abrirá `http://127.0.0.1:8080/` en el navegador.
4. Mantén la ventana del servidor abierta. Para terminar, pulsa `Ctrl+C`.

No hace falta instalar Node.js ni compilar. El lanzador usa PowerShell, incluido normalmente en Windows 10 y 11.

### Si abres `index.html` directamente

También funciona. La aplicación detecta `file://` y activa automáticamente un **mapa vectorial local incluido en el ZIP**. No solicita teselas externas, de modo que no aparecen errores 403. Los marcadores, filtros, favoritos, fichas y propuestas propias siguen funcionando.

El fondo local es deliberadamente esquemático. Para ver cartografía detallada, usa `iniciar-app.bat` o publica la carpeta como web.

## Por qué se corrigió el mapa

Los servidores comunitarios de teselas de OpenStreetMap requieren que las páginas web envíen un encabezado HTTP `Referer` válido. Una página abierta con `file://` normalmente no puede hacerlo y puede ser bloqueada.

Esta versión aplica tres medidas:

- **Nunca pide teselas externas desde `file://`.**
- Incluye un **mapa vectorial local de respaldo**, útil incluso sin conexión.
- Solo activa la cartografía raster cuando la app se sirve desde `http://` o `https://`, con atribución visible, URL configurable y la caché HTTP normal del navegador.

No se incluyen teselas de OpenStreetMap en el ZIP ni se descargan áreas para uso offline.

## Publicarla y compartirla por WhatsApp

### Netlify Drop — opción rápida

1. Entra en [Netlify Drop](https://app.netlify.com/drop).
2. Arrastra la carpeta `planes-madrid` completa, no el ZIP.
3. Netlify generará una URL pública HTTPS.
4. Abre esa URL y usa **Compartir** o el botón **WhatsApp** de cualquier ficha.

### GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio.
2. Ve a **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama principal y `/ (root)`.
5. Guarda y usa la URL publicada.

## Ejecutarla en macOS o Linux

```bash
chmod +x iniciar-app.sh
./iniciar-app.sh
```

También puedes utilizar cualquier servidor web estático:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Después abre `http://127.0.0.1:8080/`.

## Configuración del proveedor cartográfico

Edita `config.js`:

```js
window.PLANES_MAP_CONFIG = {
  mode: 'auto',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors',
  maxZoom: 18
};
```

Modos disponibles:

- `auto`: mapa local con `file://`; proveedor raster con `http://` o `https://`.
- `local`: mapa vectorial incluido en todos los casos, sin peticiones cartográficas externas.
- `raster`: proveedor configurado al servir la página por HTTP(S); por seguridad sigue usando el mapa local con `file://`.

Para un proyecto con tráfico considerable o requisitos de disponibilidad, sustituye `tileUrl` y `attribution` por los de un proveedor comercial o por infraestructura propia, respetando sus condiciones y claves API.

## Funciones incluidas

- 21 propuestas iniciales dentro de 80 km.
- Búsqueda y filtros por distancia, precio y categoría.
- Favoritos guardados en el navegador.
- Fichas con presupuesto, duración, información y ubicación.
- Propuestas propias seleccionando un punto del mapa.
- Mensajes preparados para WhatsApp.
- Diseño móvil y PWA instalable.
- Mapa local funcional sin conexión y mapa detallado al servirse como web.

## Personalizar los planes

Edita `data.js`. Ejemplo:

```js
{
  id: 'identificador-unico',
  title: 'Nombre del plan',
  category: 'nature', // nature, culture, food, adventure, leisure o route
  priceType: 'free',  // free o paid
  priceLabel: 'Gratis',
  town: 'Localidad',
  lat: 40.4168,
  lng: -3.7038,
  duration: '2–3 h',
  description: 'Descripción breve',
  notes: 'Recomendaciones para el grupo',
  url: 'https://sitio-oficial.example',
  icon: '🌿',
  featured: 8
}
```

## Privacidad y alcance

- El radio se calcula en línea recta desde el centro de Madrid.
- Favoritos y propuestas propias se guardan en `localStorage` y no se sincronizan.
- La geolocalización solo se solicita al pulsar **Mi ubicación**.
- Antes de salir, confirma horarios, precios, reservas, accesos y meteorología en los enlaces oficiales.
