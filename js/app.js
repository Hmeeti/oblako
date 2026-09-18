(function () {
  const header = document.getElementById('header');
  const progress = document.getElementById('scroll-progress');
  const greetingEl = document.getElementById('greeting');
  const clockEl = document.getElementById('live-clock');
  const toast = document.getElementById('toast');
  const dock = document.getElementById('dock');

  /* ── SCROLL PROGRESS + COMPACT HEADER ── */
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (y / max) * 100 : 0;

    if (progress) progress.style.width = `${pct}%`;
    header?.classList.toggle('header--compact', y > 70);
  }, { passive: true });

  /* ── GREETING + CLOCK ── */
  function getGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Доброе утро';
    if (h >= 12 && h < 17) return 'Добрый день';
    if (h >= 17 && h < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  }

  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (greetingEl) greetingEl.textContent = getGreeting();
  updateClock();
  setInterval(updateClock, 30000);

  /* ── WELCOME TOAST ── */
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('toast--show');
    setTimeout(() => toast.classList.remove('toast--show'), 3200);
  }

  const hasSplash = document.getElementById('splash');
  const splashDelay = hasSplash ? 3200 : 800;
  setTimeout(() => showToast('Добро пожаловать в OBLAKO'), splashDelay);

  /* ── DOCK ── */
  if (dock) {
    dock.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !window.OBLAKO) return;

      const action = btn.dataset.action;
      if (action === 'home') window.OBLAKO.goHome();
      if (action === 'categories') window.OBLAKO.scrollToTabs();
      if (action === 'rules') window.OBLAKO.openRules();
      if (action === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });

      dock.querySelectorAll('.dock__btn').forEach(b => b.classList.remove('dock__btn--active'));
      btn.classList.add('dock__btn--active');
    });
  }
})();

const RULES_TAB = 'Правила заведения';
const CATEGORIES = ['Все', ...CATEGORY_ORDER.filter(cat => MENU.some(i => i.name && i.cat === cat)), RULES_TAB];
let activeCategory = 'Все';
let searchQuery = '';
let viewMode = 'grid';

function getCategoryTabs() {
  return ['Все', ...CATEGORY_ORDER.filter(cat => MENU.some(i => i.name && i.cat === cat)), RULES_TAB];
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
  return Boolean(item.name);
}

function getFiltered() {
  if (isRulesView()) return [];

  return MENU.filter(item => {
    if (!isFilled(item)) return false;

    const matchCat = activeCategory === 'Все' || item.cat === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchCat;
    const haystack = [item.cat, item.subcat, item.name, item.desc].filter(Boolean).join(' ').toLowerCase();
    return matchCat && haystack.includes(q);
  });
}

function setViewMode() {
  const searchWrap = document.querySelector('.search-wrap');
  const menuRoot = document.getElementById('menu-root');
  const rulesRoot = document.getElementById('rules-root');
  const emptyEl = document.getElementById('empty-state');

  if (isRulesView()) {
    searchWrap.style.display = 'none';
    document.getElementById('view-toggle').style.display = 'none';
    menuRoot.style.display = 'none';
    emptyEl.classList.remove('visible');
    rulesRoot.classList.add('is-visible');
    buildRules();
    return;
  }

  searchWrap.style.display = '';
  document.getElementById('view-toggle').style.display = '';
  menuRoot.style.display = '';
  menuRoot.classList.toggle('menu-root--list', viewMode === 'list');
  rulesRoot.classList.remove('is-visible');
  buildMenu();
}

function buildTabs() {
  const tabsEl = document.getElementById('tabs');
  const cats = getCategoryTabs();
  tabsEl.innerHTML = cats.map(cat => {
    const isRules = cat === RULES_TAB;
    const active = cat === activeCategory ? ' active' : '';
    const rulesClass = isRules ? ' tab-btn--rules' : '';
    return `<button class="tab-btn${active}${rulesClass}" data-cat="${cat}">${cat}</button>`;
  }).join('');

  tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      if (activeCategory !== 'Все' && activeCategory !== RULES_TAB) {
        trackCategoryView(activeCategory);
      }
      buildTabs();
      setViewMode();
    });
  });

  const activeBtn = tabsEl.querySelector('.tab-btn.active');
  if (activeBtn) {
    activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}

