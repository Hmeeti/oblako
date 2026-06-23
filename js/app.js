const RULES_TAB = 'Правила заведения';
const CATEGORIES = ['Все', ...new Set(MENU.map(i => i.cat)), RULES_TAB];
let activeCategory = 'Все';
let searchQuery = '';
let viewMode = 'grid';

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

function getFiltered() {
  if (isRulesView()) return [];

  return MENU.filter(item => {
    const matchCat = activeCategory === 'Все' || item.cat === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchCat;
    return matchCat && item.cat.toLowerCase().includes(q);
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
  tabsEl.innerHTML = CATEGORIES.map(cat => {
    const isRules = cat === RULES_TAB;
    const active = cat === activeCategory ? ' active' : '';
    const rulesClass = isRules ? ' tab-btn--rules' : '';
    return `<button class="tab-btn${active}${rulesClass}" data-cat="${cat}">${cat}</button>`;
  }).join('');

  tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
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

  const groups = {};
  filtered.forEach(item => {
    if (!groups[item.cat]) groups[item.cat] = [];
    groups[item.cat].push(item);
  });

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

  Object.entries(groups).forEach(([cat, items], index) => {
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

    const grid = document.createElement('div');
    grid.className = viewMode === 'list' ? 'grid grid--list' : 'grid';

    items.forEach(() => {
      grid.appendChild(buildCard());
    });

    sec.appendChild(grid);
    root.appendChild(sec);
  });
}

function buildCard() {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-photo"></div>
    <div class="card-body">
      <div class="card-placeholder card-placeholder--title"></div>
      <div class="card-placeholder card-placeholder--desc"></div>
      <div class="card-placeholder card-placeholder--desc card-placeholder--short"></div>
      <div class="card-footer">
        <div class="card-placeholder card-placeholder--price"></div>
        <div class="card-placeholder card-placeholder--weight"></div>
      </div>
    </div>
  `;
  return card;
}

function buildRules() {
  const root = document.getElementById('rules-root');
  root.innerHTML = `
    <div class="rules-page">
      <button type="button" class="rules-back" id="rules-back">← Вернуться к меню</button>
      <h2 class="rules-page__title">Правила заведения</h2>
      <p class="rules-page__intro">
        Ознакомьтесь с правилами посещения заведения OBLAKO. Продолжая пользоваться меню,
        вы соглашаетесь с условиями обслуживания.
      </p>
      <div class="rules-list">
        ${RULES.map(section => `
          <section class="rules-block">
            <h3 class="rules-block__title">${section.title}</h3>
            <ul class="rules-block__list">
              ${section.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </section>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('rules-back').addEventListener('click', () => {
    activeCategory = 'Все';
    buildTabs();
    setViewMode();
    document.querySelector('.tabs-outer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}


function openRules() {
  activeCategory = RULES_TAB;
  buildTabs();
  setViewMode();
  document.querySelector('.tabs-outer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goHome() {
  activeCategory = 'Все';
  searchQuery = '';
  document.getElementById('search').value = '';
  updateSearchClear();
  buildTabs();
  setViewMode();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToTabs() {
  document.querySelector('.tabs-outer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.OBLAKO = { openRules, goHome, scrollToTabs };

function updateSearchClear() {
  const input = document.getElementById('search');
  const clearBtn = document.getElementById('search-clear');
  clearBtn.hidden = !input.value.trim();
}

function clearSearch() {
  const input = document.getElementById('search');
  input.value = '';
  searchQuery = '';
  updateSearchClear();
  buildTabs();
  setViewMode();
  input.focus();
}

document.getElementById('view-toggle').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  viewMode = btn.dataset.view;
  document.querySelectorAll('.view-toggle__btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewMode);
  });
  setViewMode();
});

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  if (searchQuery) activeCategory = 'Все';
  updateSearchClear();
  buildTabs();
  setViewMode();
});

document.getElementById('search').addEventListener('keydown', e => {
  if (e.key === 'Escape') clearSearch();
});

document.getElementById('search-clear').addEventListener('click', clearSearch);
document.getElementById('open-rules').addEventListener('click', openRules);

buildTabs();
setViewMode();

