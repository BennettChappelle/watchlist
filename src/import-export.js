'use strict';

import { state, addItem, rebuildFuse, saveState } from './state.js';
import { omdbGetById, omdbGetByTitle, omdbToItem, stubItem } from './omdb.js';
import { render } from './render/main.js';
import { closeModal, showDiffModal } from './ui/modal.js';
import { hideSearchResults } from './render/search.js';

export async function addFromSearch(el) {
  const id = el.dataset.id;
  if (!id || state.watchlist.find(i => i.imdbID === id)) return;

  const title  = el.dataset.title  || 'Unknown';
  const type   = el.dataset.type === 'series' ? 'series' : 'movie';
  const year   = el.dataset.year   || null;
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
      const idx  = state.watchlist.findIndex(i => i.imdbID === id);
      if (idx !== -1) {
        const full  = omdbToItem(data);
        full.addedAt = state.watchlist[idx].addedAt;
        full.watched = state.watchlist[idx].watched;
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

export async function doImport() {
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
    if (el) el.textContent = `${i + 1} / ${items.length}`;
    const raw = items[i];

    if (raw.imdbID && raw.title) {
      // Validate type from imported JSON; default to movie if missing/invalid
      if (!['series', 'movie'].includes(raw.type)) raw.type = 'movie';
      state.watchlist.find(x => x.imdbID === raw.imdbID)
        ? diff.skipped.push(raw.title)
        : (state.watchlist.push(raw), diff.added.push(raw.title));
      continue;
    }
    if (!raw.title) continue;

    if (state.omdbKey) {
      try {
        const data = await omdbGetByTitle(raw.title, raw.type === 'series' ? 'series' : undefined);
        const item = omdbToItem(data);
        state.watchlist.find(x => x.imdbID === item.imdbID)
          ? diff.skipped.push(item.title)
          : (state.watchlist.push(item), diff.added.push(item.title));
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

export function exportWatchlist() {
  const date = new Date().toISOString().slice(0, 10);
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([JSON.stringify(state.watchlist, null, 2)], { type: 'application/json' }));
  a.download = `watchlist-${date}.json`;
  a.click();
}
