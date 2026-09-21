'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  watchlist: [],
  omdbKey: '',
  sortSeries: 'added',
  sortMovies: 'added',
  filterSeries: 'all',
  filterMovies: 'all',
  expandedSeries: false,
  expandedMovies: false,
  openDetailId: null,
  view: 'main',
  settings: {
    defaultGrid: false,
    hideWatched: false,
    showSeasonPills: false,
    reduceMotion: false,
  },
};

let fuse = null;
let searchDebounce = null;
let contextMenuId = null;
let longPressTimer = null;
let longPressTriggered = false;

// ── Persistence ────────────────────────────────────────────────────────────
function loadState() {
  try {
    const wl = localStorage.getItem('watchlist');
    if (wl) state.watchlist = JSON.parse(wl);
    state.omdbKey = localStorage.getItem('omdbKey') || (window.OMDB_KEY || '');
    state.sortSeries = localStorage.getItem('sortSeries') || 'added';
    state.sortMovies = localStorage.getItem('sortMovies') || 'added';
    const s = localStorage.getItem('settings');
    if (s) state.settings = { ...state.settings, ...JSON.parse(s) };
  } catch (e) { console.error('loadState', e); }
}

function saveState() {
  try {
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    localStorage.setItem('omdbKey', state.omdbKey);
    localStorage.setItem('sortSeries', state.sortSeries);
    localStorage.setItem('sortMovies', state.sortMovies);
    localStorage.setItem('settings', JSON.stringify(state.settings));
    const ts = Date.now();
    localStorage.setItem('updatedAt', String(ts));
    window.Sync?.schedule({ watchlist: state.watchlist, settings: state.settings, sortSeries: state.sortSeries, sortMovies: state.sortMovies });
  } catch (e) { console.error('saveState', e); }
}

// ── Fuse ───────────────────────────────────────────────────────────────────
function rebuildFuse() {
  fuse = new Fuse(state.watchlist, { keys: ['title'], threshold: 0.35 });
}

// ── OMDB ───────────────────────────────────────────────────────────────────
async function omdbFetch(params) {
  if (!state.omdbKey) throw new Error('No OMDB key');
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', state.omdbKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (res.status === 401) throw new Error('Invalid API key');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response === 'False') throw new Error(data.Error || 'OMDB error');
  return data;
}

const omdbSearch = (q, page = 1) => omdbFetch({ s: q, page });
const omdbGetById = id => omdbFetch({ i: id, plot: 'short' });
const omdbGetByTitle = (title, type) => omdbFetch({ t: title, ...(type ? { type } : {}), plot: 'short' });

// ── Gradient fallback ──────────────────────────────────────────────────────
function titleGradient(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h);
  h = Math.abs(h) % 360;
  return `linear-gradient(135deg,hsl(${h},30%,18%),hsl(${(h+40)%360},25%,12%))`;
}

// ── Sort / filter ──────────────────────────────────────────────────────────
function getSortedFiltered(type) {
  const filter = type === 'series' ? state.filterSeries : state.filterMovies;
  const sort   = type === 'series' ? state.sortSeries   : state.sortMovies;
  let items = state.watchlist.filter(i => i.type === type);
  if (state.settings.hideWatched)  items = items.filter(i => !i.watched);
  else if (filter === 'unwatched') items = items.filter(i => !i.watched);
  else if (filter === 'watched')   items = items.filter(i =>  i.watched);
  const fn = { added:(a,b)=>(b.addedAt||0)-(a.addedAt||0), title:(a,b)=>a.title.localeCompare(b.title), rating:(a,b)=>parseFloat(b.imdbRating||0)-parseFloat(a.imdbRating||0) }[sort] || ((a,b)=>(b.addedAt||0)-(a.addedAt||0));
  // Only split watched/unwatched groups for "added" sort; other sorts rank globally
  if (sort === 'added') return [...items.filter(i=>!i.watched).sort(fn), ...items.filter(i=>i.watched).sort(fn)];
  return [...items].sort(fn);
}

// ── Item helpers ───────────────────────────────────────────────────────────
const getItem = id => state.watchlist.find(i => i.imdbID === id);

function addItem(item) {
  if (!state.watchlist.find(i => i.imdbID === item.imdbID)) {
    state.watchlist.push({ ...item, addedAt: Date.now() });
    rebuildFuse(); saveState();
  }
}

function removeItem(id) {
  state.watchlist = state.watchlist.filter(i => i.imdbID !== id);
  if (state.openDetailId === id) state.openDetailId = null;
  rebuildFuse(); saveState();
}

function toggleWatched(id) {
  const item = getItem(id);
  if (item) {
    item.watched = !item.watched;
    item.watchedAt = item.watched ? Date.now() : null;
    saveState();
  }
}

function toggleSeasonWatched(id, season) {
  const item = getItem(id);
  if (!item?.seasons) return;
  const s = item.seasons.find(s => s.season === season);
  if (s) { s.watched = !s.watched; item.watched = item.seasons.every(s => s.watched); saveState(); }
}

