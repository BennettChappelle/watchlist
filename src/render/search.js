'use strict';

import { state, fuseSearch } from '../state.js';
import { esc, titleGradient } from '../utils.js';
import { omdbSearch, tryYearExactLookup, parseQueryYear } from '../omdb.js';
import { renderShimmerCards } from './card.js';

export function renderSearchResultsList(results) {
  if (!results?.length) return `<div class="search-empty">No results.</div>`;
  return `<div class="search-grid">${results.map(r => {
    const added  = !!state.watchlist.find(i => i.imdbID === r.imdbID);
    const poster = r.Poster && r.Poster !== 'N/A' ? r.Poster : null;
    const pStyle = poster
      ? `background-image:url("${esc(r.Poster)}");background-size:cover;background-position:center`
      : `background:${titleGradient(r.Title || '')}`;
    return `<div class="search-card${added ? ' already-added' : ''}" data-action="add-from-search" data-id="${esc(r.imdbID)}" data-title="${esc(r.Title)}" data-year="${esc(r.Year)}" data-type="${esc(r.Type)}" data-poster="${esc(poster || '')}">
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

export function showSearchResults(html) {
  const el = document.getElementById('search-results');
  if (!el) return;
  el.innerHTML = html;
  el.classList.remove('hidden');
}

export function hideSearchResults() {
  const el = document.getElementById('search-results');
  if (el) { el.innerHTML = ''; el.classList.add('hidden'); }
  document.getElementById('search-clear')?.classList.add('hidden');
}

export async function handleSearchInput(value) {
  const q        = value.trim();
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !value);

  const { title: parsedTitle, year: parsedYear } = parseQueryYear(q);
  const yearChip = document.getElementById('year-chip');
  if (yearChip) {
    if (parsedYear) { yearChip.textContent = parsedYear; yearChip.classList.remove('hidden'); }
    else yearChip.classList.add('hidden');
  }

  if (!q) { hideSearchResults(); return; }

  if (state.omdbKey) {
    showSearchResults(renderShimmerCards(4));
    try {
      const data = await omdbSearch(parsedTitle, 1, parsedYear);
      if (data.Search?.length) { showSearchResults(renderSearchResultsList(data.Search)); return; }
      if (parsedYear) {
        const exact = await tryYearExactLookup(parsedTitle, parsedYear);
        if (exact) { showSearchResults(renderSearchResultsList([exact])); return; }
      }
      showSearchResults(renderSearchResultsList([]));
    } catch (e) {
      console.error('search', e);
      const tooMany = /too many results/i.test(e.message);
      if (tooMany) {
        try {
          const movieData = await omdbSearch(parsedTitle, 1, parsedYear, 'movie');
          if (movieData.Search?.length) { showSearchResults(renderSearchResultsList(movieData.Search)); return; }
        } catch {}
        try {
          const seriesData = await omdbSearch(parsedTitle, 1, parsedYear, 'series');
          if (seriesData.Search?.length) { showSearchResults(renderSearchResultsList(seriesData.Search)); return; }
        } catch {}
        if (parsedYear) {
          const exact = await tryYearExactLookup(parsedTitle, parsedYear);
          if (exact) { showSearchResults(renderSearchResultsList([exact])); return; }
        }
        showSearchResults('<div class="search-empty">Too many results — try a more specific title.</div>');
        return;
      }
      if (parsedYear) {
        try {
          const exact = await tryYearExactLookup(parsedTitle, parsedYear);
          if (exact) { showSearchResults(renderSearchResultsList([exact])); return; }
        } catch {}
      }
      showSearchResults(`<div class="search-empty">Search error: ${esc(e.message)}</div>`);
    }
  } else {
    const local = fuseSearch(q);
    if (local.length) {
      showSearchResults(renderSearchResultsList(local.map(i => ({ imdbID: i.imdbID, Title: i.title, Year: i.year, Type: i.type, Poster: i.poster }))));
    } else {
      showSearchResults(`<div class="search-empty">Searching your list only. <button class="search-key-btn" data-action="go-settings">Add OMDB key</button> for full search.</div>`);
    }
  }
}
