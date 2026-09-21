/**
 * Push menu files to GitHub so GitHub Pages stays in sync with admin edits.
 *
 * Required env on Render:
 *   GITHUB_TOKEN  — classic PAT (repo) or fine-grained (Contents: Read+Write)
 *   GITHUB_REPO   — owner/name, default Hmeeti/oblako
 *   GITHUB_BRANCH — default main
 * Optional:
 *   PUBLIC_BASE_URL — https://oblako-lppn.onrender.com (for absolute upload image URLs)
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.github.com';

function cfg() {
  return {
    token: String(process.env.GITHUB_TOKEN || '').trim(),
    repo: String(process.env.GITHUB_REPO || 'Hmeeti/oblako').trim(),
    branch: String(process.env.GITHUB_BRANCH || 'main').trim(),
    publicBase: String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '')
      .trim()
      .replace(/\/$/, ''),
  };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'oblako-menu-sync',
  };
}

async function getFileSha(repo, filePath, branch, token) {
  const url = `${API}/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${filePath}: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.sha || null;
}

async function putFile({ repo, branch, token, filePath, content, message, binary = false }) {
  const sha = await getFileSha(repo, filePath, branch, token);
  const body = {
    message,
    branch,
    content: binary
      ? Buffer.from(content).toString('base64')
      : Buffer.from(String(content), 'utf8').toString('base64'),
  };
  if (sha) body.sha = sha;

  const url = `${API}/repos/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${filePath}: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Rewrite local upload paths to absolute Render URLs so GitHub Pages can load them.
 * Keep relative image/dishes/* for static hosting (strip a leading slash if present).
 */
function absolutizeImagePath(imagePath, publicBase) {
  if (!imagePath) return imagePath;
  const s = String(imagePath);
  if (/^https?:\/\//i.test(s)) return s;
  // Dish photos ship with the static site — never point them at Render
  if (/^\/?image\/dishes\//i.test(s)) return s.replace(/^\//, '');
  if (s.startsWith('/image/uploads/') && publicBase) return `${publicBase}${s}`;
  if (s.startsWith('image/uploads/') && publicBase) return `${publicBase}/${s}`;
  return s;
}

async function pushTextFiles(files, message) {
  const { token, repo, branch } = cfg();
  if (!token) {
    return { skipped: true, reason: 'GITHUB_TOKEN not set' };
  }

  const results = [];
  for (const file of files) {
    await putFile({
      repo,
      branch,
      token,
      filePath: file.path,
      content: file.content,
      message: files.length === 1 ? message : `${message} (${file.path})`,
    });
    results.push(file.path);
  }
  return { pushed: true, files: results, repo, branch };
}

async function pushBinaryFile(remotePath, localAbsPath, message) {
  const { token, repo, branch } = cfg();
  if (!token) return { skipped: true, reason: 'GITHUB_TOKEN not set' };
  if (!fs.existsSync(localAbsPath)) {
    return { skipped: true, reason: 'file missing' };
  }
  const buf = fs.readFileSync(localAbsPath);
  await putFile({
    repo,
    branch,
    token,
    filePath: remotePath,
    content: buf,
    message,
    binary: true,
  });
  return { pushed: true, file: remotePath };
}

let queueTimer = null;
let queuePromise = null;
let pendingBuilder = null;

/**
 * Debounce GitHub pushes so rapid admin edits become one sync.
 * @param {() => {files: {path:string, content:string}[], message:string}} buildFn
 */
function scheduleGithubSync(buildFn) {
  pendingBuilder = buildFn;
  clearTimeout(queueTimer);
  queueTimer = setTimeout(() => {
    queuePromise = runQueuedSync().catch(err => {
      console.error('[github-sync]', err.message);
      return { ok: false, error: err.message };
    });
  }, 1800);
  return queuePromise;
}

async function runQueuedSync() {
  const buildFn = pendingBuilder;
  pendingBuilder = null;
  if (!buildFn) return { skipped: true };
  const payload = buildFn();
  if (!payload?.files?.length) return { skipped: true };
  console.log('[github-sync] pushing', payload.files.map(f => f.path).join(', '));
  const result = await pushTextFiles(payload.files, payload.message || 'chore: sync menu from admin');
  if (result.pushed) console.log('[github-sync] ok →', result.repo, result.branch);
  if (result.skipped) console.warn('[github-sync] skipped:', result.reason);
  return result;
}

async function flushGithubSync() {
  clearTimeout(queueTimer);
  if (pendingBuilder) {
    queuePromise = runQueuedSync().catch(err => {
      console.error('[github-sync]', err.message);
      return { ok: false, error: err.message };
    });
  }
  return queuePromise;
}

module.exports = {
  cfg,
  absolutizeImagePath,
  pushTextFiles,
  pushBinaryFile,
  scheduleGithubSync,
  flushGithubSync,
};