function omdbToItem(data) {
  const type = data.Type === 'series' ? 'series' : 'movie';
  const n = type === 'series' ? parseInt(data.totalSeasons) || 0 : 0;
  return {
    imdbID: data.imdbID,
    title: data.Title,
    year: data.Year,
    type,
    poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
    imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null,
    plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
    watched: false,
    addedAt: Date.now(),
    isStub: false,
    seasons: Array.from({length:n}, (_,i) => ({season:i+1, watched:false})),
  };
}

function stubItem(title, type = 'movie') {
  return { imdbID:'stub-'+Date.now()+'-'+Math.random().toString(36).slice(2), title, year:null, type, poster:null, imdbRating:null, plot:null, watched:false, addedAt:Date.now(), isStub:true, seasons:[] };
}

// ── Shelf stats ────────────────────────────────────────────────────────────
function shelfStats(type) {
  const all     = state.watchlist.filter(i => i.type === type);
  const watched = all.filter(i => i.watched);
  const ratings = watched.filter(i => i.imdbRating).map(i => parseFloat(i.imdbRating));
  const avg     = ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(1) : null;
  if (!all.length) return '';
  return `${watched.length}/${all.length} watched${avg ? ` · avg ★${avg}` : ''}`;
}

// ── Render helpers ─────────────────────────────────────────────────────────
const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function posterStyle(item) {
  return item.poster ? `background-image:url('${esc(item.poster)}');background-size:cover;background-position:center` : `background:${titleGradient(item.title)}`;
}

// ── Card ───────────────────────────────────────────────────────────────────
function renderCard(item) {
  const isOpen = state.openDetailId === item.imdbID;
  const seasonPills = state.settings.showSeasonPills && item.seasons?.length
    ? `<div class="season-pills">${item.seasons.map(s=>`<span class="season-pill${s.watched?' watched':''}" data-action="toggle-season" data-id="${esc(item.imdbID)}" data-season="${s.season}">S${s.season}</span>`).join('')}</div>`
    : '';
  const meta = [item.year, item.imdbRating ? `&#9733; ${esc(item.imdbRating)}` : null].filter(Boolean).join(' · ');
  return `<div class="card${item.watched?' watched':''}${isOpen?' active':''}${item.isStub?' stub':''}" data-id="${esc(item.imdbID)}" data-action="open-detail">
    <div class="card-poster" style="${posterStyle(item)}">
      ${item.watched ? '<div class="watched-badge">&#10003;</div>' : ''}
      ${item.isStub && !item.poster ? `<span class="stub-title">${esc(item.title)}</span>` : ''}
    </div>
    <div class="card-footer">
      <div class="card-title">${esc(item.title)}</div>
      ${meta ? `<div class="card-meta">${meta}</div>` : ''}
      ${item.isStub ? '<div class="card-stub-label">stub</div>' : ''}
    </div>
    ${seasonPills}
  </div>`;
}

function renderShimmerCards(n = 4) {
  return `<div class="search-grid">${Array.from({length:n},()=>`<div class="shimmer-card"></div>`).join('')}</div>`;
}

// ── Detail panel ───────────────────────────────────────────────────────────
function renderDetailPanel(item) {
  if (!item) return '<div class="detail-panel"></div>';
  const seasons = item.seasons?.length
    ? `<div class="season-pills" style="margin-top:10px">${item.seasons.map(s=>`<span class="season-pill${s.watched?' watched':''}" data-action="toggle-season" data-id="${esc(item.imdbID)}" data-season="${s.season}">S${s.season}</span>`).join('')}</div>`
    : '';
  const meta = [item.year, item.type, item.imdbRating ? `&#9733; ${esc(item.imdbRating)}` : null].filter(Boolean).join(' · ');
  return `<div class="detail-panel open" id="detail-panel">
    <button class="detail-close" data-action="close-detail" title="Close">&#10005;</button>
    <div class="detail-poster" style="${posterStyle(item)}" data-action="close-detail" title="Close" role="button" tabindex="0"></div>
    <div class="detail-body">
      <div class="detail-title">${esc(item.title)}</div>
      <div class="detail-meta">${meta}</div>
      ${item.plot ? `<div class="detail-plot">${esc(item.plot)}</div>` : ''}
      ${seasons}
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="watched-toggle${item.watched?' active':''}" data-action="toggle-watched" data-id="${esc(item.imdbID)}">${item.watched?'Mark Unwatched':'Mark Watched'}</button>
        <button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="remove-item" data-id="${esc(item.imdbID)}">Remove</button>
      </div>
    </div>
  </div>`;
}

