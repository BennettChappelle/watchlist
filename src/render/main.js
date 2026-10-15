'use strict';

import { state } from '../state.js';
import { parseQueryYear } from '../omdb.js';
import { renderShelf } from './shelf.js';
import { renderSettings } from './settings.js';

function renderMain() {
  const keyHint = !state.omdbKey
    ? `<p class="search-key-hint">Searching your list only · <button class="search-key-btn" data-action="go-settings">Add OMDB key</button> for posters &amp; full search</p>`
    : '';
  return `<header class="header">
    <span class="header-wordmark" data-action="back-to-main" role="link" tabindex="0" aria-label="Watchlist home">Watchlist</span>
    <div class="header-actions">
      ${window.GITHUB_SYNC_TOKEN ? `<span id="sync-dot" class="sync-dot" data-status="${window.Sync?.status || 'idle'}" title="Sync status"></span>` : ''}
      <button class="header-btn" data-action="open-random-picker" title="Random pick (R)" aria-keyshortcuts="r"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/></svg><span class="header-btn-label">Random</span></button>
      <button class="header-settings-btn" data-action="go-settings" title="Settings" aria-label="Settings"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
    </div>
  </header>
  <div class="page-shell">
    <div class="hero-search-wrap">
      <div class="hero-search">
        <span class="hero-search-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg></span>
        <input type="search" id="search-input" class="hero-search-input" placeholder="Search to add movies &amp; series&#8230;" autocomplete="off" spellcheck="false">
        <button class="hero-search-clear hidden" id="search-clear" data-action="search-clear" title="Clear search" aria-label="Clear search"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
        <span id="year-chip" class="year-chip hidden"></span>
        <div id="search-results" class="search-results hidden"></div>
      </div>
      ${keyHint}
    </div>
    <div id="shelves">
      ${renderShelf('series')}
      ${renderShelf('movie')}
    </div>
  </div>`;
}

export function render() {
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
  try {
    app.innerHTML = state.view === 'settings' ? renderSettings() : renderMain();
  } catch (e) {
    console.error('render', e);
    app.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">Something went wrong. <button onclick="location.reload()">Reload</button></div>`;
    return;
  }

  document.querySelectorAll('.shelf-row').forEach(row => {
    const type = row.closest('.shelf')?.dataset.type;
    const pos  = scrollPos[type] ?? state.savedScrollPos?.[type];
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

  const yearChipEl = document.getElementById('year-chip');
  if (yearChipEl && searchVal) {
    const { year: restoredYear } = parseQueryYear(searchVal.trim());
    if (restoredYear) { yearChipEl.textContent = restoredYear; yearChipEl.classList.remove('hidden'); }
  }

  if (state.settings.reduceMotion) document.documentElement.classList.add('reduce-motion');
  else document.documentElement.classList.remove('reduce-motion');
}
