/**
 * PusztaPlay — Live TV View
 * FIX: csatornalista JS memóriában tárolva (data-all-channels JSON parse hiba kikerülve)
 * FIX2: szívgomb hozzáadva minden csatorna-buttonhoz
 * FEAT: intelligens zapping bar – kedvencek ⭐ + legutóbb nézett 🕐 + fallback
 */

import { getLiveData }                        from '../services/api.js';
import { getImportedPlaylist }                from '../services/playlist-import.js';
import { isFavorite, getFavoritesByType }     from '../store/actions.js';
import { getWatchHistory }                    from '../store/selectors.js';

const PAGE_SIZE    = 200;
const ZAPPING_SIZE = 8;

let _allLiveChannels = [];

export function getAllLiveChannels() {
  return _allLiveChannels;
}

export function renderLiveLoadingView() {
  return `<section class="content-grid"><div class="status-banner"><strong>Betöltés...</strong> készül a csatornalista.</div></section>`;
}

function renderChannelLogo(ch) {
  if (!ch.logo) return '';
  return `<img src="${ch.logo}" alt="" class="channel-logo" loading="lazy" onerror="this.style.display='none'" />`;
}

function renderChannelButton(c, active = false) {
  const fav = isFavorite(c.key);
  return `<button
    class="channel-item${active ? ' active' : ''}"
    data-open-player="${c.key}"
    data-channel-key="${c.key}"
    data-channel-stream-id="${c.streamId || ''}"
    data-channel-title="${c.title.replace(/"/g, '&quot;')}"
    data-channel-group="${(c.group || 'Egyéb').replace(/"/g, '&quot;')}"
    data-channel-status="${(c.status || 'Élő').replace(/"/g, '&quot;')}"
    data-channel-logo="${(c.logo || '').replace(/"/g, '&quot;')}">
    ${renderChannelLogo(c)}${c.title}
    <span class="sub">${c.status || c.group || 'Élő'}</span>
    <button
      class="fav-heart${fav ? ' fav-heart--active' : ''}"
      data-fav-toggle="${c.key}"
      title="${fav ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
      aria-label="${fav ? 'Eltávolítás' : 'Hozzáadás'}"
      aria-pressed="${fav}"
      onclick="event.stopPropagation()">${fav ? '♥' : '♡'}</button>
  </button>`;
}

export function renderChannelPage(channels, offset = 0) {
  const page      = channels.slice(offset, offset + PAGE_SIZE);
  const hasMore   = offset + PAGE_SIZE < channels.length;
  const remaining = channels.length - offset - PAGE_SIZE;
  return `
    <div class="channel-grid">
      ${page.map((c, i) => renderChannelButton(c, offset === 0 && i === 0)).join('')}
    </div>
    ${hasMore
      ? `<button class="btn btn-secondary load-more-btn" data-load-offset="${offset + PAGE_SIZE}" style="width:100%;margin-top:8px">⬇ Következő ${Math.min(remaining, PAGE_SIZE)} csatorna (${offset + PAGE_SIZE}/${channels.length})</button>`
      : `<div class="muted" style="padding:12px 0;font-size:.85rem;text-align:center">Összes csatorna megjelenítve (${channels.length} db)</div>`
    }
  `;
}

/**
 * Intelligens zapping bar összeállítása:
 * 1. Kedvenc élő csatornák (⭐) – legelőre
 * 2. Legutóbb nézett élő csatornák (🕐) – amik még nem kedvencek
 * 3. Fallback: lista eleje – ha nincs elég history/kedvenc
 */
function getZappingChannels(allChannels) {
  const resultKeys = new Set();
  const result     = [];

  // 1. Kedvencek
  const favs = getFavoritesByType('live');
  for (const fav of favs) {
    if (result.length >= ZAPPING_SIZE) break;
    const ch = allChannels.find(c => c.key === fav.key);
    if (ch && !resultKeys.has(ch.key)) {
      result.push({ ...ch, _zapBadge: '⭐', _zapTitle: 'Kedvenc' });
      resultKeys.add(ch.key);
    }
  }

  // 2. Legutóbb nézett
  const history = getWatchHistory().filter(h => h.type === 'live');
  for (const h of history) {
    if (result.length >= ZAPPING_SIZE) break;
    const ch = allChannels.find(c => c.key === h.key);
    if (ch && !resultKeys.has(ch.key)) {
      result.push({ ...ch, _zapBadge: '🕐', _zapTitle: 'Nemrég nézett' });
      resultKeys.add(ch.key);
    }
  }

  // 3. Fallback – lista eleje
  for (const ch of allChannels) {
    if (result.length >= ZAPPING_SIZE) break;
    if (!resultKeys.has(ch.key)) {
      result.push({ ...ch, _zapBadge: null, _zapTitle: null });
      resultKeys.add(ch.key);
    }
  }

  return result;
}

