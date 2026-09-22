# Watchlist TODO

## Bugs (confirmed, ready to fix)

- [x] **`applyRemote()` missing `rebuildFuse()`** — Fuse index stale after remote pull; local search returns pre-sync results until next render. Fixed in `src/state.js`.
- [x] **Long-press + click double-fire on mobile** — after action sheet opens, the `touchend`→`click` fires `open-detail` on the same card. Fixed in `src/events.js` by checking `longPressTriggered` in click handler.
- [x] **Search debounce with no OMDB key** — 400ms lag on every keystroke even when results are purely local Fuse. Fixed in `src/events.js` by skipping debounce when `!state.omdbKey`.
- [x] **`posterStyle()` CSS injection** — `url('...')` breaks when poster URL contains a single quote. Fixed in `src/utils.js` using `url("${esc(...)}")`.
- [x] **Blank screen on render error** — uncaught exception in `renderShelf`/`renderDetailPanel` kills the whole UI. Fixed with try/catch + error boundary in `src/render/main.js`.

## Bugs (require design decision)

- [ ] **`schedule()` stale closure** (`sync.js:~60`) — `applyRemote()` replaces `state.watchlist` reference; a pending push debounce fires with the old array. Fix: capture `state.watchlist` at push time, or push `state` directly.
- [ ] **Year-only title misfires** (`src/omdb.js: parseQueryYear`) — `"1917"` → `{ title: "1917", year: 1917 }` → OMDB gets `t=1917&y=1917`, returns nothing. Fix: require at least one non-digit character before treating trailing 4-digit number as year constraint.
- [ ] **Last-write-wins on concurrent device sync** — `updatedAt` is push-time, not user-action-time. A device that pushes later always wins even if the other device's changes are newer. Fix: per-item `updatedAt` + merge-by-imdbID.
- [ ] **No flush on mobile tab-kill** — unsaved state lost when browser kills the tab. Fix: `visibilitychange` → `hidden` triggers an immediate push if `state.dirty`.

## UX / Search

- [ ] **Pagination for OMDB search** — `s=` only returns page 1 (10 results). Add a "Load more" button that increments `page=` parameter.
- [ ] **`t=` exact-title fallback fires too eagerly** — runs on every short query; should only fire when `s=` returns empty, not in parallel.
- [ ] **Search result deduplication** — Fuse local results and OMDB remote results can show the same title twice. Deduplicate by imdbID.
- [ ] **Search input not restored after settings navigation** — going to Settings and back clears the search field and hides results.
- [ ] **Keyboard navigation wraps unexpectedly** — ArrowUp from index 0 jumps to last result; not the expected behavior in a search list.

## Data Model

- [ ] **No schema version / migration** — adding new fields to `state` silently merges with stale localStorage. Add `schemaVersion` + migration function in `loadState()`.
- [ ] **`isStub` leaks into export** — exported JSON includes `isStub: true` on items that never resolved. Strip before export.
- [ ] **Series season count is static at add-time** — seasons added to OMDB after the item was added are never refreshed. Add a "Refresh metadata" action.
- [ ] **`type` not validated on JSON import** — imported items with invalid `type` render in neither shelf. Fixed partially in `src/import-export.js`; needs a defensive guard in `addItem()` too.

## Sync Correctness

- [ ] **Gist-per-field merge** — all state is one blob; any field conflict loses the entire watchlist. Switch to per-item granularity.
- [ ] **No conflict UI** — when remote wins silently, user has no idea their local additions were dropped. Show a diff modal on merge.
- [ ] **Token stored in `localStorage`** — `syncToken` survives an XSS payload. Move to `sessionStorage` or prompt on each session.
- [ ] **Sync dot shows stale status** — dot reads `window.Sync.status` at render time, not reactively. Already hooked via callback in `initSync`; verify it clears on error too.

## Offline / Resilience

- [ ] **No service worker / offline mode** — app fails completely with no network. Add a minimal SW caching `index.html`, `style.css`, `fuse.min.js`, and `sync.js`.
- [ ] **OMDB key not validated on save** — saving a bad key silently breaks all search. Add a test fetch (`?apikey=X&i=tt0000001`) before accepting the key.
- [ ] **Import progress modal blocks input indefinitely on network error** — if OMDB is down during bulk import the modal never resolves. Add a timeout + per-item error recovery.

## Code Architecture

- [x] **Monolithic `app.js` split** — 1108-line file broken into `src/` ES modules. Done.
- [ ] **`render/shelf.js` > 70 lines** — `renderDetailPanel` is large; extract season pills and rating block into helpers.
- [ ] **`handleAction` open-detail FLIP duplicated with close-detail** — identical animation math appears twice. Extract `flipPoster(fromRect, toEl)` helper.
- [ ] **`showContextMenu` and `showActionSheet` share markup** — consider a single `menuItems(item)` → `{label, action, dataset, href}[]` factory.
- [ ] **`state.savedScrollPos` grows unbounded** — never pruned; cleaned up only on full reset. Prune when a shelf type is removed (not applicable yet, but will be if type filtering is added).

## Missing Features

- [ ] **Ratings display** — OMDB returns Rotten Tomatoes / Metacritic / IMDb scores; currently only IMDb shown in detail panel. Show all three.
- [ ] **Multiple lists / tags** — single flat watchlist; no way to separate "to watch" from "rewatching" etc.
- [ ] **Sort by rating** — sort options exist for title/year/added; rating sort requires storing `imdbRating` as a number (currently string `"8.3"`).
- [ ] **Search within watchlist** — current search is add-new only; no way to filter/find within existing list.
- [ ] **Share / export to Letterboxd CSV format** — common request for watchlist apps.
- [ ] **PWA manifest + icons** — no `manifest.json`; can't install to home screen cleanly.
