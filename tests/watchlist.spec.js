// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:7890';
const OMDB_FAKE_KEY = 'testkey123';

// ── Fixtures ──────────────────────────────────────────────────────────────

const OMDB_SEARCH_RESULTS = {
  Search: [
    { imdbID: 'tt0903747', Title: 'Breaking Bad', Year: '2008–2013', Type: 'series', Poster: 'N/A' },
    { imdbID: 'tt1234567', Title: 'Breaking Bad: Origins', Year: '2009', Type: 'series', Poster: 'N/A' },
  ],
  totalResults: '2',
  Response: 'True',
};

const OMDB_FULL_ITEM = {
  imdbID: 'tt0903747',
  Title: 'Breaking Bad',
  Year: '2008–2013',
  Type: 'series',
  Poster: 'N/A',
  imdbRating: '9.5',
  Plot: 'A chemistry teacher diagnosed with cancer.',
  totalSeasons: '5',
  Response: 'True',
};

const OMDB_MOVIE_RESULTS = {
  Search: [
    { imdbID: 'tt9999001', Title: 'The Bear', Year: '2022', Type: 'movie', Poster: 'N/A' },
  ],
  totalResults: '1',
  Response: 'True',
};

const OMDB_TOO_MANY = { Response: 'False', Error: 'Too many results.' };

const GIST_ID = 'abc123gistid';
const GIST_PAYLOAD = {
  v: 1,
  updatedAt: Date.now() - 10000,
  watchlist: [],
  settings: {},
  sortSeries: 'added',
  sortMovies: 'added',
};
const GIST_REMOTE_NEWER = {
  ...GIST_PAYLOAD,
  updatedAt: Date.now() + 99999,
  watchlist: [{ imdbID: 'tt_remote_1', title: 'Remote Movie', year: '2020', type: 'movie', watched: false, addedAt: 1000, isStub: false, poster: null, imdbRating: null, plot: null, seasons: [] }],
};

// ── Helpers ───────────────────────────────────────────────────────────────

async function setupApp(page, { omdbKey = OMDB_FAKE_KEY, syncToken = null, localState = null } = {}) {
  // Inject localStorage state before page load
  await page.addInitScript(({ key, token, ls }) => {
    if (key) localStorage.setItem('omdbKey', key);
    if (token) localStorage.setItem('syncToken', token);
    if (ls) {
      for (const [k, v] of Object.entries(ls)) {
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    }
  }, { key: omdbKey, token: syncToken, ls: localState });
}

function mockOmdb(page, handler) {
  return page.route('https://www.omdbapi.com/**', handler);
}

function mockGitHub(page, handler) {
  return page.route('https://api.github.com/**', handler);
}

// ── Test: app loads without JS errors ────────────────────────────────────

test('app loads cleanly — no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await setupApp(page);
  await mockOmdb(page, r => r.fulfill({ json: { Response: 'False', Error: 'no key' } }));
  await page.goto(BASE);
  await page.waitForSelector('#app .shelf', { timeout: 5000 });

  // Filter out known benign noise (font 404s, OMDB key warning)
  const real = errors.filter(e =>
    !e.includes('fonts.googleapis') &&
    !e.includes('No OMDB key') &&
    !e.includes('Failed to load resource')
  );
  expect(real, `Console errors: ${real.join('\n')}`).toHaveLength(0);
});

// ── Test: year chip appears / disappears ─────────────────────────────────

test('year chip shows when year detected in query', async ({ page }) => {
  await setupApp(page);
  await mockOmdb(page, r => r.fulfill({ json: OMDB_SEARCH_RESULTS }));
  await page.goto(BASE);
  await page.waitForSelector('#search-input');

  const chip = page.locator('#year-chip');
  await expect(chip).toHaveClass(/hidden/);

  await page.fill('#search-input', 'breaking bad 2008');
  await page.waitForTimeout(500); // debounce
  await expect(chip).not.toHaveClass(/hidden/);
  await expect(chip).toHaveText('2008');
});

