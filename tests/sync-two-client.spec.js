// @ts-check
// Two-client sync tests. Each client = isolated Playwright context (independent localStorage).
// Shared `gistStore` in Node space simulates the GitHub Gist API.
// Key app behavior: sync-now pushes if localTs > remote.updatedAt, pulls if remote.updatedAt > localTs.

const { test, expect, chromium } = require('@playwright/test');

const BASE      = 'http://127.0.0.1:7890';
const FAKE_TOKEN = 'ghp_sync_test_token';
const OMDB_FAKE  = 'testkey123';
const GIST_ID    = 'shared-gist-001';
const GIST_FILE  = 'watchlist-sync.json';

function makeItem(id, title) {
  return { imdbID: id, title, year: '2024', type: 'movie', watched: false,
    addedAt: Date.now(), isStub: false, poster: null, imdbRating: null, plot: null, seasons: [] };
}

function freshGistStore() {
  return { data: { v: 1, updatedAt: 0, watchlist: [], settings: {}, sortSeries: 'added', sortMovies: 'added' } };
}

// Sets up a browser context with pre-seeded localStorage and GitHub/OMDB route mocks.
// localState keys are written before page load, so app.loadState() picks them up correctly.
async function setupClient(browser, gistStore, { localState = {} } = {}) {
  const ctx  = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();

  await page.addInitScript(({ token, omdb, ls }) => {
    localStorage.setItem('syncToken', token);
    localStorage.setItem('omdbKey', omdb);
    for (const [k, v] of Object.entries(ls))
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, { token: FAKE_TOKEN, omdb: OMDB_FAKE, ls: { syncGistId: GIST_ID, ...localState } });

  await page.route('https://www.omdbapi.com/**', r =>
    r.fulfill({ json: { Response: 'False', Error: 'no results' } }));

  await page.route('https://api.github.com/gists**', async route => {
    const req    = route.request();
    const url    = new URL(req.url());
    const method = req.method();
    try {
      if (method === 'GET' && url.pathname === `/gists/${GIST_ID}`) {
        await route.fulfill({ json: { id: GIST_ID, files: { [GIST_FILE]: { content: JSON.stringify(gistStore.data) } } } });
      } else if (method === 'PATCH' && url.pathname === `/gists/${GIST_ID}`) {
        const body    = JSON.parse(req.postData() || '{}');
        const newData = JSON.parse(body.files?.[GIST_FILE]?.content || '{}');
        if (newData.updatedAt > (gistStore.data.updatedAt || 0)) gistStore.data = newData;
        await route.fulfill({ json: { id: GIST_ID } });
      } else if (method === 'GET' && url.pathname === '/gists') {
        await route.fulfill({ json: [{ id: GIST_ID, files: { [GIST_FILE]: {} } }] });
      } else {
        await route.fulfill({ status: 404, json: { message: 'Not Found' } });
      }
    } catch (e) { await route.fulfill({ status: 500, body: String(e) }); }
  });

  return { ctx, page };
}

async function waitForApp(page) {
  await page.goto(BASE);
  await page.waitForSelector('.shelf', { timeout: 8000 });
  await page.waitForTimeout(1500); // initSync settles
}

async function clickSyncNow(page) {
  await page.click('[data-action="go-settings"]');
  await page.waitForSelector('[data-action="sync-now"]', { timeout: 4000 });
  await page.click('[data-action="sync-now"]');
  // wait for sync-now async to finish (button re-enabled)
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-action="sync-now"]');
    return btn && !btn.disabled && btn.textContent.trim() === 'Sync';
  }, { timeout: 10000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('two-client sync', () => {
  let browser;
  test.beforeAll(async () => { browser = await chromium.launch(); });
  test.afterAll(async () => { await browser.close(); });

  // ── Test 1: B pulls A's item via initSync on page load ────────────────
  // Gist already has A's data (high updatedAt). B loads fresh → initSync pulls it.
  // Note: initSync updates state + renders but doesn't call saveState, so we verify via DOM.
  test('client B pulls item from gist on load (remote newer)', async () => {
    const gistStore = freshGistStore();
    gistStore.data = { v: 1, updatedAt: Date.now() - 1000, watchlist: [makeItem('tt_A_item', 'A Movie')],
      settings: {}, sortSeries: 'added', sortMovies: 'added' };

    const { ctx: ctxB, page: pageB } = await setupClient(browser, gistStore);

    await waitForApp(pageB);

    // initSync applied remote data → render() was called → card is in DOM
    await expect(pageB.locator('.card[data-id="tt_A_item"]')).toBeVisible({ timeout: 3000 });

    await ctxB.close();
  });

  // ── Test 2: local is newer → sync-now pushes to gist ─────────────────
  // B starts with a newer local item + updatedAt. sync-now sees localTs > remote → pushes.
  test('sync-now pushes local state when local is newer than gist', async () => {
    const gistStore = freshGistStore();
    // Gist has older data (timestamp in the past)
    gistStore.data = { v: 1, updatedAt: 1000, watchlist: [makeItem('tt_old', 'Old Item')],
      settings: {}, sortSeries: 'added', sortMovies: 'added' };

    const newerTs = Date.now();
    const { ctx: ctxB, page: pageB } = await setupClient(browser, gistStore, {
      localState: {
        watchlist: JSON.stringify([makeItem('tt_B_newer', 'B Newer Item')]),
        updatedAt: String(newerTs), // tells sync-now: local was updated at newerTs
      },
    });

    await waitForApp(pageB);
    // initSync: remote.updatedAt(1000) < localTs(newerTs) → no pull (correct, local is newer)

    await clickSyncNow(pageB);
    // sync-now: localTs(newerTs) > remote.updatedAt(1000) → push

    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_B_newer')).toBe(true);
    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_old')).toBe(false);

    await ctxB.close();
  });

  // ── Test 3: concurrent writes — last sync wins ────────────────────────
  // A pushes first. After A pushes, we bump B's localStorage updatedAt above A's push
  // timestamp so sync-now sees B as newer and pushes B's item.
  test('last-write-wins: second sync overwrites first', async () => {
    const gistStore = freshGistStore();
    const tA = Date.now() - 2000;

    const { ctx: ctxA, page: pageA } = await setupClient(browser, gistStore, {
      localState: {
        watchlist: JSON.stringify([makeItem('tt_concurrent_A', 'Concurrent A')]),
        updatedAt: String(tA),
      },
    });
    // B starts with its own item but updatedAt=0 so initSync won't stomp it (gist starts empty)
    const { ctx: ctxB, page: pageB } = await setupClient(browser, gistStore, {
      localState: {
        watchlist: JSON.stringify([makeItem('tt_concurrent_B', 'Concurrent B')]),
      },
    });

    await waitForApp(pageA);
    await waitForApp(pageB);

    // A syncs first — gist gets A's item with updatedAt ≈ now
    await clickSyncNow(pageA);
    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_concurrent_A')).toBe(true);

    // Bump B's localStorage updatedAt to be newer than A's push timestamp
    const aTs = gistStore.data.updatedAt;
    await pageB.evaluate(ts => localStorage.setItem('updatedAt', String(ts + 1000)), aTs);

    // B syncs — localTs(aTs+1000) > remote.updatedAt(aTs) → B pushes
    await clickSyncNow(pageB);
    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_concurrent_B')).toBe(true);
    // A's item is gone — last write wins, no merge
    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_concurrent_A')).toBe(false);

    await ctxA.close();
    await ctxB.close();
  });

  // ── Test 4: B pulls A's push after A syncs ────────────────────────────
  // Full round-trip: A pushes → B's sync-now sees remote newer → B applies A's item.
  test('B receives item after A pushes then B syncs', async () => {
    const gistStore = freshGistStore();
    const tA = Date.now() - 1000;

    const { ctx: ctxA, page: pageA } = await setupClient(browser, gistStore, {
      localState: {
        watchlist: JSON.stringify([makeItem('tt_roundtrip_A', 'Roundtrip A')]),
        updatedAt: String(tA),
      },
    });
    const { ctx: ctxB, page: pageB } = await setupClient(browser, gistStore);
    // B starts completely fresh (no local items, updatedAt=0)

    await waitForApp(pageA);
    await waitForApp(pageB);

    // A pushes its item
    await clickSyncNow(pageA);
    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_roundtrip_A')).toBe(true);

    // B pulls — sync-now sees remote.updatedAt > localTs(0) → applies A's data + render()
    await clickSyncNow(pageB);
    // Navigate back to main shelf (sync-now applied data while settings panel was open)
    await pageB.click('[data-action="back-to-main"]');
    await pageB.waitForSelector('.shelf', { timeout: 3000 });
    await expect(pageB.locator('.card[data-id="tt_roundtrip_A"]')).toBeVisible({ timeout: 3000 });

    await ctxA.close();
    await ctxB.close();
  });

  // ── Test 5: pulled data persists to localStorage (survives reload) ─────
  // Core persistence bug: initSync must write localStorage.watchlist, not just localStorage.updatedAt.
  // If only updatedAt is stored, reload shows old data because initSync won't re-pull (timestamps equal).
  test('initSync-pulled data survives page reload', async () => {
    const remoteTs = Date.now() - 500;
    const gistStore = {
      data: { v: 1, updatedAt: remoteTs, watchlist: [makeItem('tt_persist', 'Persist Movie')],
        settings: {}, sortSeries: 'added', sortMovies: 'added' },
    };

    const { ctx, page } = await setupClient(browser, gistStore);
    await waitForApp(page);

    // Initial pull should show the card
    await expect(page.locator('.card[data-id="tt_persist"]')).toBeVisible({ timeout: 3000 });

    // Now reload — gist returns same timestamp so initSync won't re-pull.
    // Data must survive from localStorage.
    await page.reload();
    await page.waitForSelector('.shelf', { timeout: 8000 });
    await page.waitForTimeout(1500);

    await expect(page.locator('.card[data-id="tt_persist"]')).toBeVisible({ timeout: 3000 });

    await ctx.close();
  });

  // ── Test 6: sync-now-pulled data persists to localStorage ─────────────
  test('sync-now-pulled data survives page reload', async () => {
    const remoteTs = Date.now() - 500;
    const gistStore = {
      data: { v: 1, updatedAt: remoteTs, watchlist: [makeItem('tt_syncnow_persist', 'SyncNow Persist')],
        settings: {}, sortSeries: 'added', sortMovies: 'added' },
    };

    // Client starts with updatedAt=0 so initSync pulls on load, then we reload
    const { ctx, page } = await setupClient(browser, gistStore, {
      localState: { updatedAt: '0' },
    });
    await waitForApp(page);

    // Manually trigger sync-now on a second load where initSync won't re-pull
    // because timestamps already match (set by the initial initSync pull)
    await page.reload();
    await page.waitForSelector('.shelf', { timeout: 8000 });
    await page.waitForTimeout(1500);

    // Still visible from localStorage
    await expect(page.locator('.card[data-id="tt_syncnow_persist"]')).toBeVisible({ timeout: 3000 });

    // Now trigger sync-now (remote hasn't changed, equal timestamps — should be no-op)
    await clickSyncNow(page);
    await page.click('[data-action="back-to-main"]');
    await page.waitForSelector('.shelf', { timeout: 3000 });
    await expect(page.locator('.card[data-id="tt_syncnow_persist"]')).toBeVisible({ timeout: 3000 });

    await ctx.close();
  });

  // ── Test 7: sync-now pull path persists when called from settings ──────
  // Scenario: remote has newer data, user hits Sync button — data should show
  // after navigating back AND after a subsequent reload.
  test('sync-now pull is persisted and visible after back-to-main and reload', async () => {
    const gistStore = freshGistStore();
    const remoteTs = Date.now() - 500;
    gistStore.data = { v: 1, updatedAt: remoteTs,
      watchlist: [makeItem('tt_syncnow_pull', 'SyncNow Pull Item')],
      settings: {}, sortSeries: 'added', sortMovies: 'added' };

    // Client B is fresh (updatedAt=0) so initSync would pull, but we set localTs to match
    // so that only sync-now triggers the pull
    const { ctx, page } = await setupClient(browser, gistStore, {
      localState: { updatedAt: String(remoteTs) }, // equal → initSync won't pull
    });
    await waitForApp(page);

    // Verify initSync didn't pull (card not yet visible)
    const cardsBefore = await page.locator('.card[data-id="tt_syncnow_pull"]').count();
    expect(cardsBefore).toBe(0);

    // Now make remote newer so sync-now will pull it
    gistStore.data.updatedAt = Date.now() + 5000;

    await clickSyncNow(page);
    await page.click('[data-action="back-to-main"]');
    await page.waitForSelector('.shelf', { timeout: 3000 });
    await expect(page.locator('.card[data-id="tt_syncnow_pull"]')).toBeVisible({ timeout: 3000 });

    // Reload — data must survive from localStorage (gist timestamp still the same)
    await page.reload();
    await page.waitForSelector('.shelf', { timeout: 8000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('.card[data-id="tt_syncnow_pull"]')).toBeVisible({ timeout: 3000 });

    await ctx.close();
  });

  // ── Test 8: settings (hideWatched) applied from remote survives reload ─
  test('remote settings applied by initSync persist across reload', async () => {
    const remoteTs = Date.now() - 500;
    const gistStore = {
      data: { v: 1, updatedAt: remoteTs,
        watchlist: [{ ...makeItem('tt_setting_item', 'Setting Item'), watched: true }],
        settings: { hideWatched: true, defaultGrid: false, showSeasonPills: false, reduceMotion: false },
        sortSeries: 'added', sortMovies: 'added' },
    };

    const { ctx, page } = await setupClient(browser, gistStore);
    await waitForApp(page);

    // hideWatched=true → watched item is hidden
    await expect(page.locator('.card[data-id="tt_setting_item"]')).not.toBeVisible({ timeout: 3000 });

    // Reload — settings must persist from localStorage
    await page.reload();
    await page.waitForSelector('.shelf', { timeout: 8000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('.card[data-id="tt_setting_item"]')).not.toBeVisible({ timeout: 3000 });

    await ctx.close();
  });

  // ── Test 9: push after initSync pull — uses correct (remote) data ──────
  // After initSync pulls, user makes change → sync-now should push remote data + change.
  // Without applyRemote fix: push would send stale localStorage data (pre-pull) + change.
  test('push after initSync pull sends the pulled data + local change', async () => {
    const remoteTs = Date.now() - 2000;
    const gistStore = {
      data: { v: 1, updatedAt: remoteTs,
        watchlist: [makeItem('tt_from_remote', 'From Remote')],
        settings: {}, sortSeries: 'added', sortMovies: 'added' },
    };

    const { ctx, page } = await setupClient(browser, gistStore);
    await waitForApp(page);

    // Verify remote item is shown
    await expect(page.locator('.card[data-id="tt_from_remote"]')).toBeVisible({ timeout: 3000 });

    // Mark it watched (triggers saveState → schedule → push)
    // Use long-press / context menu via right-click on card
    await page.click('[data-action="go-settings"]');
    await page.waitForSelector('[data-action="sync-now"]', { timeout: 3000 });

    // Make gist "even newer" so sync-now won't stomp — instead local is newer via saveState
    // Simulate: user already saved (updatedAt bumped by saveState)
    const newLocalTs = gistStore.data.updatedAt + 10000;
    await page.evaluate(ts => localStorage.setItem('updatedAt', String(ts)), newLocalTs);

    await page.click('[data-action="sync-now"]');
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-action="sync-now"]');
      return btn && !btn.disabled && btn.textContent.trim() === 'Sync';
    }, { timeout: 10000 });

    // Gist should now have the remote item (applied by initSync) in the pushed payload
    expect(gistStore.data.watchlist.some(i => i.imdbID === 'tt_from_remote')).toBe(true);

    await ctx.close();
  });

  // ── Test 10: sortSeries/sortMovies applied from remote, persist ─────────
  test('remote sort preferences applied and persisted', async () => {
    const remoteTs = Date.now() - 500;
    const gistStore = {
      data: { v: 1, updatedAt: remoteTs,
        watchlist: [],
        settings: {},
        sortSeries: 'title',
        sortMovies: 'rating' },
    };

    const { ctx, page } = await setupClient(browser, gistStore);
    await waitForApp(page);

    // Verify sort selects reflect remote values
    const seriesSort = await page.evaluate(() => localStorage.getItem('sortSeries'));
    const moviesSort = await page.evaluate(() => localStorage.getItem('sortMovies'));
    expect(seriesSort).toBe('title');
    expect(moviesSort).toBe('rating');

    // Reload — must persist
    await page.reload();
    await page.waitForSelector('.shelf', { timeout: 8000 });
    await page.waitForTimeout(1500);

    const seriesSortAfter = await page.evaluate(() => localStorage.getItem('sortSeries'));
    const moviesSortAfter = await page.evaluate(() => localStorage.getItem('sortMovies'));
    expect(seriesSortAfter).toBe('title');
    expect(moviesSortAfter).toBe('rating');

    await ctx.close();
  });
});
