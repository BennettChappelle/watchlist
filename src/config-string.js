'use strict';

// Config string = btoa(JSON.stringify({omdb, sync, settings}))
// Place in config.js as: window.WL_CONFIG = '...';
// Or paste into Settings → Config string → Apply.

export function encodeConfig(state) {
  const c = { settings: state.settings };
  if (state.omdbKey)   c.omdb = state.omdbKey;
  if (state.syncToken) c.sync = state.syncToken;
  return btoa(JSON.stringify(c));
}

// Called at app startup to expand window.WL_CONFIG into the
// individual window globals that loadState() already reads.
export function applyWindowConfig() {
  const str = window.WL_CONFIG;
  if (!str) return;
  try {
    const c = JSON.parse(atob(str.trim()));
    if (c.omdb)     window.OMDB_KEY          = c.omdb;
    if (c.sync)     window.GITHUB_SYNC_TOKEN = c.sync;
    if (c.settings) window._WL_SETTINGS      = c.settings;
  } catch (e) { console.error('WL_CONFIG parse error', e); }
}

// Called from Settings import action — immediately applies and persists.
export function importConfigString(str, state, saveStateFn) {
  try {
    const c = JSON.parse(atob(str.trim()));
    if (c.omdb) {
      state.omdbKey = c.omdb;
      localStorage.setItem('omdbKey', c.omdb);
    }
    if (c.sync) {
      state.syncToken = c.sync;
      localStorage.setItem('syncToken', c.sync);
      window.GITHUB_SYNC_TOKEN = c.sync;
    }
    if (c.settings) {
      state.settings = { ...state.settings, ...c.settings };
    }
    saveStateFn();
    return true;
  } catch (e) {
    console.error('importConfigString', e);
    return false;
  }
}
