'use strict';

import { state, getItem, saveState, rebuildFuse, toggleWatched, removeItem, toggleSeasonWatched, applyRemote } from './state.js';
import { render } from './render/main.js';
import { hideSearchResults } from './render/search.js';
import { closeModal, showImportModal, showClearConfirmModal } from './ui/modal.js';
import { hideContextMenu } from './ui/context-menu.js';
import { addFromSearch, doImport, exportWatchlist } from './import-export.js';

export async function initSync() {
  if (!window.GITHUB_SYNC_TOKEN || !window.Sync) return false;
  window.Sync.init(status => {
    const dot = document.getElementById('sync-dot');
    if (dot) dot.dataset.status = status;
  });
  const remote = await window.Sync.pull();
  if (!remote) return false;
  const localTs = parseInt(localStorage.getItem('updatedAt') || '0', 10);
  if (remote.updatedAt > localTs) {
    applyRemote(remote);
    rebuildFuse();
    render();
    return true;
  }
  return false;
}

export function handleAction(action, el) {
  switch (action) {
    case 'go-settings':    state.view = 'settings'; render(); break;
    case 'back-to-main':   state.view = 'main';     render(); break;

    case 'open-detail': {
      const cardEl  = el.closest('[data-id]');
      const id      = cardEl?.dataset.id;
      if (!id) break;
      const posterEl  = cardEl?.querySelector('.card-poster');
      const fromRect  = posterEl?.getBoundingClientRect();
      const wasOpen   = state.openDetailId === id;
      const shelfRow  = cardEl.closest('.shelf-row');
      if (!wasOpen && shelfRow) {
        const t = cardEl.closest('.shelf')?.dataset.type;
        if (t) { state.savedScrollPos = state.savedScrollPos || {}; state.savedScrollPos[t] = shelfRow.scrollLeft; }
      }
      state.openDetailId = wasOpen ? null : id;
      render();
      if (!wasOpen && fromRect) {
        const panel = document.querySelector('.detail-panel.open');
        const dp    = panel?.querySelector('.detail-poster');
        if (panel && dp) {
          panel.style.transition = 'none';
          panel.style.maxHeight  = '340px';
          panel.style.opacity    = '1';
          panel.style.padding    = '20px';
          const to = dp.getBoundingClientRect();
          const dx = fromRect.left - to.left, dy = fromRect.top - to.top;
          const sx = fromRect.width / to.width, sy = fromRect.height / to.height;
          dp.style.transition      = 'none';
          dp.style.transformOrigin = 'top left';
          dp.style.transform       = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
          dp.getBoundingClientRect();
          panel.style.transition = '';
          panel.style.maxHeight  = '';
          panel.style.opacity    = '';
          panel.style.padding    = '';
          panel.style.overflow   = 'visible';
          dp.style.transition    = 'transform 0.42s cubic-bezier(0.34,1.4,0.64,1)';
          dp.style.transform     = '';
          dp.addEventListener('transitionend', () => {
            dp.style.transition      = '';
            dp.style.transformOrigin = '';
            panel.style.overflow     = '';
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
    case 'close-modal':      closeModal(); break;
    case 'export-watchlist': exportWatchlist(); break;
    case 'show-import':      showImportModal(); break;
    case 'do-import':        doImport(); break;

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
    case 'edit-sync-token': {
      const area = document.getElementById('sync-token-edit-area');
      if (area) { area.classList.toggle('hidden'); document.getElementById('sync-token-input')?.focus(); }
      break;
    }
    case 'save-sync-token': {
      const inp = document.getElementById('sync-token-input');
      if (inp) {
        state.syncToken = inp.value.trim();
        window.GITHUB_SYNC_TOKEN = state.syncToken;
        saveState(); render();
        if (state.syncToken) initSync();
      }
      break;
    }

    case 'sync-now': {
      el.textContent = 'Syncing…'; el.disabled = true;
      (async () => {
        if (!window.Sync) return;
        const remote = await window.Sync.pull();
        if (!remote) return;
        const localTs = parseInt(localStorage.getItem('updatedAt') || '0', 10);
        if (remote.updatedAt >= localTs) {
          if (remote.updatedAt > localTs) { applyRemote(remote); rebuildFuse(); render(); }
        } else {
          await window.Sync.push({ watchlist: state.watchlist, settings: state.settings, sortSeries: state.sortSeries, sortMovies: state.sortMovies });
        }
      })().catch(e => console.error('sync-now', e)).finally(() => { el.textContent = 'Sync'; el.disabled = false; });
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
    case 'clear-watchlist':   showClearConfirmModal(); break;
    case 'confirm-clear':
      state.watchlist = []; state.openDetailId = null; rebuildFuse(); saveState(); closeModal(); render();
      break;

    case 'close-detail': {
      const panel    = document.querySelector('.detail-panel.open');
      const dp       = panel?.querySelector('.detail-poster');
      const fromRect = dp?.getBoundingClientRect();
      const closingId   = state.openDetailId;
      const closingType = getItem(closingId)?.type;
      state.openDetailId = null;
      render();
      if (closingType && state.savedScrollPos?.[closingType] != null) {
        const row = document.querySelector(`.shelf[data-type="${closingType}"] .shelf-row`);
        if (row) row.scrollLeft = state.savedScrollPos[closingType];
      }
      if (fromRect && closingId) {
        const cardEl   = document.querySelector(`[data-id="${CSS.escape(closingId)}"]`);
        const posterEl = cardEl?.querySelector('.card-poster');
        if (cardEl && posterEl) {
          const toRect = posterEl.getBoundingClientRect();
          const dx = fromRect.left - toRect.left, dy = fromRect.top - toRect.top;
          const sx = fromRect.width / toRect.width, sy = fromRect.height / toRect.height;
          cardEl.style.overflow        = 'visible';
          posterEl.style.transition    = 'none';
          posterEl.style.transformOrigin = 'top left';
          posterEl.style.transform     = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
          posterEl.getBoundingClientRect();
          posterEl.style.transition    = 'transform 0.38s cubic-bezier(0.34,1.4,0.64,1)';
          posterEl.style.transform     = '';
          posterEl.addEventListener('transitionend', () => {
            posterEl.style.transition      = '';
            posterEl.style.transformOrigin = '';
            cardEl.style.overflow          = '';
          }, { once: true });
        }
      }
      break;
    }

    case 'search-clear': {
      const si = document.getElementById('search-input');
      if (si) { si.value = ''; si.focus(); }
      hideSearchResults();
      document.getElementById('year-chip')?.classList.add('hidden');
      document.getElementById('search-clear')?.classList.add('hidden');
      break;
    }
    case 'focus-search': {
      const si = document.getElementById('search-input');
      if (si) { si.focus(); si.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      break;
    }
  }
}
