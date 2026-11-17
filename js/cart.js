/* OBLAKO guest cart — local basket with 15% service, opened from the dock */
(function () {
  'use strict';

  const STORAGE_KEY = 'oblako-cart-v1';
  const SERVICE_RATE = 0.15;
  const TOAST_MS = 1800;

  /** @type {{id:string,name:string,price:number,image?:string,qty:number}[]} */
  let lines = load();

  /* ---------- Storage ---------- */
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(l => l && l.id && l.price != null) : [];
    } catch (_) {
      return [];
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch (_) { /* private mode */ }
  }

  /* ---------- Helpers ---------- */
  const money = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const findMenuItem = (id) => (typeof MENU !== 'undefined' ? MENU : []).find(i => i.id === id);
  const count = () => lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = () => lines.reduce((s, l) => s + l.price * l.qty, 0);
  const service = () => Math.round(subtotal() * SERVICE_RATE);
  const qty = (id) => lines.find(l => l.id === id)?.qty || 0;

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg, TOAST_MS);
  }

  function notify() {
    window.dispatchEvent(new CustomEvent('oblako-cart-change'));
  }

  // Lines saved before a price update must show the current menu price
  function syncWithMenu() {
    let changed = false;
    lines = lines.filter(line => {
      const item = findMenuItem(line.id);
      if (!item) return typeof MENU === 'undefined' || !MENU.length;   // dish removed from menu
      if (item.price == null) return false;
      if (line.price !== item.price || line.name !== item.name) {
        line.price = item.price;
        line.name = item.name;
        changed = true;
      }
      return true;
    });
    if (changed) save();
  }

  /* ---------- Mutations ---------- */
  function commit() {
    save();
    render();
    notify();
  }

  function setQty(id, value) {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    if (value <= 0) lines = lines.filter(l => l.id !== id);
    else line.qty = value;
    commit();
  }

  function add(itemOrId, amount = 1) {
    const item = typeof itemOrId === 'string' ? findMenuItem(itemOrId) : itemOrId;
    if (!item || item.price == null) return false;

    const existing = lines.find(l => l.id === item.id);
    if (existing) {
      existing.qty += amount;
    } else {
      lines.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || '',
        qty: Math.max(1, amount),
      });
    }
    commit();
    toast(`Добавлено: ${item.name}`);
    return true;
  }

  function clear() {
    lines = [];
    commit();
  }

  /* ---------- DOM ---------- */
  let drawer = null;
  let overlay = null;
  let lastFocus = null;

  function ensureDom() {
    if (drawer) return;
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="cart-overlay" data-cart-close hidden></div>
      <aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true">
        <header class="cart-drawer__head">
          <div>
            <p class="cart-drawer__eyebrow">OBLAKO</p>
            <h2 class="cart-drawer__title" id="cart-title">Ваш заказ</h2>
          </div>
          <button type="button" class="cart-drawer__close" data-cart-close aria-label="Закрыть">✕</button>
        </header>
        <div class="cart-drawer__body"></div>
        <footer class="cart-drawer__foot"></footer>
      </aside>`;
    document.body.append(...root.children);

    overlay = document.querySelector('.cart-overlay');
    drawer = document.querySelector('.cart-drawer');

    overlay.addEventListener('click', close);
    drawer.addEventListener('click', onDrawerClick);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  function onDrawerClick(e) {
    if (e.target.closest('[data-cart-close]')) {
      close();
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-id]')?.dataset.id;

    switch (btn.dataset.act) {
      case 'dec': setQty(id, qty(id) - 1); break;
      case 'inc': setQty(id, qty(id) + 1); break;
      case 'rm': setQty(id, 0); break;
      case 'clear':
        clear();
        toast('Корзина очищена');
        break;
      case 'ready':
        toast('Заказ сохранён — покажите официанту');
        close();
        break;
      default:
    }
  }

  function open() {
    ensureDom();
    syncWithMenu();
    render();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    drawer.querySelector('.cart-drawer__close').focus();
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    document.body.classList.remove('is-locked');
    lastFocus?.focus?.();
  }

  /* ---------- Render ---------- */
  function renderDockBadge() {
    const dockCart = document.querySelector('.dock__btn[data-action="cart"]');
    if (!dockCart) return;
    const n = count();
    let badge = dockCart.querySelector('.dock__badge');
    if (!n) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'dock__badge';
      dockCart.appendChild(badge);
    }
    badge.textContent = String(n);
    dockCart.setAttribute('aria-label', `Корзина, позиций: ${n}`);
  }

  function totalsHtml() {
    return `
      <div class="cart-totals">
        <div class="cart-totals__row"><span>Сумма блюд</span><strong>${money(subtotal())}</strong></div>
        <div class="cart-totals__row"><span>Обслуживание 15%</span><strong>${money(service())}</strong></div>
        <div class="cart-totals__row cart-totals__row--total"><span>Итого</span><strong>${money(subtotal() + service())}</strong></div>
      </div>`;
  }

  function lineHtml(l) {
    const photo = l.image
      ? `<img src="${escapeHtml(l.image)}" alt="" loading="lazy" width="56" height="56">`
      : 'OB';
    return `
      <article class="cart-line" data-id="${escapeHtml(l.id)}">
        <div class="cart-line__photo">${photo}</div>
        <div>
          <h3 class="cart-line__name">${escapeHtml(l.name)}</h3>
          <p class="cart-line__price">${money(l.price)}</p>
          <div class="cart-line__qty">
            <button type="button" class="cart-line__qty-btn" data-act="dec" aria-label="Меньше">−</button>
            <span class="cart-line__qty-num">${l.qty}</span>
            <button type="button" class="cart-line__qty-btn" data-act="inc" aria-label="Больше">+</button>
          </div>
        </div>
        <div class="cart-line__sum">
          <strong class="cart-line__total">${money(l.price * l.qty)}</strong>
          <button type="button" class="cart-line__remove" data-act="rm">удалить</button>
        </div>
      </article>`;
  }

  function render() {
    renderDockBadge();
    if (!drawer) return;

    const body = drawer.querySelector('.cart-drawer__body');
    const foot = drawer.querySelector('.cart-drawer__foot');

    if (!lines.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <p class="cart-empty__title">Корзина пуста</p>
          <p class="cart-empty__text">Добавьте блюда из меню — соберём элитный заказ для вашего стола.</p>
        </div>`;
      foot.innerHTML = totalsHtml();
      return;
    }

    body.innerHTML = lines.map(lineHtml).join('');
    foot.innerHTML = `
      ${totalsHtml()}
      <p class="cart-note">Покажите заказ официанту или хостес. Обслуживание 15% уже включено в итоговую сумму.</p>
      <div class="cart-actions">
        <button type="button" class="cart-btn cart-btn--ghost" data-act="clear">Очистить</button>
        <button type="button" class="cart-btn cart-btn--gold" data-act="ready">Готово к подаче</button>
      </div>`;
  }

  /* ---------- Public API ---------- */
  window.OBLAKO_CART = { add, open, close, clear, qty, setQty };

  // Menu data may arrive later (menu.json / API) — re-check prices then
  window.addEventListener('load', () => {
    syncWithMenu();
    renderDockBadge();
    notify();
  });

  renderDockBadge();
  notify();   // app.js rendered cards before the cart existed — sync their qty controls
})();
