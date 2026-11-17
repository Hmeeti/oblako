/* OBLAKO admin — edits data/*.json and dish photos, commits them to GitHub.
   GitHub Actions then republishes the site (1–2 min).

   Security model (static hosting, no server):
   - admin/auth.json holds only a PBKDF2 salt + hash of the password.
   - The real key is a fine-grained GitHub token (Contents: read/write, this repo only).
     It is stored only in this browser, AES-GCM encrypted with a key derived from the password,
     and never leaves the device except to api.github.com. */
(function () {
  'use strict';

  /* ---------- Config ---------- */
  const REPO = 'hmeeti/oblako';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const SITE_URL = new URL('../', location.href).href;
  const FILES = { menu: 'data/menu.json', site: 'data/site.json' };
  const PHOTO_DIR = 'image/dishes';
  const PHOTO_SIZES = { 800: 260 * 1024, 400: 80 * 1024 };   // width → max bytes
  const KEYS = {
    vault: 'oblako-admin-vault',
    fails: 'oblako-admin-fails',
    session: 'oblako-admin-session',
    draft: 'oblako-admin-draft',
  };
  const MAX_FAILS = 5;
  const LOCK_MS = 5 * 60 * 1000;
  const IDLE_MS = 20 * 60 * 1000;
  const PUBLISH_POLL_MS = 8000;
  const PUBLISH_TIMEOUT_MS = 10 * 60 * 1000;
  const COMMIT_PREFIX = 'admin: ';
  const BADGES = { new: 'Новинка', hit: 'Хит' };

  /* ---------- State ---------- */
  const store = {
    token: '',
    menu: null,
    site: null,
    original: { menu: '', site: '' },   // last saved JSON text
    shas: { menu: '', site: '' },       // blob shas of the loaded files
    photos: new Map(),                  // file name → { w800, w400, url } waiting for upload
    saving: false,
  };
  const ui = { tab: 'menu', query: '', filter: '', editing: null, editorPhoto: undefined };

  const $ = (id) => document.getElementById(id);

  /* ---------- Small helpers ---------- */
  class AppError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(text, className, onClick, label) {
    const b = el('button', className, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const toJson = (obj) => `${JSON.stringify(obj, null, 1)}\n`;
  const money = (n) => (n == null ? 'по запросу' : `${Number(n).toLocaleString('ru-RU')} ₸`);
  const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const unb64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  const decodeUtf8B64 = (str) => new TextDecoder().decode(unb64(str.replace(/\s/g, '')));

  let toastTimer = null;
  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('toast--error', Boolean(isError));
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), isError ? 6000 : 3000);
  }

  function setStatus(text, state) {
    const s = $('status');
    s.textContent = text;
    s.dataset.state = state;
  }

  function readJsonStorage(storage, key) {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; }
  }

  function writeJsonStorage(storage, key, value) {
    try {
      if (value == null) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ---------- Crypto (Web Crypto API) ---------- */
  // One PBKDF2 run gives 64 bytes: the first 32 are compared with auth.json,
  // the last 32 become the AES key that unlocks the stored GitHub token.
  async function deriveKeys(password, auth) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: unb64(auth.salt), iterations: auth.iterations, hash: 'SHA-256' },
      base,
      512,
    ));
    const aesKey = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { hash: bits.slice(0, 32), aesKey };
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  async function encryptToken(token, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
    return { iv: b64(iv), data: b64(data) };
  }

  async function decryptToken(vault, key) {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.data));
    return new TextDecoder().decode(data);
  }

  /* ---------- GitHub API ---------- */
  async function gh(path, { method = 'GET', body, token = store.token } = {}) {
    if (!navigator.onLine) throw new AppError('Нет интернета. Проверьте подключение и повторите.');
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (_) {
      throw new AppError('Нет интернета. Проверьте подключение и повторите.');
    }

    if (res.status === 401) {
      writeJsonStorage(localStorage, KEYS.vault, null);
      throw new AppError('Ключ GitHub недействителен или истёк. Войдите заново и вставьте новый ключ.', 401);
    }
    if (res.status === 403 || res.status === 429) {
      const limited = res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429;
      throw new AppError(limited
        ? 'GitHub временно ограничил запросы. Подождите пару минут и повторите.'
        : 'У ключа GitHub нет прав на запись. Проверьте его настройки по инструкции.', res.status);
    }
    if (!res.ok) throw new AppError('Не удалось сохранить, повторите.', res.status);
    return res.status === 204 ? null : res.json();
  }

  const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

  async function readFile(path, ref = BRANCH) {
    const file = await gh(`/repos/${REPO}/contents/${encodePath(path)}?ref=${ref}`);
    return { sha: file.sha, text: decodeUtf8B64(file.content) };
  }

  /**
   * Commit several files atomically (one commit, one deploy).
   * files: [{ path, text } | { path, base64 } | { path, sha } | { path, delete: true }]
   * expected: { path: blobSha } — abort if someone changed these files meanwhile.
   */
  async function commitFiles(files, message, expected = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
      const head = ref.object.sha;
      const headCommit = await gh(`/repos/${REPO}/git/commits/${head}`);

      if (Object.keys(expected).length) {
        const dir = await gh(`/repos/${REPO}/contents/data?ref=${head}`);
        const changed = Object.entries(expected).some(([path, sha]) => dir.find(f => f.path === path)?.sha !== sha);
        if (changed) {
          throw new AppError('Данные уже изменили с другого устройства. Нажмите «Выйти», войдите снова и повторите правку.', 409);
        }
      }

      const tree = [];
      for (const f of files) {
        if (f.delete) {
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
          continue;
        }
        if (!f.sha) {
          const blob = await gh(`/repos/${REPO}/git/blobs`, {
            method: 'POST',
            body: f.base64 ? { content: f.base64, encoding: 'base64' } : { content: f.text, encoding: 'utf-8' },
          });
          f.sha = blob.sha;   // kept for a retry — no second upload
        }
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: f.sha });
      }

      const newTree = await gh(`/repos/${REPO}/git/trees`, {
        method: 'POST', body: { base_tree: headCommit.tree.sha, tree },
      });
      const commit = await gh(`/repos/${REPO}/git/commits`, {
        method: 'POST', body: { message, tree: newTree.sha, parents: [head] },
      });
      try {
        await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
          method: 'PATCH', body: { sha: commit.sha, force: false },
        });
        return { sha: commit.sha, blobs: Object.fromEntries(files.map(f => [f.path, f.sha])) };
      } catch (err) {
        if (err.status === 422 && attempt < 2) continue;   // branch moved between our calls — rebuild on top
        throw err;
      }
    }
    throw new AppError('Не удалось сохранить, повторите.');
  }

  /* ---------- Login, lockout, session ---------- */
  let authConfig = null;

  async function loadAuthConfig() {
    const res = await fetch(`auth.json?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new AppError('Не удалось загрузить настройки входа. Обновите страницу.');
    return res.json();
  }

  function lockState() {
    const f = readJsonStorage(localStorage, KEYS.fails) || { count: 0, until: 0 };
    return { ...f, locked: f.until > Date.now() };
  }

  function registerFail() {
    const f = lockState();
    const count = f.count + 1;
    const extra = Math.max(0, count - MAX_FAILS);
    const until = count >= MAX_FAILS ? Date.now() + LOCK_MS * 2 ** Math.min(extra, 4) : 0;
    writeJsonStorage(localStorage, KEYS.fails, { count, until });
    return { count, until };
  }

  // Forget the key stored on this device and ask for a new one
  function resetToken() {
    writeJsonStorage(localStorage, KEYS.vault, null);
    $('token-field').hidden = false;
    $('token-reset').hidden = true;
    $('login-form').token.value = '';
    $('login-form').token.focus();
  }

  function showLoginError(msg) {
    const e = $('login-error');
    e.textContent = msg;
    e.hidden = !msg;
  }

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = $('login-submit');
    if (submit.disabled) return;
    showLoginError('');

    const lock = lockState();
    if (lock.locked) {
      showLoginError(`Слишком много попыток. Вход заблокирован на ${Math.ceil((lock.until - Date.now()) / 60000)} мин.`);
      return;
    }

    const user = form.user.value.trim();
    const password = form.password.value;
    if (!user || !password) {
      showLoginError('Введите логин и пароль.');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Проверка…';
    try {
      authConfig = authConfig || await loadAuthConfig();
      const { hash, aesKey } = await deriveKeys(password, authConfig);
      if (user !== authConfig.user || !sameBytes(hash, unb64(authConfig.hash))) {
        const f = registerFail();
        showLoginError(f.until
          ? `Неверный логин или пароль. Вход заблокирован на ${Math.ceil((f.until - Date.now()) / 60000)} мин.`
          : `Неверный логин или пароль. Осталось попыток: ${MAX_FAILS - f.count}.`);
        return;
      }
      writeJsonStorage(localStorage, KEYS.fails, null);

      const token = await unlockToken(form, aesKey);
      if (!token) return;
      startSession(token);
    } catch (err) {
      showLoginError(err instanceof AppError ? err.message : 'Не удалось войти, повторите.');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Войти';
      form.password.value = '';
    }
  }

  // Returns the GitHub token: decrypted from this device, or taken from the form once.
  async function unlockToken(form, aesKey) {
    const vault = readJsonStorage(localStorage, KEYS.vault);
    if (vault) {
      try {
        return await decryptToken(vault, aesKey);
      } catch (_) {
        writeJsonStorage(localStorage, KEYS.vault, null);   // password changed — ask for the key again
      }
    }

    const token = form.token.value.trim();
    if (!token) {
      $('token-field').hidden = false;
      showLoginError('Первый вход на этом устройстве: вставьте ключ GitHub из инструкции и нажмите «Войти» ещё раз.');
      return '';
    }

    const repo = await gh(`/repos/${REPO}`, { token });
    if (!repo.permissions?.push) {
      throw new AppError('У этого ключа нет права записи в репозиторий. Создайте ключ по инструкции.');
    }
    writeJsonStorage(localStorage, KEYS.vault, await encryptToken(token, aesKey));
    form.token.value = '';
    $('token-field').hidden = true;
    return token;
  }

  function touchSession() {
    if (!store.token) return;
    writeJsonStorage(sessionStorage, KEYS.session, { token: store.token, last: Date.now() });
  }

  function startSession(token) {
    store.token = token;
    touchSession();
    $('view-login').hidden = true;
    $('view-app').hidden = false;
    loadData();
  }

  function logout(reason) {
    if (isDirty() && !reason && !confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    writeJsonStorage(sessionStorage, KEYS.session, null);
    if (!reason) writeJsonStorage(localStorage, KEYS.draft, null);
    store.token = '';
    location.reload();
  }

  function watchIdle() {
    let lastTouch = 0;
    const onActivity = () => {
      if (Date.now() - lastTouch < 30000) return;
      lastTouch = Date.now();
      touchSession();
    };
    ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, onActivity, { passive: true }));

    const check = () => {
      const s = readJsonStorage(sessionStorage, KEYS.session);
      if (store.token && (!s || Date.now() - s.last > IDLE_MS)) {
        saveDraft();
        logout('idle');
      }
    };
    setInterval(check, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }

  /* ---------- Data ---------- */
  async function loadData() {
    setStatus('Загрузка…', 'busy');
    try {
      const [menuFile, siteFile] = await Promise.all([readFile(FILES.menu), readFile(FILES.site)]);
      applyLoaded(menuFile, siteFile);
      restoreDraft();
      renderAll();
      refreshDirty();
    } catch (err) {
      setStatus('Ошибка загрузки', 'error');
      toast(err.message || 'Не удалось загрузить данные, обновите страницу.', true);
      if (err.status === 401) setTimeout(() => logout('expired'), 2500);
    }
  }

  function applyLoaded(menuFile, siteFile) {
    store.menu = JSON.parse(menuFile.text);
    store.site = JSON.parse(siteFile.text);
    store.original = { menu: toJson(store.menu), site: toJson(store.site) };
    store.shas = { menu: menuFile.sha, site: siteFile.sha };
    store.photos.forEach(p => URL.revokeObjectURL(p.url));
    store.photos.clear();
  }

  const menuChanged = () => toJson(store.menu) !== store.original.menu;
  const siteChanged = () => toJson(store.site) !== store.original.site;
  const isDirty = () => Boolean(store.menu) && (menuChanged() || siteChanged());

  let draftTimer = null;
  function refreshDirty() {
    const dirty = isDirty();
    $('save').disabled = !dirty || store.saving;
    $('dirty-text').textContent = dirty ? 'Есть несохранённые изменения' : 'Изменений нет';
    if (dirty) setStatus('Не сохранено', 'dirty');
    else if ($('status').dataset.state === 'dirty' || $('status').textContent === 'Загрузка…') setStatus('Всё сохранено', 'ok');
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 500);
  }

  // Unsaved text edits survive an iPhone tab reload. Photos are too large to keep.
  function saveDraft() {
    if (!store.menu) return;
    writeJsonStorage(localStorage, KEYS.draft, isDirty()
      ? { shas: store.shas, menu: store.menu, site: store.site }
      : null);
  }

  function restoreDraft() {
    const draft = readJsonStorage(localStorage, KEYS.draft);
    if (!draft) return;
    if (draft.shas?.menu === store.shas.menu && draft.shas?.site === store.shas.site) {
      // photos picked before the reload were never uploaded — drop references to them
      const saved = new Set(JSON.parse(store.original.menu).items.map(i => i.photo).filter(Boolean));
      store.menu = draft.menu;
      store.site = draft.site;
      store.menu.items.forEach(i => {
        if (i.photo && !saved.has(i.photo)) delete i.photo;
      });
      toast('Восстановлены несохранённые изменения');
    } else {
      writeJsonStorage(localStorage, KEYS.draft, null);
      toast('Черновик устарел: данные менялись с другого устройства');
    }
  }

  /* ---------- Validation & commit message ---------- */
  function validateAll() {
    const names = new Set(store.menu.categories.map(c => c.name));
    const bad = store.menu.items.find(i => !i.name?.trim() || !names.has(i.cat)
      || (i.price != null && !Number.isInteger(i.price)));
    if (bad) return `Проверьте блюдо «${bad.name || 'без названия'}»: название, раздел и цена.`;
    const sp = store.site.servicePercent;
    if (!Number.isInteger(sp) || sp < 0 || sp > 50) return 'Обслуживание: укажите число от 0 до 50.';
    return '';
  }

  function describeChanges() {
    const before = JSON.parse(store.original.menu);
    const oldById = new Map(before.items.map(i => [i.id, i]));
    const newIds = new Set(store.menu.items.map(i => i.id));
    const parts = [];
    store.menu.items.forEach(i => {
      const o = oldById.get(i.id);
      if (!o) parts.push(`добавлено «${i.name}»`);
      else if (o.price !== i.price) parts.push(`${i.name}: ${o.price ?? '—'} → ${i.price ?? '—'}`);
      else if (Boolean(o.stop) !== Boolean(i.stop)) parts.push(`${i.name}: ${i.stop ? 'в стоп-лист' : 'снова в наличии'}`);
      else if (JSON.stringify(o) !== JSON.stringify(i)) parts.push(`изменено «${i.name}»`);
    });
    before.items.filter(i => !newIds.has(i.id)).forEach(i => parts.push(`удалено «${i.name}»`));
    if (JSON.stringify(before.categories) !== JSON.stringify(store.menu.categories)) parts.push('разделы');
    if (siteChanged()) parts.push('контакты и тексты');
    const head = parts.slice(0, 3).join('; ');
    return parts.length > 3 ? `${head} и ещё ${parts.length - 3}` : head || 'изменения';
  }

  /* ---------- Save & publish ---------- */
  async function save() {
    if (store.saving || !isDirty()) return;
    const problem = validateAll();
    if (problem) {
      toast(problem, true);
      return;
    }

    store.saving = true;
    refreshDirty();
    setStatus('Сохранение…', 'busy');

    try {
      const stamp = new Date().toISOString();
      const files = [];
      const expected = {};
      const watch = {};

      if (menuChanged()) {
        store.menu.updatedAt = stamp;
        files.push({ path: FILES.menu, text: toJson(store.menu) });
        expected[FILES.menu] = store.shas.menu;
        watch[FILES.menu] = stamp;
      }
      if (siteChanged()) {
        store.site.updatedAt = stamp;
        files.push({ path: FILES.site, text: toJson(store.site) });
        expected[FILES.site] = store.shas.site;
        watch[FILES.site] = stamp;
      }
      // upload only photos still used by a dish
      const used = new Set(store.menu.items.map(i => i.photo).filter(Boolean));
      store.photos.forEach((p, name) => {
        if (!used.has(name)) return;
        files.push({ path: `${PHOTO_DIR}/w800/${name}`, base64: p.w800 });
        files.push({ path: `${PHOTO_DIR}/w400/${name}`, base64: p.w400 });
      });

      const message = `${COMMIT_PREFIX}${describeChanges()}`;
      const result = await commitFiles(files, message, expected);

      store.original = { menu: toJson(store.menu), site: toJson(store.site) };
      if (result.blobs[FILES.menu]) store.shas.menu = result.blobs[FILES.menu];
      if (result.blobs[FILES.site]) store.shas.site = result.blobs[FILES.site];
      store.photos.clear();
      writeJsonStorage(localStorage, KEYS.draft, null);
      toast('Сохранено. Сайт обновится через 1–2 минуты.');
      trackPublish(watch);
    } catch (err) {
      setStatus('Ошибка сохранения', 'error');
      toast(err.message || 'Не удалось сохранить, повторите.', true);
    } finally {
      store.saving = false;
      refreshDirty();
      if (ui.tab === 'history') renderHistory();
    }
  }

  // Wait until the live site serves the new files (checks updatedAt in each JSON).
  let publishRun = 0;
  async function trackPublish(watch) {
    const run = ++publishRun;
    const started = Date.now();
    setStatus('Сохранено · публикуется…', 'busy');

    while (run === publishRun && Date.now() - started < PUBLISH_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, PUBLISH_POLL_MS));
      try {
        const checks = await Promise.all(Object.entries(watch).map(async ([path, stamp]) => {
          const res = await fetch(`${SITE_URL}${path}?_=${Date.now()}`, { cache: 'no-store' });
          return res.ok && (await res.json()).updatedAt === stamp;
        }));
        if (checks.every(Boolean)) {
          if (run === publishRun && !isDirty()) setStatus('Опубликовано ✓', 'ok');
          return;
        }
      } catch (_) { /* offline for a moment — keep waiting */ }
    }
    if (run === publishRun) setStatus('Сохранено, публикация задерживается — проверьте сайт позже', 'error');
  }

  /* ---------- History & undo ---------- */
  const revertOf = (msg) => (msg.match(/Revert ([0-9a-f]{40})/) || [])[1];
  const firstLine = (msg) => msg.split('\n')[0];

  async function loadHistory() {
    return gh(`/repos/${REPO}/commits?path=data&sha=${BRANCH}&per_page=30`);
  }

  function findUndoTarget(commits) {
    const reverted = new Set(commits.map(c => revertOf(c.commit.message)).filter(Boolean));
    for (const c of commits) {
      const msg = c.commit.message;
      if (!msg.startsWith(COMMIT_PREFIX)) return null;          // never undo developer commits
      if (revertOf(msg) || reverted.has(c.sha)) continue;
      return c;
    }
    return null;
  }

  async function renderHistory() {
    const list = $('history-list');
    list.replaceChildren(el('p', 'panel__hint', 'Загрузка…'));
    try {
      const commits = await loadHistory();
      const reverted = new Set(commits.map(c => revertOf(c.commit.message)).filter(Boolean));
      list.replaceChildren(...commits.slice(0, 15).map(c => {
        const item = el('div', 'history-item');
        if (reverted.has(c.sha)) item.classList.add('history-item--undone');
        const msg = firstLine(c.commit.message).replace(COMMIT_PREFIX, '');
        item.append(
          el('p', 'history-item__msg', c.commit.message.startsWith(COMMIT_PREFIX) ? msg : `Разработчик: ${msg}`),
          el('p', 'history-item__date', new Date(c.commit.author.date).toLocaleString('ru-RU')),
        );
        return item;
      }));
    } catch (err) {
      list.replaceChildren(el('p', 'form__error', err.message));
    }
  }

  async function undoLast(e) {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    if (isDirty()) {
      toast('Сначала сохраните или отмените текущие изменения.', true);
      return;
    }
    btn.disabled = true;
    try {
      const target = findUndoTarget(await loadHistory());
      if (!target) {
        toast('Нечего отменять.', true);
        return;
      }
      const title = firstLine(target.commit.message).replace(COMMIT_PREFIX, '');
      if (!confirm(`Отменить изменение «${title}»?`)) return;

      setStatus('Отмена…', 'busy');
      const full = await gh(`/repos/${REPO}/commits/${target.sha}`);
      const parent = full.parents[0].sha;
      const files = [];
      for (const f of full.files) {
        if (f.status === 'added') {
          files.push({ path: f.filename, delete: true });
          continue;
        }
        if (f.status === 'renamed') files.push({ path: f.filename, delete: true });
        const path = f.previous_filename || f.filename;
        const meta = await gh(`/repos/${REPO}/contents/${encodePath(path)}?ref=${parent}`);
        files.push({ path, sha: meta.sha });
      }
      const result = await commitFiles(files, `${COMMIT_PREFIX}отмена — ${title}\n\nRevert ${target.sha}`);

      const [menuFile, siteFile] = await Promise.all([readFile(FILES.menu, result.sha), readFile(FILES.site, result.sha)]);
      applyLoaded(menuFile, siteFile);
      renderAll();
      refreshDirty();
      toast('Изменение отменено. Сайт обновится через 1–2 минуты.');
      trackPublish({ [FILES.menu]: store.menu.updatedAt, [FILES.site]: store.site.updatedAt });
    } catch (err) {
      setStatus('Ошибка отмены', 'error');
      toast(err.message || 'Не удалось отменить, повторите.', true);
    } finally {
      btn.disabled = false;
      renderHistory();
    }
  }

  /* ---------- Photos ---------- */
  async function loadImage(file) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { /* fall back */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const canvasToBlob = (canvas, type, quality) => new Promise(r => canvas.toBlob(r, type, quality));

  // Center-crop to 4:3 (card format) and shrink until the size limit is met.
  async function encodeSize(source, width, maxBytes, type) {
    const height = Math.round(width * 3 / 4);
    const srcW = source.width;
    const srcH = source.height;
    const scale = Math.max(width / srcW, height / srcH);
    const cropW = width / scale;
    const cropH = height / scale;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(source, (srcW - cropW) / 2, (srcH - cropH) / 2, cropW, cropH, 0, 0, width, height);

    let quality = 0.85;
    let blob = await canvasToBlob(canvas, type, quality);
    while (blob && blob.size > maxBytes && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, type, quality);
    }
    return blob;
  }

  async function compressPhoto(file) {
    const source = await loadImage(file);
    // WebP where the browser can encode it (Chrome/Android), JPEG otherwise (Safari)
    let type = 'image/webp';
    let w800 = await encodeSize(source, 800, PHOTO_SIZES[800], type);
    if (!w800 || w800.type !== type) {
      type = 'image/jpeg';
      w800 = await encodeSize(source, 800, PHOTO_SIZES[800], type);
    }
    const w400 = await encodeSize(source, 400, PHOTO_SIZES[400], type);
    if (!w800 || !w400) throw new AppError('Не удалось обработать фото. Попробуйте другое.');
    return { ext: type === 'image/webp' ? 'webp' : 'jpg', w800, w400 };
  }

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new AppError('Не удалось прочитать фото.'));
    reader.readAsDataURL(blob);
  });

  function photoSrc(name) {
    if (!name) return '';
    return store.photos.get(name)?.url || `${SITE_URL}${PHOTO_DIR}/w400/${name}`;
  }

  async function onPhotoPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ui.editing) return;
    const label = e.target.closest('label');
    label.classList.add('is-busy');
    try {
      const { ext, w800, w400 } = await compressPhoto(file);
      // a fresh file name per upload, so phones never show a cached old photo
      const name = `${ui.editing.id}-${Date.now().toString(36)}.${ext}`;
      store.photos.set(name, {
        w800: await blobToBase64(w800),
        w400: await blobToBase64(w400),
        url: URL.createObjectURL(w400),
      });
      ui.editorPhoto = name;
      showEditorPhoto();
      toast(`Фото готово: ${Math.round(w800.size / 1024)} КБ`);
    } catch (err) {
      toast(err.message || 'Не удалось обработать фото.', true);
    } finally {
      label.classList.remove('is-busy');
    }
  }

  /* ---------- Rendering: menu ---------- */
  function renderFilter() {
    const select = $('dish-filter');
    const options = [['', 'Все разделы'], ...store.menu.categories.map(c => [c.name, c.name])];
    select.replaceChildren(...options.map(([value, text]) => {
      const o = el('option', null, text);
      o.value = value;
      return o;
    }));
    if (!store.menu.categories.some(c => c.name === ui.filter)) ui.filter = '';
    select.value = ui.filter;
  }

  function dishRow(item) {
    const row = el('div', item.stop ? 'row row--stop' : 'row');
    const main = button('', 'row__main', () => openEditor(item.id), `Изменить: ${item.name}`);
    if (item.photo) {
      const img = el('img', 'row__thumb');
      img.src = photoSrc(item.photo);
      img.alt = '';
      img.loading = 'lazy';
      main.appendChild(img);
    }
    const text = el('span', 'row__text');
    text.appendChild(el('span', 'row__name', item.name));
    const meta = el('span', 'row__meta', money(item.price));
    if (item.stop) meta.append(' · ', el('span', 'row__tag row__tag--stop', 'стоп'));
    else if (BADGES[item.badge]) meta.append(' · ', el('span', 'row__tag', BADGES[item.badge]));
    text.appendChild(meta);
    main.appendChild(text);

    const toggle = el('label', 'switch');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = Boolean(item.stop);
    box.setAttribute('aria-label', `Нет в наличии: ${item.name}`);
    box.addEventListener('change', () => {
      if (box.checked) item.stop = true;
      else delete item.stop;
      row.classList.toggle('row--stop', box.checked);
      refreshDirty();
      renderDishList();
    });
    const track = el('span', 'switch__track');
    track.setAttribute('aria-hidden', 'true');
    toggle.append(box, track);

    row.append(main, toggle);
    return row;
  }

  function renderDishList() {
    const q = ui.query.trim().toLowerCase();
    const list = $('dish-list');
    const frag = document.createDocumentFragment();
    let shown = 0;
    store.menu.categories.forEach(cat => {
      if (ui.filter && cat.name !== ui.filter) return;
      const items = store.menu.items.filter(i => i.cat === cat.name
        && (!q || `${i.name} ${i.desc || ''}`.toLowerCase().includes(q)));
      if (!items.length) return;
      frag.appendChild(el('h3', 'list__group', `${cat.name} · ${items.length}`));
      items.forEach(i => frag.appendChild(dishRow(i)));
      shown += items.length;
    });
    if (!shown) frag.appendChild(el('p', 'panel__hint', 'Ничего не найдено.'));
    list.replaceChildren(frag);
  }

  /* ---------- Dish editor ---------- */
  const editor = () => $('dish-form');

  function showEditorPhoto() {
    const img = $('photo-preview');
    const src = photoSrc(ui.editorPhoto);
    img.hidden = !src;
    $('photo-empty').hidden = Boolean(src);
    if (src) img.src = src;
    $('photo-remove').disabled = !src;
  }

  function fillCategorySelect(select, value) {
    select.replaceChildren(...store.menu.categories.map(c => {
      const o = el('option', null, c.name);
      o.value = c.name;
      return o;
    }));
    select.value = value;
  }

  function openEditor(id) {
    const isNew = !id;
    const item = isNew
      ? { id: `d${Date.now().toString(36)}`, cat: ui.filter || store.menu.categories[0]?.name || '', name: '', price: null, isNew: true }
      : store.menu.items.find(i => i.id === id);
    if (!item) return;
    ui.editing = item;
    ui.editorPhoto = item.photo || '';

    const f = editor();
    $('editor-title').textContent = isNew ? 'Новое блюдо' : 'Блюдо';
    ['name', 'subcat', 'volume', 'desc', 'about', 'priceLabel', 'price2Label'].forEach(k => {
      f[k].value = item[k] || '';
    });
    f.price.value = item.price ?? '';
    f.price2.value = item.price2 ?? '';
    fillCategorySelect(f.cat, item.cat);
    f.badge.value = item.badge || '';
    f.stop.checked = Boolean(item.stop);
    f.querySelector('.more').open = item.price2 != null;
    $('dish-delete').hidden = isNew;
    f.querySelectorAll('[data-move]').forEach(b => { b.hidden = isNew; });
    f.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    $('dish-error').hidden = true;
    showEditorPhoto();

    $('editor').hidden = false;
    document.body.classList.add('is-locked');
    $('editor').scrollTop = 0;
    if (isNew) f.name.focus();
  }

  function closeEditor() {
    $('editor').hidden = true;
    document.body.classList.remove('is-locked');
    ui.editing = null;
  }

  function parsePrice(raw) {
    const s = String(raw).replace(/[\s ₸]/g, '');
    if (!s) return { value: null };
    if (!/^\d{1,7}$/.test(s)) return { error: true };
    return { value: Number(s) };
  }

  function submitEditor(e) {
    e.preventDefault();
    const f = editor();
    const errors = [];
    const mark = (field, bad) => {
      if (bad) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      return bad;
    };

    const name = f.name.value.trim();
    if (mark(f.name, !name)) errors.push('Укажите название.');
    if (mark(f.cat, !f.cat.value)) errors.push('Выберите раздел.');
    const price = parsePrice(f.price.value);
    if (mark(f.price, price.error)) errors.push('Цена — только цифры, например 2790.');
    const price2 = parsePrice(f.price2.value);
    if (mark(f.price2, price2.error)) errors.push('Вторая цена — только цифры.');

    if (errors.length) {
      const box = $('dish-error');
      box.textContent = errors.join(' ');
      box.hidden = false;
      return;
    }

    const item = ui.editing;
    const next = { id: item.id, cat: f.cat.value };
    const text = (k) => f[k].value.trim();
    if (text('subcat')) next.subcat = text('subcat');
    next.name = name;
    next.price = price.value;
    if (price2.value != null) {
      next.price2 = price2.value;
      if (text('priceLabel')) next.priceLabel = text('priceLabel');
      if (text('price2Label')) next.price2Label = text('price2Label');
    }
    ['volume', 'desc', 'about'].forEach(k => { if (text(k)) next[k] = text(k); });
    if (ui.editorPhoto) next.photo = ui.editorPhoto;
    if (f.badge.value) next.badge = f.badge.value;
    if (f.stop.checked) next.stop = true;

    if (item.isNew) {
      // new dishes go to the end of their category
      const lastIdx = store.menu.items.map(i => i.cat).lastIndexOf(next.cat);
      store.menu.items.splice(lastIdx + 1, 0, next);
    } else {
      const idx = store.menu.items.indexOf(item);
      store.menu.items[idx] = next;
    }
    closeEditor();
    renderDishList();
    refreshDirty();
  }

  function moveDish(dir) {
    const items = store.menu.items;
    const item = ui.editing;
    const idx = items.indexOf(item);
    let j = idx + dir;
    while (j >= 0 && j < items.length && items[j].cat !== item.cat) j += dir;
    if (j < 0 || j >= items.length) {
      toast(dir < 0 ? 'Блюдо уже первое в разделе' : 'Блюдо уже последнее в разделе');
      return;
    }
    [items[idx], items[j]] = [items[j], items[idx]];
    renderDishList();
    refreshDirty();
    toast(dir < 0 ? 'Перемещено выше' : 'Перемещено ниже');
  }

  function deleteDish() {
    const item = ui.editing;
    if (!confirm(`Удалить «${item.name}» из меню? Если блюдо закончилось временно, лучше включите «Нет в наличии».`)) return;
    store.menu.items = store.menu.items.filter(i => i !== item);
    closeEditor();
    renderDishList();
    refreshDirty();
  }

  /* ---------- Rendering: categories ---------- */
  function renderCategories() {
    const list = $('cat-list');
    const cats = store.menu.categories;
    list.replaceChildren(...cats.map((cat, idx) => {
      const card = el('div', 'card');
      const name = el('input', 'field__input');
      name.value = cat.name;
      name.setAttribute('aria-label', 'Название раздела');
      name.addEventListener('change', () => {
        const value = name.value.trim();
        if (!value || cats.some(c => c !== cat && c.name === value)) {
          toast('Название пустое или уже занято.', true);
          name.value = cat.name;
          return;
        }
        store.menu.items.forEach(i => { if (i.cat === cat.name) i.cat = value; });
        if (ui.filter === cat.name) ui.filter = value;
        cat.name = value;
        refreshDirty();
        renderFilter();
      });

      const count = store.menu.items.filter(i => i.cat === cat.name).length;
      const compact = el('label', 'switch');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = Boolean(cat.compact);
      box.addEventListener('change', () => {
        if (box.checked) cat.compact = true;
        else delete cat.compact;
        refreshDirty();
      });
      const track = el('span', 'switch__track');
      track.setAttribute('aria-hidden', 'true');
      compact.append(box, track, el('span', null, 'Без фото'));

      const actions = el('div', 'row__actions');
      actions.append(
        button('↑', 'btn btn--ghost btn--icon', () => moveCategory(idx, -1), 'Выше'),
        button('↓', 'btn btn--ghost btn--icon', () => moveCategory(idx, 1), 'Ниже'),
        button('✕', 'btn btn--danger btn--icon', () => deleteCategory(cat, count), 'Удалить раздел'),
      );

      const row = el('div', 'card__row');
      row.append(el('span', 'row__meta', `${count} поз.`), compact, actions);
      card.append(name, row);
      return card;
    }));
  }

  function moveCategory(idx, dir) {
    const cats = store.menu.categories;
    const j = idx + dir;
    if (j < 0 || j >= cats.length) return;
    [cats[idx], cats[j]] = [cats[j], cats[idx]];
    renderCategories();
    renderFilter();
    refreshDirty();
  }

  function deleteCategory(cat, count) {
    if (count) {
      toast('В разделе есть блюда — сначала перенесите или удалите их.', true);
      return;
    }
    if (!confirm(`Удалить раздел «${cat.name}»?`)) return;
    store.menu.categories = store.menu.categories.filter(c => c !== cat);
    renderCategories();
    renderFilter();
    refreshDirty();
  }

  function addCategory(e) {
    e.preventDefault();
    const input = e.currentTarget.name;
    const name = input.value.trim();
    if (!name || store.menu.categories.some(c => c.name === name)) {
      toast('Введите новое, ещё не занятое название.', true);
      return;
    }
    store.menu.categories.push({ name });
    input.value = '';
    renderCategories();
    renderFilter();
    refreshDirty();
  }

  /* ---------- Rendering: contacts & texts ---------- */
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
    target[last] = value;
  }

  function renderBindings() {
    document.querySelectorAll('[data-bind]').forEach(input => {
      input.value = getPath(store.site, input.dataset.bind) ?? '';
    });
  }

  function onBindInput(e) {
    const input = e.target.closest('[data-bind]');
    if (!input || !store.site) return;
    let value = input.value;
    if (input.dataset.type === 'int') {
      const n = parsePrice(value);
      input.setAttribute('aria-invalid', String(Boolean(n.error)));
      if (n.error || n.value == null) return;
      value = n.value;
    } else {
      value = value.trim();
    }
    setPath(store.site, input.dataset.bind, value);
    refreshDirty();
  }

  function textInput(value, label, onInput, rows) {
    const input = el(rows ? 'textarea' : 'input', 'field__input');
    if (rows) input.rows = rows;
    input.value = value || '';
    input.setAttribute('aria-label', label);
    input.placeholder = label;
    input.addEventListener('input', () => {
      onInput(input.value);
      refreshDirty();
    });
    return input;
  }

  function renderPromos() {
    const promos = store.site.promos;
    $('promo-list').replaceChildren(...promos.map((p, idx) => {
      const card = el('div', 'card');
      const active = el('label', 'switch');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = Boolean(p.active);
      box.addEventListener('change', () => {
        p.active = box.checked;
        refreshDirty();
      });
      const track = el('span', 'switch__track');
      track.setAttribute('aria-hidden', 'true');
      active.append(box, track, el('span', null, 'Показывать на сайте'));

      const row = el('div', 'card__row');
      row.append(active, button('Удалить', 'btn btn--danger btn--small', () => {
        if (!confirm('Удалить эту акцию?')) return;
        promos.splice(idx, 1);
        renderPromos();
        refreshDirty();
      }));
      card.append(
        textInput(p.title, 'Заголовок', v => { p.title = v.trim(); }),
        textInput(p.text, 'Текст акции', v => { p.text = v.trim(); }, 3),
        row,
      );
      return card;
    }));
  }

  function renderRulesEditor() {
    const sections = store.site.rules.sections;
    $('rules-list').replaceChildren(...sections.map((s, idx) => {
      const card = el('div', 'card');
      card.append(
        textInput(s.title, 'Заголовок блока', v => { s.title = v.trim(); }),
        textInput(s.items.join('\n'), 'Пункты — каждый с новой строки', v => {
          s.items = v.split('\n').map(x => x.trim()).filter(Boolean);
        }, 5),
        button('Удалить блок', 'btn btn--danger btn--small', () => {
          if (!confirm(`Удалить блок «${s.title}»?`)) return;
          sections.splice(idx, 1);
          renderRulesEditor();
          refreshDirty();
        }),
      );
      return card;
    }));
  }

  /* ---------- Tabs & global render ---------- */
  function showTab(tab) {
    ui.tab = tab;
    document.querySelectorAll('.tabs__btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab; });
    if (tab === 'history') renderHistory();
    window.scrollTo(0, 0);
  }

  function renderAll() {
    store.site.promos ??= [];
    store.site.rules ??= { intro: '', sections: [] };
    renderFilter();
    renderDishList();
    renderCategories();
    renderBindings();
    renderPromos();
    renderRulesEditor();
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    $('login-form').addEventListener('submit', handleLogin);
    $('token-reset').addEventListener('click', resetToken);
    $('logout').addEventListener('click', () => logout());
    $('save').addEventListener('click', save);
    $('undo').addEventListener('click', undoLast);

    document.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (b) showTab(b.dataset.tab);
    });

    $('dish-search').addEventListener('input', e => {
      ui.query = e.target.value;
      renderDishList();
    });
    $('dish-filter').addEventListener('change', e => {
      ui.filter = e.target.value;
      renderDishList();
    });
    $('dish-add').addEventListener('click', () => openEditor(null));

    $('dish-form').addEventListener('submit', submitEditor);
    $('dish-form').addEventListener('click', e => {
      if (e.target.closest('[data-editor-cancel]')) closeEditor();
      const move = e.target.closest('[data-move]');
      if (move) moveDish(Number(move.dataset.move));
    });
    $('dish-delete').addEventListener('click', deleteDish);
    $('photo-input').addEventListener('change', onPhotoPicked);
    $('photo-remove').addEventListener('click', () => {
      ui.editorPhoto = '';
      showEditorPhoto();
    });

    $('cat-add-form').addEventListener('submit', addCategory);
    document.querySelectorAll('[data-panel="contacts"], [data-panel="texts"]').forEach(p => {
      p.addEventListener('input', onBindInput);
    });
    $('promo-add').addEventListener('click', () => {
      store.site.promos.push({ title: '', text: '', active: true });
      renderPromos();
      refreshDirty();
    });
    $('rule-add').addEventListener('click', () => {
      store.site.rules.sections.push({ title: 'Новый блок', items: [] });
      renderRulesEditor();
      refreshDirty();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('editor').hidden) closeEditor();
    });
    window.addEventListener('beforeunload', e => {
      if (!isDirty()) return;
      saveDraft();
      e.preventDefault();
      e.returnValue = '';
    });
  }

  /* ---------- Init ---------- */
  function init() {
    bindEvents();
    watchIdle();

    if (!window.crypto?.subtle) {
      showLoginError('Откройте админку по ссылке https://… в Safari или Chrome.');
      $('login-submit').disabled = true;
      return;
    }
    const hasKey = Boolean(readJsonStorage(localStorage, KEYS.vault));
    $('token-field').hidden = hasKey;
    $('token-reset').hidden = !hasKey;

    const session = readJsonStorage(sessionStorage, KEYS.session);
    if (session?.token && Date.now() - session.last < IDLE_MS) startSession(session.token);
  }

  init();
})();
