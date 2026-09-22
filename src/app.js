'use strict';

import { loadState, rebuildFuse } from './state.js';
import { render }                 from './render/main.js';
import { attachListeners }        from './events.js';
import { initSync }               from './actions.js';

function init() {
  loadState();
  rebuildFuse();
  render();
  attachListeners();
  initSync().catch(e => console.error('initSync', e));
}

document.addEventListener('DOMContentLoaded', init);
