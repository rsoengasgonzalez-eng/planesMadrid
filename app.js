(() => {
  'use strict';

  const MADRID = { lat: 40.4168, lng: -3.7038 };
  const MAP_CONFIG = window.PLANES_MAP_CONFIG || {};
  const QUERY = new URLSearchParams(location.search);
  const IS_FILE = location.protocol === 'file:';
  const MAP_MODE = IS_FILE || MAP_CONFIG.mode === 'local' || QUERY.has('offline') || QUERY.get('map') === 'local'
    ? 'local'
    : 'raster';
  const CATEGORIES = {
    nature: { label: 'Naturaleza', icon: '🌿' },
    culture: { label: 'Cultura', icon: '🎭' },
    food: { label: 'Gastronomía', icon: '🍴' },
    adventure: { label: 'Aventura', icon: '🥾' },
    leisure: { label: 'Ocio', icon: '🎡' },
    route: { label: 'Escapadas', icon: '🧭' }
  };
  const STORAGE = {
    favorites: 'planesMadrid:favorites',
    custom: 'planesMadrid:customPlans'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const safeUrl = value => /^https?:\/\//i.test(value || '') ? value : '';
  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const saveJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { showToast('No se pudo guardar en este navegador'); }
  };

  const state = {
    query: '', price: 'all', maxDistance: 80, category: 'all',
    favoritesOnly: false, sort: 'recommended', activeId: null,
    favorites: new Set(readJSON(STORAGE.favorites, [])),
    customPlans: readJSON(STORAGE.custom, []),
    filtered: [], pickingLocation: false
  };

  let map;
  let markersLayer;
  let radiusCircle;
  let locationMarker;
  let pickMarker;
  let toastTimer;
  const markerById = new Map();

  const elements = {
    sidebar: $('.sidebar'), list: $('#planList'), empty: $('#emptyState'),
    count: $('#resultCount'), mobileCount: $('#mobileCount'), summary: $('#activeSummary'),
    search: $('#searchInput'), distance: $('#distanceRange'), distanceValue: $('#distanceValue'),
    categories: $('#categoryFilters'), sort: $('#sortSelect'), favoritesToggle: $('#favoritesToggle'),
    detailDialog: $('#detailDialog'), detailContent: $('#detailContent'),
    addDialog: $('#addDialog'), addForm: $('#addPlanForm'), pickedLocation: $('#pickedLocation'),
    mapModeBadge: $('#mapModeBadge'), mapModeText: $('#mapModeText'),
    toast: $('#toast')
  };

  function distanceKm(a, b) {
    const rad = degrees => degrees * Math.PI / 180;
    const R = 6371;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function allPlans() {
    return [...window.PLANES_MADRID, ...state.customPlans].map(plan => ({
      ...plan,
      custom: Boolean(plan.custom),
      distance: distanceKm(MADRID, plan)
    }));
  }

  function initCategories() {
    elements.categories.innerHTML = [
      '<button class="category-chip is-active" data-category="all" type="button">✦ Todas</button>',
      ...Object.entries(CATEGORIES).map(([key, category]) => `<button class="category-chip" data-category="${key}" type="button">${category.icon} ${category.label}</button>`)
    ].join('');

    const categorySelect = elements.addForm.elements.category;
    categorySelect.innerHTML = Object.entries(CATEGORIES).map(([key, category]) => `<option value="${key}">${category.icon} ${category.label}</option>`).join('');
  }

  function initMap() {
    map = L.map('map', { zoomControl: true, minZoom: 7, maxZoom: 18 }).setView([MADRID.lat, MADRID.lng], 9);
    if (MAP_MODE === 'raster' && /^https:\/\//i.test(MAP_CONFIG.tileUrl || '')) {
      L.tileLayer(MAP_CONFIG.tileUrl, {
        maxZoom: MAP_CONFIG.maxZoom || 18,
        attribution: MAP_CONFIG.attribution || '© OpenStreetMap contributors'
      }).addTo(map);
      elements.mapModeText.textContent = 'Mapa detallado';
      elements.mapModeBadge.classList.add('is-online');
    } else {
      elements.mapModeText.textContent = IS_FILE ? 'Mapa local · abre iniciar-app.bat para más detalle' : 'Mapa local';
      elements.mapModeBadge.classList.add('is-local');
      document.body.classList.add('local-map-mode');
    }
    markersLayer = L.layerGroup().addTo(map);
    radiusCircle = L.circle([MADRID.lat, MADRID.lng], {
      radius: state.maxDistance * 1000,
      color: '#6f4bf2', weight: 1.5, opacity: .55,
      fillColor: '#6f4bf2', fillOpacity: .035, dashArray: '5 7', interactive: false
    }).addTo(map);

    L.circleMarker([MADRID.lat, MADRID.lng], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#201a45', fillOpacity: 1
    }).addTo(map).bindTooltip('Centro de Madrid', { direction: 'top' });

    map.on('click', event => {
      if (!state.pickingLocation) return;
      state.pickingLocation = false;
      const { lat, lng } = event.latlng;
      elements.addForm.elements.lat.value = lat.toFixed(6);
      elements.addForm.elements.lng.value = lng.toFixed(6);
      elements.pickedLocation.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (pickMarker) pickMarker.remove();
      pickMarker = L.marker([lat, lng], { opacity: .8 }).addTo(map);
      document.body.classList.remove('is-picking');
      elements.addDialog.showModal();
      showToast('Ubicación seleccionada');
    });

    $('#map').addEventListener('click', event => {
      const detailButton = event.target.closest('[data-popup-plan]');
      if (detailButton) openDetail(detailButton.dataset.popupPlan);
    });
  }

  function getFilteredPlans() {
    const query = state.query.trim().toLocaleLowerCase('es');
    const plans = allPlans().filter(plan => {
      const matchesQuery = !query || [plan.title, plan.town, plan.description, CATEGORIES[plan.category]?.label]
        .join(' ').toLocaleLowerCase('es').includes(query);
      const matchesPrice = state.price === 'all' || plan.priceType === state.price;
      const matchesDistance = plan.distance <= state.maxDistance;
      const matchesCategory = state.category === 'all' || plan.category === state.category;
      const matchesFavorite = !state.favoritesOnly || state.favorites.has(plan.id);
      return matchesQuery && matchesPrice && matchesDistance && matchesCategory && matchesFavorite;
    });

    const sorters = {
      recommended: (a, b) => (b.featured || 5) - (a.featured || 5) || a.distance - b.distance,
      distance: (a, b) => a.distance - b.distance,
      price: (a, b) => (a.priceType === b.priceType ? a.distance - b.distance : a.priceType === 'free' ? -1 : 1),
      name: (a, b) => a.title.localeCompare(b.title, 'es')
    };
    return plans.sort(sorters[state.sort]);
  }

  function render() {
    state.filtered = getFilteredPlans();
    renderList();
    renderMarkers();
    renderCounts();
  }

  function renderCounts() {
    const total = state.filtered.length;
    elements.count.textContent = `${total} ${total === 1 ? 'plan' : 'planes'}`;
    elements.mobileCount.textContent = total;
    elements.summary.textContent = state.favoritesOnly ? 'solo favoritos' : `hasta ${state.maxDistance} km`;
    elements.empty.hidden = total !== 0;
    elements.list.hidden = total === 0;
  }

  function renderList() {
    elements.list.innerHTML = state.filtered.map(plan => {
      const category = CATEGORIES[plan.category];
      const favorite = state.favorites.has(plan.id);
      return `
        <article class="plan-card ${state.activeId === plan.id ? 'is-active' : ''}" data-plan-id="${esc(plan.id)}" tabindex="0" aria-label="Ver ${esc(plan.title)}">
          <div class="plan-art art-${esc(plan.category)}"><span aria-hidden="true">${esc(plan.icon || category.icon)}</span></div>
          <div class="plan-info">
            <div class="card-topline"><span class="type-badge ${plan.priceType}">${plan.priceType === 'free' ? 'Gratis' : 'De pago'}</span><span class="card-category">${esc(category.label)}${plan.custom ? ' · Tu propuesta' : ''}</span></div>
            <h3>${esc(plan.title)}</h3>
            <p class="card-description">${esc(plan.description)}</p>
            <div class="card-meta"><span>⌖ ${formatDistance(plan.distance)}</span><i class="meta-sep"></i><span>${esc(plan.town)}</span><i class="meta-sep"></i><span>${esc(plan.duration || 'Flexible')}</span></div>
          </div>
          <button class="fav-button ${favorite ? 'is-favorite' : ''}" data-favorite-id="${esc(plan.id)}" type="button" aria-label="${favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button>
        </article>`;
    }).join('');
  }

  function renderMarkers() {
    markersLayer.clearLayers();
    markerById.clear();
    state.filtered.forEach(plan => {
      const category = CATEGORIES[plan.category];
      const icon = L.divIcon({
        className: '',
        html: `<div class="plan-marker ${plan.priceType} ${plan.custom ? 'is-custom' : ''}"><span>${esc(plan.icon || category.icon)}</span></div>`,
        iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -35]
      });
      const marker = L.marker([plan.lat, plan.lng], { icon, title: plan.title }).addTo(markersLayer);
      marker.bindPopup(`<div class="popup-title">${esc(plan.title)}</div><div class="popup-meta">${formatDistance(plan.distance)} · ${esc(plan.priceLabel)}</div><button class="popup-link" data-popup-plan="${esc(plan.id)}" type="button">Ver el plan →</button>`);
      marker.on('click', () => setActive(plan.id, false));
      markerById.set(plan.id, marker);
    });
  }

  function formatDistance(value) {
    return value < 10 ? `${value.toFixed(1).replace('.', ',')} km` : `${Math.round(value)} km`;
  }

  function setActive(id, pan = true) {
    state.activeId = id;
    $$('.plan-card').forEach(card => card.classList.toggle('is-active', card.dataset.planId === id));
    if (pan) {
      const marker = markerById.get(id);
      if (marker) {
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 11), { animate: true });
        marker.openPopup();
      }
    }
  }

  function openDetail(id) {
    const plan = allPlans().find(item => item.id === id);
    if (!plan) return;
    const category = CATEGORIES[plan.category];
    const favorite = state.favorites.has(plan.id);
    const dateFact = plan.date ? `<div class="fact"><small>Fecha propuesta</small><strong>${esc(formatDate(plan.date))}</strong></div>` : '';
    elements.detailContent.innerHTML = `
      <div class="detail-hero art-${esc(plan.category)}">
        <div class="detail-title"><span class="type-badge ${plan.priceType}">${plan.priceType === 'free' ? 'Gratis' : 'De pago'}</span><h2>${esc(plan.title)}</h2></div>
        <span class="detail-emoji" aria-hidden="true">${esc(plan.icon || category.icon)}</span>
      </div>
      <div class="detail-body">
        <p class="detail-description">${esc(plan.description)}</p>
        <div class="detail-facts">
          <div class="fact"><small>Distancia</small><strong>${formatDistance(plan.distance)}</strong></div>
          <div class="fact"><small>Localidad</small><strong>${esc(plan.town)}</strong></div>
          <div class="fact"><small>Presupuesto</small><strong>${esc(plan.priceLabel)}</strong></div>
          <div class="fact"><small>Duración</small><strong>${esc(plan.duration || 'Flexible')}</strong></div>
          ${dateFact}
        </div>
        <div class="detail-notes"><strong>Antes de ir:</strong> ${esc(plan.notes || 'Confirma con el grupo los detalles, el transporte y la disponibilidad.')}</div>
        <div class="detail-actions">
          <button class="button whatsapp" data-share-plan="${esc(plan.id)}" type="button">WhatsApp</button>
          <button class="button button-secondary" data-detail-favorite="${esc(plan.id)}" type="button">${favorite ? '♥ Guardado' : '♡ Guardar'}</button>
          ${safeUrl(plan.url) ? `<a class="button button-ghost source-link" href="${esc(plan.url)}" target="_blank" rel="noopener noreferrer">Info oficial ↗</a>` : `<a class="button button-ghost source-link" href="https://www.google.com/maps/search/?api=1&query=${plan.lat},${plan.lng}" target="_blank" rel="noopener noreferrer">Ver mapa ↗</a>`}
          ${plan.custom ? `<button class="button delete-plan" data-delete-plan="${esc(plan.id)}" type="button">Eliminar</button>` : ''}
        </div>
      </div>`;
    setActive(id, false);
    if (!elements.detailDialog.open) elements.detailDialog.showModal();
    history.replaceState(null, '', `#plan=${encodeURIComponent(id)}`);
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    saveJSON(STORAGE.favorites, [...state.favorites]);
    render();
    if (elements.detailDialog.open) openDetail(id);
    showToast(state.favorites.has(id) ? 'Guardado en favoritos' : 'Quitado de favoritos');
  }

  function sharePlan(id) {
    const plan = allPlans().find(item => item.id === id);
    if (!plan) return;
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${plan.lat},${plan.lng}`;
    const appLink = location.protocol.startsWith('http') ? `${location.origin}${location.pathname}${plan.custom ? '' : `#plan=${encodeURIComponent(plan.id)}`}` : '';
    const date = plan.date ? `\n📅 ${formatDate(plan.date)}` : '';
    const text = [
      `*¿Qué os parece este plan?*`,
      `\n${plan.icon || CATEGORIES[plan.category].icon} *${plan.title}*`,
      `📍 ${plan.town} · ${formatDistance(plan.distance)}`,
      `💶 ${plan.priceLabel} · ⏱ ${plan.duration || 'Flexible'}${date}`,
      `\n${plan.description}`,
      `\n🗺️ ${mapsLink}`,
      appLink ? `🔎 Ver ficha: ${appLink}` : ''
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function shareApp() {
    const data = {
      title: '¿Qué plan hacemos? · Madrid +80 km',
      text: 'He encontrado este mapa para elegir planes en Madrid y alrededores. ¿Cuál hacemos?',
      url: location.href.split('#')[0]
    };
    if (navigator.share && location.protocol.startsWith('http')) {
      navigator.share(data).catch(() => {});
    } else if (location.protocol.startsWith('http')) {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${data.text}\n${data.url}`)}`, '_blank', 'noopener,noreferrer');
    } else {
      showToast('Publica la app para poder compartir su enlace');
    }
  }

  function deleteCustomPlan(id) {
    state.customPlans = state.customPlans.filter(plan => plan.id !== id);
    state.favorites.delete(id);
    saveJSON(STORAGE.custom, state.customPlans);
    saveJSON(STORAGE.favorites, [...state.favorites]);
    elements.detailDialog.close();
    history.replaceState(null, '', location.pathname + location.search);
    render();
    showToast('Propuesta eliminada');
  }

  function resetFilters() {
    state.query = '';
    state.price = 'all';
    state.maxDistance = 80;
    state.category = 'all';
    state.favoritesOnly = false;
    state.sort = 'recommended';
    elements.search.value = '';
    elements.distance.value = 80;
    elements.distanceValue.textContent = '80 km';
    elements.sort.value = 'recommended';
    radiusCircle.setRadius(80000);
    $$('.chip[data-price]').forEach(button => button.classList.toggle('is-active', button.dataset.price === 'all'));
    $$('.category-chip').forEach(button => button.classList.toggle('is-active', button.dataset.category === 'all'));
    elements.favoritesToggle.setAttribute('aria-pressed', 'false');
    render();
    fitFiltered();
  }

  function fitFiltered() {
    if (!state.filtered.length) return;
    const points = state.filtered.map(plan => [plan.lat, plan.lng]);
    map.fitBounds(L.latLngBounds(points).pad(.12), { maxZoom: 11, animate: true });
  }

  function locateUser() {
    if (!navigator.geolocation) return showToast('La ubicación no está disponible');
    showToast('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(position => {
      const point = [position.coords.latitude, position.coords.longitude];
      if (locationMarker) locationMarker.remove();
      locationMarker = L.circleMarker(point, { radius: 8, color: '#fff', weight: 3, fillColor: '#6f4bf2', fillOpacity: 1 }).addTo(map).bindPopup('Estás aquí').openPopup();
      map.setView(point, 12);
      showToast('Ubicación encontrada');
    }, () => showToast('No se pudo obtener tu ubicación'), { enableHighAccuracy: true, timeout: 8000 });
  }

  function startLocationPick() {
    state.pickingLocation = true;
    elements.addDialog.close();
    elements.sidebar.classList.remove('is-open');
    document.body.classList.add('is-picking');
    showToast('Toca el mapa donde será el plan');
  }

  function saveCustomPlan(form) {
    const data = new FormData(form);
    const lat = Number(data.get('lat'));
    const lng = Number(data.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showToast('Elige la ubicación en el mapa');
      return false;
    }
    const category = data.get('category');
    const priceType = data.get('priceType');
    const plan = {
      id: `custom-${Date.now().toString(36)}`,
      title: data.get('title').trim(), category, priceType,
      priceLabel: data.get('priceLabel').trim() || (priceType === 'free' ? 'Gratis' : 'Precio por confirmar'),
      town: data.get('town').trim(), lat, lng,
      duration: data.get('duration').trim() || 'Flexible',
      audience: 'Grupo', description: data.get('description').trim(),
      notes: 'Propuesta del grupo. Confirmad entre todos los detalles antes de ir.',
      url: safeUrl(data.get('url').trim()), date: data.get('date'),
      icon: CATEGORIES[category].icon, featured: 11, custom: true
    };
    if (distanceKm(MADRID, plan) > 80) {
      showToast('La ubicación debe estar a menos de 80 km de Madrid');
      return false;
    }
    state.customPlans.unshift(plan);
    saveJSON(STORAGE.custom, state.customPlans);
    form.reset();
    form.elements.lat.value = '';
    form.elements.lng.value = '';
    elements.pickedLocation.textContent = 'Aún no seleccionada';
    if (pickMarker) { pickMarker.remove(); pickMarker = null; }
    render();
    map.setView([lat, lng], 12);
    openDetail(plan.id);
    showToast('Plan añadido al mapa');
    return true;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2600);
  }

  function bindEvents() {
    elements.search.addEventListener('input', event => { state.query = event.target.value; render(); });
    elements.distance.addEventListener('input', event => {
      state.maxDistance = Number(event.target.value);
      elements.distanceValue.textContent = `${state.maxDistance} km`;
      radiusCircle.setRadius(state.maxDistance * 1000);
      render();
    });
    elements.sort.addEventListener('change', event => { state.sort = event.target.value; render(); });

    $$('.chip[data-price]').forEach(button => button.addEventListener('click', () => {
      state.price = button.dataset.price;
      $$('.chip[data-price]').forEach(item => item.classList.toggle('is-active', item === button));
      render();
    }));
    elements.categories.addEventListener('click', event => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.category = button.dataset.category;
      $$('.category-chip').forEach(item => item.classList.toggle('is-active', item === button));
      render();
    });

    elements.list.addEventListener('click', event => {
      const favorite = event.target.closest('[data-favorite-id]');
      if (favorite) { event.stopPropagation(); toggleFavorite(favorite.dataset.favoriteId); return; }
      const card = event.target.closest('[data-plan-id]');
      if (card) openDetail(card.dataset.planId);
    });
    elements.list.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-plan-id]')) {
        event.preventDefault(); openDetail(event.target.dataset.planId);
      }
    });

    elements.detailContent.addEventListener('click', event => {
      const share = event.target.closest('[data-share-plan]');
      const favorite = event.target.closest('[data-detail-favorite]');
      const remove = event.target.closest('[data-delete-plan]');
      if (share) sharePlan(share.dataset.sharePlan);
      if (favorite) toggleFavorite(favorite.dataset.detailFavorite);
      if (remove) deleteCustomPlan(remove.dataset.deletePlan);
    });

    elements.favoritesToggle.addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      elements.favoritesToggle.setAttribute('aria-pressed', String(state.favoritesOnly));
      render();
    });
    $('#clearFilters').addEventListener('click', resetFilters);
    $('#emptyReset').addEventListener('click', resetFilters);
    $('#fitBtn').addEventListener('click', fitFiltered);
    $('#locateBtn').addEventListener('click', locateUser);
    $('#shareAppBtn').addEventListener('click', shareApp);
    $('#addPlanBtn').addEventListener('click', () => elements.addDialog.showModal());
    $('#pickLocationBtn').addEventListener('click', startLocationPick);
    $('#mobileListToggle').addEventListener('click', () => elements.sidebar.classList.add('is-open'));
    $('#aboutBtn').addEventListener('click', () => $('#aboutDialog').showModal());
    elements.mapModeBadge.addEventListener('click', () => $('#aboutDialog').showModal());

    elements.addForm.addEventListener('submit', event => {
      event.preventDefault();
      if (saveCustomPlan(event.currentTarget)) elements.addDialog.close();
    });

    $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
    $$('dialog').forEach(dialog => {
      dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (outside) dialog.close();
      });
      dialog.addEventListener('close', () => {
        if (dialog === elements.detailDialog && location.hash.startsWith('#plan=')) history.replaceState(null, '', location.pathname + location.search);
      });
    });

    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); elements.sidebar.classList.add('is-open'); elements.search.focus(); }
      if (event.key === 'Escape' && elements.sidebar.classList.contains('is-open') && !document.querySelector('dialog[open]')) elements.sidebar.classList.remove('is-open');
    });

    let startY = 0;
    elements.sidebar.addEventListener('touchstart', event => { startY = event.touches[0].clientY; }, { passive: true });
    elements.sidebar.addEventListener('touchend', event => {
      const delta = event.changedTouches[0].clientY - startY;
      if (delta > 80 && elements.sidebar.scrollTop <= 0) elements.sidebar.classList.remove('is-open');
    }, { passive: true });
  }

  function openHashPlan() {
    const match = location.hash.match(/^#plan=(.+)$/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    if (allPlans().some(plan => plan.id === id)) setTimeout(() => openDetail(id), 250);
  }

  function init() {
    document.body.dataset.mapMode = MAP_MODE;
    initCategories();
    initMap();
    bindEvents();
    render();
    openHashPlan();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !new URLSearchParams(location.search).has('offline')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  init();
})();
