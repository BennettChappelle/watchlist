'use strict';

import { state } from '../state.js';

export const closeModal = () => document.querySelector('.modal-overlay')?.remove();

export function modal(title, body, footer) {
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-panel modal-sm">
    <div class="modal-header">
      <span class="modal-title">${title}</span>
      <button class="modal-close" data-action="close-modal">&#10005;</button>
    </div>
    <div class="modal-divider"></div>
    <div class="modal-scroll">${body}</div>
    <div class="modal-footer">${footer}</div>
  </div>`;
  document.body.appendChild(o);
  return o;
}

export function showImportModal() {
  modal(
    'Import',
    `<p class="import-hint">Paste JSON export or plain titles (one per line). Append <code>S1</code> for series.</p>
     <textarea id="import-textarea" class="import-textarea" placeholder="Paste here&#8230;"></textarea>`,
    `<button class="btn-ghost" data-action="close-modal">Cancel</button>
     <button class="btn-primary" data-action="do-import">Import</button>`
  );
}

export function showDiffModal(diff) {
  modal(
    'Import Complete',
    `<div class="diff-summary">
      <div class="diff-row diff-added"><span class="diff-count">${diff.added.length}</span> added</div>
      <div class="diff-row diff-existing"><span class="diff-count">${diff.skipped.length}</span> already in list</div>
      ${diff.failed.length ? `<div class="diff-row diff-failed"><span class="diff-count">${diff.failed.length}</span> added as stubs (OMDB unavailable)</div>` : ''}
    </div>`,
    `<button class="btn-primary" data-action="close-modal">Done</button>`
  );
}

export function showFirstRunModal() {
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.innerHTML = `<div class="first-run-panel">
    <div class="first-run-title">Welcome to Watchlist</div>
    <div class="first-run-desc">Add a free OMDB API key to enable search and metadata. You can skip and add it later in Settings.</div>
    <input type="text" id="first-run-key" class="first-run-input" placeholder="OMDB API key">
    <div class="first-run-error" id="first-run-error"></div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button class="btn-primary" data-action="save-first-run-key">Save Key</button>
      <button class="btn-ghost" data-action="close-modal">Skip</button>
    </div>
  </div>`;
  document.body.appendChild(o);
}

export function showClearConfirmModal() {
  modal(
    'Clear all data',
    `<p class="import-hint">This will permanently remove all ${state.watchlist.length} title${state.watchlist.length !== 1 ? 's' : ''}. This cannot be undone.</p>`,
    `<button class="btn-ghost" data-action="close-modal">Cancel</button>
     <button class="btn-primary" style="background:var(--danger)" data-action="confirm-clear">Remove All</button>`
  );
}
