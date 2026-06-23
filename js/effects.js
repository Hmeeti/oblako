(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

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

  /* ── CURSOR GLOW ── */
  const glow = document.getElementById('cursor-glow');
  if (glow && !prefersReduced && !isTouch) {
    let gx = window.innerWidth / 2;
    let gy = window.innerHeight / 2;
    let cx = gx;
    let cy = gy;

    document.addEventListener('mousemove', e => {
      gx = e.clientX;
      gy = e.clientY;
    }, { passive: true });

    function tickGlow() {
      cx += (gx - cx) * 0.08;
      cy += (gy - cy) * 0.08;
      glow.style.transform = `translate(${cx - 200}px, ${cy - 200}px)`;
      requestAnimationFrame(tickGlow);
    }
    tickGlow();
  } else if (glow) {
    glow.remove();
  }

  /* ── PARALLAX WATERMARK ── */
  const watermark = document.querySelector('.watermark img');
  if (watermark && !prefersReduced) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      watermark.style.transform = `translateY(${y * 0.12}px) scale(${1 + y * 0.00008})`;
    }, { passive: true });
  }

  /* ── PARTICLES ── */
  const canvas = document.getElementById('particles');
  if (canvas && !prefersReduced) {
    const ctx = canvas.getContext('2d');
    let w, h;
    const dots = [];
    const COUNT = 48;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
      dots.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 0.35 + 0.15,
        alpha: Math.random() * 0.35 + 0.08,
      });
    }

    function drawParticles() {
      ctx.clearRect(0, 0, w, h);
      dots.forEach(d => {
        d.y -= d.speed;
        if (d.y < -10) {
          d.y = h + 10;
          d.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 169, 110, ${d.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(drawParticles);
    }
    drawParticles();
  } else if (canvas) {
    canvas.remove();
  }

  /* ── 3D CARD TILT ── */
  const menuRoot = document.getElementById('menu-root');
  if (menuRoot && !prefersReduced && !isTouch) {
    menuRoot.addEventListener('mousemove', e => {
      const card = e.target.closest('.card');
      menuRoot.querySelectorAll('.card--tilt').forEach(c => {
        if (c !== card) resetTilt(c);
      });
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.classList.add('card--tilt');
      card.style.transform =
        `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
    });

    menuRoot.addEventListener('mouseleave', () => {
      menuRoot.querySelectorAll('.card--tilt').forEach(resetTilt);
    });
  }

  function resetTilt(card) {
    card.classList.remove('card--tilt');
    card.style.transform = '';
  }
})();
