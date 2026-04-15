/**
 * PusztaPlay — Sorozatok View
 * FEAT: kategória panel + detail panel (EPG-box stílus) + get_series_info alapján
 */

import { getImportedPlaylist } from '../services/playlist-import.js';

const PAGE_SIZE = 100;

let _allSeries = [];
export function getAllSeries() { return _allSeries; }

export function renderSeriesLoadingView() {
  return `<section class="content-grid"><div class="status-banner"><strong>Betöltés...</strong> jönnek a sorozatok.</div></section>`;
}

function renderSeriesCard(item) {
  const bg = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat`
    : 'background:linear-gradient(145deg,#f6c800,#ff5b63 55%,#1a1a1a)';
  return `
    <article class="card"
      data-open-series="${item.seriesId}"
      data-series-key="${item.key}"
      data-series-title="${item.title.replace(/"/g,'&quot;')}"
      data-series-group="${(item.group||'').replace(/"/g,'&quot;')}"
      data-series-logo="${(item.logo||'').replace(/"/g,'&quot;')}"
      style="cursor:pointer">
      <div class="thumb" style="${bg}">
        ${!item.logo ? `<span>${item.title.replace(/ /g,'<br>')}</span>` : ''}
      </div>
      <div class="meta"><strong>${item.title}</strong><small>${item.group || ''}</small></div>
    </article>
  `;
}

export function renderSeriesPage(items, offset = 0) {
  const page      = items.slice(offset, offset + PAGE_SIZE);
  const hasMore   = offset + PAGE_SIZE < items.length;
  const remaining = items.length - offset - PAGE_SIZE;
  return `
    <div class="rail" id="vod-series-rail">
      ${page.map(item => renderSeriesCard(item)).join('')}
      ${hasMore
        ? `<button class="btn btn-secondary load-more-series-btn" data-series-offset="${offset + PAGE_SIZE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(remaining, PAGE_SIZE)} sorozat (${offset + PAGE_SIZE}/${items.length})</button>`
        : `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes sorozat megjelenítve (${items.length} db)</div>`
      }
    </div>
  `;
}

export async function renderSeriesView() {
  const imported = getImportedPlaylist();

  if (!imported || !imported.series?.length) {
    return `
      <section class="content-grid" data-search-scope="series">
        <div class="section-head"><div class="headline">Sorozatok</div></div>
        <div class="status-banner">
          ${imported ? 'Nem találtunk sorozatot az Xtream felhasználódnál.' : 'Jelentkezz be Xtream fiókkal a sorozatok eléréséhez.'}
        </div>
      </section>`;
  }

  const seriesGroups = imported.seriesGroups || ['Összes sorozat'];
  _allSeries = imported.series.map(c => ({
    key: c.key, seriesId: c.seriesId, title: c.title,
    group: c.group || 'Egyéb', logo: c.logo || ''
  }));

  const first = _allSeries[0];
  return `
    <section class="content-grid" data-search-scope="series">
      <div class="section-head">
        <div class="headline">Sorozatok</div>
        <span class="pill">${_allSeries.length} sorozatcím</span>
      </div>

      <!-- Évad/epizód panel – dinamikusan töltődik -->
      <div id="series-episode-panel" class="detail-card" style="display:none;margin-bottom:20px"></div>

      <div class="layout-live">
        <div class="panel groups" id="series-groups-panel">
          ${seriesGroups.map((g, i) =>
            `<button class="group-item ${i === 0 ? 'active' : ''}" data-series-filter="${g.replace(/"/g,'&quot;')}">${g}</button>`
          ).join('')}
        </div>
        <div id="vod-series-list">
          ${renderSeriesPage(_allSeries, 0)}
        </div>
        <div class="detail-card details live-epg-sticky" id="series-detail-panel">
          <div class="now-playing-chip"><span class="dot-live"></span><span>Saját playlist aktív</span></div>
          <h4 id="series-detail-title" style="margin-top:14px">${first?.title || ''}</h4>
          <dl id="series-detail-dl">
            <div><dt>Kategória</dt><dd id="series-detail-group">${first?.group || ''}</dd></div>
          </dl>
          <div id="series-detail-info" style="margin-top:8px">
            <div class="epg-loading" style="color:var(--color-text-muted);font-size:.85rem">‹ Kattints egy sorozatra a részletekhez</div>
          </div>
          <div style="margin-top:16px">
            <button class="btn btn-primary" id="series-detail-open" data-open-series="${first?.seriesId || ''}" data-series-title="${(first?.title||'').replace(/"/g,'&quot;')}">▶ Epizódok</button>
          </div>
        </div>
      </div>
      <div class="empty-state hidden" data-empty-search>Nincs találat a sorozatok között.</div>
    </section>`;
}
