'use strict';

import { state } from '../state.js';
import { esc, posterStyle } from '../utils.js';

export function renderCard(item) {
  const isOpen     = state.openDetailId === item.imdbID;
  const seasonPills = state.settings.showSeasonPills && item.seasons?.length
    ? `<div class="season-pills">${item.seasons.map(s =>
        `<span class="season-pill${s.watched ? ' watched' : ''}" data-action="toggle-season" data-id="${esc(item.imdbID)}" data-season="${s.season}">S${s.season}</span>`
      ).join('')}</div>`
    : '';
  const meta = [item.year, item.imdbRating ? `&#9733; ${esc(item.imdbRating)}` : null].filter(Boolean).join(' · ');
  return `<div class="card${item.watched ? ' watched' : ''}${isOpen ? ' active' : ''}${item.isStub ? ' stub' : ''}" data-id="${esc(item.imdbID)}" data-action="open-detail">
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

export function renderShimmerCards(n = 4) {
  return `<div class="search-grid">${Array.from({ length: n }, () => `<div class="shimmer-card"></div>`).join('')}</div>`;
}
