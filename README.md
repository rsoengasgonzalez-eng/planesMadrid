# Mejora visual para Planes Madrid

Este paquete corrige lo que se ve en la captura sin sustituir ni duplicar los 189 planes. Incluye `vista-previa-orientativa.png` para mostrar el estilo esperado; el resultado exacto dependerá de las clases actuales de la aplicación.

## Qué corrige

1. **Codificación UTF-8:** repara iconos mostrados como `ðŸ...`, letras como `Ã...` y otros caracteres mal interpretados.
2. **Iconos vectoriales:** sustituye los emojis rotos de las tarjetas por SVG nítidos y coherentes para Naturaleza, Cultura, Gastronomía, Ocio, Rutas y Aventura.
3. **Marcadores del mapa:** reemplaza el glifo corrupto por un marcador limpio, manteniendo el color que ya diferencia los planes.
4. **Textos de interfaz:** mejora el titular, la introducción, el buscador y varias etiquetas sin cambiar los datos de los planes.
5. **Acabado visual:** mejora tarjetas, buscador, botones, estados hover/focus, contraste y comportamiento móvil.
6. **Compatibilidad:** conserva `window.PLANES_MADRID`, los filtros, favoritos, enlaces, precios y coordenadas.

## Instalación

### 1. Copia los archivos

Copia estos dos archivos a la misma carpeta en la que está `index.html`:

- `planes-beautify.css`
- `planes-beautify.js`

### 2. Corrige la cabecera de `index.html`

La **primera etiqueta dentro de `<head>`** debe ser:

```html
<meta charset="UTF-8">
```

Es importante que aparezca antes del título, las hojas de estilo y cualquier script. Esta es la corrección principal del texto `ðŸ...` que se ve en la captura.

Después de la hoja de estilos actual, añade:

```html
<link rel="stylesheet" href="./planes-beautify.css">
```

### 3. Carga el JavaScript

El orden ideal al final de `<body>` es:

```html
<script src="./planes.js"></script>
<script src="./planes-beautify.js"></script>
<script src="./app.js"></script>
```

Si el archivo principal no se llama `app.js`, conserva su nombre real. Lo esencial es cargar `planes-beautify.js` **después del catálogo de planes**. Si no puedes cambiar el orden actual, añádelo como último script; el observador incluido corregirá también contenido renderizado después.

El archivo `index-head-snippet.html` contiene un bloque listo para copiar.

## Codificación de los archivos en GitHub

Guarda `index.html`, el catálogo de planes y los archivos JavaScript como **UTF-8**. No uses ANSI, ISO-8859-1 ni Windows-1252.

En VS Code:

1. Abre el archivo.
2. Pulsa el indicador de codificación en la esquina inferior derecha.
3. Selecciona **Save with Encoding**.
4. Elige **UTF-8**.

## Comprobación rápida tras publicar

1. Haz una recarga completa: `Ctrl+F5` o `Cmd+Shift+R`.
2. Comprueba que ya no aparece texto que empiece por `ðŸ`, `Ã`, `Â` o el símbolo `�`.
3. Verifica al menos una tarjeta de cada categoría.
4. Prueba filtros, buscador, favoritos y el control de distancia.
5. Revisa los marcadores gratis y de pago en el mapa.
6. Comprueba la vista móvil.

## Si todavía se ve la versión anterior

GitHub Pages y el navegador pueden conservar archivos en caché. Prueba una ventana privada o añade temporalmente una versión a los recursos:

```html
<link rel="stylesheet" href="./planes-beautify.css?v=2">
<script src="./planes-beautify.js?v=2"></script>
```

## Nota técnica

La solución usa SVG propios, no una librería externa. Así evita dependencias, no añade peticiones de red y los iconos conservan nitidez en pantallas de alta resolución. El reparador de texto actúa como red de seguridad; aun así, debe mantenerse `<meta charset="UTF-8">` porque corrige el problema desde el origen.
