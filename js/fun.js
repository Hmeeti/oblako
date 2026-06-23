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
    '☁️ Облако благодарит за визит',
  ];

  const SEARCH_SECRETS = {
    облако: '☁️ Вы нашли секрет OBLAKO!',
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
