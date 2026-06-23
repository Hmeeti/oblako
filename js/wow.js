(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  let vipMode = false;
  let logoClicks = 0;
  let logoTimer = null;

  const logoWrap = document.querySelector('.logo-img-wrap');
  const logo = document.querySelector('.logo-img');

  /* ── MAGNETIC LOGO ── */
  if (logoWrap && logo && !isTouch && !reduced) {
    logoWrap.addEventListener('mousemove', e => {
      const rect = logoWrap.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      logoWrap.style.transform = `translate(${x * 12}px, ${y * 8}px)`;
    });
    logoWrap.addEventListener('mouseleave', () => {
      logoWrap.style.transform = '';
    });
  }

  /* ── VIP MODE (5× click logo) ── */
  function toggleVip() {
    vipMode = !vipMode;
    document.body.classList.toggle('vip-mode', vipMode);
    showVipToast(vipMode ? '✦ VIP-режим активирован' : 'VIP-режим выключен');
    if (vipMode) goldBurst();
  }

  document.getElementById('vip-badge')?.addEventListener('click', toggleVip);

  if (logo) {
    logo.addEventListener('click', () => {
      logoClicks++;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => { logoClicks = 0; }, 1200);
      if (logoClicks >= 5) {
        logoClicks = 0;
        toggleVip();
      }
    });
  }

  function showVipToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('toast--show');
    setTimeout(() => toast.classList.remove('toast--show'), 2800);
  }

  function goldBurst() {
    const canvas = document.createElement('canvas');
    canvas.className = 'burst-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let w, h;
    const particles = [];
    const N = 80;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();

    const logoRect = logo?.getBoundingClientRect();
    const cx = logoRect ? logoRect.left + logoRect.width / 2 : w / 2;
    const cy = logoRect ? logoRect.top + logoRect.height / 2 : h * 0.22;

    for (let i = 0; i < N; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        r: Math.random() * 3 + 1,
      });
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= 0.018;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 169, 110, ${p.life})`;
        ctx.fill();
      });
      if (alive) requestAnimationFrame(frame);
      else canvas.remove();
    }
    frame();
  }
})();