function buildMenu() {
  const root = document.getElementById('menu-root');
  const emptyEl = document.getElementById('empty-state');
  const filtered = getFiltered();

  if (!filtered.length) {
    root.innerHTML = '';
    emptyEl.classList.add('visible');
    return;
  }

  emptyEl.classList.remove('visible');

  // 1. Создаем объект групп
  const groups = {};
  filtered.forEach(item => {
    if (!groups[item.cat]) groups[item.cat] = [];
    groups[item.cat].push(item);
  });

  // 2. Теперь фильтруем порядок категорий
  const categoryOrder = CATEGORY_ORDER.filter(cat => groups[cat]?.length);

  root.innerHTML = '';

  const showHero = activeCategory !== 'Все' && !searchQuery;

  if (showHero) {
    const total = filtered.length;
    const hero = document.createElement('div');
    hero.className = 'category-hero category-hero--enter';
    hero.innerHTML = `
      <span class="category-hero__label">Категория</span>
      <h2 class="category-hero__title">${activeCategory}</h2>
      <p class="category-hero__meta">${total} ${pluralPos(total)} в меню</p>
    `;
    root.appendChild(hero);
  }

  categoryOrder.forEach((cat, index) => {
    const items = groups[cat];
    const sec = document.createElement('div');
    sec.className = 'section section--enter';
    sec.style.animationDelay = `${index * 0.05}s`;

    if (!showHero) {
      sec.innerHTML = `
        <div class="section-title">
          <span class="section-title__text">${cat}</span>
          <span class="section-title__count">${items.length} поз.</span>
        </div>
      `;
    }

    appendItemGroups(sec, items);
    root.appendChild(sec);
  });
}

function groupBySubcat(items) {
  if (!items.some(i => i.subcat)) {
    return [{ title: null, items }];
  }

  const order = [];
  const map = {};
  items.forEach(item => {
    const key = item.subcat;
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
        <span class="subcategory-title__text">${title}</span>
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
  return `${price.toLocaleString('ru-RU')} ₸`;
}

function buildPriceBlock(item) {
  if (item.price2 != null) {
    return `
      <div class="card-prices">
        <div class="card-price-row">
          ${item.priceLabel ? `<span class="card-price-label">${item.priceLabel}</span>` : ''}
          <span class="card-price">${formatPrice(item.price)}</span>
        </div>
        <div class="card-price-row">
          ${item.price2Label ? `<span class="card-price-label">${item.price2Label}</span>` : ''}
          <span class="card-price">${formatPrice(item.price2)}</span>
        </div>
      </div>`;
  }

  return `
    <span class="card-price">${formatPrice(item.price)}</span>
    ${item.volume ? `<span class="card-volume">${item.volume}</span>` : ''}
  `;
}

function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'card card--filled';

  const photoInner = item.image
    ? `<img src="${item.image}" alt="${item.name}" class="card-photo__img" loading="lazy" decoding="async">`
    : '';

  card.innerHTML = `
    <div class="card-photo">${photoInner}</div>
    <div class="card-body">
      <h3 class="card-title">${item.name}</h3>
      ${item.desc ? `<p class="card-desc">${item.desc}</p>` : ''}
      <div class="card-footer">
        ${buildPriceBlock(item)}
      </div>
    </div>
  `;
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
            <h3 class="rules-block__title">${section.title}</h3>
            <ul class="rules-block__list">
              ${section.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </section>
        `).join('') : '<p>Правила загружаются...</p>'}
      </div>
    </div>
  `;

  const backBtn = document.getElementById('rules-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      activeCategory = 'Все';
      buildTabs();
      setViewMode();
      document.querySelector('.tabs-outer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
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

window.OBLAKO = { openRules, goHome, scrollToTabs };

function updateSearchClear() {
  const input = document.getElementById('search');
  const clearBtn = document.getElementById('search-clear');
  if (input && clearBtn) {
    clearBtn.hidden = !input.value.trim();
  }
}

function clearSearch() {
  const input = document.getElementById('search');
  if (input) {
    input.value = '';
    searchQuery = '';
    updateSearchClear();
    buildTabs();
    setViewMode();
    input.focus();
  }
}

document.getElementById('view-toggle')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  viewMode = btn.dataset.view;
  document.querySelectorAll('.view-toggle__btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewMode);
  });
  setViewMode();
});

document.getElementById('search')?.addEventListener('input', e => {
  searchQuery = e.target.value;
  if (searchQuery) activeCategory = 'Все';
  updateSearchClear();
  buildTabs();
  setViewMode();
});

document.getElementById('search')?.addEventListener('keydown', e => {
  if (e.key === 'Escape') clearSearch();
});

document.getElementById('search-clear')?.addEventListener('click', clearSearch);
document.getElementById('open-rules')?.addEventListener('click', openRules);

function trackEvent(eventType, meta = {}) {
  if (location.protocol === 'file:') return;
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, path: location.pathname, ...meta }),
    keepalive: true,
  }).catch(() => {});
}

function trackCategoryView(category) {
  trackEvent('category_view', { category });
}

