'use strict';

import { state, shelfStats, getItem } from '../state.js';
import { esc, posterStyle } from '../utils.js';
import { renderCard } from './card.js';

export function renderDetailPanel(item) {
  if (!item) return '<div class="detail-panel"></div>';
  const seasons = item.seasons?.length
    ? `<div class="season-pills" style="margin-top:10px">${item.seasons.map(s =>
        `<span class="season-pill${s.watched ? ' watched' : ''}" data-action="toggle-season" data-id="${esc(item.imdbID)}" data-season="${s.season}">S${s.season}</span>`
      ).join('')}</div>`
    : '';
  const meta = [item.year, item.type, item.imdbRating ? `&#9733; ${esc(item.imdbRating)}` : null].filter(Boolean).join(' · ');
  return `<div class="detail-panel open" id="detail-panel">
    <button class="detail-close" data-action="close-detail" title="Close">&#10005;</button>
    <div class="detail-poster" style="${posterStyle(item)}" data-action="close-detail" title="Close" role="button" tabindex="0" aria-label="Close detail panel"></div>
    <div class="detail-body">
      <div class="detail-title"><a href="https://www.google.com/search?q=${encodeURIComponent(`${item.title} ${item.year || ''} ${item.type === 'series' ? 'show' : 'movie'}`.trim())}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none" title="Search Google">${esc(item.title)}</a></div>
      <div class="detail-meta">${meta}</div>
      ${item.plot ? `<div class="detail-plot">${esc(item.plot)}</div>` : ''}
      ${seasons}
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="watched-toggle${item.watched ? ' active' : ''}" data-action="toggle-watched" data-id="${esc(item.imdbID)}">${item.watched ? 'Mark Unwatched' : 'Mark Watched'}</button>
        <button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="remove-item" data-id="${esc(item.imdbID)}">Remove</button>
      </div>
    </div>
  </div>`;
}

function renderRow(items, expanded, type) {
  if (!items.length) return '';
  return `<div class="shelf-row-wrap">
    <div class="shelf-row${expanded ? ' expanded' : ''}">
      ${items.map(i => renderCard(i)).join('')}
    </div>
  </div>`;
}

export function renderShelf(type) {
  const all      = state.watchlist.filter(i => i.type === type);
  const unwatched = all.filter(i => !i.watched);
  const watched   = all.filter(i =>  i.watched);
  const allCount  = all.length;
  const expanded  = type === 'series' ? state.expandedSeries : state.expandedMovies;
  const sort      = type === 'series' ? state.sortSeries     : state.sortMovies;
  const label     = type === 'series' ? 'Series' : 'Movies';
  const openItem  = state.openDetailId ? getItem(state.openDetailId) : null;
  const openHere  = openItem?.type === type;
  const stats     = shelfStats(type);
  const watchedCollapsed = type === 'series' ? state.watchedCollapsedSeries : state.watchedCollapsedMovies;

  const sortFn = {
    added:  (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
    title:  (a, b) => a.title.localeCompare(b.title),
    rating: (a, b) => parseFloat(b.imdbRating || 0) - parseFloat(a.imdbRating || 0),
  }[sort] || ((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  const sortedUnwatched = [...unwatched].sort(sortFn);
  const sortedWatched   = [...watched].sort(sortFn);

  let body;
  if (allCount === 0) {
    body = `<div class="shelf-empty-cta" data-action="focus-search" role="button" tabindex="0" aria-label="Add your first ${label.toLowerCase()}">
      <span class="shelf-empty-plus">+</span>
      <span class="shelf-empty-label">Add your first ${label.toLowerCase()}</span>
    </div>`;
  } else if (openHere) {
    body = renderDetailPanel(openItem);
  } else {
    const unwatchedRow = sortedUnwatched.length
      ? renderRow(sortedUnwatched, expanded, type)
      : (allCount > 0 ? `<div class="shelf-empty">All ${label.toLowerCase()} watched.</div>` : '');

    const watchedSection = watched.length
      ? `<div class="watched-section">
          <button class="watched-section-toggle" data-action="toggle-watched-section" data-type="${type}" aria-expanded="${!watchedCollapsed}">
            <svg class="watched-section-chevron${watchedCollapsed ? '' : ' open'}" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Watched <span class="shelf-count">${watched.length}</span>
          </button>
          ${watchedCollapsed ? '' : renderRow(sortedWatched, expanded, type)}
        </div>`
      : '';

    body = unwatchedRow + watchedSection;
  }

  return `<section class="shelf" data-type="${type}">
    <div class="shelf-header">
      <span class="shelf-label">${label} <span class="shelf-count">${allCount}</span></span>
      <span class="shelf-spacer"></span>
      <select class="shelf-sort" data-action="sort" data-type="${type}">
        <option value="added"${sort === 'added' ? ' selected' : ''}>Added</option>
        <option value="title"${sort === 'title' ? ' selected' : ''}>Title</option>
        <option value="rating"${sort === 'rating' ? ' selected' : ''}>Rating</option>
      </select>
      <button class="shelf-expand-btn" data-action="toggle-expand" data-type="${type}" aria-label="${expanded ? 'Switch to grid view' : 'Switch to list view'}">${expanded
        ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 6.5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> List`
        : `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Grid`
      }</button>
    </div>
    ${stats ? `<div class="shelf-stat">${stats}</div>` : ''}
    <div class="shelf-divider"></div>
    ${body}
  </section>`;
}
