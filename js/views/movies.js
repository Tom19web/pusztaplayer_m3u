/**
 * PusztaPlay — Filmek View
 * FEAT: kategória panel + detail panel (EPG-box stílus) + get_vod_info alapján
 */

import { getMovies }           from '../services/api.js';
import { renderPosterCard }    from '../components/poster-card.js';
import { renderSkeletonGrid }  from '../components/skeleton.js';
import { getImportedPlaylist } from '../services/playlist-import.js';

const PAGE_SIZE = 100;

let _allMovies = [];
export function getAllMovies() { return _allMovies; }

const styleMap = {
  royal: '', heist: 'background:linear-gradient(145deg,#1fd6e8,#1969a7 55%,#120f3d)',
  arena: 'background:linear-gradient(145deg,#f6c800,#ff6a00 55%,#bd1128)',
  retro: 'background:linear-gradient(145deg,#e44652,#f6c800 45%,#1fd6e8)'
};

export function renderMoviesLoadingView() {
  return `<section class="content-grid"><div class="status-banner"><strong>Betöltés...</strong> jönnek a filmek.</div>${renderSkeletonGrid(4)}</section>`;
}

function renderVodCard(item) {
  const bg = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat`
    : 'background:linear-gradient(145deg,#1fd6e8,#ff5b63 55%,#1a1a1a)';
  return `
    <article class="card"
      data-movie-key="${item.key}"
      data-movie-stream-id="${item.streamId || ''}"
      data-movie-title="${item.title.replace(/"/g,'&quot;')}"
      data-movie-group="${(item.group||'').replace(/"/g,'&quot;')}"
      data-movie-logo="${(item.logo||'').replace(/"/g,'&quot;')}">
      <div class="thumb" style="${bg}">
        ${!item.logo ? `<span>${item.title.replace(/ /g,'<br>')}</span>` : ''}
      </div>
      <div class="meta"><strong>${item.title}</strong><small>${item.group || ''}</small></div>
    </article>
  `;
}

export function renderMoviePage(items, offset = 0) {
  const page      = items.slice(offset, offset + PAGE_SIZE);
  const hasMore   = offset + PAGE_SIZE < items.length;
  const remaining = items.length - offset - PAGE_SIZE;
  return `
    <div class="rail" id="vod-movies-rail">
      ${page.map(item => renderVodCard(item)).join('')}
      ${hasMore
        ? `<button class="btn btn-secondary load-more-movies-btn" data-movies-offset="${offset + PAGE_SIZE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(remaining, PAGE_SIZE)} film (${offset + PAGE_SIZE}/${items.length})</button>`
        : `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes film megjelenítve (${items.length} db)</div>`
      }
    </div>
  `;
}

export async function renderMoviesView() {
  const imported = getImportedPlaylist();

  if (imported) {
    const movies      = imported.movies || [];
    const movieGroups = imported.movieGroups || ['Összes film'];

    _allMovies = movies.map(c => ({
      key: c.key, streamId: c.streamId || '', title: c.title,
      group: c.group || 'Egyéb', logo: c.logo || '', streamUrl: c.streamUrl || ''
    }));

    if (!movies.length) {
      return `
        <section class="content-grid" data-search-scope="movies">
          <div class="section-head"><div class="headline">Filmek</div></div>
          <div class="status-banner">Az importált playlistben nem találtunk filmet.</div>
        </section>`;
    }

    const first = _allMovies[0];
    return `
      <section class="content-grid" data-search-scope="movies">
        <div class="section-head">
          <div class="headline">Filmek</div>
          <span class="pill">${movies.length} film</span>
        </div>
        <div class="layout-live">
          <div class="panel groups" id="movies-groups-panel">
            ${movieGroups.map((g, i) =>
              `<button class="group-item ${i === 0 ? 'active' : ''}" data-movies-filter="${g.replace(/"/g,'&quot;')}">${g}</button>`
            ).join('')}
          </div>
          <div id="vod-movies-list">
            ${renderMoviePage(_allMovies, 0)}
          </div>
          <div class="detail-card details live-epg-sticky" id="movie-detail-panel">
            <div class="now-playing-chip"><span class="dot-live"></span><span>Saját playlist aktív</span></div>
            <h4 id="movie-detail-title" style="margin-top:14px">${first?.title || ''}</h4>
            <dl id="movie-detail-dl">
              <div><dt>Kategória</dt><dd id="movie-detail-group">${first?.group || ''}</dd></div>
            </dl>
            <div id="movie-detail-info" style="margin-top:8px">
              <div class="epg-loading" style="color:var(--color-text-muted);font-size:.85rem">‹ Kattints egy filmre a részletekhez</div>
            </div>
            <div style="margin-top:16px">
              <button class="btn btn-primary" id="movie-detail-play" data-open-player="${first?.key || ''}">▶ Lejátszás</button>
            </div>
          </div>
        </div>
        <div class="empty-state hidden" data-empty-search>Nincs találat a filmek között.</div>
      </section>`;
  }

  // Fallback: mock JSON
  const movies = await getMovies();
  return `
    <section class="content-grid" data-search-scope="movies">
      <div class="section-head"><div class="headline">Filmek</div><span class="pill">Prémium VOD</span></div>
      <div class="rail" data-filter-list>
        ${movies.map(m => renderPosterCard(m.key, m.title, m.meta, styleMap[m.key] || '')).join('')}
      </div>
      <div class="empty-state hidden" data-empty-search>Nincs találat a filmek között.</div>
    </section>`;
}
