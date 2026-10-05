/* OBLAKO guest menu — cards, search, tabs, menu.json + API */
(function () {
  const RULES_TAB = 'Правила заведения';
  const BAR_CATS = new Set(['Кофе и чай', 'Безалкогольные', 'Алкогольные']);
  const CACHE_KEY = 'oblako-menu-cache-v1';
  const RULES_SEEN_KEY = 'oblako-rules-seen';
  // Bump when dish photos change so browsers/SW drop stale files
  const PHOTO_VER = '20261005a';

  let activeCategory = 'Все';
  let searchQuery = '';
  let viewMode = 'grid';
  let searchTimer = null;
  let tabsBound = false;
  let menuBound = false;
  let cardIndex = 0;
  let sectionObserver = null;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function isBarItem(item) {
    return item?.noPhoto || BAR_CATS.has(item?.cat);
  }

  function apiBase() {
    return (window.OBLAKO_CONFIG && window.OBLAKO_CONFIG.apiBase)
      ? String(window.OBLAKO_CONFIG.apiBase).replace(/\/$/, '')
      : '';
  }

  function apiUrl(path) {
    if (!path.startsWith('/')) path = `/${path}`;
    return `${apiBase()}${path}`;
  }

  function withPhotoVer(url) {
    if (!url) return '';
    const s = String(url);
    if (/^data:/i.test(s)) return s;
    const join = s.includes('?') ? '&' : '?';
    return `${s}${join}v=${PHOTO_VER}`;
  }

  function resolveImageUrl(src) {
    if (!src) return '';
    const s = String(src);
    if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return withPhotoVer(s);
    if (s.startsWith('/')) {
      const base = apiBase();
      return withPhotoVer(base ? `${base}${s}` : s);
    }
    return withPhotoVer(s);
  }

  function dishWebp(item, size) {
    if (!item?.id || isBarItem(item)) return '';
    return `image/dishes/w${size}/${item.id}.webp`;
  }

  function getCategoryTabs() {
    return [
      'Все',
      ...CATEGORY_ORDER.filter(cat => MENU.some(i => i.name && i.cat === cat)),
      RULES_TAB,
    ];
  }

  function isRulesView() {
    return activeCategory === RULES_TAB;
  }

  function pluralPos(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиция';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиции';
    return 'позиций';
  }

  function isFilled(item) {
    return Boolean(item && item.name);
  }

  function getFiltered() {
    if (isRulesView()) return [];
    const q = searchQuery.toLowerCase().trim();
    return MENU.filter(item => {
      if (!isFilled(item)) return false;
      const matchCat = activeCategory === 'Все' || item.cat === activeCategory;
      if (!q) return matchCat;
      const haystack = [item.cat, item.subcat, item.name, item.desc]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchCat && haystack.includes(q);
    });
  }

  function showSkeletons() {
    const root = document.getElementById('menu-root');
    if (!root || root.childElementCount) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 6; i++) {
      const card = document.createElement('div');
      card.className = 'card card--skeleton';
      card.innerHTML = `
        <div class="card-photo card-photo--skeleton"></div>
        <div class="card-body">
          <div class="skel skel--title"></div>
          <div class="skel skel--desc"></div>
          <div class="skel skel--price"></div>
        </div>`;
      frag.appendChild(card);
    }
    const wrap = document.createElement('div');
    wrap.className = 'grid grid--skeleton';
    wrap.appendChild(frag);
    root.appendChild(wrap);
  }

  function setViewMode() {
    const searchWrap = document.querySelector('.search-wrap');
    const menuRoot = document.getElementById('menu-root');
    const rulesRoot = document.getElementById('rules-root');
    const emptyEl = document.getElementById('empty-state');
    const viewToggle = document.getElementById('view-toggle');

    if (!menuRoot || !rulesRoot || !emptyEl) return;

    if (isRulesView()) {
      if (searchWrap) searchWrap.style.display = 'none';
      if (viewToggle) viewToggle.style.display = 'none';
      menuRoot.style.display = 'none';
      emptyEl.classList.remove('visible');
      emptyEl.innerHTML = '';
      rulesRoot.classList.add('is-visible');
      buildRules();
      return;
    }

    if (searchWrap) searchWrap.style.display = '';
    if (viewToggle) viewToggle.style.display = '';
    menuRoot.style.display = '';
    menuRoot.classList.toggle('menu-root--list', viewMode === 'list');
    rulesRoot.classList.remove('is-visible');
    buildMenu();
  }

  function buildTabs() {
    const tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;

    const cats = getCategoryTabs();
    tabsEl.replaceChildren();
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab-btn'
        + (cat === activeCategory ? ' active' : '')
        + (cat === RULES_TAB ? ' tab-btn--rules' : '');
      btn.dataset.cat = cat;
      btn.textContent = cat;
      tabsEl.appendChild(btn);
    });

    if (!tabsBound) {
      tabsBound = true;
      tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const cat = btn.dataset.cat;
        if (!cat || cat === activeCategory) return;
        activeCategory = cat;
        if (activeCategory !== 'Все' && activeCategory !== RULES_TAB) {
          trackCategoryView(activeCategory);
        }
        buildTabs();
        setViewMode();
      });
    }

    const activeBtn = tabsEl.querySelector('.tab-btn.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }

  function groupBySubcat(items) {
    if (!items.some(i => i.subcat)) return [{ title: null, items }];
    const order = [];
    const map = {};
    items.forEach(item => {
      const key = item.subcat || 'Другое';
      if (!map[key]) {
        map[key] = [];
        order.push(key);
      }
      map[key].push(item);
    });
    return order.map(key => ({ title: key, items: map[key] }));
  }

  function formatPrice(price) {
    if (price == null) return 'по запросу';
    return `${Number(price).toLocaleString('ru-RU')} ₸`;
  }

  function cartQty(id) {
    return window.OBLAKO_CART?.qty?.(id) || 0;
  }

  function vibrate(ms = 12) {
    try {
      if (navigator.vibrate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigator.vibrate(ms);
      }
    } catch (_) { /* ignore */ }
  }

  function buildQtyControls(item) {
    const wrap = document.createElement('div');
    wrap.className = 'card-qty';
    wrap.dataset.qtyFor = item.id;

    const q = cartQty(item.id);
    if (q <= 0) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'card-add';
      add.dataset.add = item.id;
      add.setAttribute('aria-label', `Добавить ${item.name}`);
      add.textContent = '+';
      wrap.appendChild(add);
      return wrap;
    }

    const dec = document.createElement('button');
    dec.type = 'button';
    dec.className = 'card-qty__btn';
    dec.dataset.act = 'dec';
    dec.dataset.id = item.id;
    dec.setAttribute('aria-label', 'Меньше');
    dec.textContent = '−';

    const num = document.createElement('span');
    num.className = 'card-qty__num';
    num.textContent = String(q);

    const inc = document.createElement('button');
    inc.type = 'button';
    inc.className = 'card-qty__btn';
    inc.dataset.act = 'inc';
    inc.dataset.id = item.id;
    inc.setAttribute('aria-label', 'Больше');
    inc.textContent = '+';

    wrap.append(dec, num, inc);
    return wrap;
  }

  function buildPhoto(item, eager) {
    const frame = document.createElement('button');
    frame.type = 'button';
    frame.className = 'card-photo';
    frame.dataset.lightbox = '1';
    frame.setAttribute('aria-label', `Фото: ${item.name}`);

    const pos = item.objectPosition || 'center';
    const w400 = dishWebp(item, 400) || resolveImageUrl(item.image);
    const w800 = dishWebp(item, 800) || item.imageFull || w400;
    const full = resolveImageUrl(item.imageFull || w800 || item.image);

    if (!w400 && !item.image) {
      frame.classList.add('card-photo--empty');
      const ph = document.createElement('div');
      ph.className = 'card-photo__placeholder';
      ph.innerHTML = '<span>OBLAKO</span><small>Скоро фото</small>';
      frame.appendChild(ph);
      frame.disabled = true;
      return frame;
    }

    const skel = document.createElement('div');
    skel.className = 'card-photo__skel';
    frame.appendChild(skel);

    const img = document.createElement('img');
    img.className = 'card-photo__img';
    img.alt = item.name || '';
    img.width = 400;
    img.height = 300;
    img.decoding = 'async';
    img.loading = eager ? 'eager' : 'lazy';
    if (eager) img.fetchPriority = 'high';
    img.style.objectPosition = pos;
    img.dataset.full = full;
    if (w400 && w800 && w400 !== w800) {
      img.srcset = `${resolveImageUrl(w400)} 400w, ${resolveImageUrl(w800)} 800w`;
      img.sizes = '(max-width: 640px) 46vw, 240px';
      img.src = resolveImageUrl(w400);
    } else {
      img.src = resolveImageUrl(w400 || item.image);
    }
    img.addEventListener('load', () => {
      img.classList.add('is-loaded');
      skel.remove();
    }, { once: true });
    img.addEventListener('error', () => {
      skel.remove();
      frame.classList.add('card-photo--empty');
      img.remove();
      const ph = document.createElement('div');
      ph.className = 'card-photo__placeholder';
      ph.innerHTML = '<span>OBLAKO</span><small>Скоро фото</small>';
      frame.appendChild(ph);
      frame.disabled = true;
    }, { once: true });

    frame.appendChild(img);
    return frame;
  }

  function buildCard(item) {
    const card = document.createElement('article');
    const bar = isBarItem(item);
    card.className = bar ? 'card card--filled card--bar' : 'card card--filled';
    card.dataset.id = item.id || '';
    card.dataset.cat = item.cat || '';

    const idx = cardIndex++;
    const eager = !bar && idx < 3 && !searchQuery;

    if (!bar) card.appendChild(buildPhoto(item, eager));

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = item.name;
    body.appendChild(title);

    if (item.desc) {
      const desc = document.createElement('p');
      desc.className = 'card-desc';
      desc.textContent = item.desc;
      body.appendChild(desc);
    }

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const priceWrap = document.createElement('div');
    priceWrap.className = 'card-price-wrap';
    if (item.price2 != null) {
      priceWrap.innerHTML = `
        <div class="card-prices">
          <div class="card-price-row">
            ${item.priceLabel ? `<span class="card-price-label">${escapeHtml(item.priceLabel)}</span>` : ''}
            <span class="card-price">${formatPrice(item.price)}</span>
          </div>
          <div class="card-price-row">
            ${item.price2Label ? `<span class="card-price-label">${escapeHtml(item.price2Label)}</span>` : ''}
            <span class="card-price">${formatPrice(item.price2)}</span>
          </div>
        </div>`;
    } else {
      const price = document.createElement('span');
      price.className = 'card-price';
      price.textContent = formatPrice(item.price);
      priceWrap.appendChild(price);
      if (item.volume) {
        const vol = document.createElement('span');
        vol.className = 'card-volume';
        vol.textContent = item.volume;
        priceWrap.appendChild(vol);
      }
    }
    footer.appendChild(priceWrap);

    if (item.price != null) footer.appendChild(buildQtyControls(item));
    body.appendChild(footer);
    card.appendChild(body);
    return card;
  }

  function bindMenuEvents() {
    if (menuBound) return;
    menuBound = true;
    const root = document.getElementById('menu-root');
    if (!root) return;

    root.addEventListener('click', (e) => {
      const photoBtn = e.target.closest('[data-lightbox]');
      if (photoBtn && !photoBtn.disabled) {
        const img = photoBtn.querySelector('img');
        openLightbox(img?.dataset.full || img?.src, img?.alt || '');
        return;
      }

      const add = e.target.closest('[data-add]');
      if (add) {
        e.stopPropagation();
        const item = MENU.find(i => i.id === add.dataset.add);
        if (item) {
          window.OBLAKO_CART?.add(item);
          vibrate(14);
          refreshQty(item.id);
        }
        return;
      }

      const actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        e.stopPropagation();
        const id = actBtn.dataset.id;
        const q = cartQty(id);
        if (actBtn.dataset.act === 'inc') {
          window.OBLAKO_CART?.add(id);
          vibrate(10);
        } else {
          window.OBLAKO_CART?.setQty?.(id, q - 1);
          vibrate(8);
        }
        refreshQty(id);
      }
    });
  }

  function refreshQty(id) {
    const wrap = document.querySelector(`.card-qty[data-qty-for="${CSS.escape(id)}"]`);
    const item = MENU.find(i => i.id === id);
    if (!wrap || !item) return;
    const next = buildQtyControls(item);
    wrap.replaceWith(next);
  }

  function refreshAllQty() {
    document.querySelectorAll('.card-qty[data-qty-for]').forEach(el => {
      refreshQty(el.dataset.qtyFor);
    });
  }

  function observeSections(root) {
    if (sectionObserver) sectionObserver.disconnect();
    if (activeCategory !== 'Все' || searchQuery) return;
    const sections = root.querySelectorAll('.section[data-cat]');
    if (!sections.length || !('IntersectionObserver' in window)) return;

    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(en => en.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const cat = visible.target.dataset.cat;
      const tabsEl = document.getElementById('tabs');
      if (!tabsEl || !cat) return;
      tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
        const on = btn.dataset.cat === cat;
        btn.classList.toggle('active', on);
        if (on) btn.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] });

    sections.forEach(sec => sectionObserver.observe(sec));
  }

  function buildMenu() {
    const root = document.getElementById('menu-root');
    const emptyEl = document.getElementById('empty-state');
    if (!root || !emptyEl) return;

    const filtered = getFiltered();
    cardIndex = 0;
    bindMenuEvents();

    if (!filtered.length) {
      root.replaceChildren();
      emptyEl.classList.add('visible');
      emptyEl.replaceChildren();
      const title = document.createElement('p');
      title.className = 'empty__title';
      title.textContent = 'Ничего не найдено';
      const hint = document.createElement('p');
      hint.className = 'empty__hint';
      hint.textContent = searchQuery
        ? `По запросу «${searchQuery}» совпадений нет`
        : 'В этом разделе пока пусто';
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn-reset-search';
      reset.textContent = searchQuery ? 'Сбросить поиск' : 'Показать всё меню';
      reset.addEventListener('click', () => {
        if (searchQuery) clearSearch();
        else goHome();
      });
      emptyEl.append(title, hint, reset);
      return;
    }

    emptyEl.classList.remove('visible');
    emptyEl.replaceChildren();

    const groups = {};
    filtered.forEach(item => {
      if (!groups[item.cat]) groups[item.cat] = [];
      groups[item.cat].push(item);
    });

    const categoryOrder = CATEGORY_ORDER.filter(cat => groups[cat]?.length);
    const frag = document.createDocumentFragment();
    const showHero = activeCategory !== 'Все' && !searchQuery;

    if (showHero) {
      const total = filtered.length;
      const hero = document.createElement('div');
      hero.className = 'category-hero category-hero--enter';
      hero.innerHTML = `
        <span class="category-hero__label">Категория</span>
        <h2 class="category-hero__title">${escapeHtml(activeCategory)}</h2>
        <p class="category-hero__meta">${total} ${pluralPos(total)} в меню</p>`;
      frag.appendChild(hero);
    }

    categoryOrder.forEach((cat, index) => {
      const items = groups[cat];
      const sec = document.createElement('section');
      sec.className = 'section section--enter';
      sec.dataset.cat = cat;
      sec.style.animationDelay = `${Math.min(index, 8) * 0.04}s`;

      if (!showHero) {
        const head = document.createElement('div');
        head.className = 'section-title';
        head.innerHTML = `
          <span class="section-title__text">${escapeHtml(cat)}</span>
          <span class="section-title__line" aria-hidden="true"></span>
          <span class="section-title__count">${items.length} поз.</span>`;
        sec.appendChild(head);
      }

      groupBySubcat(items).forEach(({ title, items: subItems }) => {
        if (title) {
          const subTitle = document.createElement('div');
          subTitle.className = 'subcategory-title';
          subTitle.innerHTML = `
            <span class="subcategory-title__text">${escapeHtml(title)}</span>
            <span class="subcategory-title__count">${subItems.length} поз.</span>`;
          sec.appendChild(subTitle);
        }
        const grid = document.createElement('div');
        grid.className = viewMode === 'list' ? 'grid grid--list' : 'grid';
        if (subItems.every(isBarItem)) grid.classList.add('grid--bar');
        subItems.forEach(item => grid.appendChild(buildCard(item)));
        sec.appendChild(grid);
      });

      frag.appendChild(sec);
    });

    root.replaceChildren(frag);
    observeSections(root);
  }

  /* ── Lightbox ── */
  let lightboxEl = null;
  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox';
    lightboxEl.hidden = true;
    lightboxEl.innerHTML = `
      <div class="lightbox__backdrop" data-close="1"></div>
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="">
        <figcaption class="lightbox__cap"></figcaption>
      </figure>
      <button type="button" class="lightbox__close" data-close="1" aria-label="Закрыть">✕</button>`;
    document.body.appendChild(lightboxEl);

    let startY = 0;
    lightboxEl.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) closeLightbox();
    });
    lightboxEl.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
    }, { passive: true });
    lightboxEl.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 80) closeLightbox();
    }, { passive: true });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !lightboxEl.hidden) closeLightbox();
    });
    return lightboxEl;
  }

  function openLightbox(src, alt) {
    if (!src) return;
    const box = ensureLightbox();
    const img = box.querySelector('.lightbox__img');
    const cap = box.querySelector('.lightbox__cap');
    img.src = src;
    img.alt = alt || '';
    cap.textContent = alt || '';
    box.hidden = false;
    document.body.classList.add('lightbox-open');
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.hidden = true;
    document.body.classList.remove('lightbox-open');
  }

  function buildRules() {
    const root = document.getElementById('rules-root');
    if (!root) return;
    root.innerHTML = `
      <div class="rules-page">
        <button type="button" class="rules-back" id="rules-back">← Вернуться к меню</button>
        <h2 class="rules-page__title">Правила заведения</h2>
        <p class="rules-page__intro">
          Ознакомьтесь с правилами посещения заведения OBLAKO.
        </p>
        <div class="rules-list">
          ${typeof RULES !== 'undefined' ? RULES.map((section, idx) => `
            <details class="rules-block" ${idx === 0 ? 'open' : ''}>
              <summary class="rules-block__title">${escapeHtml(section.title)}</summary>
              <ul class="rules-block__list">
                ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </details>
          `).join('') : '<p>Правила загружаются...</p>'}
        </div>
      </div>`;

    document.getElementById('rules-back')?.addEventListener('click', () => {
      activeCategory = 'Все';
      buildTabs();
      setViewMode();
      document.querySelector('.tabs-outer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    try { localStorage.setItem(RULES_SEEN_KEY, '1'); } catch (_) { /* ignore */ }
  }

  function openRules() {
    activeCategory = RULES_TAB;
    buildTabs();
    setViewMode();
    document.querySelector('.tabs-outer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goHome() {
    activeCategory = 'Все';
    searchQuery = '';
    const searchInput = document.getElementById('search');
    if (searchInput) searchInput.value = '';
    updateSearchClear();
    buildTabs();
    setViewMode();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToTabs() {
    document.querySelector('.tabs-outer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateSearchClear() {
    const input = document.getElementById('search');
    const clearBtn = document.getElementById('search-clear');
    if (input && clearBtn) clearBtn.hidden = !input.value.trim();
  }

  function clearSearch() {
    const input = document.getElementById('search');
    if (!input) return;
    input.value = '';
    searchQuery = '';
    updateSearchClear();
    buildTabs();
    setViewMode();
    input.focus();
  }

  function applySearch(value) {
    searchQuery = value;
    if (searchQuery) activeCategory = 'Все';
    updateSearchClear();
    buildTabs();
    setViewMode();
  }

  document.getElementById('view-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    viewMode = btn.dataset.view;
    document.querySelectorAll('.view-toggle__btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewMode);
    });
    setViewMode();
  });

  document.getElementById('search')?.addEventListener('input', (e) => {
    const value = e.target.value;
    updateSearchClear();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applySearch(value), 140);
  });
  document.getElementById('search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSearch();
  });
  document.getElementById('search-clear')?.addEventListener('click', clearSearch);
  document.getElementById('open-rules')?.addEventListener('click', openRules);

  function trackEvent(eventType, meta = {}) {
    if (location.protocol === 'file:') return;
    fetch(`${apiUrl('/api/analytics/event')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, path: location.pathname, ...meta }),
      keepalive: true,
    }).catch(() => {});
  }

  function trackCategoryView(category) {
    trackEvent('category_view', { category });
  }

  function applyMenuPayload(data, { fromApi = false } = {}) {
    if (!data?.items?.length) return false;
    MENU.length = 0;
    data.items.forEach(item => {
      const next = { ...item };
      if (next.image) next.image = resolveImageUrl(next.image);
      if (next.imageFull) next.imageFull = resolveImageUrl(next.imageFull);
      if (!next.noPhoto && !isBarItem(next)) {
        if (!next.image && typeof IMAGE_MAP !== 'undefined' && IMAGE_MAP[next.id]) {
          next.image = resolveImageUrl(IMAGE_MAP[next.id]);
        }
        // Prefer local WebP when available on Pages
        if (dishWebp(next, 400)) {
          next.image = dishWebp(next, 400);
          next.imageFull = dishWebp(next, 800);
          next.imageSrcset = `${dishWebp(next, 400)} 400w, ${dishWebp(next, 800)} 800w`;
        }
      } else {
        next.noPhoto = true;
        next.image = undefined;
      }
      MENU.push(next);
    });
    if (data.categories?.length) {
      CATEGORY_ORDER.length = 0;
      data.categories.forEach(c => CATEGORY_ORDER.push(c));
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        categories: [...CATEGORY_ORDER],
        items: MENU,
      }));
    } catch (_) { /* quota */ }
    return true;
  }

  async function loadMenuJson() {
    try {
      const res = await fetch(`data/menu.json?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      return applyMenuPayload(data);
    } catch {
      return false;
    }
  }

  async function fetchMenuOnce(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${apiUrl('/api/menu')}?_=${Date.now()}`, {
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

  async function loadMenuFromApi() {
    if (location.protocol === 'file:') return;
    const delays = [0, 2500, 6000];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
      try {
        const data = await fetchMenuOnce(i === 0 ? 10000 : 25000);
        if (applyMenuPayload(data, { fromApi: true })) {
          buildTabs();
          setViewMode();
          trackEvent('page_view');
          return;
        }
      } catch (_) { /* retry */ }
    }
  }

  function hydrateFromCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data?.items?.length) return false;
      if (Date.now() - (data.savedAt || 0) > 1000 * 60 * 60 * 24) return false;
      return applyMenuPayload(data);
    } catch {
      return false;
    }
  }

  // Enrich static MENU with webp paths before first paint
  if (typeof MENU !== 'undefined') {
    MENU.forEach(item => {
      if (isBarItem(item)) {
        item.noPhoto = true;
        return;
      }
      if (dishWebp(item, 400)) {
        item.image = dishWebp(item, 400);
        item.imageFull = dishWebp(item, 800);
      } else if (typeof IMAGE_MAP !== 'undefined' && IMAGE_MAP[item.id]) {
        item.image = IMAGE_MAP[item.id];
      }
    });
  }

  window.OBLAKO = Object.assign(window.OBLAKO || {}, {
    openRules,
    goHome,
    scrollToTabs,
    openCart: () => window.OBLAKO_CART?.open(),
    reloadMenu: loadMenuFromApi,
    refreshQty: refreshAllQty,
  });

  window.addEventListener('oblako-cart-change', refreshAllQty);

  showSkeletons();
  hydrateFromCache();
  buildTabs();
  setViewMode();

  (async () => {
    const ok = await loadMenuJson();
    if (ok) {
      buildTabs();
      setViewMode();
    }
    loadMenuFromApi();
  })();

  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    fetchMenuOnce(12000)
      .then(data => {
        if (!applyMenuPayload(data, { fromApi: true })) return;
        buildTabs();
        setViewMode();
      })
      .catch(() => {});
  }, 120000);
})();