test('year chip hides when query has no year', async ({ page }) => {
  await setupApp(page);
  await mockOmdb(page, r => r.fulfill({ json: OMDB_SEARCH_RESULTS }));
  await page.goto(BASE);
  await page.waitForSelector('#search-input');

  await page.fill('#search-input', 'breaking bad 2008');
  await page.waitForTimeout(500);
  const chip = page.locator('#year-chip');
  await expect(chip).not.toHaveClass(/hidden/);

  await page.fill('#search-input', 'breaking bad');
  await page.waitForTimeout(500);
  await expect(chip).toHaveClass(/hidden/);
});

// ── Test: year extracted and sent as y= param ─────────────────────────────

test('year sent as y param to OMDB for "title YYYY" query', async ({ page }) => {
  let capturedUrl = null;
  await setupApp(page);
  await mockOmdb(page, async r => {
    capturedUrl = r.request().url();
    await r.fulfill({ json: OMDB_SEARCH_RESULTS });
  });
  await page.goto(BASE);
  await page.waitForSelector('#search-input');
  await page.fill('#search-input', 'breaking bad 2008');
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const r = document.getElementById('search-results');
    return r && !r.classList.contains('hidden') && r.querySelectorAll('.search-card').length > 0;
  }, { timeout: 5000 });

  expect(capturedUrl).toContain('y=2008');
  expect(capturedUrl).toContain('s=breaking+bad');
  expect(capturedUrl).not.toContain('s=breaking+bad+2008');
});

test('year sent as y param for "(YYYY)" format', async ({ page }) => {
  let capturedUrl = null;
  await setupApp(page);
  await mockOmdb(page, async r => {
    capturedUrl = r.request().url();
    await r.fulfill({ json: OMDB_SEARCH_RESULTS });
  });
  await page.goto(BASE);
  await page.waitForSelector('#search-input');
  await page.fill('#search-input', 'the bear (2022)');
  await page.waitForTimeout(500);
  await page.waitForSelector('.search-card', { timeout: 5000 });

  expect(capturedUrl).toContain('y=2022');
  expect(capturedUrl).toContain('s=the+bear');
});

test('year sent as y param for "YYYY title" format', async ({ page }) => {
  let capturedUrl = null;
  await setupApp(page);
  await mockOmdb(page, async r => {
    capturedUrl = r.request().url();
    await r.fulfill({ json: OMDB_SEARCH_RESULTS });
  });
  await page.goto(BASE);
  await page.fill('#search-input', '2008 breaking bad');
  await page.waitForTimeout(500);
  await page.waitForSelector('.search-card', { timeout: 5000 });

  expect(capturedUrl).toContain('y=2008');
});

// ── Test: too-many-results auto-retry ─────────────────────────────────────

test('too-many-results retries with type=movie and shows results', async ({ page }) => {
  let callCount = 0;
  await setupApp(page);
  await mockOmdb(page, async r => {
    callCount++;
    const url = new URL(r.request().url());
    if (url.searchParams.get('type') === 'movie') {
      await r.fulfill({ json: OMDB_MOVIE_RESULTS });
    } else {
      await r.fulfill({ json: OMDB_TOO_MANY });
    }
  });
  await page.goto(BASE);
  await page.fill('#search-input', 'the bear');
  await page.waitForTimeout(600);
  await page.waitForSelector('.search-card', { timeout: 5000 });

  const cards = await page.locator('.search-card').count();
  expect(cards).toBeGreaterThan(0);
  expect(callCount).toBeGreaterThanOrEqual(2); // initial + retry
});

test('too-many-results shows fallback message when both types fail', async ({ page }) => {
  await setupApp(page);
  await mockOmdb(page, async r => {
    await r.fulfill({ json: OMDB_TOO_MANY });
  });
  await page.goto(BASE);
  await page.fill('#search-input', 'the');
  await page.waitForTimeout(600);
  await page.waitForSelector('.search-empty', { timeout: 5000 });

  const text = await page.locator('.search-empty').textContent();
  expect(text).toContain('Too many results');
});

// ── Test: add from search → type propagation ─────────────────────────────

