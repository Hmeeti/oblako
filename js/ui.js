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
