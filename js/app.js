/* OBLAKO guest menu — tabs, search, cards, lightbox, rules, data loading */
(function () {
  'use strict';

  /* ---------- Constants & state ---------- */
  const ALL_TAB = 'Все';
  const RULES_TAB = 'Правила заведения';
  const BAR_CATS = new Set(['Кофе и чай', 'Безалкогольные', 'Алкогольные']);
  const CACHE_KEY = 'oblako-menu-cache-v3';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const POLL_MS = 2 * 60 * 1000;
  const SEARCH_DEBOUNCE_MS = 140;
  const EAGER_PHOTOS = 4;
  // Bump when dish photos change so browsers/SW drop stale files
  const PHOTO_VER = '20261012b';
  // Revision of the bundled js/data.js. Remote data with another revision is stale.
  const LOCAL_REVISION = typeof MENU_REVISION !== 'undefined' ? MENU_REVISION : null;

  const state = {
    category: ALL_TAB,
    query: '',
    view: 'grid',
  };

  let cardIndex = 0;
  let searchTimer = null;
  let sectionObserver = null;
  let lastSignature = '';

  const $ = (id) => document.getElementById(id);
  const els = {
    tabs: $('tabs'),
    tabsList: $('tabs-list'),
    search: $('search'),
    searchClear: $('search-clear'),
    viewToggle: $('view-toggle'),
    menuRoot: $('menu-root'),
    rulesRoot: $('rules-root'),
    empty: $('empty-state'),
  };

  /* ---------- Helpers ---------- */
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatPrice(price) {
    if (price == null) return 'по запросу';
    return `${Number(price).toLocaleString('ru-RU')} ₸`;
  }

  function pluralPos(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиция';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиции';
    return 'позиций';
  }

  function isBarItem(item) {
    return Boolean(item?.noPhoto || BAR_CATS.has(item?.cat));
  }

  function apiUrl(path) {
    const base = String(window.OBLAKO_CONFIG?.apiBase || '').replace(/\/$/, '');
    return `${base}${path}`;
  }

  function resolveImageUrl(src) {
    if (!src) return '';
    let url = String(src);
    if (url.startsWith('data:')) return url;
    if (url.startsWith('/')) url = apiUrl(url);
    return `${url}${url.includes('?') ? '&' : '?'}v=${PHOTO_VER}`;
  }

  function dishWebp(item, size) {
    if (!item?.id || isBarItem(item)) return '';
    return `image/dishes/w${size}/${item.photoId || item.id}.webp`;
  }

  function cartQty(id) {
    return window.OBLAKO_CART?.qty?.(id) || 0;
  }

  function vibrate(ms) {
    try {
      if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(ms);
    } catch (_) { /* unsupported */ }
  }

  function scrollToTabs() {
    els.tabs?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Filtering ---------- */
  function getCategoryTabs() {
    return [
      ALL_TAB,
      ...CATEGORY_ORDER.filter(cat => MENU.some(i => i.name && i.cat === cat)),
      RULES_TAB,
    ];
  }

  function getFiltered() {
    const q = state.query.toLowerCase().trim();
    return MENU.filter(item => {
      if (!item?.name) return false;
      if (state.category !== ALL_TAB && item.cat !== state.category) return false;
      if (!q) return true;
      return [item.cat, item.subcat, item.name, item.desc]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }

  /* ---------- Tabs ---------- */
  function renderTabs() {
    if (!els.tabsList) return;
    const frag = document.createDocumentFragment();
    getCategoryTabs().forEach(cat => {
      const btn = el('button', 'tabs__btn', cat);
      btn.type = 'button';
      btn.dataset.cat = cat;
      if (cat === RULES_TAB) btn.classList.add('tabs__btn--rules');
      if (cat === state.category) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-current', 'true');
      }
      frag.appendChild(btn);
    });
    els.tabsList.replaceChildren(frag);
    els.tabsList.querySelector('.is-active')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function setActiveTab(cat) {
    els.tabsList?.querySelectorAll('.tabs__btn').forEach(btn => {
      const on = btn.dataset.cat === cat;
      btn.classList.toggle('is-active', on);
      if (on) btn.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  function selectCategory(cat) {
    if (!cat || cat === state.category) return;
    state.category = cat;
    if (cat !== ALL_TAB && cat !== RULES_TAB) trackEvent('category_view', { category: cat });
    render();
    // Deep in the list? Jump back so the new category starts right under the tabs
    if (els.tabs.getBoundingClientRect().top <= 0) els.tabs.scrollIntoView({ block: 'start' });
  }

  /* ---------- Card ---------- */
  function buildQtyControls(item) {
    const wrap = el('div', 'card__qty');
    wrap.dataset.qtyFor = item.id;
    const qty = cartQty(item.id);

    if (qty <= 0) {
      const add = el('button', 'card__add', '+');
      add.type = 'button';
      add.dataset.add = item.id;
      add.setAttribute('aria-label', `Добавить ${item.name}`);
      wrap.appendChild(add);
      return wrap;
    }

    const dec = el('button', 'card__qty-btn', '−');
    dec.type = 'button';
    dec.dataset.act = 'dec';
    dec.dataset.id = item.id;
    dec.setAttribute('aria-label', 'Меньше');

    const num = el('span', 'card__qty-num', String(qty));

    const inc = el('button', 'card__qty-btn', '+');
    inc.type = 'button';
    inc.dataset.act = 'inc';
    inc.dataset.id = item.id;
    inc.setAttribute('aria-label', 'Больше');

    wrap.append(dec, num, inc);
    return wrap;
  }

  function markPhotoEmpty(frame) {
    frame.classList.add('card__photo--empty');
    frame.removeAttribute('role');
    frame.removeAttribute('tabindex');
    frame.removeAttribute('data-lightbox');
    frame.replaceChildren(el('span', 'card__placeholder', 'OBLAKO'));
  }

  function buildPhoto(item, eager) {
    const frame = el('div', 'card__photo');
    const w400 = dishWebp(item, 400) || item.image;
    const w800 = dishWebp(item, 800) || item.imageFull || w400;

    if (!w400) {
      markPhotoEmpty(frame);
      return frame;
    }

    frame.dataset.lightbox = '1';
    frame.setAttribute('role', 'button');
    frame.tabIndex = 0;
    frame.setAttribute('aria-label', `Фото: ${item.name}`);

    const img = el('img', 'card__img');
    img.alt = item.name;
    img.width = 400;
    img.height = 300;
    img.decoding = 'async';
    img.loading = eager ? 'eager' : 'lazy';
    if (eager) img.fetchPriority = 'high';
    img.dataset.full = resolveImageUrl(w800);
    if (w400 !== w800) {
      img.srcset = `${resolveImageUrl(w400)} 400w, ${resolveImageUrl(w800)} 800w`;
      img.sizes = '(max-width: 767px) 50vw, 260px';
    }
    img.src = resolveImageUrl(w400);
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => markPhotoEmpty(frame), { once: true });

    frame.appendChild(img);
    return frame;
  }

  function buildPrice(item) {
    const wrap = el('div', 'card__price-wrap');

    if (item.price2 != null) {
      const prices = el('div', 'card__prices');
      [[item.priceLabel, item.price], [item.price2Label, item.price2]].forEach(([label, price]) => {
        const row = el('div', 'card__price-row');
        if (label) row.appendChild(el('span', 'card__price-label', label));
        row.appendChild(el('span', 'card__price', formatPrice(price)));
        prices.appendChild(row);
      });
      wrap.appendChild(prices);
      return wrap;
    }

    wrap.appendChild(el('span', 'card__price', formatPrice(item.price)));
    if (item.volume) wrap.appendChild(el('span', 'card__volume', item.volume));
    return wrap;
  }

  function buildCard(item) {
    const bar = isBarItem(item);
    const card = el('article', bar ? 'card card--bar' : 'card');
    card.dataset.id = item.id || '';

    if (!bar) {
      const eager = cardIndex < EAGER_PHOTOS && !state.query;
      card.appendChild(buildPhoto(item, eager));
      cardIndex++;
    }

    const body = el('div', 'card__body');
    body.appendChild(el('h3', 'card__title', item.name));
    // No composition → no line at all, so the layout never reserves empty space
    if (item.desc) body.appendChild(el('p', 'card__desc', item.desc));

    const footer = el('div', 'card__footer');
    footer.appendChild(buildPrice(item));
    if (item.price != null) footer.appendChild(buildQtyControls(item));
    body.appendChild(footer);

    card.appendChild(body);
    return card;
  }

  function refreshQty(id) {
    const wrap = els.menuRoot?.querySelector(`.card__qty[data-qty-for="${CSS.escape(id)}"]`);
    const item = MENU.find(i => i.id === id);
    if (wrap && item) wrap.replaceWith(buildQtyControls(item));
  }

  function refreshAllQty() {
    els.menuRoot?.querySelectorAll('.card__qty[data-qty-for]')
      .forEach(node => refreshQty(node.dataset.qtyFor));
  }

  /* ---------- Menu ---------- */
  function groupBy(items, key, fallback) {
    const map = new Map();
    items.forEach(item => {
      const k = item[key] || fallback;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    });
    return map;
  }

  function buildGrid(items) {
    const grid = el('div', state.view === 'list' ? 'grid grid--list' : 'grid');
    if (items.every(isBarItem)) grid.classList.add('grid--bar');
    items.forEach(item => grid.appendChild(buildCard(item)));
    return grid;
  }

  function buildSection(cat, items, withHead) {
    const sec = el('section', 'section');
    sec.dataset.cat = cat;

    if (withHead) {
      const head = el('div', 'section__head');
      const line = () => {
        const node = el('span', 'section__line');
        node.setAttribute('aria-hidden', 'true');
        return node;
      };
      head.append(
        el('h2', 'section__title', cat),
        line(),
        el('span', 'section__count', `${items.length} поз.`),
      );
      sec.appendChild(head);
    }

    const hasSub = items.some(i => i.subcat);
    if (!hasSub) {
      sec.appendChild(buildGrid(items));
      return sec;
    }

    groupBy(items, 'subcat', 'Другое').forEach((subItems, title) => {
      const sub = el('div', 'subsection-title');
      sub.append(
        el('h3', 'subsection-title__text', title),
        el('span', 'subsection-title__count', `${subItems.length} поз.`),
      );
      sec.append(sub, buildGrid(subItems));
    });
    return sec;
  }

  function renderEmpty() {
    const reset = el('button', 'empty__reset', state.query ? 'Сбросить поиск' : 'Показать всё меню');
    reset.type = 'button';
    reset.addEventListener('click', () => (state.query ? clearSearch() : goHome()));
    els.empty.replaceChildren(
      el('p', 'empty__title', 'Ничего не найдено'),
      el('p', 'empty__hint', state.query
        ? `По запросу «${state.query}» совпадений нет`
        : 'В этом разделе пока пусто'),
      reset,
    );
    els.empty.hidden = false;
  }

  function renderMenu() {
    const items = getFiltered();
    cardIndex = 0;

    if (!items.length) {
      els.menuRoot.replaceChildren();
      renderEmpty();
      return;
    }
    els.empty.hidden = true;
    els.empty.replaceChildren();

    const frag = document.createDocumentFragment();
    const single = state.category !== ALL_TAB && !state.query;

    if (single) {
      const hero = el('div', 'category-hero');
      hero.append(
        el('span', 'category-hero__label', 'Категория'),
        el('h2', 'category-hero__title', state.category),
        el('p', 'category-hero__meta', `${items.length} ${pluralPos(items.length)} в меню`),
      );
      frag.appendChild(hero);
    }

    const groups = groupBy(items, 'cat');
    CATEGORY_ORDER
      .filter(cat => groups.has(cat))
      .forEach(cat => frag.appendChild(buildSection(cat, groups.get(cat), !single)));

    els.menuRoot.replaceChildren(frag);
    observeSections();
  }

  // Highlight the tab of the section in view while scrolling the full menu
  function observeSections() {
    sectionObserver?.disconnect();
    if (state.category !== ALL_TAB || state.query || !('IntersectionObserver' in window)) return;

    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(en => en.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveTab(visible.target.dataset.cat);
    }, { rootMargin: '-30% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] });

    els.menuRoot.querySelectorAll('.section[data-cat]').forEach(sec => sectionObserver.observe(sec));
  }

  /* ---------- Rules ---------- */
  function renderRules() {
    const blocks = typeof RULES === 'undefined' ? '' : RULES.map((section, idx) => `
      <details class="rules-block"${idx === 0 ? ' open' : ''}>
        <summary class="rules-block__title">${escapeHtml(section.title)}</summary>
        <ul class="rules-block__list">
          ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </details>`).join('');

    els.rulesRoot.innerHTML = `
      <div class="rules">
        <button type="button" class="rules__back" data-rules-back>← Вернуться к меню</button>
        <h2 class="rules__title">Правила заведения</h2>
        <p class="rules__intro">Ознакомьтесь с правилами посещения заведения OBLAKO.</p>
        <div class="rules__list">${blocks}</div>
      </div>`;
  }

  /* ---------- Render ---------- */
  function render() {
    renderTabs();
    const rules = state.category === RULES_TAB;

    document.querySelector('.search').hidden = rules;
    els.viewToggle.hidden = rules;
    els.menuRoot.hidden = rules;
    els.rulesRoot.hidden = !rules;

    if (rules) {
      sectionObserver?.disconnect();
      els.empty.hidden = true;
      renderRules();
      return;
    }
    renderMenu();
  }

  function openRules() {
    state.category = RULES_TAB;
    render();
    scrollToTabs();
  }

  function goHome() {
    state.category = ALL_TAB;
    state.query = '';
    els.search.value = '';
    updateSearchClear();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Search ---------- */
  function updateSearchClear() {
    els.searchClear.hidden = !els.search.value.trim();
  }

  function applySearch(value) {
    state.query = value;
    if (value) state.category = ALL_TAB;
    render();
  }

  function clearSearch() {
    els.search.value = '';
    state.query = '';
    updateSearchClear();
    render();
    els.search.focus();
  }

  /* ---------- Lightbox ---------- */
  let lightbox = null;
  let lastFocus = null;

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    lastFocus?.focus?.();
  }

  function ensureLightbox() {
    if (lightbox) return lightbox;
    lightbox = el('div', 'lightbox');
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.innerHTML = `
      <div class="lightbox__backdrop" data-close></div>
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="">
        <figcaption class="lightbox__cap"></figcaption>
      </figure>
      <button type="button" class="lightbox__close" data-close aria-label="Закрыть">✕</button>`;
    document.body.appendChild(lightbox);

    let startY = 0;
    lightbox.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) closeLightbox();
    });
    lightbox.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - startY > 80) closeLightbox();
    }, { passive: true });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeLightbox();
    });
    return lightbox;
  }

  function openLightbox(photo) {
    const img = photo?.querySelector('img');
    if (!img) return;
    const box = ensureLightbox();
    box.querySelector('.lightbox__img').src = img.dataset.full || img.src;
    box.querySelector('.lightbox__img').alt = img.alt;
    box.querySelector('.lightbox__cap').textContent = img.alt;
    lastFocus = document.activeElement;
    box.hidden = false;
    document.body.classList.add('is-locked');
    box.querySelector('.lightbox__close').focus();
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    els.tabsList?.addEventListener('click', e => {
      selectCategory(e.target.closest('.tabs__btn')?.dataset.cat);
    });

    els.viewToggle?.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn || btn.dataset.view === state.view) return;
      state.view = btn.dataset.view;
      els.viewToggle.querySelectorAll('[data-view]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      renderMenu();
    });

    els.search?.addEventListener('input', e => {
      const { value } = e.target;
      updateSearchClear();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applySearch(value), SEARCH_DEBOUNCE_MS);
    });
    els.search?.addEventListener('keydown', e => {
      if (e.key === 'Escape') clearSearch();
      if (e.key === 'Enter') els.search.blur();      // hide the mobile keyboard
    });
    els.searchClear?.addEventListener('click', clearSearch);

    els.rulesRoot?.addEventListener('click', e => {
      if (!e.target.closest('[data-rules-back]')) return;
      state.category = ALL_TAB;
      render();
      scrollToTabs();
    });

    els.menuRoot?.addEventListener('click', e => {
      const photo = e.target.closest('[data-lightbox]');
      if (photo) {
        openLightbox(photo);
        return;
      }

      const add = e.target.closest('[data-add]');
      if (add) {
        const item = MENU.find(i => i.id === add.dataset.add);
        if (!item) return;
        window.OBLAKO_CART?.add(item);
        vibrate(14);
        refreshQty(item.id);
        return;
      }

      const act = e.target.closest('[data-act]');
      if (act) {
        const { id } = act.dataset;
        if (act.dataset.act === 'inc') window.OBLAKO_CART?.add(id);
        else window.OBLAKO_CART?.setQty(id, cartQty(id) - 1);
        vibrate(10);
        refreshQty(id);
      }
    });

    els.menuRoot?.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.matches('[data-lightbox]')) return;
      e.preventDefault();
      openLightbox(e.target);
    });

    window.addEventListener('oblako-cart-change', refreshAllQty);
  }

  /* ---------- Data loading ---------- */
  function trackEvent(eventType, meta = {}) {
    if (location.protocol === 'file:') return;
    fetch(apiUrl('/api/analytics/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, path: location.pathname, ...meta }),
      keepalive: true,
    }).catch(() => {});
  }

  function normalizeItem(raw) {
    const item = { ...raw };
    if (isBarItem(item)) {
      item.noPhoto = true;
      delete item.image;
      delete item.imageFull;
      return item;
    }
    if (dishWebp(item, 400)) {
      item.image = dishWebp(item, 400);
      item.imageFull = dishWebp(item, 800);
    } else if (!item.image && typeof IMAGE_MAP !== 'undefined') {
      item.image = IMAGE_MAP[item.photoId || item.id] || '';
    }
    return item;
  }

  // Accepts only data built from the same js/data.js revision — a not-yet-redeployed
  // API or an old cache must never show outdated prices.
  function applyMenuPayload(data) {
    if (!data?.items?.length) return false;
    if (LOCAL_REVISION && data.revision !== LOCAL_REVISION) return false;

    // Skip re-render (and scroll jumps) when nothing changed
    const signature = JSON.stringify([data.categories, data.items]);
    if (signature === lastSignature) return false;
    lastSignature = signature;

    MENU.splice(0, MENU.length, ...data.items.map(normalizeItem));
    if (data.categories?.length) CATEGORY_ORDER.splice(0, CATEGORY_ORDER.length, ...data.categories);

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        revision: data.revision || null,
        categories: CATEGORY_ORDER,
        items: MENU,
      }));
    } catch (_) { /* quota or private mode */ }
    return true;
  }

  function hydrateFromCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!data || Date.now() - (data.savedAt || 0) > CACHE_TTL_MS) return false;
      return applyMenuPayload(data);
    } catch (_) {
      return false;
    }
  }

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}?_=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadMenuJson() {
    try {
      if (applyMenuPayload(await fetchJson('data/menu.json', 8000))) render();
    } catch (_) { /* bundled data.js stays */ }
  }

  async function loadMenuFromApi() {
    if (location.protocol === 'file:') return;
    const delays = [0, 2500, 6000];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
      try {
        const data = await fetchJson(apiUrl('/api/menu'), i === 0 ? 10000 : 25000);
        if (applyMenuPayload(data)) render();
        return;
      } catch (_) { /* cold start — retry */ }
    }
  }

  function showSkeletons() {
    if (MENU.length) return;
    const grid = el('div', 'grid');
    for (let i = 0; i < 6; i++) {
      const card = el('div', 'card card--skeleton');
      const body = el('div', 'card__body');
      body.append(el('div', 'skel skel--title'), el('div', 'skel'), el('div', 'skel skel--price'));
      card.append(el('div', 'card__photo'), body);
      grid.appendChild(card);
    }
    els.menuRoot.replaceChildren(grid);
  }

  /* ---------- Init ---------- */
  MENU.splice(0, MENU.length, ...MENU.map(normalizeItem));

  window.OBLAKO = Object.assign(window.OBLAKO || {}, {
    openRules,
    goHome,
    scrollToTabs,
  });

  bindEvents();
  showSkeletons();
  hydrateFromCache();
  render();

  loadMenuJson().then(() => {
    loadMenuFromApi();
    trackEvent('page_view');
  });

  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    fetchJson(apiUrl('/api/menu'), 12000)
      .then(data => { if (applyMenuPayload(data)) render(); })
      .catch(() => {});
  }, POLL_MS);
})();
