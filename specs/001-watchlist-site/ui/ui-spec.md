# UI Specification — Watchlist

**Version:** 1.0  
**Date:** 2026-09-20

---

## 1. Design Tokens

### Color

```css
:root {
  --bg:          #111111;
  --surface:     #1c1c1e;
  --surface-2:   #2c2c2e;   /* elevated surfaces, context menus */
  --text:        #f5f5f7;
  --muted:       #6e6e73;
  --accent:      #0a84ff;
  --accent-dim:  rgba(10, 132, 255, 0.15);
  --danger:      #ff453a;
  --overlay:     rgba(0, 0, 0, 0.72);
  --blur:        blur(20px) saturate(180%);
}
```

### Typography

```css
/* Load via Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');

--font-display: 'Playfair Display', Georgia, serif;
--font-ui:      'DM Sans', system-ui, sans-serif;

/* Scale */
--text-xs:   11px / 1.4  DM Sans 400
--text-sm:   13px / 1.5  DM Sans 400
--text-base: 15px / 1.6  DM Sans 400
--text-lg:   17px / 1.5  DM Sans 500
--text-xl:   20px / 1.3  Playfair Display 600
--text-2xl:  28px / 1.2  Playfair Display 600
```

### Spacing & Shape

```css
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px

--radius-sm:  6px
--radius-md:  12px
--radius-lg:  18px
--radius-full: 999px

--shadow-card: 0 2px 12px rgba(0,0,0,0.5);
--shadow-lift: 0 8px 32px rgba(0,0,0,0.6);
--shadow-modal: 0 24px 80px rgba(0,0,0,0.8);
```

### Motion

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

--dur-fast:   120ms
--dur-base:   220ms
--dur-slow:   380ms
--dur-expand: 300ms
```

---

## 2. Global Layout

### Page Shell

```
┌─────────────────────────────────────────────────────┐
│ HEADER (48px, sticky, position: fixed, top: 0)      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  HERO SEARCH (full-width, centered, pt: 80px)       │
│                                                     │
│  SHELF: SERIES                                      │
│  ─────────────────────────────────────────          │
│  [card][card][card][card][card] →                   │
│                                                     │
│  SHELF: MOVIES                                      │
│  ─────────────────────────────────────────          │
│  [card][card][card][card][card] →                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Page padding: `0 48px` (desktop) / `0 16px` (≤768px)
- Max content width: `1440px`, centered
- Background: `var(--bg)` full bleed
- Body overflow-x: hidden

---

## 3. Header

### Structure

```
┌──────────────────────────────────────────────────────┐
│  Watchlist          [Import ↑]  [Export ↓]           │
└──────────────────────────────────────────────────────┘
```

- Height: 48px
- Background: `rgba(17,17,17,0.8)` + `backdrop-filter: var(--blur)`
- Border-bottom: `1px solid rgba(255,255,255,0.06)`
- Position: `fixed`, `top: 0`, `z-index: 100`

### Wordmark
- Font: Playfair Display 600, 20px
- Color: `var(--text)`
- Left-aligned with page padding

### Buttons (Import / Export)
- Style: ghost — no background, `var(--muted)` text, 13px DM Sans 400
- Hover: `var(--text)` color, `var(--dur-fast)` transition
- Icon: small SVG inline left of label (↑ for import, ↓ for export)
- Gap between buttons: `var(--space-3)`

---

## 4. Hero Search Bar

```
┌─────────────────────────────────────────────────────┐
│  🔍  Search movies & TV shows...                    │
└─────────────────────────────────────────────────────┘
```

- Width: 100% up to 680px, centered
- Height: 56px
- Background: `var(--surface)`
- Border: `1px solid rgba(255,255,255,0.08)`
- Border-radius: `var(--radius-lg)`
- Box-shadow: `var(--shadow-card)`
- Focus border: `1px solid var(--accent)`
- Font: DM Sans 400, 16px, `var(--text)`
- Placeholder: `var(--muted)`
- Search icon: 18px, `var(--muted)`, left-padded 16px
- Spinner: replaces icon while OMDB fetches, same position
- `padding: 0 16px 0 44px`
- Transition: border-color `var(--dur-fast)` `var(--ease-out)`

### Search Active State

