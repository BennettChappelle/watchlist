'use strict';

import { state, getSortedFiltered, shelfStats, getItem } from '../state.js';
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
    <div class="detail-poster" style="${posterStyle(item)}" data-action="close-detail" title="Close" role="button" tabindex="0"></div>
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

export function renderShelf(type) {
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
    `<button class="shelf-filter-btn${filter === val ? ' active' : ''}" data-action="filter" data-type="${type}" data-value="${val}">${text}</button>`;

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
          <div class="shelf-row${expanded ? ' expanded' : ''}">
            ${items.map(i => renderCard(i)).join('')}
          </div>
        </div>`;
  }

  return `<section class="shelf" data-type="${type}">
    <div class="shelf-header">
      <span class="shelf-label">${label} <span class="shelf-count">${allCount}</span></span>
      <div class="shelf-filters">
        ${filterBtn('all', 'All')}
        <span class="shelf-filter-sep">·</span>
        ${filterBtn('unwatched', 'Unwatched')}
        <span class="shelf-filter-sep">·</span>
        ${filterBtn('watched', 'Watched')}
      </div>
      <span class="shelf-spacer"></span>
      <select class="shelf-sort" data-action="sort" data-type="${type}">
        <option value="added"${sort === 'added' ? ' selected' : ''}>Added</option>
        <option value="title"${sort === 'title' ? ' selected' : ''}>Title</option>
        <option value="rating"${sort === 'rating' ? ' selected' : ''}>Rating</option>
      </select>
      <button class="shelf-expand-btn" data-action="toggle-expand" data-type="${type}">${expanded ? '&#9650; List' : '&#9660; Grid'}</button>
    </div>
    ${stats ? `<div class="shelf-stat">${stats}</div>` : ''}
    <div class="shelf-divider"></div>
    ${body}
  </section>`;
}
