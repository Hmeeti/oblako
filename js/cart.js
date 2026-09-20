/* OBLAKO elite cart — local guest basket with 15% service */
(function () {
  const STORAGE_KEY = 'oblako-cart-v1';
  const SERVICE_RATE = 0.15;

  /** @type {{id:string,name:string,price:number,image?:string,qty:number}[]} */
  let lines = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(l => l && l.id && l.price != null) : [];
    } catch {
      return [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }

  function money(n) {
    return `${Math.round(n).toLocaleString('ru-RU')} ₸`;
  }

  function count() {
    return lines.reduce((s, l) => s + l.qty, 0);
  }

  function subtotal() {
    return lines.reduce((s, l) => s + l.price * l.qty, 0);
  }

  function service() {
    return Math.round(subtotal() * SERVICE_RATE);
  }

  function total() {
    return subtotal() + service();
  }

  function findMenuItem(id) {
    return (typeof MENU !== 'undefined' ? MENU : []).find(i => i.id === id || i.uid === id);
  }

  function add(itemOrId, qty = 1) {
    const item = typeof itemOrId === 'string' ? findMenuItem(itemOrId) : itemOrId;
    if (!item || item.price == null) return false;

    const existing = lines.find(l => l.id === item.id);
    if (existing) {
      existing.qty += qty;
    } else {
      lines.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || '',
        qty: Math.max(1, qty),
      });
    }
    save();
    render();
    pulseFab();
    if (typeof showToast === 'function') showToast(`Добавлено: ${item.name}`, 1800);
    else toastFallback(`Добавлено: ${item.name}`);
    return true;
  }

  function setQty(id, qty) {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    if (qty <= 0) {
      lines = lines.filter(l => l.id !== id);
    } else {
      line.qty = qty;
    }
    save();
    render();
  }

  function clear() {
    lines = [];
    save();
    render();
  }

  function toastFallback(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastFallback._t);
    toastFallback._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function pulseFab() {
    const fab = document.getElementById('cart-fab');
    if (!fab) return;
    fab.classList.remove('cart-fab--pulse');
    void fab.offsetWidth;
    fab.classList.add('cart-fab--pulse');
  }

  function ensureDom() {
    if (document.getElementById('cart-root')) return;

    const root = document.createElement('div');
    root.id = 'cart-root';
    root.innerHTML = `
      <button type="button" class="cart-fab" id="cart-fab" aria-label="Корзина">
        <span class="cart-fab__glow" aria-hidden="true"></span>
        <svg class="cart-fab__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M6 7h15l-1.5 9h-12z"/>
          <path d="M6 7L5 3H2"/>
          <circle cx="9" cy="20" r="1.4"/>
          <circle cx="17" cy="20" r="1.4"/>
        </svg>
        <span class="cart-fab__badge" id="cart-badge" hidden>0</span>
      </button>

      <div class="cart-overlay" id="cart-overlay" hidden></div>
      <aside class="cart-drawer" id="cart-drawer" aria-hidden="true">
        <div class="cart-drawer__shine" aria-hidden="true"></div>
        <header class="cart-drawer__head">
          <div>
            <p class="cart-drawer__eyebrow">OBLAKO</p>
            <h2 class="cart-drawer__title">Ваш заказ</h2>
          </div>
          <button type="button" class="cart-drawer__close" id="cart-close" aria-label="Закрыть">✕</button>
        </header>
        <div class="cart-drawer__body" id="cart-body"></div>
        <footer class="cart-drawer__foot" id="cart-foot"></footer>
      </aside>
    `;
    document.body.appendChild(root);

    document.getElementById('cart-fab').addEventListener('click', open);
    document.getElementById('cart-close').addEventListener('click', close);
    document.getElementById('cart-overlay').addEventListener('click', close);
  }

  function open() {
    ensureDom();
    render();
    document.getElementById('cart-overlay').hidden = false;
    const drawer = document.getElementById('cart-drawer');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open');
  }

  function close() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('cart-open');
  }

  function render() {
    ensureDom();
    const badge = document.getElementById('cart-badge');
    const body = document.getElementById('cart-body');
    const foot = document.getElementById('cart-foot');
    const n = count();

    if (badge) {
      badge.hidden = n === 0;
      badge.textContent = String(n);
    }

    if (!body || !foot) return;

    if (!lines.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__orb">✦</div>
          <p class="cart-empty__title">Корзина пуста</p>
          <p class="cart-empty__text">Добавьте блюда из меню — соберём элитный заказ для вашего стола.</p>
        </div>`;
      foot.innerHTML = `
        <div class="cart-totals cart-totals--muted">
          <div class="cart-totals__row"><span>Сумма</span><strong>0 ₸</strong></div>
          <div class="cart-totals__row"><span>Обслуживание 15%</span><strong>0 ₸</strong></div>
          <div class="cart-totals__row cart-totals__row--total"><span>Итого</span><strong>0 ₸</strong></div>
        </div>`;
      return;
    }

    body.innerHTML = lines.map(l => `
      <article class="cart-line" data-id="${l.id}">
        <div class="cart-line__photo">
          ${l.image ? `<img src="${l.image}" alt="" loading="lazy">` : '<span class="cart-line__ph">OB</span>'}
        </div>
        <div class="cart-line__info">
          <h3 class="cart-line__name">${l.name}</h3>
          <p class="cart-line__price">${money(l.price)}</p>
          <div class="cart-line__qty">
            <button type="button" data-act="dec" aria-label="Меньше">−</button>
            <span>${l.qty}</span>
            <button type="button" data-act="inc" aria-label="Больше">+</button>
          </div>
        </div>
        <div class="cart-line__sum">
          <strong>${money(l.price * l.qty)}</strong>
          <button type="button" class="cart-line__remove" data-act="rm" aria-label="Удалить">удалить</button>
        </div>
      </article>
    `).join('');

    body.querySelectorAll('.cart-line').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-act="dec"]')?.addEventListener('click', () => {
        const line = lines.find(l => l.id === id);
        setQty(id, (line?.qty || 1) - 1);
      });
      row.querySelector('[data-act="inc"]')?.addEventListener('click', () => {
        const line = lines.find(l => l.id === id);
        setQty(id, (line?.qty || 0) + 1);
      });
      row.querySelector('[data-act="rm"]')?.addEventListener('click', () => setQty(id, 0));
    });

    foot.innerHTML = `
      <div class="cart-totals">
        <div class="cart-totals__row"><span>Сумма блюд</span><strong>${money(subtotal())}</strong></div>
        <div class="cart-totals__row"><span>Обслуживание 15%</span><strong>${money(service())}</strong></div>
        <div class="cart-totals__row cart-totals__row--total"><span>Итого</span><strong>${money(total())}</strong></div>
      </div>
      <p class="cart-note">Покажите заказ официанту или хостес. Обслуживание 15% уже включено в итоговую сумму.</p>
      <div class="cart-actions">
        <button type="button" class="cart-btn cart-btn--ghost" id="cart-clear">Очистить</button>
        <button type="button" class="cart-btn cart-btn--gold" id="cart-ready">Готово к подаче</button>
      </div>
    `;

    document.getElementById('cart-clear')?.addEventListener('click', () => {
      clear();
      toastFallback('Корзина очищена');
    });
    document.getElementById('cart-ready')?.addEventListener('click', () => {
      toastFallback('Заказ сохранён — покажите официанту');
      close();
    });
  }

  // Public API
  window.OBLAKO_CART = { add, open, close, clear, render, count, total, SERVICE_RATE };
  if (!window.OBLAKO) window.OBLAKO = {};
  window.OBLAKO.openCart = open;
  window.OBLAKO.addToCart = add;

  document.addEventListener('DOMContentLoaded', () => {
    ensureDom();
    render();
  });

  // Also init immediately if DOM already ready
  if (document.readyState !== 'loading') {
    ensureDom();
    render();
  }
})();