function renderZappingBar(allChannels) {
  const zapChannels = getZappingChannels(allChannels);
  if (!zapChannels.length) return '';

  return `
    <div class="zapping-bar">
      ${zapChannels.map(ch => `
        <button
          class="control-btn quick-zap"
          data-zap-channel="${ch.key}"
          title="${ch._zapTitle ? ch._zapTitle + ': ' + ch.title : ch.title}">
          ${renderChannelLogo(ch)}
          ${ch.title}
          ${ch._zapBadge ? `<span class="zap-badge" aria-label="${ch._zapTitle}">${ch._zapBadge}</span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

export async function renderLiveView() {
  const imported = getImportedPlaylist();

  let channels, groups, isImported;

  if (imported) {
    channels   = imported.liveChannels || imported.channels || [];
    groups     = imported.groups       || ['Összes csatorna'];
    isImported = true;
  } else {
    const data = await getLiveData();
    channels   = data.channels || [];
    groups     = data.groups   || ['Összes csatorna'];
    isImported = false;
  }

  _allLiveChannels = channels.map(c => ({
    key:      c.key,
    streamId: c.streamId || '',
    title:    c.title,
    group:    c.group   || 'Egyéb',
    status:   c.status  || 'Élő',
    logo:     c.logo    || ''
  }));

  const first       = channels[0];
  const pill        = isImported ? `${channels.length} élő csatorna` : 'EPG + gyors váltás';
  const sourceLabel = isImported ? 'Saját playlist aktív' : 'Most népszerű live csatorna';

  if (!channels.length) {
    return `
      <section class="content-grid">
        <div class="section-head"><div class="headline">Live TV</div></div>
        <div class="status-banner"><strong>Nincs élő csatorna.</strong> Importálj egy .m3u fájlt a sidebarban.</div>
      </section>
    `;
  }

  return `
    <section class="content-grid" data-search-scope="live">
      <div class="section-head"><div class="headline">Live TV</div><span class="pill">${pill}</span></div>
      ${renderZappingBar(_allLiveChannels)}
      <div class="layout-live">
        <div class="panel groups" id="live-groups-panel">
          ${groups.map((g, i) =>
            `<button class="group-item ${i === 0 ? 'active' : ''}" data-group-filter="${g}">${g}</button>`
          ).join('')}
        </div>
        <div class="panel channels" id="live-channel-list">
          ${renderChannelPage(_allLiveChannels, 0)}
        </div>
        <div class="detail-card details live-epg-sticky" id="live-detail-panel">
          <div class="now-playing-chip"><span class="dot-live"></span><span>${sourceLabel}</span></div>
          <h4 id="live-detail-title" style="margin-top:14px">${first?.title || ''}</h4>
          <dl>
            <div><dt>Státusz</dt><dd id="live-detail-status">${first?.status || 'Élő'}</dd></div>
            <div><dt>Kategória</dt><dd id="live-detail-group">${first?.group || 'Egyéb'}</dd></div>
            <div><dt>Minőség</dt><dd>${isImported ? 'HLS stream' : 'Full HD'}</dd></div>
            <div><dt>Forrás</dt><dd>${isImported ? 'Lokális M3U import' : 'Automatikus session'}</dd></div>
          </dl>
          <div id="live-detail-epg">
            <div class="epg-loading" style="color:var(--color-text-muted);font-size:.85rem;margin-top:12px">⏳ EPG betöltése...</div>
          </div>
          <div style="margin-top:16px">
            <button class="btn btn-primary" id="live-detail-play" data-open-player="${first?.key || ''}">&#9654; Lejátszás</button>
          </div>
        </div>
      </div>
      <div class="empty-state hidden" data-empty-search>Nincs találat a csatornák között.</div>
    </section>
  `;
}
