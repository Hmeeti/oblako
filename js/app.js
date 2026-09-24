/* OBLAKO guest menu — render, search, tabs, API sync */
(function () {
  const RULES_TAB = 'Правила заведения';
  let activeCategory = 'Все';
  let searchQuery = '';
  let viewMode = 'grid';
  let searchTimer = null;
  let tabsBound = false;
  let cardIndex = 0;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
    tabsEl.innerHTML = cats.map(cat => {
      const isRules = cat === RULES_TAB;
      const active = cat === activeCategory ? ' active' : '';
      const rulesClass = isRules ? ' tab-btn--rules' : '';
      return `<button type="button" class="tab-btn${active}${rulesClass}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
    }).join('');

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

  function buildMenu() {
    const root = document.getElementById('menu-root');
    const emptyEl = document.getElementById('empty-state');
    if (!root || !emptyEl) return;

    const filtered = getFiltered();
    cardIndex = 0;

    if (!filtered.length) {
      root.innerHTML = '';
      emptyEl.classList.add('visible');
      return;
    }

    emptyEl.classList.remove('visible');

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
        <p class="category-hero__meta">${total} ${pluralPos(total)} в меню</p>
      `;
      frag.appendChild(hero);
    }

    categoryOrder.forEach((cat, index) => {
      const items = groups[cat];
      const sec = document.createElement('section');
      sec.className = 'section section--enter';
      sec.style.animationDelay = `${Math.min(index, 8) * 0.04}s`;

      if (!showHero) {
        sec.innerHTML = `
          <div class="section-title">
            <span class="section-title__text">${escapeHtml(cat)}</span>
            <span class="section-title__count">${items.length} поз.</span>
          </div>
        `;
      }

      appendItemGroups(sec, items);
      frag.appendChild(sec);
    });

    root.replaceChildren(frag);
  }

  function groupBySubcat(items) {
    if (!items.some(i => i.subcat)) {
      return [{ title: null, items }];
    }

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

  function appendItemGroups(parent, items) {
    groupBySubcat(items).forEach(({ title, items: subItems }) => {
      if (title) {
        const subTitle = document.createElement('div');
        subTitle.className = 'subcategory-title';
        subTitle.innerHTML = `
          <span class="subcategory-title__text">${escapeHtml(title)}</span>
          <span class="subcategory-title__count">${subItems.length} поз.</span>
        `;
        parent.appendChild(subTitle);
      }

      const grid = document.createElement('div');
      grid.className = viewMode === 'list' ? 'grid grid--list' : 'grid';
      subItems.forEach(item => grid.appendChild(buildCard(item)));
      parent.appendChild(grid);
    });
  }

  function formatPrice(price) {
    if (price == null) return 'по запросу';
    return `${Number(price).toLocaleString('ru-RU')} ₸`;
  }

  function buildPriceBlock(item) {
    if (item.price2 != null) {
      return `
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
    }

    return `
      <span class="card-price">${formatPrice(item.price)}</span>
      ${item.volume ? `<span class="card-volume">${escapeHtml(item.volume)}</span>` : ''}
    `;
  }

  const BAR_CATS = new Set(['Кофе и чай', 'Безалкогольные', 'Алкогольные']);

  function isBarItem(item) {
    return BAR_CATS.has(item?.cat);
  }

  function buildCard(item) {
    const card = document.createElement('article');
    const bar = isBarItem(item);
    card.className = bar ? 'card card--filled card--bar' : 'card card--filled';
    card.dataset.id = item.id || '';

    const idx = cardIndex++;
    const eager = !bar && idx < 4 && !searchQuery;
    const showPhoto = !bar && item.image;
    const photoBlock = showPhoto
      ? `<div class="card-photo"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="card-photo__img" width="720" height="720" decoding="async" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} sizes="(max-width: 640px) 46vw, 240px"></div>`
      : '';

    const canAdd = item.price != null;
    card.innerHTML = `
      ${photoBlock}
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(item.name)}</h3>
        ${item.desc ? `<p class="card-desc">${escapeHtml(item.desc)}</p>` : ''}
        <div class="card-footer">
          ${buildPriceBlock(item)}
          ${canAdd ? `<button type="button" class="card-add" data-add="${escapeHtml(item.id)}">В заказ</button>` : ''}
        </div>
      </div>
    `;

    const addBtn = card.querySelector('[data-add]');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.OBLAKO_CART) window.OBLAKO_CART.add(item);
        else if (window.OBLAKO?.addToCart) window.OBLAKO.addToCart(item);
      });
    }

    return card;
  }

  function buildRules() {
    const root = document.getElementById('rules-root');
    if (!root) return;
    root.innerHTML = `
      <div class="rules-page">
        <button type="button" class="rules-back" id="rules-back">← Вернуться к меню</button>
        <h2 class="rules-page__title">Правила заведения</h2>
        <p class="rules-page__intro">
          Ознакомьтесь с правилами посещения заведения OBLAKO. Продолжая пользоваться меню,
          вы соглашаетесь с условиями обслуживания.
        </p>
        <div class="rules-list">
          ${typeof RULES !== 'undefined' ? RULES.map(section => `
            <section class="rules-block">
              <h3 class="rules-block__title">${escapeHtml(section.title)}</h3>
              <ul class="rules-block__list">
                ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </section>
          `).join('') : '<p>Правила загружаются...</p>'}
        </div>
      </div>
    `;

    document.getElementById('rules-back')?.addEventListener('click', () => {
      activeCategory = 'Все';
      buildTabs();
      setViewMode();
      document.querySelector('.tabs-outer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
    const base = (window.OBLAKO_CONFIG && window.OBLAKO_CONFIG.apiBase)
      ? String(window.OBLAKO_CONFIG.apiBase).replace(/\/$/, '')
      : '';
    fetch(`${base}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, path: location.pathname, ...meta }),
      keepalive: true,
    }).catch(() => {});
  }

  function trackCategoryView(category) {
    trackEvent('category_view', { category });
  }

  function apiBase() {
    return (window.OBLAKO_CONFIG && window.OBLAKO_CONFIG.apiBase)
      ? String(window.OBLAKO_CONFIG.apiBase).replace(/\/$/, '')
      : '';
  }

  function resolveImageUrl(src) {
    if (!src) return '';
    const s = String(src);
    if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
    // Absolute server paths (/image/uploads/...) must hit the API host on GitHub Pages
    if (s.startsWith('/')) {
      const base = apiBase();
      return base ? `${base}${s}` : s;
    }
    return s;
  }

  function applyApiMenu(data) {
    if (!data?.items?.length) return false;

    MENU.length = 0;
    data.items.forEach(item => {
      const next = { ...item };
      if (next.image) next.image = resolveImageUrl(next.image);
      // Fallback to static map only when API item has no photo
      else if (typeof IMAGE_MAP !== 'undefined' && IMAGE_MAP[next.id]) {
        next.image = resolveImageUrl(IMAGE_MAP[next.id]);
      }
      MENU.push(next);
    });

    if (data.categories?.length) {
      CATEGORY_ORDER.length = 0;
      data.categories.forEach(c => CATEGORY_ORDER.push(c));
    }
    return true;
  }

  function apiUrl(path) {
    const base = apiBase();
    if (!path.startsWith('/')) path = `/${path}`;
    return `${base}${path}`;
  }

  async function fetchMenuOnce(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${apiUrl('/api/menu')}?_=${Date.now()}`;
      const res = await fetch(url, {
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
    if (location.protocol === 'file:') {
      const root = document.getElementById('menu-root');
      if (root) {
        const tip = document.createElement('div');
        tip.className = 'menu-loading menu-loading--error';
        tip.innerHTML = 'Сайт нужно открывать через сервер:<br><strong>http://localhost:3000</strong><br>Запусти файл <code>START.bat</code> в папке проекта.';
        root.prepend(tip);
      }
      return;
    }

    // Normalize static images for hybrid hosting
    MENU.forEach(item => {
      if (item.image) item.image = resolveImageUrl(item.image);
    });

    const delays = [0, 2500, 6000];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
      try {
        // Cold start on Render free tier can take ~30s — later attempts use longer timeout
        const data = await fetchMenuOnce(i === 0 ? 10000 : 25000);
        if (applyApiMenu(data)) {
          buildTabs();
          setViewMode();
          trackEvent('page_view');
          return;
        }
      } catch (_) {
        // retry
      }
    }
  }

  // Soft refresh every 2 minutes so other phones pick up admin edits via API
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    fetchMenuOnce(12000)
      .then(data => {
        if (!applyApiMenu(data)) return;
        buildTabs();
        setViewMode();
      })
      .catch(() => {});
  }, 120000);

  window.OBLAKO = Object.assign(window.OBLAKO || {}, {
    openRules,
    goHome,
    scrollToTabs,
    openCart: () => window.OBLAKO_CART?.open(),
    reloadMenu: loadMenuFromApi,
  });

  buildTabs();
  setViewMode();
  loadMenuFromApi();
})();
