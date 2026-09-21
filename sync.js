'use strict';

// GitHub Gist-based sync. Requires window.GITHUB_SYNC_TOKEN in config.js.
// Gist ID is cached in localStorage. Last-write-wins by updatedAt timestamp.

const GIST_FILE = 'watchlist-sync.json';
const GIST_API  = 'https://api.github.com/gists';

let _timer    = null;
let _status   = 'idle'; // idle | syncing | synced | error
let _onChange = null;

function token()  { return window.GITHUB_SYNC_TOKEN || ''; }
function gistId() { return localStorage.getItem('syncGistId') || ''; }
function setGistId(id) { localStorage.setItem('syncGistId', id); }

function setStatus(s) {
  _status = s;
  _onChange?.(s);
}

function headers() {
  return { Authorization: `token ${token()}`, 'Content-Type': 'application/json' };
}

async function resolveGistId() {
  // 1. Try cached ID
  const cached = gistId();
  if (cached) {
    try {
      const r = await fetch(`${GIST_API}/${cached}`, { headers: headers() });
      if (r.ok) return cached;
    } catch {}
    localStorage.removeItem('syncGistId');
  }
  // 2. Search existing gists
  const r = await fetch(`${GIST_API}?per_page=100`, { headers: headers() });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const list = await r.json();
  const found = list.find(g => GIST_FILE in (g.files || {}));
  if (found) { setGistId(found.id); return found.id; }
  // 3. Create
  const body = {
    description: 'Watchlist sync',
    public: false,
    files: { [GIST_FILE]: { content: JSON.stringify({ v: 1, updatedAt: 0, watchlist: [], settings: {}, sortSeries: 'added', sortMovies: 'added' }) } },
  };
  const cr = await fetch(GIST_API, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!cr.ok) throw new Error(`GitHub ${cr.status}`);
  const created = await cr.json();
  setGistId(created.id);
  return created.id;
}

async function pull() {
  if (!token()) return null;
  setStatus('syncing');
  try {
    const id = await resolveGistId();
    const r  = await fetch(`${GIST_API}/${id}`, { headers: headers() });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const gist    = await r.json();
    const content = gist.files[GIST_FILE]?.content;
    if (!content) throw new Error('empty gist');
    const data = JSON.parse(content);
    setStatus('synced');
    return data;
  } catch (e) {
    console.error('sync pull', e);
    setStatus('error');
    return null;
  }
}

async function push(data) {
  if (!token()) return;
  setStatus('syncing');
  try {
    const id      = await resolveGistId();
    const payload = { files: { [GIST_FILE]: { content: JSON.stringify({ v: 1, updatedAt: Date.now(), ...data }) } } };
    const r = await fetch(`${GIST_API}/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    setStatus('synced');
  } catch (e) {
    console.error('sync push', e);
    setStatus('error');
  }
}

function schedule(data) {
  if (!token()) return;
  clearTimeout(_timer);
  setStatus('syncing');
  _timer = setTimeout(() => push(data), 2000);
}

window.Sync = {
  init(cb) { _onChange = cb; },
  pull,
  push,
  schedule,
  get status() { return _status; },
};
