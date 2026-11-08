/* Configuración del mapa.
   - auto: mapa local al abrir con file:// y teselas OSM solo desde http(s).
   - local: siempre usa el mapa vectorial incluido, sin peticiones externas.
   - raster: usa tileUrl desde una web http(s); no se activa desde file://.
*/
window.PLANES_MAP_CONFIG = {
  mode: 'auto',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 18
};
