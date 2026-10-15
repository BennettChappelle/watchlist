'use strict';

import { state, loadState, rebuildFuse } from './state.js';
import { render }                        from './render/main.js';
import { attachListeners }               from './events.js';
import { initSync }                      from './actions.js';
import { applyWindowConfig }             from './config-string.js';
import { showFirstRunModal }             from './ui/modal.js';

function init() {
  applyWindowConfig();
  loadState();
  rebuildFuse();
  render();
  attachListeners();
  // Show first-run modal only when no key has ever been saved (null → never set vs '' → cleared)
  if (localStorage.getItem('omdbKey') === null && !state.omdbKey) showFirstRunModal();
  initSync().catch(e => console.error('initSync', e));
}

document.addEventListener('DOMContentLoaded', init);