// ── Shelf ──────────────────────────────────────────────────────────────────
function renderShelf(type) {
  const items    = getSortedFiltered(type);
  const allCount = state.watchlist.filter(i => i.type === type).length;
  const expanded = type === 'series' ? state.expandedSeries : state.expandedMovies;
  const sort     = type === 'series' ? state.sortSeries     : state.sortMovies;
  const filter   = type === 'series' ? state.filterSeries   : state.filterMovies;
  const label    = type === 'series' ? 'Series' : 'Movies';
  const openItem = state.openDetailId ? getItem(state.openDetailId) : null;
  const openHere = openItem?.type === type;
  const stats    = shelfStats(type);

  const filterBtn = (val, text) =>
    `<button class="shelf-filter-btn${filter===val?' active':''}" data-action="filter" data-type="${type}" data-value="${val}">${text}</button>`;

  let body;
  if (allCount === 0) {
    body = `<div class="shelf-empty-cta" data-action="focus-search">
      <span class="shelf-empty-plus">+</span>
      <span class="shelf-empty-label">Add your first ${label.toLowerCase()}</span>
    </div>`;
  } else if (items.length === 0) {
    body = `<div class="shelf-empty">Nothing matches this filter.</div>`;
  } else {
    body = openHere
      ? renderDetailPanel(openItem)
      : `<div class="shelf-row-wrap">
          <div class="shelf-row${expanded?' expanded':''}">
            ${items.map(i => renderCard(i)).join('')}
          </div>
        </div>`;
  }

  return `<section class="shelf" data-type="${type}">
    <div class="shelf-header">
      <span class="shelf-label">${label} <span class="shelf-count">${allCount}</span></span>
      <div class="shelf-filters">
        ${filterBtn('all','All')}
        <span class="shelf-filter-sep">·</span>
        ${filterBtn('unwatched','Unwatched')}
        <span class="shelf-filter-sep">·</span>
        ${filterBtn('watched','Watched')}
      </div>
      <span class="shelf-spacer"></span>
      <select class="shelf-sort" data-action="sort" data-type="${type}">
        <option value="added"${sort==='added'?' selected':''}>Added</option>
        <option value="title"${sort==='title'?' selected':''}>Title</option>
        <option value="rating"${sort==='rating'?' selected':''}>Rating</option>
      </select>
      <button class="shelf-expand-btn" data-action="toggle-expand" data-type="${type}">${expanded?'&#9650; List':'&#9660; Grid'}</button>
    </div>
    ${stats ? `<div class="shelf-stat">${stats}</div>` : ''}
    <div class="shelf-divider"></div>
    ${body}
  </section>`;
}

// ── Search results dropdown ────────────────────────────────────────────────
function renderSearchResultsList(results) {
  if (!results?.length) return `<div class="search-empty">No results.</div>`;
  return `<div class="search-grid">${results.map(r => {
    const added = !!state.watchlist.find(i => i.imdbID === r.imdbID);
    const poster = r.Poster && r.Poster !== 'N/A' ? r.Poster : null;
    const pStyle = poster ? `background-image:url('${esc(r.Poster)}');background-size:cover;background-position:center` : `background:${titleGradient(r.Title||'')}`;
    return `<div class="search-card${added?' already-added':''}" data-action="add-from-search" data-id="${esc(r.imdbID)}" data-title="${esc(r.Title)}" data-year="${esc(r.Year)}" data-type="${esc(r.Type)}" data-poster="${esc(poster||'')}">
      <div class="card-poster" style="${pStyle}">
        ${added ? '<div class="watched-badge" style="background:var(--accent);color:#fff;font-size:11px">&#10003;</div>' : ''}
      </div>
      <div class="card-footer">
        <div class="card-title">${esc(r.Title)}</div>
        <div class="card-meta">${esc(r.Year)} · ${esc(r.Type)}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function showSearchResults(html) {
  const el = document.getElementById('search-results');
  if (!el) return;
  el.innerHTML = html;
  el.classList.remove('hidden');
}
function hideSearchResults() {
  const el = document.getElementById('search-results');
  if (el) { el.innerHTML = ''; el.classList.add('hidden'); }
  document.getElementById('search-clear')?.classList.add('hidden');
}

async function handleSearchInput(value) {
  const q = value.trim();
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !value);
  if (!q) { hideSearchResults(); return; }
  if (state.omdbKey) {
    showSearchResults(renderShimmerCards(4));
    try {
      const data = await omdbSearch(q);
      showSearchResults(renderSearchResultsList(data.Search || []));
    } catch (e) {
      console.error('search', e);
      showSearchResults(`<div class="search-empty">Search error: ${esc(e.message)}</div>`);
    }
  } else {
    const local = fuse?.search(q).slice(0,8).map(r=>r.item) || [];
    if (local.length) {
      showSearchResults(renderSearchResultsList(local.map(i=>({imdbID:i.imdbID,Title:i.title,Year:i.year,Type:i.type,Poster:i.poster}))));
    } else {
      showSearchResults(`<div class="search-empty">Searching your list only. <button class="search-key-btn" data-action="go-settings">Add OMDB key</button> for full search.</div>`);
    }
  }
}

