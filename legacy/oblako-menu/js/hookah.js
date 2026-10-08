const HOOKAH_TAB = 'Кальянная';

const HOOKAH_FLAVORS = [
  { id: 'apple', name: 'Яблоко', color: '#7cb342' },
  { id: 'grape', name: 'Виноград', color: '#8e44ad' },
  { id: 'mint', name: 'Мята', color: '#26a69a' },
  { id: 'citrus', name: 'Цитрус', color: '#f9a825' },
  { id: 'berry', name: 'Ягоды', color: '#e91e63' },
  { id: 'melon', name: 'Дыня', color: '#ff8f00' },
  { id: 'choco', name: 'Шоколад', color: '#6d4c41' },
  { id: 'cream', name: 'Сливки', color: '#fff8e1' },
  { id: 'rose', name: 'Роза', color: '#f48fb1' },
  { id: 'cola', name: 'Кола', color: '#4e342e' },
  { id: 'ice', name: 'Лёд', color: '#81d4fa' },
  { id: 'spice', name: 'Пряности', color: '#bf360c' },
];

const HOOKAH_PRESETS = [
  { name: 'OBLAKO Classic', flavors: ['apple', 'mint', 'cream'], desc: 'Фирменный микс заведения' },
  { name: 'Night Cloud', flavors: ['grape', 'berry', 'ice'], desc: 'Холодный ягодный вечер' },
  { name: 'Golden Sunset', flavors: ['citrus', 'melon', 'rose'], desc: 'Лёгкий и сладкий' },
  { name: 'Dark Lounge', flavors: ['choco', 'cola', 'spice'], desc: 'Глубокий, насыщенный' },
];

let selectedFlavors = [];

