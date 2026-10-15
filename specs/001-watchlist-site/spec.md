# Watchlist — Static GitHub Pages Site

**Version:** 1.0  
**Date:** 2026-09-20  
**Status:** Draft

---

## Overview

A personal, single-user watchlist for movies and TV shows. Hosted on GitHub Pages (free, static). No backend. All state persists in the browser via `localStorage`. Metadata sourced from the OMDB API. Fuzzy search lets users filter their existing list and add new titles. Designed for daily personal use — fast, zero-friction, no accounts.

---

## Non-Goals

- Multi-user or shared lists
- Streaming availability data
- Cross-device sync (no backend)
- Social features (ratings shared with others)
- Native mobile app
- Recommendation engine
- Season-by-season episode tracking (only season-level granularity)

---

## User Scenarios & Testing

### P1 — Core Watchlist

**US-001: View watchlist**
- Given: user has titles in their watchlist
- When: they open the site
- Then: titles appear in two shelves — Series and Movies — sorted by added date descending

**US-002: Add a title via search**
- Given: the OMDB API key is configured
- When: user types a title in the hero search bar, presses Enter or waits for debounce, and clicks an OMDB result in the modal
- Then: title is added to the correct shelf (Series or Movies), persisted to localStorage, visible immediately

**US-003: Mark a title watched**
- Given: a title is in the watchlist
- When: user clicks the ✓ badge on the card (or toggles via context menu)
- Then: card moves to the end of its shelf; badge turns accent-blue; watched state persists across reload

**US-004: Remove a title**
- Given: a title is in the watchlist
- When: user right-clicks (desktop) or long-presses (mobile) and selects "Remove from list"
- Then: title is removed from shelf immediately; localStorage updated

**US-005: Filter shelf by watched status**
- Given: a shelf contains both watched and unwatched titles
- When: user selects "Unwatched" filter on the Series shelf
- Then: only unwatched Series cards are shown; Movies shelf filter is unaffected; empty shelf collapses to label only

### P2 — Content Discovery

**US-006: Search within watchlist**
- Given: user has titles in their list
- When: they type in the hero search bar
- Then: shelves are replaced by a flat results grid showing fuzzy-matched watchlist titles under "In your list"

**US-007: Add from OMDB search**
- Given: user is typing in the hero search bar
- When: OMDB returns results (debounced 400ms)
- Then: OMDB results appear under "Find on OMDB" section alongside watchlist matches; clicking an OMDB result opens the add modal

**US-008: View plot/details**
- Given: a title card is visible
- When: user clicks the card
- Then: a full-width details panel expands below the entire shelf row, showing poster, title, year, type, IMDB rating, watched toggle, and plot summary; next shelf is pushed down; click again to collapse

**US-009: Open Google search**
- Given: a title is in the watchlist
- When: user right-clicks (desktop) or long-presses (mobile) and selects "Open Google Search"
- Then: new browser tab opens with `https://google.com/search?q=Title+Year`

### P3 — Import / Export / Config

**US-010: Bulk import via plain text**
- Given: user has a list of titles (one per line, optional season suffix `S1` or `(S1)`)
- When: they click Import, paste the list, and click Import
- Then: titles are resolved against OMDB and added to the correct shelves; a diff summary shows added / already existed / failed to match; unresolved titles are added as plain-text stubs

**US-011: Export watchlist**
- Given: user has titles in their list
- When: they click Export
- Then: a JSON file downloads named `watchlist-YYYY-MM-DD.json` containing all titles, metadata, and watched status

**US-012: First-run OMDB key setup**
- Given: no OMDB key is stored in localStorage
- When: user opens the site for the first time
- Then: a modal prompts them to enter their OMDB API key with a link to register at omdbapi.com; key is saved to localStorage; modal does not appear again

---

## Functional Requirements

### Search & Discovery

**FR-001:** Hero search bar appears full-width at the top of the page.  
**FR-002:** Typing in the search bar replaces the shelf layout with a flat results grid containing two sections: "In your list" (fuzzy-matched) and "Find on OMDB" (live API results, debounced 400ms).  
**FR-003:** Clearing the search bar restores the shelf layout.  
**FR-004:** OMDB search results in the add modal support infinite scroll — additional pages load as user scrolls to the bottom.  
**FR-005:** Titles already in the watchlist appear greyed out and unclickable in the add modal.  
**FR-006:** Fuzzy search uses fuse.js against title text.