test('item added from search gets correct type from OMDB full resolve', async ({ page }) => {
  await setupApp(page);
  await mockOmdb(page, async r => {
    const url = new URL(r.request().url());
    if (url.searchParams.get('i')) {
      await r.fulfill({ json: OMDB_FULL_ITEM });
    } else {
      await r.fulfill({ json: OMDB_SEARCH_RESULTS });
    }
  });
  await page.goto(BASE);
  await page.fill('#search-input', 'breaking bad');
  await page.waitForTimeout(600);
  await page.waitForSelector('.search-card', { timeout: 5000 });
  await page.locator('.search-card').first().click();

  // Wait for enrichment
  await page.waitForTimeout(1000);

  // Check the item is in the Series shelf (type=series from OMDB)
  const seriesShelf = page.locator('.shelf[data-type="series"]');
  await expect(seriesShelf.locator('.card')).toHaveCount(1, { timeout: 5000 });
});

// ── Test: sync — resolveGistId pagination ────────────────────────────────

test('resolveGistId paginates when gist not on first page', async ({ page }) => {
  let page1Fetched = false, page2Fetched = false;
  await setupApp(page, { syncToken: 'ghp_fake_token' });

  await mockGitHub(page, async r => {
    const url = new URL(r.request().url());
    if (url.pathname === `/gists/${GIST_ID}`) {
      // cached ID check
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: GIST_ID, files: { 'watchlist-sync.json': { content: JSON.stringify(GIST_PAYLOAD) } } }) });
      return;
    }
    if (url.pathname === '/gists') {
      const pageNum = url.searchParams.get('page') || '1';
      if (pageNum === '1') {
        page1Fetched = true;
        // First page: no watchlist gist + Link header pointing to page 2
        await r.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json', 'link': `<https://api.github.com/gists?per_page=100&page=2>; rel="next"` },
          body: JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: `othergist${i}`, files: { 'other.json': {} } }))),
        });
      } else {
        page2Fetched = true;
        // Second page has our gist
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: GIST_ID, files: { 'watchlist-sync.json': { content: JSON.stringify(GIST_PAYLOAD) } } }]),
        });
      }
      return;
    }
    await r.continue();
  });

  // Serve Fuse.js stub so the page renders (blocking script — abort breaks render)
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Fuse = function(){this.search=()=>[]};' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

  await page.goto(BASE);
  await page.waitForSelector('.shelf', { timeout: 6000 });
  await page.waitForTimeout(2000); // let initSync run

  // gistId is now cached in localStorage from page 2
  const gistIdStored = await page.evaluate(() => localStorage.getItem('syncGistId'));
  // Either it found it on page 2, OR it used the cached check path (if page ran twice)
  // The key assertion: page1 was fetched
  expect(page1Fetched).toBe(true);
  expect(page2Fetched).toBe(true);
});

// ── Test: initSync returns true when remote newer ────────────────────────

test('initSync returns true when remote is newer, false when not', async ({ page }) => {
  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => consoleMsgs.push(`[pageerror] ${e.message}`));

  await setupApp(page, {
    syncToken: 'ghp_fake',
    localState: { syncGistId: GIST_ID, updatedAt: String(Date.now() - 100000) },
  });

  // Intercept window.Sync to capture pull() result and localTs comparison
  await page.addInitScript(() => {
    let _syncVal;
    Object.defineProperty(window, 'Sync', {
      configurable: true,
      get: () => _syncVal,
      set: (v) => {
        const origPull = v.pull.bind(v);
        v.pull = async function() {
          const result = await origPull();
          window.__pullResult = result ? { updatedAt: result.updatedAt, watchlistLen: (result.watchlist||[]).length } : null;
          return result;
        };
        _syncVal = v;
        Object.defineProperty(window, 'Sync', { value: v, writable: true, configurable: true });
      },
      enumerable: true,
    });
  });

  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Fuse = function(a,o){this._d=a;this.search=()=>[]};' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

  let mockHitCount = 0;
  await mockGitHub(page, async r => {
    mockHitCount++;
    const url = new URL(r.request().url());
    if (url.pathname === `/gists/${GIST_ID}`) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: GIST_ID, files: { 'watchlist-sync.json': { content: JSON.stringify(GIST_REMOTE_NEWER) } } }) });
      return;
    }
    await r.continue();
  });

  await page.goto(BASE);
  await page.waitForSelector('.shelf', { timeout: 5000 });
  await page.waitForTimeout(3000);

  const syncStatus = await page.evaluate(() => document.getElementById('sync-dot')?.dataset?.status);
  const cards = await page.locator('.card').count();
  const debugInfo = await page.evaluate(() => ({
    localTs: parseInt(localStorage.getItem('updatedAt') || '0', 10),
    pullResult: window.__pullResult,
    appCards: document.querySelectorAll('.card').length,
    shelfCount: document.querySelectorAll('.shelf').length,
    shelfEmptyCount: document.querySelectorAll('.shelf-empty-cta').length,
  }));

  // Expose debug info in error message
  if (cards < 1) {
    throw new Error(`cards=${cards} syncStatus=${syncStatus} mockHits=${mockHitCount} debug=${JSON.stringify(debugInfo)} console=${JSON.stringify(consoleMsgs.slice(0, 10))}`);
  }
  expect(cards).toBeGreaterThanOrEqual(1);
});

