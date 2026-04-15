/**
 * filters.js
 * Csoport/kategória szűrés + Load More kezelés (Live, Film, Sorozat).
 */

import { getAllLiveChannels }                          from '../views/live.js';
import { getAllMovies }                                from '../views/movies.js';
import { getAllSeries }                                from '../views/series.js';
import { renderChannelListHTML, renderChannelItemHTML,
         renderMovieListHTML,   renderMovieCardHTML,
         renderSeriesListHTML,  renderSeriesCardHTML }  from './card-renderers.js';
import { isFavorite }                                  from '../store/actions.js';

/* ═════════════════════════════════════════
   SZŰRÉS
   ═════════════════════════════════════════ */

export function bindGroupFilter(bindLiveInteractions, bindRouteEvents, bindFavoriteButtons) {
  const groupButtons  = [...document.querySelectorAll('[data-group-filter]')];
  const listEl        = document.getElementById('live-channel-list');
  if (!groupButtons.length || !listEl) return;
  const masterChannels = getAllLiveChannels();
  if (!masterChannels.length) return;

  groupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      groupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter   = btn.dataset.groupFilter;
      const filtered = filter === 'Összes csatórna'
        ? masterChannels
        : masterChannels.filter(ch => ch.group === filter);

      listEl._filteredChannels = filtered;
      listEl.innerHTML = renderChannelListHTML(filtered);
      bindLiveInteractions();
      bindRouteEvents();
      bindFavoriteButtons();
    });
  });
}

export function bindMoviesFilter(bindMovieCards, bindRouteEvents, bindFavoriteButtons) {
  const groupButtons = [...document.querySelectorAll('[data-movies-filter]')];
  const listEl       = document.getElementById('vod-movies-list');
  if (!groupButtons.length || !listEl) return;
  const master = getAllMovies();
  if (!master.length) return;

  groupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      groupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter   = btn.dataset.moviesFilter;
      const filtered = filter === 'Összes film'
        ? master
        : master.filter(m => m.group === filter);

      listEl._filteredMovies = filtered;
      listEl.innerHTML = renderMovieListHTML(filtered);
      bindMovieCards();
      bindRouteEvents();
      bindFavoriteButtons();
    });
  });
}

export function bindSeriesFilter(bindSeriesDetailPanel, bindSeriesCards, bindRouteEvents, bindFavoriteButtons) {
  const groupButtons = [...document.querySelectorAll('[data-series-filter]')];
  const listEl       = document.getElementById('vod-series-list');
  if (!groupButtons.length || !listEl) return;
  const master = getAllSeries();
  if (!master.length) return;

  groupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      groupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter   = btn.dataset.seriesFilter;
      const filtered = filter === 'Összes sorozat'
        ? master
        : master.filter(s => s.group === filter);

      listEl._filteredSeries = filtered;
      listEl.innerHTML = renderSeriesListHTML(filtered);
      bindSeriesDetailPanel();
      bindSeriesCards();
      bindRouteEvents();
      bindFavoriteButtons();
    });
  });
}

/* ═════════════════════════════════════════
   LOAD MORE
   ═════════════════════════════════════════ */

export function bindLoadMore(bindLiveInteractions, bindRouteEvents, bindFavoriteButtons) {
  const listEl = document.getElementById('live-channel-list');
  if (!listEl) return;
  const PAGE = 200;

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.load-more-btn');
    if (!btn) return;
    const offset = parseInt(btn.dataset.loadOffset, 10);
    if (isNaN(offset)) return;

    const source  = listEl._filteredChannels || getAllLiveChannels();
    const page    = source.slice(offset, offset + PAGE);
    const hasMore = offset + PAGE < source.length;
    const rem     = source.length - offset - PAGE;
    const grid    = listEl.querySelector('.channel-grid');

    if (grid) grid.insertAdjacentHTML('beforeend', page.map(c => renderChannelItemHTML(c)).join(''));
    btn.remove();

    if (hasMore) {
      listEl.insertAdjacentHTML('beforeend',
        `<button class="btn btn-secondary load-more-btn" data-load-offset="${offset + PAGE}" style="width:100%;margin-top:8px">⬇ Következő ${Math.min(rem, PAGE)} csatórna (${offset + PAGE}/${source.length})</button>`);
    } else {
      listEl.insertAdjacentHTML('beforeend',
        `<div class="muted" style="padding:12px 0;font-size:.85rem;text-align:center">Összes csatórna megjelenítve (${source.length} db)</div>`);
    }
    bindLiveInteractions();
    bindRouteEvents();
    bindFavoriteButtons();
  });
}

export function bindMoviesLoadMore(bindMovieCards, bindRouteEvents, bindFavoriteButtons) {
  const listEl = document.getElementById('vod-movies-list');
  if (!listEl) return;
  const PAGE = 100;

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.load-more-movies-btn');
    if (!btn) return;
    const offset = parseInt(btn.dataset.moviesOffset, 10);
    if (isNaN(offset)) return;

    const source  = listEl._filteredMovies || getAllMovies();
    const page    = source.slice(offset, offset + PAGE);
    const hasMore = offset + PAGE < source.length;
    const rem     = source.length - offset - PAGE;
    const rail    = listEl.querySelector('#vod-movies-rail') || listEl;

    rail.insertAdjacentHTML('beforeend', page.map(c => renderMovieCardHTML(c)).join(''));
    btn.remove();

    if (hasMore) {
      listEl.insertAdjacentHTML('beforeend',
        `<button class="btn btn-secondary load-more-movies-btn" data-movies-offset="${offset + PAGE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem, PAGE)} film (${offset + PAGE}/${source.length})</button>`);
    } else {
      listEl.insertAdjacentHTML('beforeend',
        `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes film megjelenítve (${source.length} db)</div>`);
    }
    bindMovieCards();
    bindRouteEvents();
    bindFavoriteButtons();
  });
}

export function bindSeriesLoadMore(bindSeriesDetailPanel, bindSeriesCards, bindRouteEvents, bindFavoriteButtons) {
  const listEl = document.getElementById('vod-series-list');
  if (!listEl) return;
  const PAGE = 100;

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.load-more-series-btn');
    if (!btn) return;
    const offset = parseInt(btn.dataset.seriesOffset, 10);
    if (isNaN(offset)) return;

    const source  = listEl._filteredSeries || getAllSeries();
    const page    = source.slice(offset, offset + PAGE);
    const hasMore = offset + PAGE < source.length;
    const rem     = source.length - offset - PAGE;
    const rail    = listEl.querySelector('#vod-series-rail') || listEl;

    rail.insertAdjacentHTML('beforeend', page.map(c => renderSeriesCardHTML(c)).join(''));
    btn.remove();

    if (hasMore) {
      listEl.insertAdjacentHTML('beforeend',
        `<button class="btn btn-secondary load-more-series-btn" data-series-offset="${offset + PAGE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem, PAGE)} sorozat (${offset + PAGE}/${source.length})</button>`);
    } else {
      listEl.insertAdjacentHTML('beforeend',
        `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes sorozat megjelenítve (${source.length} db)</div>`);
    }
    bindSeriesDetailPanel();
    bindSeriesCards();
    bindRouteEvents();
    bindFavoriteButtons();
  });
}
