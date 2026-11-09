/* Planes Madrid — visual and encoding hardening layer.
 * Load after planes.js. ASCII-only source keeps this file safe even when a host
 * sends an incorrect legacy charset.
 */
(function () {
  'use strict';

  var CP1252_REVERSE = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
    0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
    0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
    0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f
  };

  var BAD_TEXT = /(\u00c3.|\u00c2.|\u00e2[\u0080-\u00bf]|\u00f0[\u0080-\u024f]|\ufffd)/;
  var EMOJI_OR_BAD = /([\u{1F000}-\u{1FAFF}]|[\u2600-\u27BF]|\u00f0[\u0080-\u024f]|\u00c3.|\ufffd)/u;

  function badness(value) {
    var matches = String(value || '').match(new RegExp(BAD_TEXT.source, 'g'));
    return matches ? matches.length : 0;
  }

  function decodeCp1252AsUtf8(value) {
    var input = String(value || '');
    var bytes = [];
    for (var char of input) {
      var code = char.codePointAt(0);
      if (Object.prototype.hasOwnProperty.call(CP1252_REVERSE, code)) {
        bytes.push(CP1252_REVERSE[code]);
      } else if (code <= 0xff) {
        bytes.push(code);
      } else {
        return input;
      }
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    } catch (_) {
      return input;
    }
  }

  function repairText(value) {
    var current = String(value == null ? '' : value);
    for (var pass = 0; pass < 2; pass += 1) {
      var candidate = decodeCp1252AsUtf8(current);
      if (candidate === current || badness(candidate) > badness(current)) break;
      current = candidate;
    }
    return current;
  }

  function repairPlanData() {
    if (!Array.isArray(window.PLANES_MADRID)) return;
    window.PLANES_MADRID.forEach(function (plan) {
      Object.keys(plan).forEach(function (key) {
        if (typeof plan[key] === 'string') plan[key] = repairText(plan[key]);
      });
    });
  }

  var ICONS = {
    nature: '<path d="M12 21V9"/><path d="M12 13C7 13 4 10 4 5c5 0 8 3 8 8Z"/><path d="M12 16c5 0 8-3 8-8-5 0-8 3-8 8Z"/>',
    culture: '<path d="M3 10h18"/><path d="M5 10V8l7-4 7 4v2"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/><path d="M3 21h18M4 18h16"/>',
    food: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10"/><path d="M17 3v18M17 3c3 2 3 7 0 9"/>',
    leisure: '<circle cx="12" cy="12" r="8"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    route: '<path d="M9 18 3.5 20.5v-15L9 3l6 2.5L20.5 3v15L15 20.5 9 18Z"/><path d="M9 3v15M15 5.5v15"/>',
    adventure: '<path d="m3 20 7-13 4 7 2-4 5 10H3Z"/><path d="m8 11 2 2 2-3 2 4"/>',
    default: '<path d="M12 3 14.7 8.5 21 9.4l-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.3-.9L12 3Z"/>'
  };

  function svgIcon(category, extraClass) {
    var body = ICONS[category] || ICONS.default;
    return '<svg class="pm-svg-icon ' + (extraClass || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  function repairDomText(root) {
    if (!root || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return BAD_TEXT.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) { node.nodeValue = repairText(node.nodeValue); });

    root.querySelectorAll && root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(function (element) {
      ['title', 'aria-label', 'placeholder'].forEach(function (attribute) {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(attribute, repairText(element.getAttribute(attribute)));
        }
      });
    });
  }

  var COPY = new Map([
    ['ENCUENTRA LA PR\u00d3XIMA QUEDADA', 'TU PR\u00d3XIMO PLAN EMPIEZA AQU\u00cd'],
    ['Planes cerca.', 'Planes que apetecen.'],
    ['Decidir, f\u00e1cil.', 'Elegir, a\u00fan m\u00e1s f\u00e1cil.'],
    ['Filtra, guarda y manda al grupo la propuesta perfecta.', 'Descubre planes por Madrid y alrededores, guarda tus favoritos y comparte el plan con tu gente.'],
    ['Buscar por plan o lugar...', 'Busca un plan, un lugar o una idea\u2026'],
    ['Distancia desde Madrid', '\u00bfHasta d\u00f3nde quieres ir?'],
    ['189 planes', '189 ideas para disfrutar Madrid'],
    ['A\u00f1adir plan', 'Proponer un plan'],
    ['Informaci\u00f3n y fuentes', 'Fuentes y datos pr\u00e1cticos']
  ]);

  function improveMicrocopy(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var original = node.nodeValue;
      var trimmed = original.trim();
      if (!COPY.has(trimmed)) return;
      node.nodeValue = original.replace(trimmed, COPY.get(trimmed));
    });
    (root || document.body).querySelectorAll('[placeholder],[aria-label],[title]').forEach(function (element) {
      ['placeholder', 'aria-label', 'title'].forEach(function (attribute) {
        var value = element.getAttribute(attribute);
        if (value && COPY.has(value.trim())) element.setAttribute(attribute, COPY.get(value.trim()));
      });
    });
  }

  function normalizeCategory(value) {
    var text = String(value || '').toLowerCase();
    if (/natur|parque|jard|bosque|campo/.test(text)) return 'nature';
    if (/cultur|museo|arte|teatro|monumento/.test(text)) return 'culture';
    if (/gastr|comida|tapeo|mercado|restaur/.test(text)) return 'food';
    if (/avent|sender|escal|monta|kayak/.test(text)) return 'adventure';
    if (/ruta|escapada|paseo|excurs/.test(text)) return 'route';
    if (/ocio|famil|juego|parque tem|cine/.test(text)) return 'leisure';
    return 'default';
  }

  function categoryForCard(card) {
    var text = card.textContent || '';
    if (Array.isArray(window.PLANES_MADRID)) {
      var match = window.PLANES_MADRID.find(function (plan) {
        return plan.title && text.indexOf(plan.title) !== -1;
      });
      if (match && match.category) return match.category;
    }
    return normalizeCategory(text);
  }

  function isProbableCard(element) {
    if (!element || element === document.body) return false;
    var name = String(element.className || '');
    var rect = element.getBoundingClientRect();
    var cardish = /card|plan-item|result|place/i.test(name) || /^(ARTICLE|LI)$/.test(element.tagName);
    return cardish && rect.width > 180 && rect.height > 58 && rect.height < 420;
  }

  function findCard(element) {
    var current = element;
    for (var depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      if (isProbableCard(current)) return current;
    }
    return null;
  }

  function enhanceCards(root) {
    var plans = Array.isArray(window.PLANES_MADRID) ? window.PLANES_MADRID : [];
    if (!plans.length || !root.querySelectorAll) return;
    var candidates = root.querySelectorAll('h1,h2,h3,h4,h5,strong,[class*="title"],[class*="name"]');
    candidates.forEach(function (titleElement) {
      var text = titleElement.textContent.trim();
      var plan = plans.find(function (item) { return item.title === text; });
      if (!plan) return;
      var card = findCard(titleElement);
      if (!card || card.dataset.pmBeautified === 'true') return;
      card.dataset.pmBeautified = 'true';
      card.dataset.pmPlanCard = '';
      card.dataset.pmCategory = plan.category || 'default';
      card.dataset.pmPrice = plan.priceType || '';

      var iconCandidates = card.querySelectorAll('[class*="icon"],[class*="emoji"],[class*="thumb"],[class*="visual"],[class*="illustration"]');
      var iconHost = Array.prototype.find.call(iconCandidates, function (element) {
        if (element.closest('button,a') || element === titleElement) return false;
        var value = element.textContent.trim();
        var rect = element.getBoundingClientRect();
        return rect.width >= 34 && rect.width <= 130 && rect.height >= 34 && rect.height <= 150 && (EMOJI_OR_BAD.test(value) || value.length < 18);
      });
      if (iconHost) {
        iconHost.innerHTML = svgIcon(plan.category, 'pm-card-svg');
        iconHost.classList.add('pm-beautified-icon');
        iconHost.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function markerColor(marker) {
    var elements = [marker].concat(Array.from(marker.querySelectorAll('*')));
    for (var element of elements) {
      var color = getComputedStyle(element).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
    }
    return '';
  }

  function enhanceMapMarkers(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('.leaflet-marker-icon').forEach(function (marker) {
      if (marker.dataset.pmMarker === 'true') return;
      var text = marker.textContent.trim();
      if (!EMOJI_OR_BAD.test(text)) return;
      var color = markerColor(marker);
      marker.dataset.pmMarker = 'true';
      marker.classList.add('pm-map-marker');
      if (color) marker.style.setProperty('--pm-marker-color', color);
      marker.innerHTML = '<span class="pm-marker-surface">' + svgIcon('default', 'pm-marker-svg') + '</span>';
    });
  }

  function addUiClasses(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('button,a,[role="button"]').forEach(function (element) {
      var text = element.textContent.trim().toLowerCase();
      if (text === 'proponer un plan' || text === 'a\u00f1adir plan') element.classList.add('pm-primary-action');
      if (text === 'favoritos' || text === 'compartir') element.classList.add('pm-soft-action');
    });
    root.querySelectorAll('input[type="search"],input[placeholder*="Busca"],input[placeholder*="plan"]').forEach(function (element) {
      element.classList.add('pm-search-input');
    });
  }

  var scheduled = false;
  function enhanceAll(root) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      var scope = root && root.nodeType === 1 ? root : document.body;
      repairDomText(scope);
      improveMicrocopy(scope);
      enhanceCards(document);
      enhanceMapMarkers(document);
      addUiClasses(document);
      document.documentElement.classList.add('pm-beautified');
    });
  }

  repairPlanData();
  window.PlanesMadridBeauty = {
    repairText: repairText,
    repairPlanData: repairPlanData,
    refresh: function () { enhanceAll(document.body); }
  };

  function start() {
    enhanceAll(document.body);
    var observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        return mutation.type === 'childList' && mutation.addedNodes.length;
      });
      if (relevant) enhanceAll(document.body);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());