// ── Add from search ────────────────────────────────────────────────────────
async function addFromSearch(el) {
  const id = el.dataset.id;
  if (!id || state.watchlist.find(i => i.imdbID === id)) return;
  const title  = el.dataset.title || 'Unknown';
  const type   = el.dataset.type === 'series' ? 'series' : 'movie';
  const year   = el.dataset.year  || null;
  const poster = el.dataset.poster || null;

  const stub = { ...stubItem(title, type), imdbID: id, year, poster: poster || null, isStub: true };
  addItem(stub);
  hideSearchResults();
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  render();

  if (state.omdbKey) {
    try {
      const data = await omdbGetById(id);
      const idx = state.watchlist.findIndex(i => i.imdbID === id);
      if (idx !== -1) {
        const full = omdbToItem(data);
        full.addedAt  = state.watchlist[idx].addedAt;
        full.watched  = state.watchlist[idx].watched;
        state.watchlist[idx] = full;
        rebuildFuse(); saveState(); render();
      }
    } catch (e) {
      console.error('resolve', e);
      const idx = state.watchlist.findIndex(i => i.imdbID === id);
      if (idx !== -1) { state.watchlist[idx].isStub = false; saveState(); render(); }
    }
  } else {
    const idx = state.watchlist.findIndex(i => i.imdbID === id);
    if (idx !== -1) { state.watchlist[idx].isStub = false; saveState(); render(); }
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
function renderSettings() {
  const { defaultGrid, hideWatched, showSeasonPills, reduceMotion } = state.settings;
  const toggle = (key, on) => `<span class="toggle${on?' on':''}" data-action="toggle-setting" data-key="${key}"><span class="toggle-track"></span><span class="toggle-thumb"></span></span>`;

  return `<div class="settings-view">
    <header class="header">
      <span class="header-wordmark">Settings</span>
      <div class="header-actions">
        <button class="header-settings-btn" data-action="back-to-main" title="Back">&#8592; Back</button>
      </div>
    </header>
    <div style="padding-top:80px;max-width:640px;margin:0 auto;padding-bottom:48px">
      <div class="settings-section-label">OMDB API Key</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left">
            <span class="settings-row-label">${state.omdbKey ? 'Key saved' : 'No key set'}</span>
            <span class="settings-row-sub">Required for search &amp; metadata</span>
          </div>
          <div class="settings-row-right">
            ${state.omdbKey
              ? `<button class="key-change" data-action="edit-key">Change</button>`
              : `<button class="btn-primary" style="font-size:13px;padding:6px 14px" data-action="edit-key">Add Key</button>`}
          </div>
        </div>
        <div id="key-edit-area" class="hidden" style="padding:0 16px 14px">
          <div class="key-edit-wrap">
            <input type="password" id="key-edit-input" class="key-edit-input" placeholder="Enter OMDB key" value="${esc(state.omdbKey)}">
            <button class="btn-primary" style="font-size:13px" data-action="save-key">Save</button>
          </div>
          <div class="settings-hint">Free keys at omdbapi.com · 1000 req/day</div>
        </div>
      </div>

      <div class="settings-section-label" style="margin-top:28px">Preferences</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Default grid view</span></div>
          <div class="settings-row-right">${toggle('defaultGrid', defaultGrid)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Hide watched titles</span></div>
          <div class="settings-row-right">${toggle('hideWatched', hideWatched)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Show season pills</span></div>
          <div class="settings-row-right">${toggle('showSeasonPills', showSeasonPills)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Reduce motion</span></div>
          <div class="settings-row-right">${toggle('reduceMotion', reduceMotion)}</div>
        </div>
      </div>

      <div class="settings-section-label" style="margin-top:28px">Data</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Export watchlist</span></div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="export-watchlist">Export JSON</button></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Import watchlist</span></div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="show-import">Import</button></div>
        </div>
        <div class="settings-row danger">
          <div class="settings-row-left"><span class="settings-row-label">Clear all data</span></div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px;color:var(--danger);border-color:var(--danger)" data-action="clear-watchlist">Clear</button></div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Main view ──────────────────────────────────────────────────────────────
function renderMain() {
  const keyHint = !state.omdbKey
    ? `<p class="search-key-hint">Searching your list only · <button class="search-key-btn" data-action="go-settings">Add OMDB key</button> for posters &amp; full search</p>`
    : '';
  return `<header class="header">
    <span class="header-wordmark">Watchlist</span>
    <div class="header-actions">
      ${window.GITHUB_SYNC_TOKEN ? `<span id="sync-dot" class="sync-dot" data-status="${window.Sync?.status||'idle'}" title="Sync status"></span>` : ''}
      <button class="header-settings-btn" data-action="go-settings" title="Settings">&#9881;</button>
    </div>
  </header>
  <div class="page-shell">
    <div class="hero-search-wrap">
      <div class="hero-search">
        <span class="hero-search-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg></span>
        <input type="search" id="search-input" class="hero-search-input" placeholder="Search to add movies &amp; series&#8230;" autocomplete="off" spellcheck="false">
        <button class="hero-search-clear hidden" id="search-clear" data-action="search-clear" title="Clear search" aria-label="Clear search"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
        <div id="search-results" class="search-results hidden"></div>
      </div>
      ${keyHint}
    </div>
    <div id="shelves">
      ${renderShelf('series')}
      ${renderShelf('movies')}
    </div>
  </div>`;
}

function render() {
  const scrollPos = {};
  document.querySelectorAll('.shelf-row').forEach(row => {
    const type = row.closest('.shelf')?.dataset.type;
    if (type) scrollPos[type] = row.scrollLeft;
  });
  const searchVal     = document.getElementById('search-input')?.value || '';
  const searchFocused = document.activeElement?.id === 'search-input';
  const resultsEl     = document.getElementById('search-results');
  const resultsHtml   = resultsEl?.innerHTML || '';
  const resultsOpen   = resultsEl && !resultsEl.classList.contains('hidden');

  const app = document.getElementById('app');
  app.innerHTML = state.view === 'settings' ? renderSettings() : renderMain();

  document.querySelectorAll('.shelf-row').forEach(row => {
    const type = row.closest('.shelf')?.dataset.type;
    const pos = scrollPos[type] ?? state.savedScrollPos?.[type];
    if (type && pos) row.scrollLeft = pos;
  });
  const inp = document.getElementById('search-input');
  if (inp) {
    if (searchVal) inp.value = searchVal;
    if (searchFocused) inp.focus();
  }
  const newResults = document.getElementById('search-results');
  if (newResults && resultsHtml && resultsOpen) {
    newResults.innerHTML = resultsHtml;
    newResults.classList.remove('hidden');
  }
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn && searchVal) clearBtn.classList.remove('hidden');

  if (state.settings.reduceMotion) document.documentElement.classList.add('reduce-motion');
  else document.documentElement.classList.remove('reduce-motion');
}

// ── Context menu ───────────────────────────────────────────────────────────
function showContextMenu(id, x, y) {
  hideContextMenu();
  contextMenuId = id;
  const item = getItem(id);
  if (!item) return;
  const m = document.createElement('div');
  m.className = 'context-menu';
  m.style.cssText = `left:${x}px;top:${y}px`;
  const searchLink = !item.isStub ? `<a class="context-item" href="https://www.google.com/search?q=${encodeURIComponent(item.title + (item.year ? ' ' + item.year : ''))}" target="_blank" rel="noopener noreferrer">Search on Google</a>` : '';
  m.innerHTML = `
    <button class="context-item" data-action="ctx-toggle-watched" data-id="${esc(id)}">${item.watched?'Mark Unwatched':'Mark Watched'}</button>
    ${searchLink}
    <button class="context-item danger" data-action="ctx-remove" data-id="${esc(id)}">Remove</button>`;
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  if (r.right  > window.innerWidth)  m.style.left = (window.innerWidth  - r.width  - 8) + 'px';
  if (r.bottom > window.innerHeight) m.style.top  = (y - r.height) + 'px';
}

function hideContextMenu() {
  document.querySelector('.context-menu')?.remove();
  contextMenuId = null;
}

function showActionSheet(id) {
  document.querySelector('.action-sheet-overlay')?.remove();
  const item = getItem(id);
  if (!item) return;
  const o = document.createElement('div');
  o.className = 'action-sheet-overlay';
  const sheetSearch = !item.isStub ? `<a class="action-sheet-item" href="https://www.google.com/search?q=${encodeURIComponent(item.title + (item.year ? ' ' + item.year : ''))}" target="_blank" rel="noopener noreferrer">Search on Google</a>` : '';
  o.innerHTML = `<div class="action-sheet">
    <div class="action-sheet-handle"></div>
    <div class="action-sheet-title">${esc(item.title)}</div>
    <button class="action-sheet-item" data-action="ctx-toggle-watched" data-id="${esc(id)}">${item.watched?'Mark Unwatched':'Mark Watched'}</button>
    ${sheetSearch}
    <button class="action-sheet-item danger" data-action="ctx-remove" data-id="${esc(id)}">Remove</button>
    <button class="action-sheet-item" data-action="close-action-sheet">Cancel</button>
  </div>`;
  document.body.appendChild(o);
}

// ── Modals ─────────────────────────────────────────────────────────────────
const closeModal = () => document.querySelector('.modal-overlay')?.remove();

function modal(title, body, footer) {
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-panel modal-sm">
    <div class="modal-header">
      <span class="modal-title">${title}</span>
      <button class="modal-close" data-action="close-modal">&#10005;</button>
    </div>
    <div class="modal-divider"></div>
    <div class="modal-scroll">${body}</div>
    <div class="modal-footer">${footer}</div>
  </div>`;
  document.body.appendChild(o);
  return o;
}

function showImportModal() {
  modal(
    'Import',
    `<p class="import-hint">Paste JSON export or plain titles (one per line). Append <code>S1</code> for series.</p>
     <textarea id="import-textarea" class="import-textarea" placeholder="Paste here&#8230;"></textarea>`,
    `<button class="btn-ghost" data-action="close-modal">Cancel</button>
     <button class="btn-primary" data-action="do-import">Import</button>`
  );
}

function showDiffModal(diff) {
  modal(
    'Import Complete',
    `<div class="diff-summary">
      <div class="diff-row diff-added"><span class="diff-count">${diff.added.length}</span> added</div>
      <div class="diff-row diff-existing"><span class="diff-count">${diff.skipped.length}</span> already in list</div>
      ${diff.failed.length ? `<div class="diff-row diff-failed"><span class="diff-count">${diff.failed.length}</span> added as stubs (OMDB unavailable)</div>` : ''}
    </div>`,
    `<button class="btn-primary" data-action="close-modal">Done</button>`
  );
}

function showFirstRunModal() {
  const o = document.createElement('div');
  o.className = 'first-run-overlay';
  o.innerHTML = `<div class="first-run-panel">
    <div class="first-run-title">Welcome to Watchlist</div>
    <div class="first-run-desc">Add a free OMDB API key to enable search and metadata. You can skip and add it later in Settings.</div>
    <input type="text" id="first-run-key" class="first-run-input" placeholder="OMDB API key">
    <div class="first-run-error" id="first-run-error"></div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button class="btn-primary" data-action="save-first-run-key">Save Key</button>
      <button class="btn-ghost" data-action="close-modal">Skip</button>
    </div>
  </div>`;
  document.body.appendChild(o);
}

// ── Import ─────────────────────────────────────────────────────────────────
async function doImport() {
  const ta = document.getElementById('import-textarea');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) return;
  closeModal();

  let items = [];
  try {
    const p = JSON.parse(text);
    if (Array.isArray(p)) items = p;
  } catch (_) {
    items = text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const m = line.match(/\s+\(?S(\d+)\)?$/i);
      return m
        ? { title: line.replace(/\s+\(?S\d+\)?$/i, '').trim(), type: 'series' }
        : { title: line, type: 'movie' };
    });
  }
  if (!items.length) return;

  const prog = document.createElement('div');
  prog.className = 'modal-overlay';
  prog.innerHTML = `<div class="modal-panel modal-sm"><div class="modal-header"><span class="modal-title">Importing&#8230;</span></div><div class="modal-scroll" id="import-progress" style="padding:16px;text-align:center;color:var(--muted)">0 / ${items.length}</div></div>`;
  document.body.appendChild(prog);

  const diff = { added: [], skipped: [], failed: [] };

  for (let i = 0; i < items.length; i++) {
    const el = document.getElementById('import-progress');
    if (el) el.textContent = `${i+1} / ${items.length}`;
    const raw = items[i];

    if (raw.imdbID && raw.title) {
      state.watchlist.find(x => x.imdbID === raw.imdbID) ? diff.skipped.push(raw.title) : (state.watchlist.push(raw), diff.added.push(raw.title));
      continue;
    }
    if (!raw.title) continue;

    if (state.omdbKey) {
      try {
        const data = await omdbGetByTitle(raw.title, raw.type === 'series' ? 'series' : undefined);
        const item = omdbToItem(data);
        state.watchlist.find(x => x.imdbID === item.imdbID) ? diff.skipped.push(item.title) : (state.watchlist.push(item), diff.added.push(item.title));
        if (i < items.length - 1) await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        console.error('import resolve', e);
        state.watchlist.push(stubItem(raw.title, raw.type || 'movie'));
        diff.failed.push(raw.title);
      }
    } else {
      state.watchlist.push(stubItem(raw.title, raw.type || 'movie'));
      diff.added.push(raw.title);
    }
  }

  rebuildFuse(); saveState();
  prog.remove();
  showDiffModal(diff);
  render();
}