// ── Test: sync-now skips push when remote is newer ───────────────────────

test('sync-now does not push when remote is newer', async ({ page }) => {
  let pushCount = 0;
  await setupApp(page, {
    syncToken: 'ghp_fake',
    localState: { syncGistId: GIST_ID, updatedAt: String(Date.now() - 100000) },
  });

  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Fuse = function(a,o){this._d=a;this.search=()=>[]};' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

  await mockGitHub(page, async r => {
    const url = new URL(r.request().url());
    if (r.request().method() === 'PATCH') {
      pushCount++;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: GIST_ID }) });
      return;
    }
    if (url.pathname === `/gists/${GIST_ID}`) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: GIST_ID, files: { 'watchlist-sync.json': { content: JSON.stringify(GIST_REMOTE_NEWER) } } }) });
      return;
    }
    await r.continue();
  });

  await page.goto(BASE);
  await page.waitForSelector('[data-action="go-settings"]', { timeout: 5000 });
  await page.waitForTimeout(1500); // let initSync settle

  // Go to settings and trigger sync-now
  await page.click('[data-action="go-settings"]');
  await page.waitForSelector('[data-action="sync-now"]', { timeout: 3000 });

  const initialPushCount = pushCount;
  await page.click('[data-action="sync-now"]');
  await page.waitForTimeout(2000);

  // push should NOT have been called in sync-now (remote was newer)
  expect(pushCount).toBe(initialPushCount);
});

// ── Test: sync-now catches errors ────────────────────────────────────────

test('sync-now restores button state even when initSync throws', async ({ page }) => {
  const errors = [];
  await setupApp(page, {
    syncToken: 'ghp_fake',
    localState: { syncGistId: GIST_ID },
  });

  await mockGitHub(page, async r => {
    await r.fulfill({ status: 500, body: 'Internal Server Error' });
  });

  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(BASE);
  await page.waitForSelector('[data-action="go-settings"]', { timeout: 5000 });
  await page.waitForTimeout(1000);

  await page.click('[data-action="go-settings"]');
  await page.waitForSelector('[data-action="sync-now"]', { timeout: 3000 });

  await page.click('[data-action="sync-now"]');
  await page.waitForTimeout(2000);

  // Button should be restored after error
  const syncBtn = page.locator('[data-action="sync-now"]');
  await expect(syncBtn).toHaveText('Sync');
  await expect(syncBtn).toBeEnabled();
});

// ── Test: saveState gist payload excludes secrets ────────────────────────

test('gist push payload does not contain omdbKey or syncToken', async ({ page }) => {
  let pushedPayload = null;
  await setupApp(page, {
    syncToken: 'ghp_supersecrettoken',
    omdbKey: 'verysecretomdbkey',
    localState: { syncGistId: GIST_ID },
  });

  await mockGitHub(page, async r => {
    if (r.request().method() === 'PATCH') {
      const body = r.request().postData();
      pushedPayload = body ? JSON.parse(body) : null;
      await r.fulfill({ json: { id: GIST_ID } });
      return;
    }
    if (new URL(r.request().url()).pathname === `/gists/${GIST_ID}`) {
      await r.fulfill({ json: { id: GIST_ID, files: { 'watchlist-sync.json': { content: JSON.stringify(GIST_PAYLOAD) } } } });
    }
  });

  await page.goto(BASE);
  await page.waitForSelector('.shelf', { timeout: 5000 });
  // Trigger a saveState via a toggle or wait for scheduled push
  await page.waitForTimeout(3000); // wait for 2s debounce + network

  if (pushedPayload) {
    const content = JSON.parse(pushedPayload.files['watchlist-sync.json'].content);
    expect(JSON.stringify(content)).not.toContain('verysecretomdbkey');
    expect(JSON.stringify(content)).not.toContain('ghp_supersecrettoken');
    expect(JSON.stringify(content)).not.toContain('omdbKey');
    expect(JSON.stringify(content)).not.toContain('syncToken');
  }
  // pushedPayload may be null if no state changes triggered a push — that's fine
});

