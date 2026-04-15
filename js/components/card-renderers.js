/**
 * card-renderers.js
 * Megosztott HTML-generáló függvények: live csatórna, film, sorozat kártyalisták.
 * Importálja: app.js, filters.js, load-more.js
 */

import { isFavorite } from '../store/actions.js';

const PAGE_LIVE   = 200;
const PAGE_VOD    = 100;

/* ── Live csatórna lista ── */
export function renderChannelListHTML(channels) {
  const page    = channels.slice(0, PAGE_LIVE);
  const hasMore = channels.length > PAGE_LIVE;
  const rem     = channels.length - PAGE_LIVE;

  return `<div class="channel-grid">${
    page.map(c => renderChannelItemHTML(c)).join('')
  }</div>${
    hasMore
      ? `<button class="btn btn-secondary load-more-btn" data-load-offset="${PAGE_LIVE}" style="width:100%;margin-top:8px">⬇ Következő ${Math.min(rem, PAGE_LIVE)} csatórna (${PAGE_LIVE}/${channels.length})</button>`
      : `<div class="muted" style="padding:12px 0;font-size:.85rem;text-align:center">Összes csatórna megjelenítve (${channels.length} db)</div>`
  }`;
}

/* Egyetlen channel-item gomb HTML-je (load-more-nál is használjuk) */
export function renderChannelItemHTML(c) {
  return `<button class="channel-item"
    data-open-player="${c.key}"
    data-channel-key="${c.key}"
    data-channel-stream-id="${c.streamId || ''}"
    data-channel-title="${c.title.replace(/"/g, '&quot;')}"
    data-channel-group="${(c.group || 'Egyéb').replace(/"/g, '&quot;')}"
    data-channel-status="${(c.status || 'Élő').replace(/"/g, '&quot;')}"
    data-channel-logo="${(c.logo || '').replace(/"/g, '&quot;')}">
    ${c.logo ? `<img src="${c.logo}" alt="" class="channel-logo" loading="lazy" onerror="this.style.display='none'"/>` : ''}${c.title}
    <span class="sub">${c.status || c.group || 'Élő'}</span>
  </button>`;
}

/* ── Film kártyalista ── */
export function renderMovieListHTML(items) {
  const page    = items.slice(0, PAGE_VOD);
  const hasMore = items.length > PAGE_VOD;
  const rem     = items.length - PAGE_VOD;

  return `<div class="rail" id="vod-movies-rail">${
    page.map(item => renderMovieCardHTML(item)).join('')
  }${hasMore
    ? `<button class="btn btn-secondary load-more-movies-btn" data-movies-offset="${PAGE_VOD}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem, PAGE_VOD)} film (${PAGE_VOD}/${items.length})</button>`
    : `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes film megjelenítve (${items.length} db)</div>`
  }</div>`;
}

/* Egyetlen film-kártya HTML-je */
export function renderMovieCardHTML(item) {
  const bg  = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat`
    : 'background:linear-gradient(145deg,#1fd6e8,#ff5b63 55%,#1a1a1a)';
  const fav = isFavorite(item.key);

  return `<article class="card"
    data-movie-key="${item.key}"
    data-movie-stream-id="${item.streamId || ''}"
    data-movie-title="${item.title.replace(/"/g, '&quot;')}"
    data-movie-group="${(item.group || '').replace(/"/g, '&quot;')}"
    data-movie-logo="${(item.logo || '').replace(/"/g, '&quot;')}">
    <div class="thumb" style="${bg}">
      ${!item.logo ? `<span>${item.title.replace(/ /g, '<br>')}</span>` : ''}
      <button class="fav-heart${fav ? ' fav-heart--active' : ''}" data-fav-toggle="${item.key}"
        title="${fav ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
        aria-label="${fav ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
        aria-pressed="${fav}">${fav ? '♥' : '♡'}</button>
    </div>
    <div class="meta"><strong>${item.title}</strong><small>${item.group || ''}</small></div>
  </article>`;
}

/* ── Sorozat kártyalista ── */
export function renderSeriesListHTML(items) {
  const page    = items.slice(0, PAGE_VOD);
  const hasMore = items.length > PAGE_VOD;
  const rem     = items.length - PAGE_VOD;

  return `<div class="rail" id="vod-series-rail">${
    page.map(item => renderSeriesCardHTML(item)).join('')
  }${hasMore
    ? `<button class="btn btn-secondary load-more-series-btn" data-series-offset="${PAGE_VOD}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem, PAGE_VOD)} sorozat (${PAGE_VOD}/${items.length})</button>`
    : `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes sorozat megjelenítve (${items.length} db)</div>`
  }</div>`;
}

/* Egyetlen sorozat-kártya HTML-je */
export function renderSeriesCardHTML(item) {
  const bg  = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat`
    : 'background:linear-gradient(145deg,#f6c800,#ff5b63 55%,#1a1a1a)';
  const fav = isFavorite(item.key);

  return `<article class="card"
    data-open-series="${item.seriesId}"
    data-series-key="${item.key}"
    data-series-title="${item.title.replace(/"/g, '&quot;')}"
    data-series-group="${(item.group || '').replace(/"/g, '&quot;')}"
    data-series-logo="${(item.logo || '').replace(/"/g, '&quot;')}" style="cursor:pointer">
    <div class="thumb" style="${bg}">
      ${!item.logo ? `<span>${item.title.replace(/ /g, '<br>')}</span>` : ''}
      <button class="fav-heart${fav ? ' fav-heart--active' : ''}" data-fav-toggle="${item.key}"
        title="${fav ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
        aria-label="${fav ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
        aria-pressed="${fav}">${fav ? '♥' : '♡'}</button>
    </div>
    <div class="meta"><strong>${item.title}</strong><small>${item.group || ''}</small></div>
  </article>`;
}