When text is present, shelves animate out (`opacity: 0, translateY(-8px)`, `var(--dur-base)`) and the flat results grid fades in.

Clear (✕) button appears at right of input on focus + text present.

---

## 5. Search Results Grid (Active Search)

Replaces shelf layout while search bar has content.

```
In your list
────────────────────────────────
[card][card][card][card]...

Find on OMDB
────────────────────────────────
[card][card][card][card]...
```

- Section label: DM Sans 500, 11px, `var(--muted)`, uppercase, letter-spacing 0.08em
- Grid: `display: grid`, `grid-template-columns: repeat(auto-fill, minmax(130px, 1fr))`, gap 12px
- OMDB section shows skeleton shimmer cards while fetching
- Already-added OMDB cards: `opacity: 0.35`, pointer-events none, ✓ badge visible
- Clicking unwatched OMDB card → opens Add Modal

---

## 6. Shelf

### Shelf Header

```
SERIES  Added ▾   All · Unwatched · Watched          [↕]
─────────────────────────────────────────────────────────
```

- Label: DM Sans 500, 11px, `var(--muted)`, uppercase, letter-spacing 0.08em
- Divider: `1px solid rgba(255,255,255,0.06)`, full width
- Sort dropdown: 11px DM Sans 400, `var(--muted)` → `var(--text)` on hover, inline next to label
- Filter tabs: `All · Unwatched · Watched` — dot-separated, 11px, active tab uses `var(--text)`, inactive `var(--muted)`; cursor pointer
- Expand toggle `[↕]`: 14px icon, `var(--muted)`, right-aligned; rotates 180° when expanded
- All header elements on one baseline line, `align-items: center`

### Shelf Row (Collapsed — default)

- `display: flex`, `overflow-x: auto`, `scroll-snap-type: x mandatory`, `gap: 12px`
- Scrollbar: hidden (`scrollbar-width: none`)
- Right fade: `::after` pseudo with `linear-gradient(to right, transparent, var(--bg))`, width 80px, pointer-events none
- Scroll snap: each card `scroll-snap-align: start`
- Padding-bottom: 4px (shadow clearance)

### Shelf Row (Expanded)

On `[↕]` click:
- Transition from flex scroll row → `display: grid, grid-template-columns: repeat(4, 1fr)` (desktop), `repeat(2, 1fr)` (≤768px)
- Animation: height expands with `max-height` transition, `var(--dur-expand)` `var(--ease-out)`
- Right fade `::after` disappears
- Toggle icon rotates 180° over `var(--dur-base)`

### Shelf Empty State (filtered)

When filter produces 0 cards:
- Cards area hidden
- Only shelf header line remains visible
- No empty message

### Shelf Spacing

- Between shelf header and cards: `var(--space-4)`
- Between shelves: `var(--space-8)`
- Below last shelf: `var(--space-8)`

---

## 7. Card

### Dimensions

- Width: ~150px (constrained by grid/flex)
- Poster area: 2:3 aspect ratio (`aspect-ratio: 2/3`)
- Border-radius: `var(--radius-md)`
- Background: `var(--surface)`
- Overflow: hidden
- Cursor: pointer

### Card Anatomy

```
┌──────────────────┐
│                  │   ← poster (2:3, object-fit: cover)
│           [✓]    │   ← watched badge (top-right, 28px)
│                  │
│                  │
│                  │
├──────────────────┤
│ Title            │   ← Playfair Display 400, 13px, 2-line clamp
│ 2023 · Series    │   ← DM Sans 400, 11px, var(--muted)
│ ★ 8.3            │   ← DM Sans 400, 11px, var(--muted)
│ [S1] [S2] ▾      │   ← season pills (only if seasons present)
└──────────────────┘
```

- Card footer padding: `8px 10px`
- Footer background: `var(--surface)`
- Title: max 2 lines, `overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2`

### Card Hover State

- `transform: scale(1.03)`
- `box-shadow: var(--shadow-lift)`
- Transition: `var(--dur-fast)` `var(--ease-out)`

### Watched Badge

- Position: `absolute`, top 8px, right 8px
- Size: 24px circle
- Background: `var(--accent)` when watched, `rgba(0,0,0,0.5)` when unwatched
- Icon: ✓ checkmark SVG, 12px, white
- Transition: background `var(--dur-fast)`

