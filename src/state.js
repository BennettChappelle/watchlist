'use strict';

export const state = {
  watchlist: [],
  omdbKey: '',
  syncToken: '',
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

export function rebuildFuse() {
  fuse = new Fuse(state.watchlist, { keys: ['title'], threshold: 0.35 });
}

export function fuseSearch(q) {
  return fuse?.search(q).slice(0, 8).map(r => r.item) || [];
}

export function loadState() {
  try {
    const wl = localStorage.getItem('watchlist');
    if (wl) state.watchlist = JSON.parse(wl);
    state.omdbKey   = localStorage.getItem('omdbKey')   || (window.OMDB_KEY         || '');
    state.syncToken = localStorage.getItem('syncToken') || (window.GITHUB_SYNC_TOKEN || '');
    if (state.syncToken) window.GITHUB_SYNC_TOKEN = state.syncToken;
    state.sortSeries = localStorage.getItem('sortSeries') || 'added';
    state.sortMovies = localStorage.getItem('sortMovies') || 'added';
    const s = localStorage.getItem('settings');
    if (s) state.settings = { ...state.settings, ...JSON.parse(s) };
  } catch (e) { console.error('loadState', e); }
}

export function saveState() {
  try {
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    localStorage.setItem('omdbKey',    state.omdbKey);
    localStorage.setItem('syncToken',  state.syncToken);
    localStorage.setItem('sortSeries', state.sortSeries);
    localStorage.setItem('sortMovies', state.sortMovies);
    localStorage.setItem('settings',   JSON.stringify(state.settings));
    localStorage.setItem('updatedAt',  String(Date.now()));
    // omdbKey/syncToken intentionally excluded — credentials never synced to gist
    window.Sync?.schedule({ watchlist: state.watchlist, settings: state.settings, sortSeries: state.sortSeries, sortMovies: state.sortMovies });
  } catch (e) { console.error('saveState', e); }
}

// Applies remote gist data without scheduling a push back.
// Bug fix: always rebuild Fuse so local search reflects the applied data.
export function applyRemote(remote) {
  if (Array.isArray(remote.watchlist)) {
    state.watchlist = remote.watchlist;
    localStorage.setItem('watchlist', JSON.stringify(remote.watchlist));
  }
  if (remote.settings) {
    state.settings = { ...state.settings, ...remote.settings };
    localStorage.setItem('settings', JSON.stringify(state.settings));
  }
  if (remote.sortSeries) { state.sortSeries = remote.sortSeries; localStorage.setItem('sortSeries', remote.sortSeries); }
  if (remote.sortMovies) { state.sortMovies = remote.sortMovies; localStorage.setItem('sortMovies', remote.sortMovies); }
  localStorage.setItem('updatedAt', String(remote.updatedAt));
  rebuildFuse();
}

export function getSortedFiltered(type) {
  const filter = type === 'series' ? state.filterSeries : state.filterMovies;
  const sort   = type === 'series' ? state.sortSeries   : state.sortMovies;
  let items = state.watchlist.filter(i => i.type === type);
  if (state.settings.hideWatched)  items = items.filter(i => !i.watched);
  else if (filter === 'unwatched') items = items.filter(i => !i.watched);
  else if (filter === 'watched')   items = items.filter(i =>  i.watched);
  const fn = {
    added:  (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
    title:  (a, b) => a.title.localeCompare(b.title),
    rating: (a, b) => parseFloat(b.imdbRating || 0) - parseFloat(a.imdbRating || 0),
  }[sort] || ((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  if (sort === 'added') return [...items.filter(i => !i.watched).sort(fn), ...items.filter(i => i.watched).sort(fn)];
  return [...items].sort(fn);
}

export function shelfStats(type) {
  const all     = state.watchlist.filter(i => i.type === type);
  const watched = all.filter(i => i.watched);
  const ratings = watched.filter(i => i.imdbRating).map(i => parseFloat(i.imdbRating));
  const avg     = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
  if (!all.length) return '';
  return `${watched.length}/${all.length} watched${avg ? ` · avg ★${avg}` : ''}`;
}

export const getItem = id => state.watchlist.find(i => i.imdbID === id);

export function addItem(item) {
  if (!state.watchlist.find(i => i.imdbID === item.imdbID)) {
    state.watchlist.push({ ...item, addedAt: Date.now() });
    rebuildFuse();
    saveState();
  }
}

export function removeItem(id) {
  state.watchlist = state.watchlist.filter(i => i.imdbID !== id);
  if (state.openDetailId === id) state.openDetailId = null;
  rebuildFuse();
  saveState();
}

export function toggleWatched(id) {
  const item = getItem(id);
  if (item) {
    item.watched   = !item.watched;
    item.watchedAt = item.watched ? Date.now() : null;
    saveState();
  }
}

export function toggleSeasonWatched(id, season) {
  const item = getItem(id);
  if (!item?.seasons) return;
  const s = item.seasons.find(s => s.season === season);
  if (s) {
    s.watched    = !s.watched;
    item.watched = item.seasons.every(s => s.watched);
    saveState();
  }
}
