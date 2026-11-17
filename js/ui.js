/* OBLAKO UI shell — toast, bottom dock, service worker */
(function () {
  'use strict';

  const TOAST_MS = 3000;

  /* ---------- Toast ---------- */
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  window.showToast = function showToast(msg, duration = TOAST_MS) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), duration);
  };

  /* ---------- Dock ---------- */
  const ACTIONS = {
    home: () => window.OBLAKO?.goHome(),
    categories: () => window.OBLAKO?.scrollToTabs(),
    rules: () => window.OBLAKO?.openRules(),
    cart: () => window.OBLAKO_CART?.open(),
  };

  const dock = document.getElementById('dock');
  dock?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    const action = ACTIONS[btn?.dataset.action];
    if (!action) return;
    action();
    if (btn.dataset.action === 'cart') return;   // the drawer is an overlay, not a place
    dock.querySelectorAll('.dock__btn').forEach(b => b.classList.toggle('is-active', b === btn));
  });

  /* ---------- Service worker (offline + fast repeat visits) ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