### Card Footer — Watched Order

Watched cards are sorted to end of shelf. No visual dimming or grayscale. Only the badge changes.

### Poster Fallback Cascade

1. Render OMDB `Poster` URL
2. On `onerror` → retry OMDB fetch with explicit `&type=movie` or `&type=series`
3. On second failure → render gradient placeholder

**Gradient Placeholder:**
- Hash title string → seed a hue (0–360°)
- `background: linear-gradient(135deg, hsl({h}, 30%, 18%), hsl({h+40}, 25%, 12%))`
- Title centered, Playfair Display 400, 14px, `var(--text)`, max 3 lines, padding 12px

### Stub Cards

Cards with `isStub: true`:
- Gradient poster (no image attempt)
- No rating or type badge in footer
- "Unresolved" label in 10px `var(--muted)` italic below title

---

## 8. Season Pills

Shown in card footer when `seasons` array is non-empty.

```
[S1] [S2] [S3] ▾
```

- Pill: `var(--surface-2)` bg, 10px DM Sans 500, border-radius `var(--radius-full)`, padding `2px 6px`
- Watched season pill: `var(--accent-dim)` bg, `var(--accent)` text
- `▾` chevron: 10px, `var(--muted)`, cursor pointer
- Clicking `▾` expands inline season list beneath the card (within shelf flow)

### Expanded Season List

```
┌──────────────────┐
│  [card as above] │
├──────────────────┤
│  Season 1  [ ✓ ] │
│  Season 2  [   ] │
│  Season 3  [   ] │
└──────────────────┘
```

- Expands below card footer
- Background: `var(--surface-2)`, border-radius `0 0 var(--radius-md) var(--radius-md)`
- Each row: season label (DM Sans 400, 12px) + watched toggle right-aligned
- Toggle: same 24px circle badge as main card

---

## 9. Card Detail Panel

Triggered by clicking a card body (not the badge, not the season pills).

### Behavior

- Panel inserts as full-width block **below the shelf row** containing the clicked card
- Height: ~200px (desktop), auto (mobile)
- Pushes content below it down; shelf row above is unaffected
- Clicking the same card again, or clicking ✕ in panel, collapses it
- Only one panel open at a time — opening another card closes the current panel

### Animation

Open: `max-height: 0 → 200px`, `opacity: 0 → 1`, `var(--dur-expand)` `var(--ease-out)`  
Close: reverse

### Panel Layout

```
┌──────────────────────────────────────────────────────────┐
│  [poster]   Title                              [✕]        │
│  120×180    2023 · Series · ★ 9.5                        │
│             [● Watched]  or  [○ Mark watched]             │
│                                                           │
│             Short plot summary (2–3 sentences, DM Sans    │
│             400 15px, var(--text), line-height 1.6)       │
└──────────────────────────────────────────────────────────┘
```

- Background: `var(--surface)`, `border-top: 1px solid rgba(255,255,255,0.06)`
- Poster: 80px wide, 2:3 ratio, border-radius `var(--radius-sm)`
- Title: Playfair Display 600, 18px
- Metadata line: DM Sans 400, 13px, `var(--muted)`
- Watched toggle: pill button — `var(--surface-2)` bg, 13px DM Sans 500; active state `var(--accent-dim)` bg, `var(--accent)` text
- ✕ close: 16px icon, `var(--muted)`, top-right of panel, hover `var(--text)`
- Padding: `var(--space-5)`
- Gap between poster and text: `var(--space-4)`

---

## 10. Context Menu

Triggered by right-click (desktop) or long-press ≥500ms (mobile).

```
┌─────────────────────────┐
│  ✓ Mark as watched      │
│  ✕ Remove from list     │
│  ⎘ Copy title           │
│  ↗ Open Google Search   │
└─────────────────────────┘
```

- Background: `var(--surface-2)`
- Border-radius: `var(--radius-md)`
- Box-shadow: `var(--shadow-modal)`
- Border: `1px solid rgba(255,255,255,0.08)`
- Item: 14px DM Sans 400, `var(--text)`, padding `10px 16px`, cursor pointer
- Item hover: `var(--surface)` bg, `var(--dur-fast)`
- Icon: 14px inline SVG, `var(--muted)`, 8px right margin
- "Remove from list" icon/text: `var(--danger)` on hover
- Dismissed by: click outside, Escape, any item selection
- Appear animation: `scale(0.96) → scale(1)`, `opacity: 0 → 1`, `var(--dur-fast)` `var(--ease-spring)`
- Positioned at cursor; clamped to viewport edges

