(function () {
  const API = window.OBLAKO_ADMIN_API || '/api/admin';
  const loader = document.getElementById('loader');
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const connStatus = document.getElementById('conn-status');

  let categories = [];
  let items = [];
  let currentView = 'dashboard';
  let busy = false;

  const titles = {
    dashboard: 'Обзор',
    items: 'Блюда',
    categories: 'Категории',
    logs: 'Журнал',
    analytics: 'Аналитика',
    images: 'Фото',
  };

  function showLoader(v = true) {
    if (loader) loader.hidden = !v;
  }

  function setOnline(ok) {
    if (!connStatus) return;
    connStatus.classList.toggle('is-offline', !ok);
    connStatus.querySelector('.status-pill__text').textContent = ok ? 'Онлайн' : 'Нет связи';
  }

  function toast(msg, ok = true) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.toggle('is-error', !ok);
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  async function api(path, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const headers = { ...(opts.headers || {}) };
      let body = opts.body;
      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }

      const res = await fetch(`${API}${path}`, {
        method: opts.method || 'GET',
        credentials: 'same-origin',
        headers,
        body,
        signal: controller.signal,
      });

      setOnline(true);

      if (res.status === 401 && path !== '/login') {
        showLogin();
        throw new Error('Сессия истекла — войдите снова');
      }

      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('json') ? await res.json() : null;
      if (!res.ok) throw new Error(data?.error || res.statusText || 'Ошибка запроса');
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        setOnline(false);
        throw new Error('Сервер не отвечает. Запустите npm start');
      }
      if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
        setOnline(false);
        throw new Error('Нет связи с сервером. Откройте http://localhost:3000/admin.html');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function showLogin() {
    if (loginScreen) {
      loginScreen.hidden = false;
      loginScreen.style.display = 'flex';
    }
    if (app) {
      app.hidden = true;
      app.style.display = 'none';
    }
    closeSidebar();
    closeModal();
  }

  function showApp(user) {
    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.style.display = 'none';
    }
    if (app) {
      app.hidden = false;
      app.style.display = 'flex';
    }
    const el = document.getElementById('admin-user');
    if (el) el.textContent = user || 'admin';
  }

  function openSidebar() {
    sidebar?.classList.add('is-open');
    if (backdrop) backdrop.hidden = false;
  }

  function closeSidebar() {
    sidebar?.classList.remove('is-open');
    if (backdrop) backdrop.hidden = true;
  }

  function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    modalBody.innerHTML = '';
    document.body.style.overflow = '';
  }

  async function loadData() {
    [categories, items] = await Promise.all([
      api('/categories'),
      api('/items'),
    ]);
  }

  async function checkSession() {
    if (location.protocol === 'file:') {
      showLogin();
      const err = document.getElementById('login-error');
      if (err) {
        err.hidden = false;
        err.textContent = 'Откройте админку через http://localhost:3000/admin.html';
      }
      return;
    }

    showLoader(true);
    try {
      const s = await api('/session');
      if (s?.authenticated) {
        showApp(s.user);
        await loadData();
        renderView('dashboard');
      } else {
        showLogin();
      }
    } catch (err) {
      console.error(err);
      showLogin();
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message;
      }
    } finally {
      showLoader(false);
    }
  }

  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    errEl.hidden = true;
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    if (!username || !password) {
      errEl.textContent = 'Введите логин и пароль';
      errEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Входим…';
    try {
      await api('/login', { method: 'POST', body: { username, password } });
      const s = await api('/session');
      showApp(s.user);
      await loadData();
      renderView('dashboard');
      toast('Добро пожаловать ☁️');
    } catch (err) {
      console.error(err);
      if (/too many/i.test(err.message)) {
        errEl.textContent = 'Слишком много попыток. Подождите 15 минут.';
      } else if (/Invalid credentials/i.test(err.message)) {
        errEl.textContent = 'Неверный логин или пароль';
      } else {
        errEl.textContent = err.message || 'Неверный логин или пароль';
      }
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch (_) {}
    showLogin();
    toast('Вы вышли', true);
  });

  document.getElementById('burger')?.addEventListener('click', openSidebar);
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      renderView(btn.dataset.view);
      closeSidebar();
    });
  });

  modal?.addEventListener('click', e => {
    if (e.target.closest('[data-close-modal]')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  function renderView(name) {
    currentView = name;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
    const view = document.getElementById(`view-${name}`);
    if (view) view.hidden = false;
    document.getElementById('view-title').textContent = titles[name] || name;

    const runners = {
      dashboard: renderDashboard,
      items: renderItems,
      categories: renderCategories,
      logs: renderLogs,
      analytics: renderAnalytics,
      images: renderImages,
    };
    runners[name]?.();
  }

  async function safeRender(el, fn) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">☁️</div><p>Загрузка…</p></div>';
    try {
      await fn();
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><p>${esc(err.message)}</p></div>`;
      toast(err.message, false);
    }
  }

  async function renderDashboard() {
    const el = document.getElementById('view-dashboard');
    await safeRender(el, async () => {
      const stats = await api('/dashboard');
      el.innerHTML = `
        <div class="stats">
          <div class="stat"><div class="stat__val">${stats.items}</div><div class="stat__label">Блюд в меню</div></div>
          <div class="stat"><div class="stat__val">${stats.withImages}</div><div class="stat__label">С фото</div></div>
          <div class="stat"><div class="stat__val">${stats.viewsToday}</div><div class="stat__label">Просмотров сегодня</div></div>
          <div class="stat"><div class="stat__val">${stats.viewsWeek}</div><div class="stat__label">За 7 дней</div></div>
        </div>
        <div class="panel">
          <div class="panel__head"><h3 class="panel__title">Последние действия</h3></div>
          <p class="panel__hint">Кто что менял в меню — цены, фото, категории.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Детали</th></tr></thead>
              <tbody>
                ${stats.recentLogs.length ? stats.recentLogs.map(l => `
                  <tr>
                    <td>${fmtDate(l.created_at)}</td>
                    <td>${esc(l.actor)}</td>
                    <td><span class="badge">${esc(prettyAction(l.action))}</span></td>
                    <td><small>${esc(shortDetails(l.details))}</small></td>
                  </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state">Пока тихо — изменений не было</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>`;
    });
  }

  function renderItems() {
    const el = document.getElementById('view-items');
    el.innerHTML = `
      <div class="panel">
        <div class="panel__head">
          <h3 class="panel__title">Блюда · ${items.length}</h3>
          <button type="button" class="btn btn--gold btn--sm" id="add-item-btn">+ Добавить блюдо</button>
        </div>
        <p class="panel__hint">Ищите по названию или составу. Изменения сразу видны гостям на сайте.</p>
        <div class="filters">
          <input type="search" id="item-search" placeholder="Поиск: цезарь, семга, пицца…">
          <select id="item-cat-filter">
            <option value="">Все категории</option>
            ${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap" id="items-table"></div>
      </div>`;

    const drawTable = () => {
      const q = document.getElementById('item-search').value.toLowerCase().trim();
      const cat = document.getElementById('item-cat-filter').value;
      const filtered = items.filter(i =>
        (!cat || String(i.categoryId) === cat) &&
        (!q || i.name.toLowerCase().includes(q) || (i.desc || '').toLowerCase().includes(q) || (i.cat || '').toLowerCase().includes(q))
      );

      document.getElementById('items-table').innerHTML = `
        <table>
          <thead><tr><th>Фото</th><th>Название</th><th>Категория</th><th>Цена</th><th></th></tr></thead>
          <tbody>
            ${filtered.map(i => `
              <tr>
                <td>${i.image ? `<img class="thumb" src="${esc(i.image)}" alt="" loading="lazy">` : '<span class="badge">нет фото</span>'}</td>
                <td>
                  <strong>${esc(i.name)}</strong>
                  ${i.desc ? `<br><small style="color:var(--muted)">${esc(i.desc.slice(0, 70))}${i.desc.length > 70 ? '…' : ''}</small>` : ''}
                </td>
                <td>${esc(i.cat)}${i.subcat ? `<br><small style="color:var(--muted)">${esc(i.subcat)}</small>` : ''}</td>
                <td><strong>${Number(i.price).toLocaleString('ru-RU')} ₸</strong>${i.price2 != null ? `<br><small style="color:var(--muted)">${Number(i.price2).toLocaleString('ru-RU')} ₸</small>` : ''}</td>
                <td class="td-actions">
                  <button type="button" class="btn btn--ghost btn--sm" data-edit="${esc(i.id)}">Изменить</button>
                  ${i.image ? `<button type="button" class="btn btn--ghost btn--sm" data-clear-photo="${esc(i.id)}" title="Убрать фото">Убрать фото</button>` : ''}
                  <button type="button" class="btn btn--danger btn--sm" data-del="${esc(i.id)}">Удалить</button>
                </td>
              </tr>`).join('') || `<tr><td colspan="5"><div class="empty-state">Ничего не найдено</div></td></tr>`}
          </tbody>
        </table>`;
    };

    drawTable();
    document.getElementById('item-search').oninput = drawTable;
    document.getElementById('item-cat-filter').onchange = drawTable;
    document.getElementById('add-item-btn').onclick = () => openItemEditor(null);

    el.onclick = async e => {
      const editId = e.target.closest('[data-edit]')?.dataset.edit;
      const delId = e.target.closest('[data-del]')?.dataset.del;
      const clearPhotoId = e.target.closest('[data-clear-photo]')?.dataset.clearPhoto;
      if (editId) {
        openItemEditor(items.find(i => i.id === editId));
        return;
      }
      if (clearPhotoId) {
        if (!confirm('Убрать фото у этого блюда?')) return;
        if (busy) return;
        busy = true;
        try {
          await api(`/items/${clearPhotoId}/image/clear`, { method: 'POST' });
          await loadData();
          renderItems();
          toast('Фото удалено');
        } catch (err) {
          toast(err.message, false);
        } finally {
          busy = false;
        }
        return;
      }
      if (delId) {
        if (!confirm('Удалить это блюдо из меню?')) return;
        if (busy) return;
        busy = true;
        try {
          await api(`/items/${delId}`, { method: 'DELETE' });
          await loadData();
          renderItems();
          toast('Блюдо удалено');
        } catch (err) {
          toast(err.message, false);
        } finally {
          busy = false;
        }
      }
    };
  }

  function openItemEditor(item) {
    openModal(item ? 'Редактировать блюдо' : 'Новое блюдо', `
      <form id="item-form" class="form-grid">
        <label>Название *
          <input name="name" required value="${esc(item?.name || '')}" placeholder="Например: Цезарь с курицей">
        </label>
        <label>Категория *
          <select name="categoryId" required>
            ${categories.map(c => `<option value="${c.id}" ${item?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <label>Подкатегория
          <input name="subcat" value="${esc(item?.subcat || '')}" placeholder="Например: Вина">
        </label>
        <label>Объём
          <input name="volume" value="${esc(item?.volume || '')}" placeholder="0,25 л / 50 мл">
        </label>
        <label>Цена (₸) *
          <input name="price" type="number" min="0" step="1" required value="${item?.price ?? ''}">
        </label>
        <label>Вторая цена (₸)
          <input name="price2" type="number" min="0" step="1" value="${item?.price2 ?? ''}" placeholder="Для бутылки / 1 л">
        </label>
        <label class="full">Состав / описание
          <textarea name="description" placeholder="Ингредиенты через запятую">${esc(item?.desc || '')}</textarea>
        </label>
        ${item ? `
          <div class="full photo-field">
            <span class="photo-field__label">Фото блюда</span>
            ${item.image ? `
              <div class="photo-field__preview">
                <img class="thumb thumb--lg" src="${esc(item.image)}" alt="">
                <button type="button" class="btn btn--danger btn--sm" id="clear-photo-btn">Удалить фото</button>
              </div>
            ` : '<p class="photo-field__empty">Фото пока нет</p>'}
            <input type="file" name="image" accept="image/*">
            <small class="photo-field__hint">Можно загрузить новое или просто удалить текущее</small>
          </div>` : ''}
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          <button type="submit" class="btn btn--gold" id="save-item-btn">Сохранить</button>
          <button type="button" class="btn btn--ghost" data-close-modal>Отмена</button>
        </div>
      </form>`);

    document.getElementById('clear-photo-btn')?.addEventListener('click', async () => {
      if (!item?.id) return;
      if (!confirm('Удалить фото у этого блюда?')) return;
      if (busy) return;
      busy = true;
      try {
        await api(`/items/${item.id}/image/clear`, { method: 'POST' });
        await loadData();
        closeModal();
        renderItems();
        toast('Фото удалено');
      } catch (err) {
        toast(err.message, false);
      } finally {
        busy = false;
      }
    });

    document.getElementById('item-form').onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      const btn = document.getElementById('save-item-btn');
      const fd = new FormData(e.target);
      const body = {
        name: String(fd.get('name') || '').trim(),
        categoryId: Number(fd.get('categoryId')),
        subcat: String(fd.get('subcat') || '').trim() || null,
        price: Number(fd.get('price')),
        price2: fd.get('price2') ? Number(fd.get('price2')) : null,
        volume: String(fd.get('volume') || '').trim() || null,
        description: String(fd.get('description') || '').trim() || null,
      };

      if (!body.name || !body.categoryId || Number.isNaN(body.price)) {
        toast('Заполните название, категорию и цену', false);
        return;
      }

      busy = true;
      btn.disabled = true;
      btn.textContent = 'Сохраняем…';
      try {
        if (item) {
          await api(`/items/${item.id}`, { method: 'PUT', body });
          const file = fd.get('image');
          if (file && file.size) {
            const imgFd = new FormData();
            imgFd.append('image', file);
            await api(`/items/${item.id}/image`, { method: 'POST', body: imgFd });
          }
        } else {
          await api('/items', { method: 'POST', body });
        }
        await loadData();
        closeModal();
        renderItems();
        toast('Сохранено — меню обновлено');
      } catch (err) {
        toast(err.message, false);
        btn.disabled = false;
        btn.textContent = 'Сохранить';
      } finally {
        busy = false;
      }
    };
  }

  function renderCategories() {
    const el = document.getElementById('view-categories');
    el.innerHTML = `
      <div class="panel">
        <div class="panel__head">
          <h3 class="panel__title">Категории · ${categories.length}</h3>
          <button type="button" class="btn btn--gold btn--sm" id="add-cat">+ Категория</button>
        </div>
        <p class="panel__hint">Порядок — это очерёдность вкладок на сайте (меньше число = выше в списке).</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Название</th><th>Порядок</th><th>Блюд</th><th></th></tr></thead>
            <tbody>
              ${categories.map(c => {
                const count = items.filter(i => i.categoryId === c.id).length;
                return `<tr>
                  <td><input data-cat-name="${c.id}" value="${esc(c.name)}" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px"></td>
                  <td><input data-cat-order="${c.id}" type="number" value="${c.sort_order}" style="width:72px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px"></td>
                  <td><span class="badge">${count}</span></td>
                  <td class="td-actions">
                    <button type="button" class="btn btn--ghost btn--sm" data-save-cat="${c.id}">Сохранить</button>
                    <button type="button" class="btn btn--danger btn--sm" data-del-cat="${c.id}">Удалить</button>
                  </td>
                </tr>`;
              }).join('') || `<tr><td colspan="4"><div class="empty-state">Категорий пока нет</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('add-cat').onclick = () => {
      openModal('Новая категория', `
        <form id="cat-form" class="form-grid">
          <label class="full">Название
            <input name="name" required placeholder="Например: Завтраки">
          </label>
          <div class="full" style="display:flex;gap:10px">
            <button type="submit" class="btn btn--gold">Добавить</button>
            <button type="button" class="btn btn--ghost" data-close-modal>Отмена</button>
          </div>
        </form>`);
      document.getElementById('cat-form').onsubmit = async e => {
        e.preventDefault();
        const name = new FormData(e.target).get('name').toString().trim();
        if (!name) return;
        try {
          await api('/categories', { method: 'POST', body: { name, sortOrder: categories.length } });
          categories = await api('/categories');
          closeModal();
          renderCategories();
          toast('Категория добавлена');
        } catch (err) {
          toast(err.message, false);
        }
      };
    };

    el.onclick = async e => {
      const saveId = e.target.closest('[data-save-cat]')?.dataset.saveCat;
      const delId = e.target.closest('[data-del-cat]')?.dataset.delCat;
      if (saveId) {
        try {
          await api(`/categories/${saveId}`, {
            method: 'PUT',
            body: {
              name: document.querySelector(`[data-cat-name="${saveId}"]`).value.trim(),
              sortOrder: Number(document.querySelector(`[data-cat-order="${saveId}"]`).value),
            },
          });
          categories = await api('/categories');
          toast('Категория сохранена');
        } catch (err) {
          toast(err.message, false);
        }
      }
      if (delId) {
        if (!confirm('Удалить категорию и все блюда в ней?')) return;
        try {
          await api(`/categories/${delId}`, { method: 'DELETE' });
          await loadData();
          renderCategories();
          toast('Категория удалена');
        } catch (err) {
          toast(err.message, false);
        }
      }
    };
  }

  async function renderLogs() {
    const el = document.getElementById('view-logs');
    el.innerHTML = `
      <div class="panel">
        <div class="panel__head"><h3 class="panel__title">Журнал действий</h3></div>
        <div class="filters">
          <input id="log-action" placeholder="Фильтр: login, item, category…">
          <input id="log-actor" placeholder="Пользователь">
          <button type="button" class="btn btn--ghost btn--sm" id="log-refresh">Обновить</button>
        </div>
        <div id="logs-body"></div>
      </div>`;

    const load = async () => {
      const body = document.getElementById('logs-body');
      body.innerHTML = '<div class="empty-state">Загрузка…</div>';
      try {
        const action = document.getElementById('log-action').value.trim();
        const actor = document.getElementById('log-actor').value.trim();
        const params = new URLSearchParams({ limit: '150' });
        if (action) params.set('action', action);
        if (actor) params.set('actor', actor);
        const { rows, total } = await api(`/logs?${params}`);
        body.innerHTML = `
          <p class="panel__hint">Всего записей: ${total}</p>
          <div class="table-wrap"><table>
            <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead>
            <tbody>${rows.map(l => `
              <tr>
                <td>${fmtDate(l.created_at)}</td>
                <td>${esc(l.actor)}</td>
                <td><span class="badge">${esc(prettyAction(l.action))}</span></td>
                <td><small>${esc([l.entity_type, l.entity_id].filter(Boolean).join(' · '))}</small></td>
                <td><small>${esc(shortDetails(l.details))}</small></td>
              </tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">Пусто</div></td></tr>'}
            </tbody>
          </table></div>`;
      } catch (err) {
        body.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      }
    };

    document.getElementById('log-refresh').onclick = load;
    document.getElementById('log-action').oninput = debounce(load, 350);
    document.getElementById('log-actor').oninput = debounce(load, 350);
    load();
  }

  async function renderAnalytics() {
    const el = document.getElementById('view-analytics');
    await safeRender(el, async () => {
      const data = await api('/analytics');
      const max = Math.max(...(data.byDay || []).map(d => d.views), 1);
      el.innerHTML = `
        <div class="panel">
          <h3 class="panel__title">Просмотры за 14 дней</h3>
          <div class="bar-chart">
            ${(data.byDay || []).map(d => `
              <div class="bar-chart__col" title="${d.views}">
                <div class="bar-chart__bar" style="height:${Math.max(4, (d.views / max) * 100)}%"></div>
                <span class="bar-chart__label">${esc(String(d.day).slice(5))}</span>
              </div>`).join('') || '<p class="empty-state">Пока нет данных</p>'}
          </div>
        </div>
        <div class="panel">
          <h3 class="panel__title">Популярные разделы</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>Раздел</th><th>Просмотры</th></tr></thead>
            <tbody>${(data.topCategories || []).map(r => `
              <tr><td>${esc(r.category)}</td><td>${r.views}</td></tr>`).join('') ||
              '<tr><td colspan="2"><div class="empty-state">Статистика появится после просмотров меню</div></td></tr>'}
            </tbody>
          </table></div>
        </div>`;
    });
  }

  async function renderImages() {
    const el = document.getElementById('view-images');
    await safeRender(el, async () => {
      const rows = await api('/image-matches');
      const withPhoto = items.filter(i => i.image).length;
      el.innerHTML = `
        <div class="panel">
          <div class="panel__head">
            <h3 class="panel__title">Фото в меню</h3>
            <span class="badge badge--ok">${withPhoto} / ${items.length} с фото</span>
          </div>
          <p class="panel__hint">
            Лучше назначать фото вручную в разделе «Блюда» → Изменить → загрузить файл.
            Авто-сопоставление из папки <code>image/</code>: команда <code>npm run match-images</code>.
          </p>
          <div class="table-wrap"><table>
            <thead><tr><th>Файл</th><th>Блюдо</th><th>Уверенность</th><th>Метод</th><th>Дата</th></tr></thead>
            <tbody>${(rows || []).map(r => `
              <tr>
                <td>${esc(r.source_file)}</td>
                <td>${esc(r.item_name || '—')}</td>
                <td>${r.confidence != null ? Math.round(r.confidence * 100) + '%' : '—'}</td>
                <td><code>${esc(r.method || '')}</code></td>
                <td>${fmtDate(r.created_at)}</td>
              </tr>`).join('') || '<tr><td colspan="5"><div class="empty-state">Пока нет записей о сопоставлении</div></td></tr>'}
            </tbody>
          </table></div>
        </div>`;
    });
  }

  function prettyAction(a) {
    const map = {
      'login.success': 'Вход',
      'login.failed': 'Ошибка входа',
      logout: 'Выход',
      'item.create': 'Новое блюдо',
      'item.update': 'Изменение блюда',
      'item.delete': 'Удаление блюда',
      'item.image.assign': 'Фото назначено',
      'item.image.clear': 'Фото снято',
      'category.create': 'Новая категория',
      'category.update': 'Категория изменена',
      'category.delete': 'Категория удалена',
    };
    return map[a] || a;
  }

  function shortDetails(details) {
    if (!details) return '';
    try {
      const o = typeof details === 'string' ? JSON.parse(details) : details;
      if (o.name) return o.name;
      if (o.filename) return o.filename;
      return JSON.stringify(o).slice(0, 80);
    } catch {
      return String(details).slice(0, 80);
    }
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Keep session alive / connection check
  setInterval(async () => {
    if (app.hidden) return;
    try {
      await api('/session');
    } catch (_) {
      setOnline(false);
    }
  }, 60000);

  checkSession();
})();