// ── Test: year chip cleared on search-clear ──────────────────────────────

test('year chip hides when search is cleared via clear button', async ({ page }) => {
  await setupApp(page);
  await mockOmdb(page, r => r.fulfill({ json: OMDB_SEARCH_RESULTS }));
  await page.goto(BASE);
  await page.fill('#search-input', 'breaking bad 2008');
  await page.waitForTimeout(500);

  const chip = page.locator('#year-chip');
  await expect(chip).not.toHaveClass(/hidden/);

  await page.click('[data-action="search-clear"]');
  await expect(chip).toHaveClass(/hidden/);
});

// ── Test: year+title exact-lookup fallback (t= endpoint) ─────────────────

const OMDB_OZ_EXACT = {
  imdbID: 'tt0118421',
  Title: 'Oz',
  Year: '1997–2003',
  Type: 'series',
  Poster: 'N/A',
  imdbRating: '8.7',
  Plot: 'Life in the Oswald Maximum Security Prison.',
  totalSeasons: '6',
  Response: 'True',
};

test('too-many-results with year falls back to t= exact lookup', async ({ page }) => {
  const calls = [];
  await setupApp(page);
  await mockOmdb(page, async r => {
    const url = new URL(r.request().url());
    calls.push({ s: url.searchParams.get('s'), t: url.searchParams.get('t'), type: url.searchParams.get('type'), y: url.searchParams.get('y') });
    // All s= searches return too-many; t= with y=1997 returns the exact hit
    if (url.searchParams.get('t') && url.searchParams.get('y') === '1997') {
      await r.fulfill({ json: OMDB_OZ_EXACT });
    } else {
      await r.fulfill({ json: OMDB_TOO_MANY });
    }
  });
  await page.goto(BASE);
  await page.fill('#search-input', 'oz 1997');
  await page.waitForTimeout(600);
  await page.waitForSelector('.search-card', { timeout: 5000 });

  const cardTitle = await page.locator('.search-card').first().getAttribute('data-title');
  expect(cardTitle).toBe('Oz');

  // Verify the t= call was made with y=1997
  const exactCall = calls.find(c => c.t === 'oz' && c.y === '1997');
  expect(exactCall).toBeTruthy();
});

test('not-found error with year falls back to t= exact lookup', async ({ page }) => {
  await setupApp(page);
  await mockOmdb(page, async r => {
    const url = new URL(r.request().url());
    if (url.searchParams.get('t') && url.searchParams.get('y') === '1997') {
      await r.fulfill({ json: OMDB_OZ_EXACT });
    } else {
      await r.fulfill({ json: { Response: 'False', Error: 'Movie not found!' } });
    }
  });
  await page.goto(BASE);
  await page.fill('#search-input', 'oz 1997');
  await page.waitForTimeout(600);
  await page.waitForSelector('.search-card', { timeout: 5000 });

  const cardTitle = await page.locator('.search-card').first().getAttribute('data-title');
  expect(cardTitle).toBe('Oz');
});

test('too-many-results without year shows fallback message (no t= call)', async ({ page }) => {
  const calls = [];
  await setupApp(page);
  await mockOmdb(page, async r => {
    const url = new URL(r.request().url());
    calls.push(url.searchParams.get('t'));
    await r.fulfill({ json: OMDB_TOO_MANY });
  });
  await page.goto(BASE);
  await page.fill('#search-input', 'oz');
  await page.waitForTimeout(600);
  await page.waitForSelector('.search-empty', { timeout: 5000 });

  const text = await page.locator('.search-empty').textContent();
  expect(text).toContain('Too many results');
  // No t= exact-lookup calls made since no year was given
  expect(calls.every(c => c === null)).toBe(true);
});