function buildHookahLounge() {
  const root = document.getElementById('hookah-root');
  root.innerHTML = `
    <div class="hookah-lounge">
      <button type="button" class="rules-back" id="hookah-back">← Вернуться к меню</button>

      <div class="hookah-hero">
        <canvas class="hookah-smoke" id="hookah-smoke" aria-hidden="true"></canvas>
        <div class="hookah-visual">
          <div class="hookah-bowl">
            <div class="hookah-coals"></div>
          </div>
          <div class="hookah-stem"></div>
          <div class="hookah-base">
            <div class="hookah-liquid"></div>
          </div>
          <div class="hookah-hose"></div>
        </div>
        <div class="hookah-hero__text">
          <span class="hookah-hero__label">OBLAKO Hookah Lounge</span>
          <h2 class="hookah-hero__title">Собери свой микс</h2>
          <p class="hookah-hero__sub">Выберите до 3 вкусов — кальянный мастер приготовит по вашему рецепту</p>
        </div>
      </div>

      <div class="hookah-mix">
        <div class="hookah-mix__slots" id="hookah-slots">
          <div class="hookah-slot hookah-slot--empty">1</div>
          <div class="hookah-slot hookah-slot--empty">2</div>
          <div class="hookah-slot hookah-slot--empty">3</div>
        </div>
        <p class="hookah-mix__result" id="hookah-result">Выберите вкусы ниже</p>
        <button type="button" class="hookah-mix__clear" id="hookah-clear" hidden>Очистить микс</button>
      </div>

      <div class="hookah-flavors" id="hookah-flavors">
        ${HOOKAH_FLAVORS.map(f => `
          <button type="button" class="hookah-flavor" data-id="${f.id}" style="--flavor-color: ${f.color}">
            <span class="hookah-flavor__dot"></span>
            ${f.name}
          </button>
        `).join('')}
      </div>

      <div class="hookah-presets">
        <h3 class="hookah-presets__title">Популярные миксы</h3>
        <div class="hookah-presets__grid">
          ${HOOKAH_PRESETS.map(p => `
            <button type="button" class="hookah-preset" data-preset="${p.name}">
              <span class="hookah-preset__name">${p.name}</span>
              <span class="hookah-preset__desc">${p.desc}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="hookah-cta">
        <p>Покажите этот экран кальянному мастеру</p>
        <button type="button" class="hookah-cta__btn" id="hookah-order">Готово — вызвать мастера</button>
      </div>
    </div>
  `;

  selectedFlavors = [];
  bindHookahEvents();
  initHookahSmoke();
}

function bindHookahEvents() {
  document.getElementById('hookah-back').addEventListener('click', () => {
    window.OBLAKO.goHome();
  });

  document.getElementById('hookah-flavors').addEventListener('click', e => {
    const btn = e.target.closest('.hookah-flavor');
    if (!btn) return;
    toggleFlavor(btn.dataset.id);
  });

  document.querySelectorAll('.hookah-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = HOOKAH_PRESETS.find(p => p.name === btn.dataset.preset);
      if (preset) applyPreset(preset.flavors);
    });
  });

  document.getElementById('hookah-clear').addEventListener('click', () => {
    selectedFlavors = [];
    renderMix();
  });

  document.getElementById('hookah-order').addEventListener('click', () => {
    if (!selectedFlavors.length) {
      showHookahToast('Сначала выберите вкусы');
      return;
    }
    const names = selectedFlavors.map(id => HOOKAH_FLAVORS.find(f => f.id === id).name).join(' + ');
    showHookahToast(`Микс отправлен: ${names}`);
    document.querySelector('.hookah-visual')?.classList.add('hookah-visual--active');
    setTimeout(() => {
      document.querySelector('.hookah-visual')?.classList.remove('hookah-visual--active');
    }, 2000);
  });
}

function toggleFlavor(id) {
  const idx = selectedFlavors.indexOf(id);
  if (idx >= 0) {
    selectedFlavors.splice(idx, 1);
  } else if (selectedFlavors.length < 3) {
    selectedFlavors.push(id);
  } else {
    showHookahToast('Максимум 3 вкуса');
    return;
  }
  renderMix();
}

function applyPreset(ids) {
  selectedFlavors = [...ids];
  renderMix();
  showHookahToast('Микс загружен');
}

function renderMix() {
  const slots = document.querySelectorAll('.hookah-slot');
  const result = document.getElementById('hookah-result');
  const clearBtn = document.getElementById('hookah-clear');

  slots.forEach((slot, i) => {
    const id = selectedFlavors[i];
    if (id) {
      const f = HOOKAH_FLAVORS.find(x => x.id === id);
      slot.className = 'hookah-slot';
      slot.style.setProperty('--flavor-color', f.color);
      slot.textContent = f.name;
    } else {
      slot.className = 'hookah-slot hookah-slot--empty';
      slot.style.removeProperty('--flavor-color');
      slot.textContent = i + 1;
    }
  });

  document.querySelectorAll('.hookah-flavor').forEach(btn => {
    btn.classList.toggle('hookah-flavor--active', selectedFlavors.includes(btn.dataset.id));
  });

  if (selectedFlavors.length) {
    const names = selectedFlavors.map(id => HOOKAH_FLAVORS.find(f => f.id === id).name);
    result.textContent = `Ваш микс: ${names.join(' · ')}`;
    clearBtn.hidden = false;
  } else {
    result.textContent = 'Выберите вкусы ниже';
    clearBtn.hidden = true;
  }
}

function showHookahToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('toast--show');
  setTimeout(() => toast.classList.remove('toast--show'), 2800);
}

function initHookahSmoke() {
  const canvas = document.getElementById('hookah-smoke');
  if (!canvas) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  let w, h;
  const puffs = [];

  function resize() {
    const rect = parent.getBoundingClientRect();
    w = canvas.width = rect.width;
    h = canvas.height = rect.height;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawn() {
    if (puffs.length < 40) {
      puffs.push({
        x: w * 0.5 + (Math.random() - 0.5) * 30,
        y: h * 0.35,
        r: Math.random() * 18 + 8,
        life: 1,
        drift: (Math.random() - 0.5) * 0.6,
        speed: Math.random() * 0.6 + 0.4,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    if (Math.random() > 0.7) spawn();

    puffs.forEach((p, i) => {
      p.y -= p.speed;
      p.x += p.drift + Math.sin(p.y * 0.02) * 0.3;
      p.r += 0.15;
      p.life -= 0.008;

      if (p.life <= 0) {
        puffs.splice(i, 1);
        return;
      }

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `rgba(220, 220, 230, ${p.life * 0.12})`);
      grad.addColorStop(1, 'rgba(220, 220, 230, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  draw();
}
