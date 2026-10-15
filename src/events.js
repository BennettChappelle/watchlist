'use strict';

import { state, saveState } from './state.js';
import { handleAction }     from './actions.js';
import { closeModal }       from './ui/modal.js';
import { hideContextMenu, showContextMenu, showActionSheet } from './ui/context-menu.js';
import { hideSearchResults, handleSearchInput } from './render/search.js';
import { addFromSearch }    from './import-export.js';
import { render }           from './render/main.js';
import { handleRandomKey, openPicker } from './random-pick.js';

let searchDebounce  = null;
let longPressTimer  = null;
let longPressTriggered = false;

export function attachListeners() {
  document.addEventListener('click', e => {
    if (longPressTriggered) { longPressTriggered = false; return; }
    const el = e.target.closest('[data-action]');
    if (el) {
      if (el.dataset.action !== 'sort') {
        handleAction(el.dataset.action, el);
        return;
      }
    }
    if (e.target.classList.contains('modal-overlay')) { closeModal(); return; }
    if (!e.target.closest('.hero-search')) hideSearchResults();
    if (!e.target.closest('.context-menu')) hideContextMenu();
  });

  document.addEventListener('change', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'sort') {
      const type = el.dataset.type;
      if (type === 'series') state.sortSeries = el.value;
      else state.sortMovies = el.value;
      saveState(); render();
    } else if (action === 'set-setting-select' || action === 'set-setting-range') {
      handleAction(action, el);
    }
  });

  document.addEventListener('input', e => {
    if (e.target.closest('[data-action="set-setting-range"]')) {
      const el = e.target.closest('[data-action="set-setting-range"]');
      const sub = el?.closest('.settings-row')?.querySelector('.settings-row-sub');
      if (sub) sub.textContent = `${parseFloat(el.value)}s`;
      return;
    }
    if (e.target.id !== 'search-input') return;
    const q = e.target.value;
    clearTimeout(searchDebounce);
    // Fix: skip debounce for local-only Fuse search (no OMDB key) — removes 400ms lag
    if (!state.omdbKey) { handleSearchInput(q); return; }
    searchDebounce = setTimeout(() => handleSearchInput(q), 400);
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
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      showActionSheet(card.dataset.id);
    }, 500);
  }, { passive: true });

  document.addEventListener('touchend',  () => clearTimeout(longPressTimer), { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
  document.addEventListener('scroll', hideContextMenu, true);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.querySelector('.modal-overlay'))       { closeModal(); return; }
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

  document.addEventListener('keydown', handleRandomKey);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    const card = el?.closest('.card[data-action="open-detail"]');
    if (card) { e.preventDefault(); handleAction('open-detail', card); return; }
    const actionEl = el?.closest('[data-action][role="button"],[data-action][role="switch"],[data-action][role="link"]');
    if (actionEl) { e.preventDefault(); handleAction(actionEl.dataset.action, actionEl); }
  });
}
