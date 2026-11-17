/* OBLAKO guest menu — data from data/menu.json + data/site.json */
(function () {
  'use strict';

  /* ---------- Constants & state ---------- */
  const ALL_TAB = 'Все';
  const RULES_TAB = 'Правила заведения';
  const CACHE_KEY = 'oblako-data-v4';
  const POLL_MS = 2 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 10000;
  const SEARCH_DEBOUNCE_MS = 140;
  const EAGER_PHOTOS = 4;
  const BADGES = { new: 'Новинка', hit: 'Хит' };

  const state = { category: ALL_TAB, query: '', view: 'grid' };
  let menu = { categories: [], items: [] };
  let site = null;
  let signature = '';
  let cardIndex = 0;
  let searchTimer = null;
  let sectionObserver = null;

  const $ = (id) => document.getElementById(id);
  const els = {
    intro: $('home-intro'),
    search: $('search'),
    searchWrap: $('search-wrap'),
    searchClear: $('search-clear'),
    viewToggle: $('view-toggle'),
    tabs: $('tabs'),
    tabsList: $('tabs-list'),
    promos: $('promos'),
    menuRoot: $('menu-root'),
    rulesRoot: $('rules-root'),
    empty: $('empty-state'),
    contacts: $('contacts'),
    dockCall: $('dock-call'),
  };

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatPrice(price) {
    if (price == null || price === '') return 'по запросу';
    return `${Number(price).toLocaleString('ru-RU')} ₸`;
  }

  function pluralPos(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиция';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиции';
    return 'позиций';
  }

  const photoUrl = (item, size) => (item.photo ? `image/dishes/w${size}/${item.photo}` : '');
  const categoryNames = () => menu.categories.map(c => c.name);
  const isCompact = (cat) => Boolean(menu.categories.find(c => c.name === cat)?.compact);
  const findItem = (id) => menu.items.find(i => i.id === id);
  const cartQty = (id) => window.OBLAKO_CART?.qty?.(id) || 0;

  function vibrate(ms) {
    try {
      if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(ms);
    } catch (_) { /* unsupported */ }
  }

  function scrollToTabs() {
    els.tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function telHref(phone) {
    return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
  }

  /* ---------- Filtering ---------- */
  function getFiltered() {
    const q = state.query.toLowerCase().trim();
    return menu.items.filter(item => {
      if (!item.name) return false;
      if (state.category !== ALL_TAB && item.cat !== state.category) return false;
      if (!q) return true;
      return [item.cat, item.subcat, item.name, item.desc, item.about]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }

  /* ---------- Tabs ---------- */
  function renderTabs() {
    const cats = categoryNames().filter(cat => menu.items.some(i => i.cat === cat));
    const frag = document.createDocumentFragment();
    [ALL_TAB, ...cats, RULES_TAB].forEach(cat => {
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
    els.tabsList.querySelectorAll('.tabs__btn').forEach(btn => {
      const on = btn.dataset.cat === cat;
      btn.classList.toggle('is-active', on);
      if (on) btn.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  function selectCategory(cat) {
    if (!cat || cat === state.category) return;
    state.category = cat;
    render();
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

    const inc = el('button', 'card__qty-btn', '+');
    inc.type = 'button';
    inc.dataset.act = 'inc';
    inc.dataset.id = item.id;
    inc.setAttribute('aria-label', 'Больше');

    wrap.append(dec, el('span', 'card__qty-num', String(qty)), inc);
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
    if (!item.photo) {
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
    img.dataset.full = photoUrl(item, 800);
    img.srcset = `${photoUrl(item, 400)} 400w, ${photoUrl(item, 800)} 800w`;
    img.sizes = '(max-width: 767px) 50vw, 260px';
    img.src = photoUrl(item, 400);
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
    const compact = isCompact(item.cat) && !item.photo;
    const card = el('article', compact ? 'card card--bar' : 'card');
    card.dataset.id = item.id;
    if (item.stop) card.classList.add('card--stop');

    if (!compact) {
      card.appendChild(buildPhoto(item, cardIndex < EAGER_PHOTOS && !state.query));
      cardIndex++;
    }

    const body = el('div', 'card__body');
    if (item.stop || BADGES[item.badge]) {
      const tags = el('div', 'card__tags');
      if (item.stop) tags.appendChild(el('span', 'card__tag card__tag--stop', 'Нет в наличии'));
      else tags.appendChild(el('span', `card__tag card__tag--${item.badge}`, BADGES[item.badge]));
      body.appendChild(tags);
    }
    body.appendChild(el('h3', 'card__title', item.name));
    // No composition → no line at all, so the layout never reserves empty space
    if (item.desc) body.appendChild(el('p', 'card__desc', item.desc));
    if (item.about) body.appendChild(el('p', 'card__about', item.about));

    const footer = el('div', 'card__footer');
    footer.appendChild(buildPrice(item));
    if (item.price != null && !item.stop) footer.appendChild(buildQtyControls(item));
    body.appendChild(footer);

    card.appendChild(body);
    return card;
  }

  function refreshQty(id) {
    const wrap = els.menuRoot.querySelector(`.card__qty[data-qty-for="${CSS.escape(id)}"]`);
    const item = findItem(id);
    if (wrap && item) wrap.replaceWith(buildQtyControls(item));
  }

  function refreshAllQty() {
    els.menuRoot.querySelectorAll('.card__qty[data-qty-for]')
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
    if (items.every(i => isCompact(i.cat) && !i.photo)) grid.classList.add('grid--bar');
    items.forEach(item => grid.appendChild(buildCard(item)));
    return grid;
  }

  function buildSection(cat, items, withHead) {
    const sec = el('section', 'section');
    sec.dataset.cat = cat;

    if (withHead) {
      const head = el('div', 'section__head');
      const line = el('span', 'section__line');
      line.setAttribute('aria-hidden', 'true');
      head.append(el('h2', 'section__title', cat), line, el('span', 'section__count', `${items.length} поз.`));
      sec.appendChild(head);
    }

    if (!items.some(i => i.subcat)) {
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

  function renderEmpty(title, hint, actionText, action) {
    const btn = el('button', 'empty__reset', actionText);
    btn.type = 'button';
    btn.addEventListener('click', action);
    els.empty.replaceChildren(el('p', 'empty__title', title), el('p', 'empty__hint', hint), btn);
    els.empty.hidden = false;
  }

  function renderMenu() {
    if (!menu.items.length) return;   // still loading — skeletons stay
    const items = getFiltered();
    cardIndex = 0;

    if (!items.length) {
      els.menuRoot.replaceChildren();
      renderEmpty(
        'Ничего не найдено',
        state.query ? `По запросу «${state.query}» совпадений нет` : 'В этом разделе пока пусто',
        state.query ? 'Сбросить поиск' : 'Показать всё меню',
        () => (state.query ? clearSearch() : goHome()),
      );
      return;
    }
    els.empty.hidden = true;

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
    categoryNames()
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

  /* ---------- Site texts: intro, promos, contacts, rules ---------- */
  function renderSite() {
    if (!site) return;

    const intro = site.home?.intro?.trim();
    els.intro.textContent = intro || '';
    els.intro.hidden = !intro;

    const promos = (site.promos || []).filter(p => p.active && (p.title || p.text));
    els.promos.replaceChildren(...promos.map(p => {
      const card = el('article', 'promo');
      if (p.title) card.appendChild(el('h2', 'promo__title', p.title));
      if (p.text) card.appendChild(el('p', 'promo__text', p.text));
      return card;
    }));
    els.promos.hidden = !promos.length || state.category === RULES_TAB;

    renderContacts(site.contacts || {});
  }

  function contactLink(href, text, external) {
    const a = el('a', 'contacts__link', text);
    a.href = href;
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  }

  function renderContacts(c) {
    const rows = [];
    if (c.phone) rows.push(contactLink(telHref(c.phone), c.phone));
    if (c.whatsapp) {
      rows.push(contactLink(`https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}`, 'WhatsApp', true));
    }
    if (c.instagram) {
      const handle = String(c.instagram).replace(/^@|^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      rows.push(contactLink(`https://instagram.com/${handle}`, `Instagram @${handle}`, true));
    }
    if (c.address) {
      rows.push(c.mapUrl ? contactLink(c.mapUrl, c.address, true) : el('span', 'contacts__text', c.address));
    } else if (c.mapUrl) {
      rows.push(contactLink(c.mapUrl, 'Мы на карте', true));
    }
    if (c.hours) rows.push(el('span', 'contacts__text', c.hours));

    els.contacts.replaceChildren(...rows);
    els.contacts.hidden = !rows.length;

    els.dockCall.hidden = !c.phone;
    if (c.phone) els.dockCall.href = telHref(c.phone);
  }

  function renderRules() {
    const rules = site?.rules || { sections: [] };
    const wrap = el('div', 'rules');
    const back = el('button', 'rules__back', '← Вернуться к меню');
    back.type = 'button';
    back.dataset.rulesBack = '';
    const list = el('div', 'rules__list');
    rules.sections.forEach((section, idx) => {
      const block = el('details', 'rules-block');
      block.open = idx === 0;
      const ul = el('ul', 'rules-block__list');
      section.items.forEach(text => ul.appendChild(el('li', null, text)));
      block.append(el('summary', 'rules-block__title', section.title), ul);
      list.appendChild(block);
    });
    wrap.append(back, el('h2', 'rules__title', RULES_TAB));
    if (rules.intro) wrap.appendChild(el('p', 'rules__intro', rules.intro));
    wrap.appendChild(list);
    els.rulesRoot.replaceChildren(wrap);
  }

  /* ---------- Render ---------- */
  function render() {
    renderTabs();
    renderSite();
    const rules = state.category === RULES_TAB;

    els.searchWrap.hidden = rules;
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
    const img = photo.querySelector('img');
    if (!img) return;
    const box = ensureLightbox();
    const big = box.querySelector('.lightbox__img');
    big.src = img.dataset.full || img.src;
    big.alt = img.alt;
    box.querySelector('.lightbox__cap').textContent = img.alt;
    lastFocus = document.activeElement;
    box.hidden = false;
    document.body.classList.add('is-locked');
    box.querySelector('.lightbox__close').focus();
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    els.tabsList.addEventListener('click', e => {
      selectCategory(e.target.closest('.tabs__btn')?.dataset.cat);
    });

    els.viewToggle.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn || btn.dataset.view === state.view) return;
      state.view = btn.dataset.view;
      els.viewToggle.querySelectorAll('[data-view]').forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderMenu();
    });

    els.search.addEventListener('input', e => {
      const { value } = e.target;
      updateSearchClear();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = value;
        if (value) state.category = ALL_TAB;
        render();
      }, SEARCH_DEBOUNCE_MS);
    });
    els.search.addEventListener('keydown', e => {
      if (e.key === 'Escape') clearSearch();
      if (e.key === 'Enter') els.search.blur();      // hide the mobile keyboard
    });
    els.searchClear.addEventListener('click', clearSearch);

    els.rulesRoot.addEventListener('click', e => {
      if (!e.target.closest('[data-rules-back]')) return;
      state.category = ALL_TAB;
      render();
      scrollToTabs();
    });

    els.menuRoot.addEventListener('click', e => {
      const photo = e.target.closest('[data-lightbox]');
      if (photo) {
        openLightbox(photo);
        return;
      }

      const add = e.target.closest('[data-add]');
      if (add) {
        const item = findItem(add.dataset.add);
        if (!item) return;
        window.OBLAKO_CART?.add(item);
        vibrate(14);
        refreshQty(item.id);
        return;
      }

      const act = e.target.closest('[data-act]');
      if (act) {
        const { id } = act.dataset;
        if (act.dataset.act === 'inc') window.OBLAKO_CART?.add(findItem(id));
        else window.OBLAKO_CART?.setQty(id, cartQty(id) - 1);
        vibrate(10);
        refreshQty(id);
      }
    });

    els.menuRoot.addEventListener('keydown', e => {
      if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches('[data-lightbox]')) return;
      e.preventDefault();
      openLightbox(e.target);
    });

    window.addEventListener('oblako-cart-change', refreshAllQty);
  }

  /* ---------- Data loading ---------- */
  function applyData(nextMenu, nextSite) {
    if (!Array.isArray(nextMenu?.items) || !Array.isArray(nextMenu?.categories)) return false;
    const next = JSON.stringify([nextMenu, nextSite]);
    if (next === signature) return false;          // nothing changed → no re-render, no scroll jump
    signature = next;
    menu = nextMenu;
    site = nextSite;
    try { localStorage.setItem(CACHE_KEY, next); } catch (_) { /* quota or private mode */ }
    window.dispatchEvent(new CustomEvent('oblako-menu-change'));
    return true;
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      // Unique URL + no-store: fresh data right after the admin publishes
      const res = await fetch(`${url}?_=${Date.now()}`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadData() {
    try {
      const [m, s] = await Promise.all([fetchJson('data/menu.json'), fetchJson('data/site.json')]);
      if (applyData(m, s)) render();
    } catch (_) {
      if (menu.items.length) return;              // cached menu stays on screen
      els.menuRoot.replaceChildren();
      renderEmpty('Меню не загрузилось', 'Проверьте интернет и попробуйте ещё раз', 'Повторить', () => {
        els.empty.hidden = true;
        showSkeletons();
        loadData();
      });
    }
  }

  function hydrateFromCache() {
    try {
      const [m, s] = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') || [];
      return applyData(m, s);
    } catch (_) {
      return false;
    }
  }

  function showSkeletons() {
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
  window.OBLAKO = {
    openRules,
    goHome,
    scrollToTabs,
    findItem,
    isReady: () => menu.items.length > 0,
    servicePercent: () => Number(site?.servicePercent ?? 15),
  };

  bindEvents();
  showSkeletons();
  hydrateFromCache();
  render();
  loadData();

  setInterval(() => {
    if (document.visibilityState === 'visible') loadData();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadData();
  });
})();