### Shelf Layout

**FR-007:** Titles are displayed in two horizontal-scrolling shelves: "Series" and "Movies", determined by OMDB `Type` field.  
**FR-008:** Each shelf has an independent sort dropdown (options: Added date, Title A–Z, IMDB Rating). Sort choice persists to localStorage per shelf.  
**FR-009:** Each shelf has an expand/collapse toggle (`[↕]`) that transitions the row from horizontal scroll to a wrapped 4-col grid (desktop) / 2-col (mobile).  
**FR-010:** Right edge of each shelf shows a fade-to-background gradient indicating scrollable content.  
**FR-011:** When a shelf filter produces zero results, the shelf collapses to its label header only (no cards, no empty message).  
**FR-012:** Each shelf has independent All / Unwatched / Watched filter tabs.  
**FR-013:** Watched titles always sort to the end of their shelf regardless of sort order.

### Cards

**FR-014:** Each card shows: poster image (2:3 ratio, ~150px wide), title (Playfair Display), year · type badge, IMDB rating.  
**FR-015:** Watched cards display an accent-blue ✓ badge at top-right.  
**FR-016:** Clicking a card expands a full-width details panel beneath the entire shelf row (height ≈ 1 card row). Panel shows: large poster, title, year, type, IMDB rating, watched toggle, plot summary. Clicking again collapses.  
**FR-017:** Poster fallback cascade: (1) OMDB poster URL → (2) OMDB re-query with explicit type → (3) auto-generated gradient from title hash with title overlaid.  
**FR-018:** Missing metadata cards ("stubs") render with the gradient fallback and title only; no rating or type badge.

### Season Tracking

**FR-019:** A show card with season-level imports shows season badge pills in the card footer (e.g., `S1 S2 ▾`). Clicking `▾` expands an inline season list beneath the card within the shelf.  
**FR-020:** Each season entry has its own watched toggle.  
**FR-021:** Season OMDB data is fetched on demand using `?t=Title&Season=N`.

### Context Menu

**FR-022:** Right-click (desktop) or long-press ≥500ms (mobile) on any card opens a context menu with: Remove from list · Toggle watched · Copy title to clipboard · Open Google Search (new tab).

### Import

**FR-023:** Import button in header opens a textarea modal.  
**FR-024:** Accepted formats (both detected): `Show Name S1` and `Show Name (S1)` via regex `/S(\d+)$/i` and `/\(S(\d+)\)$/i`.  
**FR-025:** After import, a diff summary modal displays: added count · already-existed count · failed-to-match count.  
**FR-026:** Titles that fail OMDB resolution are added as stubs (no metadata, gradient fallback).  
**FR-027:** Importing a title already in the list skips silently (counted in diff).

### Export

**FR-028:** Export button in header downloads `watchlist-YYYY-MM-DD.json` with full state: imdbID, title, year, type, poster URL, IMDB rating, plot, watched status, addedAt timestamp, season data if present.

### Configuration

**FR-029:** On first load with no OMDB key in localStorage, a setup modal prompts for the key with a registration link. Key saved to localStorage.  
**FR-030:** OMDB search is debounced at 400ms to stay within the 1000 req/day free-tier limit.

---

## Success Criteria

**SC-001:** A user can add a title to their watchlist within 3 interactions from opening the site (search → click result → confirm).  
**SC-002:** Searching for a title in the hero bar produces visible results within 500ms on a standard broadband connection.  
**SC-003:** Watchlist state (titles, watched status, sort preferences) survives a full browser reload with no data loss.  
**SC-004:** A plain-text list of 50 titles imports and resolves within 30 seconds (accounting for OMDB rate limiting).  
**SC-005:** The site functions fully offline for browsing the existing watchlist (add/search unavailable without network).  
**SC-006:** All cards render correctly on viewport widths from 375px to 2560px.  
**SC-007:** An exported JSON file can be imported back into a fresh localStorage instance with full fidelity.

