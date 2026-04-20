/**
 * PusztaPlay — Player View
 * FEAT: Xtream csatorna/film/sorozat metaadat megjelenítése
 *       Sorozatnál: next-episode sáv az aktuális évad epizódjaival
 *       FIX: Kedvenc gomb a detail-card-ban
 */

import { playerData }           from '../services/mock-data.js';
import { renderPlayerControls } from '../components/player-controls.js';
import { getImportedPlaylist }  from '../services/playlist-import.js';
import { isFavorite }           from '../store/actions.js';


export function renderPlayerLoadingView() {
  return `
    <section class="content-grid">
      <div class="status-banner"><strong>Betöltés...</strong> a player inicializálása folyamatban.</div>
    </section>
  `;
}


function findFromPlaylist(contentId) {
  const p = getImportedPlaylist();
  if (!p) return null;
  return (
    (p.liveChannels || p.channels || []).find(c => c.key === contentId) ||
    (p.movies  || []).find(c => c.key === contentId) ||
    (p.series  || []).find(c => c.key === contentId) ||
    null
  );
}


function typeLabel(item) {
  if (!item) return 'VOD';
  if (item.type === 'live')   return 'Live TV';
  if (item.type === 'movie')  return 'Film';
  if (item.type === 'series') return 'Sorozat';
  return item.type || 'VOD';
}