---

## 11. Add Modal (OMDB Results)

Triggered by clicking an OMDB result in the search grid.

### Overlay

- `position: fixed`, full viewport
- Background: `rgba(0,0,0,0.72)` + `backdrop-filter: var(--blur)`
- `z-index: 200`
- Dismissed by: Escape or click outside modal panel

### Modal Panel

```
┌─────────────────────────────────────────────┐
│  Add to Watchlist               [✕]          │
│  ─────────────────────────────────────────── │
│  [ Search OMDB...                          ] │
│                                              │
│  [card][card][card][card]                    │
│  [card][card][card][card]                    │
│  [card][card][card][card]                    │
│         ↓ scroll for more                   │
└─────────────────────────────────────────────┘
```

- Width: min(90vw, 860px)
- Height: min(90vh, 720px)
- Background: `var(--surface)`
- Border-radius: `var(--radius-lg)`
- Box-shadow: `var(--shadow-modal)`
- Overflow-y: auto (inner content area)
- `padding: var(--space-6)`

### Modal Header

- Title: "Add to Watchlist" — Playfair Display 600, 20px
- ✕ button: top-right, 20px icon, `var(--muted)` → `var(--text)` hover

### Modal Search Input

- Same style as hero search bar but smaller: height 44px, 14px font
- Searches OMDB directly; debounced 400ms
- Pre-populated with the search term that triggered the modal

### Modal Results Grid

- `grid-template-columns: repeat(auto-fill, minmax(130px, 1fr))`, gap 12px
- Cards: same as shelf cards but ghost state for already-added titles
- **Skeleton shimmer** while fetching: same card shape, animated gradient sweep
  - `background: linear-gradient(90deg, var(--surface) 0%, var(--surface-2) 50%, var(--surface) 100%)`
  - `background-size: 200%`
  - `animation: shimmer 1.4s infinite`
- Already-added cards: `opacity: 0.35`, `pointer-events: none`
- Clicking a card: card scales up briefly (`var(--ease-spring)`), modal closes, title appears in correct shelf

### Infinite Scroll

When user scrolls to within 200px of modal bottom and more OMDB pages exist: load next page, append shimmer cards, replace with results.

### Modal Open/Close Animation

Open: `scale(0.95) → scale(1)`, `opacity: 0 → 1`, `var(--dur-base)` `var(--ease-out)`  
Close: `scale(0.95)`, `opacity: 0`, `var(--dur-fast)`

---

## 12. Import Modal

### Trigger

"Import ↑" button in header.

### Layout

```
┌────────────────────────────────────────────────┐
│  Import Watchlist                   [✕]         │
│  ──────────────────────────────────────────     │
│  One title per line. Season suffix optional:    │
│  "Show Name S1" or "Show Name (S1)"             │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Breaking Bad                             │  │
│  │ Sopranos S1                              │  │
│  │ Sopranos (S2)                            │  │
│  │ Dune                                     │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│                              [Cancel] [Import]  │
└────────────────────────────────────────────────┘
```

- Width: min(90vw, 560px)
- Textarea: height 240px, monospace 13px, `var(--surface-2)` bg, `var(--text)` color, `var(--radius-sm)` border-radius, `1px solid rgba(255,255,255,0.1)` border; focus border `var(--accent)`
- Hint text: DM Sans 400, 12px, `var(--muted)`
- [Cancel]: ghost button
- [Import]: filled button, `var(--accent)` bg, white text, `var(--radius-full)`, 13px DM Sans 500, padding `8px 20px`

### Import Button States

- Idle: "Import"
- Loading: "Importing..." + spinner, disabled
- Done: dismissed; diff summary modal appears

### Diff Summary Modal

Replaces import modal:

```
┌──────────────────────────────────────┐
│  Import complete                     │
│                                      │
│  ✓  12  added                        │
│  ~   3  already in list              │
│  ✗   2  failed to match OMDB (stubs) │
│                                      │
│                              [Done]  │
└──────────────────────────────────────┘
```