function applyApiMenu(data) {
  if (!data?.items?.length) return;

  // Full replace from API so admin edits/deletes show on the public site
  MENU.length = 0;
  data.items.forEach(item => MENU.push(item));

  if (data.categories?.length) {
    CATEGORY_ORDER.length = 0;
    data.categories.forEach(c => CATEGORY_ORDER.push(c));
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

  try {
    const res = await fetch('/api/menu');
    if (!res.ok) return;
    const data = await res.json();
    applyApiMenu(data);
    buildTabs();
    setViewMode();
    trackEvent('page_view');
  } catch (_) {
    // Offline / no server — local MENU from data.js is enough
  }
}

// Always show menu from data.js first, then enhance from API if server is running
buildTabs();
setViewMode();
loadMenuFromApi();

/* ── ЭФФЕКТЫ И ОСТАЛЬНАЯ ЛОГИКА ── */
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toast = document.getElementById('toast');
  const logo = document.querySelector('.logo-img');
  const menuRoot = document.getElementById('menu-root');
  const searchInput = document.getElementById('search');

  const TIPS = [
    'Спросите официанта о блюде дня',
    'Идеальное место для вечернего коктейля',
    'Попробуйте что-нибудь из десертов — не пожалеете',
    'Бронируйте стол заранее в выходные',
    'Наш бармен создаст авторский напиток по вашему вкусу',
    'Уютная атмосфера для долгих разговоров',
  ];

  const SHAKE_QUOTES = [
    '☁️ OBLAKO чувствует вашу энергию!',
    '✦ Сегодня отличный день для лаунджа',
    '🥂 Пора заказать что-нибудь особенное',
    '☁️ арафат благодарит за визит',
  ];

  const SEARCH_SECRETS = {
    арафат: '☁️ Вы нашли секрет OBLAKO!',
    oblako: '☁️ Welcome to the cloud, friend',
    vip: '✦ Попробуйте 5 раз нажать на логотип...',
    hmeeti: '✦ Разработчик отмечает ваш интерес',
    кофе: '☕ Бариста уже готовит что-то особенное',
    кальян: '🌙 Вечер создан для отдыха',
  };

  function showToast(msg, duration = 2800) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('toast--show');
    setTimeout(() => toast.classList.remove('toast--show'), duration);
  }

  /* ── LOUNGE TIPS ── */
  const tipEl = document.createElement('p');
  tipEl.className = 'lounge-tip';
  tipEl.setAttribute('role', 'note');
  const searchWrap = document.querySelector('.search-wrap');
  if (searchWrap) {
    searchWrap.after(tipEl);
    let tipIdx = 0;

    function showTip() {
      tipEl.classList.add('lounge-tip--fade');
      setTimeout(() => {
        tipEl.innerHTML = `<span class="lounge-tip__icon">✦</span>${TIPS[tipIdx]}`;
        tipEl.classList.remove('lounge-tip--fade');
        tipIdx = (tipIdx + 1) % TIPS.length;
      }, 350);
    }

    showTip();
    if (!reduced) setInterval(showTip, 7000);
  }

  /* ── NIGHT WARM TINT (after 22:00) ── */
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) {
    document.body.classList.add('night-warm');
  }

  /* ── SEARCH EASTER EGGS ── */
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q = searchInput.value.trim().toLowerCase();
      if (SEARCH_SECRETS[q]) showToast(SEARCH_SECRETS[q]);
    });
  }

  /* ── CARD RIPPLE + TAP ── */
  if (menuRoot) {
    menuRoot.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'card-ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      card.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      card.classList.remove('card--bounce');
      void card.offsetWidth;
      card.classList.add('card--bounce');

      if (Math.random() > 0.6) {
        showToast('Скоро появится в меню', 2000);
      }
    });
  }

  /* ── LOGO LONG-PRESS SPIN ── */
  if (logo && !reduced) {
    let pressTimer = null;

    const startPress = () => {
      pressTimer = setTimeout(() => {
        logo.classList.remove('logo-img--spin');
        void logo.offsetWidth;
        logo.classList.add('logo-img--spin');
        showToast('☁️ OBLAKO', 1500);
      }, 800);
    };

    const cancelPress = () => clearTimeout(pressTimer);

    logo.addEventListener('mousedown', startPress);
    logo.addEventListener('mouseup', cancelPress);
    logo.addEventListener('mouseleave', cancelPress);
    logo.addEventListener('touchstart', startPress, { passive: true });
    logo.addEventListener('touchend', cancelPress);
  }

  /* ── SHAKE (mobile) ── */
  if (!reduced && window.DeviceMotionEvent) {
    let lastShake = 0;
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;

    window.addEventListener('devicemotion', e => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      const delta = Math.abs(acc.x - lastX) + Math.abs(acc.y - lastY) + Math.abs(acc.z - lastZ);
      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;

      const now = Date.now();
      if (delta > 22 && now - lastShake > 2500) {
        lastShake = now;
        const quote = SHAKE_QUOTES[Math.floor(Math.random() * SHAKE_QUOTES.length)];
        showToast(quote);
      }
    });
  }

  /* ── hmeeti EASTER EGG ── */
  const devName = document.querySelector('.site-footer__dev-name');
  if (devName) {
    devName.addEventListener('click', () => {
      devName.classList.remove('site-footer__dev-name--pulse');
      void devName.offsetWidth;
      devName.classList.add('site-footer__dev-name--pulse');
      showToast('Сделано с душой для OBLAKO ✦');
    });
  }
})();