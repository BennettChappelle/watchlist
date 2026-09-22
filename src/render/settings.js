'use strict';

import { state } from '../state.js';
import { esc } from '../utils.js';

export function renderSettings() {
  const { defaultGrid, hideWatched, showSeasonPills, reduceMotion } = state.settings;
  const toggle = (key, on) =>
    `<span class="toggle${on ? ' on' : ''}" data-action="toggle-setting" data-key="${key}"><span class="toggle-track"></span><span class="toggle-thumb"></span></span>`;

  return `<div class="settings-view">
    <header class="header">
      <span class="header-wordmark">Settings</span>
      <div class="header-actions">
        <button class="header-settings-btn" data-action="back-to-main" title="Back">&#8592; Back</button>
      </div>
    </header>
    <div style="padding-top:80px;max-width:640px;margin:0 auto;padding-bottom:48px">
      <div class="settings-section-label">OMDB API Key</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left">
            <span class="settings-row-label">${state.omdbKey ? 'Key saved' : 'No key set'}</span>
            <span class="settings-row-sub">Required for search &amp; metadata</span>
          </div>
          <div class="settings-row-right">
            ${state.omdbKey
              ? `<button class="key-change" data-action="edit-key">Change</button>`
              : `<button class="btn-primary" style="font-size:13px;padding:6px 14px" data-action="edit-key">Add Key</button>`}
          </div>
        </div>
        <div id="key-edit-area" class="hidden" style="padding:0 16px 14px">
          <div class="key-edit-wrap">
            <input type="password" id="key-edit-input" class="key-edit-input" placeholder="Enter OMDB key" value="${esc(state.omdbKey)}">
            <button class="btn-primary" style="font-size:13px" data-action="save-key">Save</button>
          </div>
          <div class="settings-hint">Free keys at omdbapi.com · 1000 req/day</div>
        </div>
      </div>

      <div class="settings-section-label" style="margin-top:28px">Sync</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left">
            <span class="settings-row-label">${state.syncToken ? 'Token saved' : 'No token set'}</span>
            <span class="settings-row-sub">GitHub token for cross-device sync</span>
          </div>
          <div class="settings-row-right">
            ${state.syncToken
              ? `<button class="key-change" data-action="edit-sync-token">Change</button>`
              : `<button class="btn-primary" style="font-size:13px;padding:6px 14px" data-action="edit-sync-token">Add Token</button>`}
          </div>
        </div>
        <div id="sync-token-edit-area" class="hidden" style="padding:0 16px 14px">
          <div class="key-edit-wrap">
            <input type="password" id="sync-token-input" class="key-edit-input" placeholder="ghp_..." value="${esc(state.syncToken)}">
            <button class="btn-primary" style="font-size:13px" data-action="save-sync-token">Save</button>
          </div>
          <div class="settings-hint">Needs <code>gist</code> scope · <a href="https://github.com/settings/tokens/new?scopes=gist" target="_blank" rel="noopener">Generate token</a></div>
        </div>
        ${state.syncToken ? `<div class="settings-row">
          <div class="settings-row-left">
            <span class="settings-row-label">Sync now</span>
            <span class="settings-row-sub">Pull latest from Gist, then push local changes</span>
          </div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="sync-now">Sync</button></div>
        </div>` : ''}
      </div>

      <div class="settings-section-label" style="margin-top:28px">Preferences</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Default grid view</span></div>
          <div class="settings-row-right">${toggle('defaultGrid', defaultGrid)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Hide watched titles</span></div>
          <div class="settings-row-right">${toggle('hideWatched', hideWatched)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Show season pills</span></div>
          <div class="settings-row-right">${toggle('showSeasonPills', showSeasonPills)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Reduce motion</span></div>
          <div class="settings-row-right">${toggle('reduceMotion', reduceMotion)}</div>
        </div>
      </div>

      <div class="settings-section-label" style="margin-top:28px">Data</div>
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Export watchlist</span></div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="export-watchlist">Export JSON</button></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><span class="settings-row-label">Import watchlist</span></div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px" data-action="show-import">Import</button></div>
        </div>
        <div class="settings-row danger">
          <div class="settings-row-left"><span class="settings-row-label">Clear all data</span></div>
          <div class="settings-row-right"><button class="btn-ghost" style="font-size:13px;padding:6px 14px;color:var(--danger);border-color:var(--danger)" data-action="clear-watchlist">Clear</button></div>
        </div>
      </div>
    </div>
  </div>`;
}