---

## Key Entities

### WatchlistItem
| Attribute | Type | Notes |
|---|---|---|
| `imdbID` | string | OMDB identifier, primary key |
| `title` | string | Display title |
| `year` | string | Release year or range (e.g. "2008–2013") |
| `type` | `"movie" \| "series"` | Determines shelf |
| `poster` | string \| null | OMDB poster URL |
| `imdbRating` | string \| null | e.g. "9.5" |
| `plot` | string \| null | Short plot from OMDB |
| `watched` | boolean | Default false |
| `addedAt` | number | Unix timestamp |
| `isStub` | boolean | True if OMDB resolution failed |
| `seasons` | SeasonEntry[] \| null | Only present if season-level import |

### SeasonEntry
| Attribute | Type | Notes |
|---|---|---|
| `season` | number | Season number |
| `watched` | boolean | Default false |
| `episodes` | number \| null | From OMDB Season query |

### AppState (localStorage)
| Key | Value |
|---|---|
| `watchlist` | `WatchlistItem[]` |
| `omdbKey` | string |
| `sortSeries` | `"added" \| "title" \| "rating"` |
| `sortMovies` | `"added" \| "title" \| "rating"` |

---

## Design System

| Token | Value |
|---|---|
| `--bg` | `#111` |
| `--surface` | `#1c1c1e` |
| `--text` | `#f5f5f7` |
| `--muted` | `#6e6e73` |
| `--accent` | `#0a84ff` |
| `--radius` | `12px` |
| Heading font | Playfair Display (Google Fonts) |
| Body/UI font | DM Sans (Google Fonts) |
| Card width | ~150px (5–6 visible per shelf row) |
| Card aspect | 2:3 (poster) |

---

## Page Layout

```
┌──────────────────────────────────────────┐
│  Watchlist            [Import] [Export]  │  ← sticky minimal header
├──────────────────────────────────────────┤
│                                          │
│    [ Search movies & TV shows...       ] │  ← hero search, full-width
│                                          │
│  SERIES  Added ▾  All·Unwatched·Watched [↕] │
│  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  →        │  ← horizontal scroll
│                                          │
│  MOVIES  Added ▾  All·Unwatched·Watched [↕] │
│  ░░░░  ░░░░  ░░░░  ░░░░  ░░░░  →        │
│                                          │
└──────────────────────────────────────────┘
```

---

## Assumptions

- OMDB free tier (1000 req/day) is sufficient for personal use.
- A single browser on a single device is the primary use case; localStorage is acceptable.
- The user manages their own OMDB API key; the site provides a registration link but does not manage keys.
- "Series" vs "Movies" split is determined entirely by the OMDB `Type` field; edge cases (mini-series, specials) follow OMDB's classification.
- Stub titles with no OMDB match remain stubs until manually resolved via search.

---

## Edge Cases

**EC-001:** OMDB returns `"N/A"` for poster, rating, or plot — treated as null; fallbacks apply.  
**EC-002:** Two imported titles resolve to the same `imdbID` — second is skipped (deduplication by imdbID).  
**EC-003:** OMDB rate limit hit mid-import — remaining titles queued as stubs; no error thrown mid-batch.  
**EC-004:** Season query (`?Season=N`) returns no data — season entry stored with `episodes: null`.  
**EC-005:** User pastes a title with special characters (e.g. `It's Always Sunny`) — URI-encoded before OMDB query.  
**EC-006:** `localStorage` quota exceeded — catch `QuotaExceededError`, surface a banner prompting export before adding more titles.  
**EC-007:** Search bar cleared mid-typing — debounce cancelled, shelves restore immediately.  
**EC-008:** Both `S1` and `(S1)` suffixes present in same import for same show — merged into one parent card with one S1 season entry.

---

## Deployment

- **Repo:** new dedicated repo, e.g. `github.com/{user}/watchlist`
- **URL:** `{user}.github.io/watchlist`
- **Branch:** `main` → GitHub Pages root
- **No build step** — all files served as-is
- **config.js is gitignored** — `config.example.js` committed as template
- **OMDB key** stored in localStorage, not in any committed file
