(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const isNarrow = window.matchMedia('(max-width: 768px)').matches;

  /* ── SPLASH ── */
  const splash = document.getElementById('splash');
  if (splash) {
    if (prefersReduced || sessionStorage.getItem('oblako_splash')) {
      splash.remove();
    } else {
      document.body.classList.add('splash-active');
      sessionStorage.setItem('oblako_splash', '1');

      setTimeout(() => {
        splash.classList.add('splash--out');
        document.body.classList.remove('splash-active');
        setTimeout(() => splash.remove(), 900);
      }, 2400);
    }
  }

  /* ── CURSOR GLOW (desktop only) ── */
  const glow = document.getElementById('cursor-glow');
  if (glow && !prefersReduced && !isTouch) {
    let gx = window.innerWidth / 2;
    let gy = window.innerHeight / 2;
    let cx = gx;
    let cy = gy;
    let raf = 0;
    let active = true;

    document.addEventListener('mousemove', e => {
      gx = e.clientX;
      gy = e.clientY;
      if (!raf && active) raf = requestAnimationFrame(tickGlow);
    }, { passive: true });

    function tickGlow() {
      raf = 0;
      if (!active) return;
      cx += (gx - cx) * 0.08;
      cy += (gy - cy) * 0.08;
      glow.style.transform = `translate(${cx - 200}px, ${cy - 200}px)`;
      if (Math.abs(gx - cx) > 0.4 || Math.abs(gy - cy) > 0.4) {
        raf = requestAnimationFrame(tickGlow);
      }
    }

    document.addEventListener('visibilitychange', () => {
      active = document.visibilityState === 'visible';
      if (active && !raf) raf = requestAnimationFrame(tickGlow);
    });
  } else if (glow) {
    glow.remove();
  }

  /* ── PARALLAX WATERMARK ── */
  const watermark = document.querySelector('.watermark img');
  if (watermark && !prefersReduced) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        watermark.style.transform = `translateY(${y * 0.12}px) scale(${1 + y * 0.00008})`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── PARTICLES ── */
  const canvas = document.getElementById('particles');
  if (canvas && !prefersReduced) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let w = 0;
    let h = 0;
    const dots = [];
    const COUNT = isNarrow || isTouch ? 18 : 32;
    let running = true;
    let rafId = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    for (let i = 0; i < COUNT; i++) {
      dots.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 0.3 + 0.12,
        alpha: Math.random() * 0.28 + 0.06,
      });
    }

    function drawParticles() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.y -= d.speed;
        if (d.y < -10) {
          d.y = h + 10;
          d.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 169, 110, ${d.alpha})`;
        ctx.fill();
      }
      rafId = requestAnimationFrame(drawParticles);
    }

    function setRunning(on) {
      running = on;
      if (on && !rafId) rafId = requestAnimationFrame(drawParticles);
      if (!on && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    document.addEventListener('visibilitychange', () => {
      setRunning(document.visibilityState === 'visible');
    });

    setRunning(true);
  } else if (canvas) {
    canvas.remove();
  }

  /* ── 3D CARD TILT (desktop only) ── */
  const menuRoot = document.getElementById('menu-root');
  if (menuRoot && !prefersReduced && !isTouch) {
    let tilted = null;

    menuRoot.addEventListener('mousemove', e => {
      const card = e.target.closest('.card');
      if (tilted && tilted !== card) resetTilt(tilted);
      if (!card) {
        tilted = null;
        return;
      }

      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.classList.add('card--tilt');
      card.style.transform =
        `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-3px)`;
      tilted = card;
    });

    menuRoot.addEventListener('mouseleave', () => {
      if (tilted) resetTilt(tilted);
      tilted = null;
    });
  }

  function resetTilt(card) {
    card.classList.remove('card--tilt');
    card.style.transform = '';
  }
})();
