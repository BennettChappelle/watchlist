'use strict';

import { state } from './state.js';

export async function omdbFetch(params) {
  if (!state.omdbKey) throw new Error('No OMDB key');
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', state.omdbKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (res.status === 401) throw new Error('Invalid API key');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response === 'False') throw new Error(data.Error || 'OMDB error');
  return data;
}

export const omdbSearch     = (q, page = 1, year = null, type = null) => omdbFetch({ s: q, page, ...(year ? { y: year } : {}), ...(type ? { type } : {}) });
export const omdbGetById    = id          => omdbFetch({ i: id, plot: 'short' });
export const omdbGetByTitle = (title, type) => omdbFetch({ t: title, ...(type ? { type } : {}), plot: 'short' });

// Exact-title fallback when s= fails: tries t= with year, cycling through no-type → series → movie
export async function tryYearExactLookup(title, year) {
  for (const type of [undefined, 'series', 'movie']) {
    try {
      const d = await omdbFetch({ t: title, y: year, plot: 'short', ...(type ? { type } : {}) });
      if (d.imdbID) return d;
    } catch {}
  }
  return null;
}

// Extracts a trailing/leading 4-digit year: "breaking bad 2008", "the bear (2022)"
export function parseQueryYear(q) {
  const m = q.match(/(?:^|[\s(])(\d{4})(?:[)\s]|$)/);
  if (!m) return { title: q, year: null };
  const year  = m[1];
  const title = q.replace(/\s*\(?\d{4}\)?\s*/g, ' ').trim() || q;
  return { title, year };
}

export function omdbToItem(data) {
  const type = data.Type === 'series' ? 'series' : 'movie';
  const n    = type === 'series' ? parseInt(data.totalSeasons) || 0 : 0;
  return {
    imdbID:     data.imdbID,
    title:      data.Title,
    year:       data.Year,
    type,
    poster:     data.Poster     && data.Poster     !== 'N/A' ? data.Poster     : null,
    imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null,
    plot:       data.Plot       && data.Plot       !== 'N/A' ? data.Plot       : null,
    watched:    false,
    addedAt:    Date.now(),
    isStub:     false,
    seasons:    Array.from({ length: n }, (_, i) => ({ season: i + 1, watched: false })),
  };
}

export function stubItem(title, type = 'movie') {
  return {
    imdbID:     'stub-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    title, year: null, type,
    poster:     null, imdbRating: null, plot: null,
    watched:    false, addedAt: Date.now(), isStub: true, seasons: [],
  };
}
