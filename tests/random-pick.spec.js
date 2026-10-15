const { test, expect, chromium } = require('@playwright/test');

const BASE = 'http://localhost:8080';

const SEED_DATA = {
  watchlist: [
    { imdbID: 'tt0111161', title: 'The Shawshank Redemption', year: '1994', type: 'movie', watched: false, poster: '', imdbRating: '9.3', plot: 'Two imprisoned men bond over a number of years.', seasons: [] },
    { imdbID: 'tt0068646', title: 'The Godfather', year: '1972', type: 'movie', watched: false, poster: '', imdbRating: '9.2', plot: 'The aging patriarch of a crime dynasty.', seasons: [] },
    { imdbID: 'tt0903747', title: 'Breaking Bad', year: '2008', type: 'series', watched: false, poster: '', imdbRating: '9.5', plot: 'A high school chemistry teacher.', seasons: [] },
    { imdbID: 'tt0944947', title: 'Game of Thrones', year: '2011', type: 'series', watched: false, poster: '', imdbRating: '9.2', plot: 'Nine noble families war.', seasons: [] },
    { imdbID: 'tt1475582', title: 'Sherlock', year: '2010', type: 'series', watched: false, poster: '', imdbRating: '9.1', plot: 'A modern take on Sherlock Holmes.', seasons: [] },
  ],
  omdbKey: '',
  syncToken: '',
  sortSeries: 'added',
  sortMovies: 'added',
  filterSeries: 'all',
  filterMovies: 'all',
  expandedSeries: false,
  expandedMovies: false,
  openDetailId: null,
  view: 'main',
  settings: { defaultGrid: false, hideWatched: false, showSeasonPills: false, reduceMotion: false },
};

test.describe('Random Pick Feature', () => {
  let browser, context, page;
  const errors = [];

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    errors.length = 0;
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    // Seed localStorage before page load
    await context.addInitScript(data => {
      localStorage.setItem('watchlist', JSON.stringify(data.watchlist));
      localStorage.setItem('omdbKey', data.omdbKey);
      localStorage.setItem('sortSeries', data.sortSeries);
      localStorage.setItem('sortMovies', data.sortMovies);
      localStorage.setItem('filterSeries', data.filterSeries);
      localStorage.setItem('filterMovies', data.filterMovies);
      localStorage.setItem('expandedSeries', String(data.expandedSeries));
      localStorage.setItem('expandedMovies', String(data.expandedMovies));
      localStorage.setItem('settings', JSON.stringify(data.settings));
    }, SEED_DATA);

    await page.goto(BASE, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('1. No JS errors on load', async () => {
    expect(errors).toEqual([]);
  });

  test('2. Random button in header', async () => {
    const btn = page.locator('[data-action="open-random-picker"]');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Random');
  });

  test('3. Click Random — picker modal appears', async () => {
    await page.click('[data-action="open-random-picker"]');
    await expect(page.locator('#rp-overlay')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.rp-tile[data-type="series"]')).toBeVisible();
    await expect(page.locator('.rp-tile[data-type="movie"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('4. Hover tile — fan animates', async () => {
    await page.click('[data-action="open-random-picker"]');
    await page.locator('.rp-tile[data-type="series"]').hover();
    // Just check no errors; visual animation is CSS/JS
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });

  test('5. Click Series — stage appears', async () => {
    await page.click('[data-action="open-random-picker"]');
    await page.click('.rp-tile[data-type="series"]');
    await expect(page.locator('#rp-stage')).toBeVisible({ timeout: 2000 });
    expect(errors).toEqual([]);
  });

  test('6. Settle — winner reveal panel appears', async () => {
    await page.click('[data-action="open-random-picker"]');
    await page.click('.rp-tile[data-type="series"]');
    await expect(page.locator('#rp-stage')).toBeVisible({ timeout: 2000 });
    // Wait for info panel to show (spin takes up to 5s + 380ms reveal delay)
    const info = page.locator('#rp-stage [data-info]');
    await expect(info).toBeVisible({ timeout: 9000 });
    await expect(page.locator('[data-open-details]')).toBeVisible();
    await expect(page.locator('[data-spin-again]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('7. Spin again — re-spins', async () => {
    await page.click('[data-action="open-random-picker"]');
    await page.click('.rp-tile[data-type="series"]');
    await expect(page.locator('[data-info]')).toBeVisible({ timeout: 9000 });
    await page.click('[data-spin-again]');
    // Info should hide during spin
    await expect(page.locator('[data-info]')).toBeHidden({ timeout: 2000 });
    // Then reappear after new spin
    await expect(page.locator('[data-info]')).toBeVisible({ timeout: 9000 });
    expect(errors).toEqual([]);
  });

  test('8. Open details — stage closes, detail opens', async () => {
    await page.click('[data-action="open-random-picker"]');
    await page.click('.rp-tile[data-type="series"]');
    await expect(page.locator('[data-open-details]')).toBeVisible({ timeout: 9000 });
    await page.click('[data-open-details]');
    await expect(page.locator('#rp-stage')).toBeHidden({ timeout: 2000 });
    // detail panel or open detail ID should be reflected
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('9. R opens picker, Esc closes', async () => {
    await page.keyboard.press('r');
    await expect(page.locator('#rp-overlay')).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#rp-overlay')).toBeHidden({ timeout: 1000 });
    expect(errors).toEqual([]);
  });

  test('10. R then S — straight to series stage', async () => {
    await page.keyboard.press('r');
    await expect(page.locator('#rp-overlay')).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('s');
    await expect(page.locator('#rp-overlay')).toBeHidden({ timeout: 1000 });
    await expect(page.locator('#rp-stage')).toBeVisible({ timeout: 2000 });
    expect(errors).toEqual([]);
  });

  test('11. Esc closes stage', async () => {
    await page.click('[data-action="open-random-picker"]');
    await page.click('.rp-tile[data-type="movie"]');
    await expect(page.locator('#rp-stage')).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#rp-stage')).toBeHidden({ timeout: 2000 });
    expect(errors).toEqual([]);
  });
});
