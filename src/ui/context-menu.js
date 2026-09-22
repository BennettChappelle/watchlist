'use strict';

import { getItem } from '../state.js';
import { esc } from '../utils.js';

let contextMenuId = null;

export function hideContextMenu() {
  document.querySelector('.context-menu')?.remove();
  contextMenuId = null;
}

export function showContextMenu(id, x, y) {
  hideContextMenu();
  contextMenuId = id;
  const item = getItem(id);
  if (!item) return;
  const m = document.createElement('div');
  m.className = 'context-menu';
  m.style.cssText = `left:${x}px;top:${y}px`;
  const searchLink = !item.isStub
    ? `<a class="context-item" href="https://www.google.com/search?q=${encodeURIComponent(item.title + (item.year ? ' ' + item.year : ''))}" target="_blank" rel="noopener noreferrer">Search on Google</a>`
    : '';
  m.innerHTML = `
    <button class="context-item" data-action="ctx-toggle-watched" data-id="${esc(id)}">${item.watched ? 'Mark Unwatched' : 'Mark Watched'}</button>
    ${searchLink}
    <button class="context-item danger" data-action="ctx-remove" data-id="${esc(id)}">Remove</button>`;
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  if (r.right  > window.innerWidth)  m.style.left = (window.innerWidth  - r.width  - 8) + 'px';
  if (r.bottom > window.innerHeight) m.style.top  = (y - r.height) + 'px';
}

export function showActionSheet(id) {
  document.querySelector('.action-sheet-overlay')?.remove();
  const item = getItem(id);
  if (!item) return;
  const o = document.createElement('div');
  o.className = 'action-sheet-overlay';
  const sheetSearch = !item.isStub
    ? `<a class="action-sheet-item" href="https://www.google.com/search?q=${encodeURIComponent(item.title + (item.year ? ' ' + item.year : ''))}" target="_blank" rel="noopener noreferrer">Search on Google</a>`
    : '';
  o.innerHTML = `<div class="action-sheet">
    <div class="action-sheet-handle"></div>
    <div class="action-sheet-title">${esc(item.title)}</div>
    <button class="action-sheet-item" data-action="ctx-toggle-watched" data-id="${esc(id)}">${item.watched ? 'Mark Unwatched' : 'Mark Watched'}</button>
    ${sheetSearch}
    <button class="action-sheet-item danger" data-action="ctx-remove" data-id="${esc(id)}">Remove</button>
    <button class="action-sheet-item" data-action="close-action-sheet">Cancel</button>
  </div>`;
  document.body.appendChild(o);
}