function exportWatchlist() {
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state.watchlist, null, 2)], { type: 'application/json' }));
  a.download = `watchlist-${date}.json`;
  a.click();
}

// ── Action dispatcher ──────────────────────────────────────────────────────
function handleAction(action, el) {
  switch (action) {
    case 'go-settings':    state.view = 'settings'; render(); break;
    case 'back-to-main':   state.view = 'main';     render(); break;

    case 'open-detail': {
      const cardEl = el.closest('[data-id]');
      const id = cardEl?.dataset.id;
      if (!id) break;
      const posterEl = cardEl?.querySelector('.card-poster');
      const fromRect = posterEl?.getBoundingClientRect();
      const wasOpen = state.openDetailId === id;
      // Save scroll pos before row is replaced by detail panel
      const shelfRow = cardEl.closest('.shelf-row');
      if (!wasOpen && shelfRow) {
        const t = cardEl.closest('.shelf')?.dataset.type;
        if (t) { state.savedScrollPos = state.savedScrollPos || {}; state.savedScrollPos[t] = shelfRow.scrollLeft; }
      }
      state.openDetailId = wasOpen ? null : id;
      render();
      if (!wasOpen && fromRect) {
        const panel = document.querySelector('.detail-panel.open');
        const dp = panel?.querySelector('.detail-poster');
        if (panel && dp) {
          // Freeze panel open so detail-poster has a stable rect
          panel.style.transition = 'none';
          panel.style.maxHeight = '340px';
          panel.style.opacity = '1';
          panel.style.padding = '20px';
          const to = dp.getBoundingClientRect();
          const dx = fromRect.left - to.left, dy = fromRect.top - to.top;
          const sx = fromRect.width / to.width, sy = fromRect.height / to.height;
          // FLIP: position detail-poster at card location
          dp.style.transition = 'none';
          dp.style.transformOrigin = 'top left';
          dp.style.transform = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
          // Force reflow so browser registers the starting transform
          dp.getBoundingClientRect();
          // Restore panel (already at final values, no animation fires)
          panel.style.transition = '';
          panel.style.maxHeight = '';
          panel.style.opacity = '';
          panel.style.padding = '';
          // Allow poster to animate outside panel bounds during FLIP
          panel.style.overflow = 'visible';
          dp.style.transition = 'transform 0.42s cubic-bezier(0.34,1.4,0.64,1)';
          dp.style.transform = '';
          dp.addEventListener('transitionend', () => {
            dp.style.transition = '';
            dp.style.transformOrigin = '';
            panel.style.overflow = '';
          }, { once: true });
        }
      }
      break;
    }
    case 'toggle-watched': {
      const id = el.dataset.id;
      toggleWatched(id);
      render();
      if (getItem(id)?.watched) {
        const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
        if (card) { card.classList.add('watched-anim'); setTimeout(() => card.classList.remove('watched-anim'), 700); }
      }
      break;
    }
    case 'toggle-season':
      toggleSeasonWatched(el.dataset.id, parseInt(el.dataset.season)); render(); break;
    case 'remove-item':
      removeItem(el.dataset.id); render(); break;
    case 'toggle-expand':
      if (el.dataset.type === 'series') state.expandedSeries = !state.expandedSeries;
      else state.expandedMovies = !state.expandedMovies;
      render(); break;
    case 'filter':
      if (el.dataset.type === 'series') state.filterSeries = el.dataset.value;
      else state.filterMovies = el.dataset.value;
      render(); break;
    case 'add-from-search':
      addFromSearch(el.closest('[data-action="add-from-search"]') || el); break;
    case 'ctx-toggle-watched':
      toggleWatched(el.dataset.id); hideContextMenu(); document.querySelector('.action-sheet-overlay')?.remove(); render(); break;
    case 'ctx-remove':
      removeItem(el.dataset.id); hideContextMenu(); document.querySelector('.action-sheet-overlay')?.remove(); render(); break;
    case 'close-action-sheet':
      document.querySelector('.action-sheet-overlay')?.remove(); break;
    case 'close-modal':    closeModal(); break;
    case 'export-watchlist': exportWatchlist(); break;
    case 'show-import':    showImportModal(); break;
    case 'do-import':      doImport(); break;
    case 'edit-key': {
      const area = document.getElementById('key-edit-area');
      if (area) { area.classList.toggle('hidden'); document.getElementById('key-edit-input')?.focus(); }
      break;
    }
    case 'save-key': {
      const inp = document.getElementById('key-edit-input');
      if (inp) { state.omdbKey = inp.value.trim(); saveState(); render(); }
      break;
    }
    case 'save-first-run-key': {
      const inp = document.getElementById('first-run-key');
      if (inp?.value.trim()) { state.omdbKey = inp.value.trim(); saveState(); }
      closeModal(); break;
    }
    case 'toggle-setting': {
      const k = el.dataset.key;
      if (k in state.settings) { state.settings[k] = !state.settings[k]; saveState(); render(); }
      break;
    }
    case 'clear-watchlist':
      modal(
        'Clear all data',
        `<p class="import-hint">This will permanently remove all ${state.watchlist.length} title${state.watchlist.length !== 1 ? 's' : ''}. This cannot be undone.</p>`,
        `<button class="btn-ghost" data-action="close-modal">Cancel</button>
         <button class="btn-primary" style="background:var(--danger)" data-action="confirm-clear">Remove All</button>`
      );
      break;
    case 'confirm-clear':
      state.watchlist = []; state.openDetailId = null; rebuildFuse(); saveState(); closeModal(); render();
      break;
    case 'close-detail': {
      const panel = document.querySelector('.detail-panel.open');
      const dp = panel?.querySelector('.detail-poster');
      const fromRect = dp?.getBoundingClientRect();
      const closingId = state.openDetailId;
      const closingType = getItem(closingId)?.type;
      state.openDetailId = null;
      render();
      // Restore scroll so card is at its original position before measuring
      if (closingType && state.savedScrollPos?.[closingType] != null) {
        const row = document.querySelector(`.shelf[data-type="${closingType}"] .shelf-row`);
        if (row) row.scrollLeft = state.savedScrollPos[closingType];
      }
      if (fromRect && closingId) {
        const cardEl = document.querySelector(`[data-id="${CSS.escape(closingId)}"]`);
        const posterEl = cardEl?.querySelector('.card-poster');
        if (cardEl && posterEl) {
          const toRect = posterEl.getBoundingClientRect();
          const dx = fromRect.left - toRect.left;
          const dy = fromRect.top - toRect.top;
          const sx = fromRect.width / toRect.width;
          const sy = fromRect.height / toRect.height;
          cardEl.style.overflow = 'visible';
          posterEl.style.transition = 'none';
          posterEl.style.transformOrigin = 'top left';
          posterEl.style.transform = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
          posterEl.getBoundingClientRect();
          posterEl.style.transition = 'transform 0.38s cubic-bezier(0.34,1.4,0.64,1)';
          posterEl.style.transform = '';
          posterEl.addEventListener('transitionend', () => {
            posterEl.style.transition = '';
            posterEl.style.transformOrigin = '';
            cardEl.style.overflow = '';
          }, { once: true });
        }
      }
      break;
    }
    case 'search-clear': {
      const si = document.getElementById('search-input');
      if (si) { si.value = ''; si.focus(); }
      hideSearchResults();
      break;
    }
    case 'focus-search': {
      const si = document.getElementById('search-input');
      if (si) { si.focus(); si.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      break;
    }
  }
}

// ── Events ─────────────────────────────────────────────────────────────────
function attachListeners() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && el.dataset.action !== 'sort') { handleAction(el.dataset.action, el); return; }
    if (!e.target.closest('.hero-search')) hideSearchResults();
    if (!e.target.closest('.context-menu')) hideContextMenu();
  });

  document.addEventListener('change', e => {
    const el = e.target.closest('[data-action="sort"]');
    if (!el) return;
    const type = el.dataset.type;
    if (type === 'series') state.sortSeries = el.value;
    else state.sortMovies = el.value;
    saveState(); render();
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'search-input') return;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => handleSearchInput(e.target.value), 400);
  });

  document.addEventListener('contextmenu', e => {
    const card = e.target.closest('.card[data-id]');
    if (!card) return;
    e.preventDefault();
    showContextMenu(card.dataset.id, e.clientX, e.clientY);
  });

  document.addEventListener('touchstart', e => {
    const card = e.target.closest('.card[data-id]');
    if (!card) return;
    longPressTriggered = false;
    longPressTimer = setTimeout(() => { longPressTriggered = true; showActionSheet(card.dataset.id); }, 500);
  }, { passive: true });

  document.addEventListener('touchend',  () => clearTimeout(longPressTimer), { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
  document.addEventListener('scroll', hideContextMenu, true);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.querySelector('.modal-overlay')) { closeModal(); return; }
      if (document.querySelector('.action-sheet-overlay')) { document.querySelector('.action-sheet-overlay').remove(); return; }
      if (state.openDetailId) { state.openDetailId = null; render(); return; }
      hideSearchResults(); hideContextMenu();
      return;
    }
    const results = document.getElementById('search-results');
    if (!results || results.classList.contains('hidden')) return;
    if (document.activeElement?.id !== 'search-input') return;
    const cards = [...results.querySelectorAll('.search-card:not(.already-added)')];
    if (!cards.length) return;
    const idx = cards.findIndex(c => c.classList.contains('kb-focused'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cards.forEach(c => c.classList.remove('kb-focused'));
      cards[idx < 0 ? 0 : Math.min(idx + 1, cards.length - 1)].classList.add('kb-focused');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cards.forEach(c => c.classList.remove('kb-focused'));
      cards[idx <= 0 ? cards.length - 1 : idx - 1].classList.add('kb-focused');
    } else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault();
      addFromSearch(cards[idx]);
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
async function initSync() {
  if (!window.GITHUB_SYNC_TOKEN || !window.Sync) return;
  window.Sync.init(status => {
    const dot = document.getElementById('sync-dot');
    if (dot) dot.dataset.status = status;
  });
  const remote = await window.Sync.pull();
  if (!remote) return;
  const localTs  = parseInt(localStorage.getItem('updatedAt') || '0', 10);
  if (remote.updatedAt > localTs) {
    if (Array.isArray(remote.watchlist)) state.watchlist = remote.watchlist;
    if (remote.settings)   state.settings   = { ...state.settings, ...remote.settings };
    if (remote.sortSeries) state.sortSeries = remote.sortSeries;
    if (remote.sortMovies) state.sortMovies = remote.sortMovies;
    localStorage.setItem('updatedAt', String(remote.updatedAt));
    rebuildFuse();
    render();
  }
}

function init() {
  loadState();
  rebuildFuse();
  render();
  attachListeners();
  initSync();
}

document.addEventListener('DOMContentLoaded', init);