function buildNextEpisodePanel(currentItem) {
  if (!currentItem || currentItem.type !== 'series') return '';
  const p = getImportedPlaylist();
  if (!p) return '';
  const siblings = (p.series || []).filter(s =>
    s.type === 'series' &&
    s.key !== currentItem.key &&
    s.seriesId === currentItem.seriesId &&
    s.seasonNum === currentItem.seasonNum
  );
  if (!siblings.length) return '';
  const cards = siblings.map(ep => `
    <button class="channel-item next-ep-btn"
      data-ep-url="${ep.streamUrl}"
      data-ep-key="${ep.key}"
      data-ep-title="${(ep.title||'').replace(/"/g,'&quot;')}"
      data-ep-series-id="${ep.seriesId||''}"
      data-ep-season="${ep.seasonNum||''}"
      style="display:flex;gap:10px;align-items:center;padding:8px 12px;text-align:left">
      ${ep.logo
        ? `<img src="${ep.logo}" alt="" style="width:80px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0" loading="lazy" onerror="this.style.display='none'">`
        : `<div style="width:80px;height:45px;background:linear-gradient(145deg,#f6c800,#1a1a1a);border-radius:4px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <strong style="font-size:.88rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ep.title||'Epizód'}</strong>
        <small class="muted">${ep.seasonNum ? `${ep.seasonNum}. évad` : ''}</small>
      </div>
    </button>
  `).join('');
  return `
    <div class="next-episode-panel" style="margin-top:24px">
      <div class="section-head" style="margin-bottom:12px">
        <div class="headline" style="font-size:1rem">📺 További epizódok ebből az évadból</div>
      </div>
      <div class="next-ep-list" style="display:flex;flex-direction:column;gap:4px;max-height:360px;overflow-y:auto;border:1px solid #2a2a2a;border-radius:8px;padding:4px">
        ${cards}
      </div>
    </div>
  `;
}


export async function renderPlayerView(currentKey = 'royal') {
  const xtream = findFromPlaylist(currentKey);
  const mock   = playerData[currentKey] || playerData.royal;

  const title     = xtream?.title     || mock.title;
  const type      = typeLabel(xtream) || mock.type;
  const status    = xtream?.status    || mock.status;
  const isLive    = xtream ? xtream.type === 'live' : !!mock.isLive;
  const streamUrl = xtream?.streamUrl || mock.streamUrl;
  const group     = xtream?.group     || mock.audio || '—';
  const noStream  = !streamUrl;

  const fav = isFavorite(currentKey);
  const favType = xtream?.type || (isLive ? 'live' : 'movie');

  const favBtn = `
    <button
      class="btn fav-player-btn${fav ? ' fav-player-btn--active' : ''}"
      data-fav-toggle="${currentKey}"
      data-channel-key="${favType === 'live' ? currentKey : ''}"
      data-movie-key="${favType === 'movie' ? currentKey : ''}"
      data-open-series="${favType === 'series' ? (xtream?.seriesId || currentKey) : ''}"
      data-series-title="${favType === 'series' ? (title).replace(/"/g,'&quot;') : ''}"
      data-series-key="${favType === 'series' ? currentKey : ''}"
      data-channel-title="${title.replace(/"/g,'&quot;')}"
      data-channel-group="${group.replace(/"/g,'&quot;')}"
      data-channel-logo="${(xtream?.logo||'').replace(/"/g,'&quot;')}"
      data-channel-stream-id="${xtream?.streamId||''}"
      data-movie-title="${title.replace(/"/g,'&quot;')}"
      data-movie-group="${group.replace(/"/g,'&quot;')}"
      data-movie-logo="${(xtream?.logo||'').replace(/"/g,'&quot;')}"
      data-movie-stream-id="${xtream?.streamId||''}"
      data-fav-key="${currentKey}"
      aria-pressed="${fav}"
      title="${fav ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}">
      ${fav ? '♥ Kedvenc' : '♡ Kedvencekhez'}
    </button>`;

  const nextEpisodePanel = buildNextEpisodePanel(xtream);

  const vodId        = !isLive && xtream?.type === 'movie'  ? (xtream.streamId || '')   : '';
  const seriesId     = !isLive && xtream?.type === 'series' ? (xtream.seriesId || '')   : '';
  const liveStreamId = isLive ? (xtream?.streamId || '') : '';

  return `
    <section class="player-layout">
      <div id="player-status" class="status-banner">
        <strong>Készen áll.</strong> A stream betöltése indul.
      </div>
      <div class="section-head">
        <div class="headline">Lejátszó</div>
        <span class="pill">${isLive ? '🔴 LIVE' : type}</span>
      </div>

      ${noStream ? `
        <div class="status-banner" style="border-color:#f6c800">
          <strong>Nincs közvetlen stream URL.</strong>
          Sorozatepizód-választó hamarosan elérhető.
        </div>` : `
        <div class="player-surface">
          <div class="video-wrap">
            ${isLive ? '<div class="live-badge">LIVE</div>' : ''}
            <video id="main-video" class="video" controls playsinline preload="metadata"></video>
          </div>
          ${renderPlayerControls(currentKey)}
        </div>`
      }

      <div class="detail-card"${vodId ? ` data-vod-id="${vodId}"` : ''}${seriesId ? ` data-series-id="${seriesId}"` : ''}${liveStreamId ? ` data-live-stream-id="${liveStreamId}"` : ''}>
        <h4>${title}</h4>

        ${isLive ? `
<div class="detail-card-inner">
  <div class="live-left">
    ${xtream?.logo ? `
      <div class="player-detail-logo">
        <img
          src="${xtream.logo}"
          alt="${title}"
          loading="lazy"
          onerror="this.parentElement.style.display='none'"
        >
      </div>` : ''}
    <div class="detail-meta">
      <dl>
        <div><dt>Típus</dt><dd>${type}</dd></div>
        <div><dt>Kategória</dt><dd>${group}</dd></div>
      </dl>
      <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${favBtn}
      </div>
    </div>
  </div>
  <div id="live-detail-epg" class="live-detail-epg"></div>
</div>
        ` : (xtream?.type === 'movie' || xtream?.type === 'series') ? `
          <div class="detail-card-inner vod-layout">
            <div class="vod-left">
              <div class="vod-poster">
                ${xtream?.logo ? `
                  <img
                    src="${xtream.logo}"
                    alt="${title.replace(/"/g, '&quot;')}"
                    loading="lazy"
                    onerror="this.style.display='none'">
                ` : ''}
              </div>
              <dl class="vod-meta">
                <div><dt>Kiadás dátuma</dt><dd id="player-detail-release">–</dd></div>
                <div><dt>Műfaj</dt><dd id="player-detail-genre">–</dd></div>
                <div><dt>Főszereplők</dt><dd id="player-detail-cast">–</dd></div>
                <div><dt>Rendező</dt><dd id="player-detail-director">–</dd></div>
              </dl>
            </div>
            <div class="vod-plot">
              <h5>Rövid tartalom</h5>
              <p id="player-detail-plot">–</p>
            </div>
          </div>
          <div class="detail-actions">
            ${favBtn}
          </div>
        ` : `
          <div class="detail-card-inner">
            <div class="detail-meta">
              <dl>
                <div><dt>Típus</dt><dd>${type}</dd></div>
                <div><dt>Kategória</dt><dd>${group}</dd></div>
              </dl>
              <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                ${favBtn}
              </div>
            </div>
          </div>
        `}
      ${nextEpisodePanel}
    </section>
  `;
}
