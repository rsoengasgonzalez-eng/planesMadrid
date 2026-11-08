/* Visor cartográfico ligero incluido con la app.
   Usa un mapa vectorial local como base y añade teselas solo cuando la página se sirve por HTTP(S). */
(() => {
  'use strict';

  const TILE = 256;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const latLng = value => Array.isArray(value)
    ? { lat: Number(value[0]), lng: Number(value[1]) }
    : { lat: Number(value.lat), lng: Number(value.lng) };
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const project = (point, zoom) => {
    point = latLng(point);
    const scale = TILE * 2 ** zoom;
    const sin = clamp(Math.sin(point.lat * Math.PI / 180), -.9999, .9999);
    return {
      x: (point.lng + 180) / 360 * scale,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    };
  };
  const unproject = (point, zoom) => {
    const scale = TILE * 2 ** zoom;
    const lng = point.x / scale * 360 - 180;
    const n = Math.PI - 2 * Math.PI * point.y / scale;
    return { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lng };
  };

  const LOCAL_MAP = {
    boundary: [
      [41.16,-4.20],[41.05,-3.45],[40.88,-3.02],[40.48,-3.00],[40.00,-3.18],
      [39.82,-3.78],[40.05,-4.20],[40.53,-4.58],[40.95,-4.48],[41.16,-4.20]
    ],
    river: [[40.88,-3.88],[40.72,-3.90],[40.53,-3.76],[40.42,-3.72],[40.28,-3.62],[40.05,-3.61],[39.86,-3.58]],
    roads: [
      { name:'A-1', points:[[40.42,-3.70],[40.55,-3.63],[40.73,-3.58],[40.99,-3.64]] },
      { name:'A-2', points:[[40.42,-3.70],[40.45,-3.57],[40.48,-3.36],[40.57,-3.16]] },
      { name:'A-3', points:[[40.42,-3.70],[40.31,-3.52],[40.20,-3.30],[40.10,-3.12]] },
      { name:'A-4', points:[[40.42,-3.70],[40.28,-3.69],[40.04,-3.61],[39.86,-3.62]] },
      { name:'A-5', points:[[40.42,-3.70],[40.32,-3.86],[40.29,-4.02],[40.23,-4.18]] },
      { name:'A-6', points:[[40.42,-3.70],[40.49,-3.87],[40.59,-4.15],[40.74,-4.06]] },
      { name:'M-607', points:[[40.42,-3.70],[40.60,-3.71],[40.73,-3.86],[40.79,-4.00]] }
    ],
    towns: [
      { name:'Madrid', lat:40.4168, lng:-3.7038, major:true },
      { name:'Alcalá de Henares', lat:40.4819, lng:-3.3635, major:true },
      { name:'Aranjuez', lat:40.0360, lng:-3.6080, major:true },
      { name:'El Escorial', lat:40.5890, lng:-4.1477, major:true },
      { name:'Cercedilla', lat:40.7410, lng:-4.0567 },
      { name:'Rascafría', lat:40.9036, lng:-3.8794 },
      { name:'Buitrago', lat:40.9947, lng:-3.6368 },
      { name:'Patones', lat:40.8553, lng:-3.4840 },
      { name:'Chinchón', lat:40.1401, lng:-3.4227 },
      { name:'Navacerrada', lat:40.7888, lng:-4.0038 },
      { name:'Toledo', lat:39.8570, lng:-4.0242, major:true },
      { name:'Segovia', lat:40.9481, lng:-4.1184, major:true }
    ]
  };

  class Bounds {
    constructor(points) {
      const values = points.map(latLng);
      this.south = Math.min(...values.map(point => point.lat));
      this.north = Math.max(...values.map(point => point.lat));
      this.west = Math.min(...values.map(point => point.lng));
      this.east = Math.max(...values.map(point => point.lng));
    }
    pad(ratio) {
      const dLat = Math.max(this.north - this.south, .01) * ratio;
      const dLng = Math.max(this.east - this.west, .01) * ratio;
      return new Bounds([[this.south - dLat, this.west - dLng], [this.north + dLat, this.east + dLng]]);
    }
  }

  class MiniMap {
    constructor(id, options = {}) {
      this.el = typeof id === 'string' ? document.getElementById(id) : id;
      this.options = options;
      this.center = { lat: 40.4168, lng: -3.7038 };
      this.zoom = 9;
      this.minZoom = options.minZoom ?? 3;
      this.maxZoom = options.maxZoom ?? 18;
      this.handlers = {};
      this.layers = new Set();
      this.tiles = new Map();
      this.tilesEnabled = false;
      this.tileTemplate = '';
      this.attribution = 'Mapa local orientativo';
      this._build();
      this._bind();
      window.addEventListener('resize', () => this.render(), { passive: true });
    }

    _build() {
      this.el.classList.add('leaflet-container', 'mini-map');
      this.el.innerHTML = [
        '<div class="mini-map-grid"></div>',
        '<svg class="mini-local-base" aria-hidden="true"></svg>',
        '<div class="mini-tiles"></div>',
        '<svg class="mini-overlay" aria-hidden="true"></svg>',
        '<div class="mini-markers"></div>',
        '<div class="mini-zoom"><button type="button" aria-label="Acercar">+</button><button type="button" aria-label="Alejar">−</button></div>',
        '<div class="leaflet-control-attribution">Mapa local orientativo</div>'
      ].join('');
      this.localBase = this.el.querySelector('.mini-local-base');
      this.tilePane = this.el.querySelector('.mini-tiles');
      this.overlay = this.el.querySelector('.mini-overlay');
      this.markerPane = this.el.querySelector('.mini-markers');
      this.attributionEl = this.el.querySelector('.leaflet-control-attribution');
      const [zoomIn, zoomOut] = this.el.querySelectorAll('.mini-zoom button');
      zoomIn.addEventListener('click', event => { event.stopPropagation(); this.setView(this.center, this.zoom + 1); });
      zoomOut.addEventListener('click', event => { event.stopPropagation(); this.setView(this.center, this.zoom - 1); });
    }

    _bind() {
      let drag = null;
      this.el.addEventListener('pointerdown', event => {
        if (event.target.closest('button, a, .plan-marker, .mini-popup')) return;
        this.el.setPointerCapture?.(event.pointerId);
        drag = { x: event.clientX, y: event.clientY, center: project(this.center, this.zoom), moved: false };
        this.el.classList.add('is-dragging');
      });
      this.el.addEventListener('pointermove', event => {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        this.center = unproject({ x: drag.center.x - dx, y: drag.center.y - dy }, this.zoom);
        this.render();
      });
      const finish = event => {
        if (!drag) return;
        const wasMoved = drag.moved;
        drag = null;
        this.el.classList.remove('is-dragging');
        if (!wasMoved) {
          const rect = this.el.getBoundingClientRect();
          const centerPx = project(this.center, this.zoom);
          const point = unproject({
            x: centerPx.x + event.clientX - rect.left - rect.width / 2,
            y: centerPx.y + event.clientY - rect.top - rect.height / 2
          }, this.zoom);
          this._fire('click', { latlng: point, originalEvent: event });
        }
      };
      this.el.addEventListener('pointerup', finish);
      this.el.addEventListener('pointercancel', () => { drag = null; this.el.classList.remove('is-dragging'); });
      this.el.addEventListener('wheel', event => {
        event.preventDefault();
        this.setView(this.center, this.zoom + (event.deltaY < 0 ? 1 : -1));
      }, { passive: false });
      this.el.addEventListener('dblclick', event => { event.preventDefault(); this.setView(this.center, this.zoom + 1); });
    }

    setView(center, zoom = this.zoom) {
      this.center = latLng(center);
      this.zoom = clamp(Math.round(zoom), this.minZoom, this.maxZoom);
      this.render();
      return this;
    }
    getZoom() { return this.zoom; }
    on(type, handler) { (this.handlers[type] ||= []).push(handler); return this; }
    _fire(type, event) { (this.handlers[type] || []).forEach(handler => handler(event)); }
    _remove(layer) {
      this.layers.delete(layer);
      layer._el?.remove();
      layer._shape?.remove();
      if (this.popupOwner === layer) this.closePopup();
      this.render();
    }
    fitBounds(bounds, options = {}) {
      const rect = this.el.getBoundingClientRect();
      let chosen = this.minZoom;
      for (let zoom = Math.min(options.maxZoom ?? this.maxZoom, this.maxZoom); zoom >= this.minZoom; zoom--) {
        const nw = project({ lat: bounds.north, lng: bounds.west }, zoom);
        const se = project({ lat: bounds.south, lng: bounds.east }, zoom);
        if (Math.abs(se.x - nw.x) <= rect.width * .82 && Math.abs(se.y - nw.y) <= rect.height * .82) { chosen = zoom; break; }
      }
      return this.setView({ lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }, chosen);
    }

    _renderLocalBase(width, height) {
      const point = value => this._screenPoint(value);
      const path = values => values.map((value, index) => {
        const p = point(value);
        return `${index ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' ');
      const boundary = path(LOCAL_MAP.boundary);
      const river = path(LOCAL_MAP.river);
      const roads = LOCAL_MAP.roads.map(road => `<path class="local-road-casing" d="${path(road.points)}"/><path class="local-road" d="${path(road.points)}"/>`).join('');
      const roadLabels = this.zoom >= 9 ? LOCAL_MAP.roads.map(road => {
        const p = point(road.points[Math.floor(road.points.length / 2)]);
        return `<text class="local-road-label" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}">${esc(road.name)}</text>`;
      }).join('') : '';
      const towns = LOCAL_MAP.towns.filter(town => town.major || this.zoom >= 9).map(town => {
        const p = point(town);
        const klass = town.major ? 'major' : 'minor';
        return `<g class="local-town ${klass}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><circle r="${town.major ? 4 : 2.5}"/><text x="7" y="3">${esc(town.name)}</text></g>`;
      }).join('');
      this.localBase.setAttribute('viewBox', `0 0 ${width} ${height}`);
      this.localBase.setAttribute('width', width);
      this.localBase.setAttribute('height', height);
      this.localBase.innerHTML = `<path class="local-region" d="${boundary}Z"/><path class="local-river" d="${river}"/>${roads}${roadLabels}${towns}`;
    }

    _renderTiles(width, height) {
      const centerPx = project(this.center, this.zoom);
      const left = centerPx.x - width / 2;
      const top = centerPx.y - height / 2;
      const tileMinX = Math.floor(left / TILE), tileMaxX = Math.floor((left + width) / TILE);
      const tileMinY = Math.floor(top / TILE), tileMaxY = Math.floor((top + height) / TILE);
      const worldTiles = 2 ** this.zoom;
      const visible = new Set();

      if (this.tilesEnabled && this.tileTemplate) {
        for (let tx = tileMinX; tx <= tileMaxX; tx++) for (let ty = tileMinY; ty <= tileMaxY; ty++) {
          if (ty < 0 || ty >= worldTiles) continue;
          const wrappedX = ((tx % worldTiles) + worldTiles) % worldTiles;
          const key = `${this.zoom}/${tx}/${ty}`;
          visible.add(key);
          let image = this.tiles.get(key);
          if (!image) {
            image = document.createElement('img');
            image.alt = '';
            image.draggable = false;
            image.decoding = 'async';
            image.loading = 'eager';
            image.referrerPolicy = 'strict-origin-when-cross-origin';
            image.src = this.tileTemplate
              .replace('{z}', this.zoom)
              .replace('{x}', wrappedX)
              .replace('{y}', ty);
            image.addEventListener('error', () => image.remove());
            this.tilePane.appendChild(image);
            this.tiles.set(key, image);
          }
          image.style.transform = `translate(${Math.round(tx * TILE - left)}px, ${Math.round(ty * TILE - top)}px)`;
        }
      }
      for (const [key, image] of this.tiles) {
        if (!visible.has(key) || !image.isConnected) { image.remove(); this.tiles.delete(key); }
      }
    }

    render() {
      if (!this.el.isConnected) return;
      const width = this.el.clientWidth;
      const height = this.el.clientHeight;
      if (!width || !height) return;
      this._renderLocalBase(width, height);
      this._renderTiles(width, height);
      this.overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
      this.overlay.setAttribute('width', width);
      this.overlay.setAttribute('height', height);
      for (const layer of this.layers) layer._render?.({ zoom: this.zoom, width, height });
      if (this.popupOwner) this._positionPopup(this.popupOwner);
    }

    openPopup(layer) {
      this.closePopup();
      if (!layer.popup) return;
      this.popupOwner = layer;
      this.popup = document.createElement('div');
      this.popup.className = 'mini-popup leaflet-popup-content-wrapper';
      this.popup.innerHTML = `<button class="mini-popup-close" type="button" aria-label="Cerrar">×</button><div class="leaflet-popup-content">${layer.popup}</div>`;
      this.popup.querySelector('.mini-popup-close').addEventListener('click', event => { event.stopPropagation(); this.closePopup(); });
      this.markerPane.appendChild(this.popup);
      this._positionPopup(layer);
    }
    _positionPopup(layer) {
      if (!this.popup) return;
      const point = this._screenPoint(layer.point);
      this.popup.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y - (layer.icon?.options?.iconSize?.[1] || 20) - 12)}px) translate(-50%, -100%)`;
    }
    closePopup() { this.popup?.remove(); this.popup = null; this.popupOwner = null; }
    _screenPoint(point) {
      const projected = project(point, this.zoom);
      const center = project(this.center, this.zoom);
      return {
        x: this.el.clientWidth / 2 + projected.x - center.x,
        y: this.el.clientHeight / 2 + projected.y - center.y
      };
    }
  }

  class TileLayer {
    constructor(template, options = {}) { this.template = template; this.options = options; }
    addTo(map) {
      map.tileTemplate = this.template;
      map.tilesEnabled = Boolean(this.template);
      map.attribution = this.options.attribution || map.attribution;
      map.attributionEl.innerHTML = map.attribution;
      map.render();
      return this;
    }
  }

  class LayerGroup {
    constructor() { this.layers = new Set(); this._map = null; }
    addTo(map) { this._map = map; this.layers.forEach(layer => layer.addTo(map)); return this; }
    _add(layer) { this.layers.add(layer); if (this._map) layer.addTo(this._map); }
    clearLayers() { this.layers.forEach(layer => layer.remove()); this.layers.clear(); }
  }

  class Marker {
    constructor(point, options = {}) { this.point = latLng(point); this.options = options; this.icon = options.icon; this.handlers = {}; }
    addTo(target) {
      if (target instanceof LayerGroup) { target._add(this); return this; }
      this._map = target;
      target.layers.add(this);
      this._create();
      target.render();
      return this;
    }
    _create() {
      if (this._el) return;
      this._el = document.createElement('div');
      this._el.className = 'mini-marker';
      this._el.innerHTML = this.icon?.options?.html || '<span class="mini-default-marker"></span>';
      if (this.options.title) this._el.title = this.options.title;
      this._el.addEventListener('click', event => {
        event.stopPropagation();
        this._fire('click', { target: this, originalEvent: event });
        if (this.popup) this.openPopup();
      });
      this._map.markerPane.appendChild(this._el);
    }
    _render() {
      this._create();
      const point = this._map._screenPoint(this.point);
      const anchor = this.icon?.options?.iconAnchor || [10, 20];
      this._el.style.transform = `translate(${Math.round(point.x - anchor[0])}px, ${Math.round(point.y - anchor[1])}px)`;
    }
    bindPopup(content) { this.popup = content; return this; }
    bindTooltip(content) { this.options.title = content; if (this._el) this._el.title = content; return this; }
    on(type, handler) { (this.handlers[type] ||= []).push(handler); return this; }
    _fire(type, event) { (this.handlers[type] || []).forEach(handler => handler(event)); }
    getLatLng() { return { ...this.point }; }
    openPopup() { this._map?.openPopup(this); return this; }
    remove() { this._map?._remove(this); this._el?.remove(); return this; }
  }

  class Circle extends Marker {
    constructor(point, options = {}) { super(point, options); this.radiusMeters = options.radius || 0; }
    addTo(map) {
      this._map = map;
      map.layers.add(this);
      this._shape = document.createElementNS(NS, 'circle');
      map.overlay.appendChild(this._shape);
      map.render();
      return this;
    }
    _render({ zoom }) {
      const point = this._map._screenPoint(this.point);
      const metersPerPixel = 156543.03392 * Math.cos(this.point.lat * Math.PI / 180) / 2 ** zoom;
      const radius = this.radiusMeters / metersPerPixel;
      this._shape.setAttribute('cx', point.x);
      this._shape.setAttribute('cy', point.y);
      this._shape.setAttribute('r', radius);
      this._shape.setAttribute('fill', this.options.fillColor || this.options.color || '#6f4bf2');
      this._shape.setAttribute('fill-opacity', this.options.fillOpacity ?? .08);
      this._shape.setAttribute('stroke', this.options.color || '#6f4bf2');
      this._shape.setAttribute('stroke-width', this.options.weight || 1.5);
      this._shape.setAttribute('stroke-opacity', this.options.opacity ?? .6);
      if (this.options.dashArray) this._shape.setAttribute('stroke-dasharray', this.options.dashArray);
    }
    setRadius(radius) { this.radiusMeters = radius; this._map?.render(); return this; }
  }

  class CircleMarker extends Marker {
    _create() {
      if (this._el) return;
      const size = (this.options.radius || 6) * 2 + (this.options.weight || 2) * 2;
      this.icon = { options: { iconAnchor: [size / 2, size / 2], iconSize: [size, size] } };
      this._el = document.createElement('div');
      this._el.className = 'mini-circle-marker';
      Object.assign(this._el.style, {
        width: `${size}px`, height: `${size}px`,
        border: `${this.options.weight || 2}px solid ${this.options.color || '#fff'}`,
        background: this.options.fillColor || '#201a45', opacity: this.options.fillOpacity ?? 1
      });
      this._el.addEventListener('click', event => { event.stopPropagation(); this._fire('click', { target: this }); if (this.popup) this.openPopup(); });
      this._map.markerPane.appendChild(this._el);
    }
  }

  window.L = {
    map: (id, options) => new MiniMap(id, options),
    tileLayer: (template, options) => new TileLayer(template, options),
    layerGroup: () => new LayerGroup(),
    marker: (point, options) => new Marker(point, options),
    circle: (point, options) => new Circle(point, options),
    circleMarker: (point, options) => new CircleMarker(point, options),
    divIcon: options => ({ options }),
    latLngBounds: points => new Bounds(points)
  };
})();