- ✓ line: `var(--accent)` color
- ~ line: `var(--muted)` color
- ✗ line: `var(--danger)` color
- If failed count > 0: small footnote "Unresolved titles added as stubs — search to resolve them"

---

## 13. First-Run OMDB Key Modal

Appears on load when `localStorage.omdbKey` is empty.

```
┌──────────────────────────────────────────┐
│  Welcome to Watchlist                    │
│                                          │
│  Enter your free OMDB API key to search  │
│  for movies and TV shows.                │
│                                          │
│  Get a free key at omdbapi.com →         │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Paste your API key here...         │  │
│  └────────────────────────────────────┘  │
│                                          │
│                           [Get Started]  │
└──────────────────────────────────────────┘
```

- Cannot be dismissed without entering a key (no ✕ button, Escape blocked)
- "Get a free key at omdbapi.com →": anchor in `var(--accent)`, opens new tab
- Key input: same style as import textarea (single line, height 44px)
- [Get Started]: disabled until input has ≥6 chars; validates against OMDB on click (test request); shows error "Invalid key" inline if rejected
- On success: modal closes, key saved to `localStorage.omdbKey`

---

## 14. Skeleton / Loading States

### Shimmer Animation

```css
@keyframes shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
```

Applied to: modal grid cards while fetching, first-run ghost cards on empty shelves.

### First-Run Ghost Cards

Empty shelves on first visit show 5–6 ghost cards per shelf:
- Same dimensions as real cards
- Shimmer animation at 60% opacity
- No text content

---

## 15. Buttons

### Filled (Primary)

```
background: var(--accent)
color: #fff
border-radius: var(--radius-full)
padding: 9px 20px
font: DM Sans 500, 14px
```

Hover: `brightness(1.12)`, `var(--dur-fast)`  
Active: `scale(0.97)`  
Disabled: `opacity: 0.4`, `cursor: not-allowed`

### Ghost (Secondary)

```
background: transparent
color: var(--muted)
border: 1px solid rgba(255,255,255,0.12)
border-radius: var(--radius-full)
padding: 9px 20px
font: DM Sans 400, 14px
```

Hover: `color: var(--text)`, border brightens, `var(--dur-fast)`

### Icon Button

```
background: transparent
color: var(--muted)
padding: 6px
border-radius: var(--radius-sm)
```

Hover: `color: var(--text)`, `background: rgba(255,255,255,0.06)`

---

## 16. Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| `≥1200px` | 5–6 cards per shelf row visible; expanded grid = 4 cols |
| `768px–1199px` | 4–5 cards visible; expanded grid = 3 cols |
| `≤768px` | 3–4 cards visible; expanded grid = 2 cols; page padding = 16px |
| `≤375px` | 2–3 cards visible; no layout breakage |

Header at ≤768px: hide "Import" / "Export" text, show icons only.

---

## 17. Scrollbar Styles

```css
/* Hide shelf scrollbars globally */
.shelf-row {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.shelf-row::-webkit-scrollbar { display: none; }

/* Modal inner scroll: thin, styled */
.modal-scroll::-webkit-scrollbar { width: 4px; }
.modal-scroll::-webkit-scrollbar-track { background: transparent; }
.modal-scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
}
```

---

## 18. Z-Index Stack

```
100  Header (sticky)
150  Context menu
200  Modal overlay
210  Modal panel
220  First-run modal (blocks all)
```

---

## 19. File Structure (UI Assets)

```
/
├── index.html
├── style.css          ← all tokens + component styles
├── app.js             ← all behaviour
├── config.js          ← OMDB_KEY (gitignored)
├── config.example.js  ← template (committed)
└── assets/
    └── icons/         ← SVG icon sprites
```

No build step. All fonts via Google Fonts CDN with `display=swap`.

---

## 20. Accessibility (Minimal)

Personal tool — full WCAG AA not required. Ship:
- Semantic HTML (`<main>`, `<section>`, `<button>`, `<input>`)
- Keyboard: `Tab` navigates cards/buttons; `Enter` activates; `Escape` closes modals/menus
- Focus ring: `outline: 2px solid var(--accent)`, `outline-offset: 2px`
- No ARIA roles beyond what semantic HTML provides
