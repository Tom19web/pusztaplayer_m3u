/**
 * PusztaPlay — Home View
 * - Hero szekció: utoljára nézett tartalom (vagy üres állapot)
 * - Utoljára megtekintett: Live TV (16:9) és Film/Sorozat (2:3) külön szekcióban
 * - Élő most: csak Hungary kategória, 5 random csatorna, hover-re EPG adat
 */
import { renderSkeletonGrid }           from '../components/skeleton.js';
import { getImportedPlaylist,
         loadXtreamCredentials }        from '../services/playlist-import.js';
import { getWatchHistory }              from '../store/selectors.js';
import { fetchShortEpg }               from '../services/epg-service.js';

// ─── Utils ──────────────────────────────────────────────────────────────────

export function renderHomeLoadingView() {
  return `
    <section class="content-grid">
      <div class="status-banner"><strong>Betöltés…</strong> épül a kezdőlap.</div>
      ${renderSkeletonGrid(4)}
    </section>
  `;
}

function sample(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function typeLabel(type) {
  if (type === 'live')   return { icon: '📺', text: 'Live TV' };
  if (type === 'series') return { icon: '🎬', text: 'Sorozat' };
  return { icon: '🎬', text: 'Film' };
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function heroDescHtml(item) {
  const { icon, text } = typeLabel(item.type);
  return `
    <div class="hero-desc">
      <div class="hero-desc-badge">${icon} ${text}</div>
      ${item.group ? `<div style="margin-bottom:10px;font-size:.85rem;color:#ddd3c2;letter-spacing:.04em;text-transform:uppercase">${item.group}</div>` : ''}
      <dl class="hero-desc-dl">
        <div class="hero-desc-row"><dt>Típus</dt><dd>${icon} ${text}</dd></div>
        ${item.group ? `<div class="hero-desc-row"><dt>Kategória</dt><dd>${item.group}</dd></div>` : ''}
        <div class="hero-desc-row"><dt>Állapot</dt><dd>${item.type === 'live' ? '🔴 Élő adás' : '⏸ Megszakítva'}</dd></div>
      </dl>
      <p class="hero-desc-blurb">Folytathatod ott, ahol legutoljára abbahagytad &mdash; csak kattints a lejátszás gombra.</p>
    </div>
  `;
}

function renderHero(heroItem) {
  if (!heroItem) return `
    <div class="hero">
      <div class="hero-copy">
        <div class="headline">Kezdjünk hozzá</div>
        <h2>Nincs előzmény még</h2>
        <p>Válassz tartalmat a lejátszást kezdéshez.</p>
        <div class="actions">
          <button class="btn btn-primary" data-route="live">📺 Live TV böngészése</button>
          <button class="btn btn-secondary" data-route="movies">🎬 Filmek</button>
        </div>
      </div>
      <div class="poster-art">
        <div class="poster-badge" style="background:linear-gradient(145deg,#f6c800,#1a1a1a)"><strong>PusztaPlayer</strong><br/>Válassz tartalmat</div>
      </div>
    </div>`;

  return `
    <div class="hero hero--has-desc">
      <div class="hero-copy">
        <p class="hero-eyebrow">Folytasd ahol abbahagytad</p>
        <div class="headline">${heroItem.type === 'live' ? '🔴 Live TV' : heroItem.type === 'series' ? '📺 Sorozat' : '🎬 Film'}</div>
        <h2>${heroItem.title}</h2>
        <div class="actions">
          <button class="btn btn-primary" data-open-player="${heroItem.key}">► Lejátszás folytatása</button>
          <button class="btn btn-secondary" data-route="live">📺 Ugrás a Live TV-hez</button>
        </div>
      </div>
      ${heroDescHtml(heroItem)}
      <div class="poster-art">
        ${heroItem.logo
          ? `<img src="${heroItem.logo}" alt="${heroItem.title}" onerror="this.parentElement.style.background='linear-gradient(145deg,#f6c800,#1a1a1a)'">`
          : `<div class="poster-badge"><strong>${heroItem.title}</strong><br/>${heroItem.group||heroItem.type||''}</div>`
        }
      </div>
    </div>`;
}

// ─── Utoljára megtekintett — Live TV kártya (16:9) ──────────────────────────

function renderHistoryLiveCard(item) {
  return `
    <article class="card history-card history-card--live" data-open-player="${item.key}" title="${item.title}">
      <div class="history-thumb--live">
        <span class="hist-live-badge">LIVE</span>
        ${item.logo
          ? `<img class="hist-live-logo" src="${item.logo}" alt="${item.title}" loading="lazy" onerror="this.style.display='none'">`
          : `<span class="hist-no-logo-title">${item.title}</span>`
        }
        <div class="history-play-overlay">
          <span class="history-play-btn">► Lejátszás</span>
        </div>
      </div>
      <div class="meta">
        <strong style="font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${item.title}</strong>
        <small>${item.group || 'Live TV'}</small>
      </div>
    </article>
  `;
}

// ─── Utoljára megtekintett — Film / Sorozat kártya (2:3) ────────────────────

function renderHistoryMediaCard(item) {
  const bg = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat`
    : 'background:linear-gradient(145deg,#f6c800,#ff5b63 55%,#1a1a1a)';
  const typePill = item.type === 'series'
    ? `<span class="hist-type-pill hist-type-pill--series">📺 Sorozat</span>`
    : `<span class="hist-type-pill hist-type-pill--movie">🎬 Film</span>`;
  return `
    <article class="card history-card history-card--media" data-open-player="${item.key}" title="${item.title}">
      <div class="history-thumb--media" style="${bg}">
        ${typePill}
        ${!item.logo ? `<span class="hist-no-logo-title">${item.title.replace(/ /g,'<br>')}</span>` : ''}
        <div class="history-play-overlay">
          <span class="history-play-btn">► Lejátszás</span>
        </div>
      </div>
      <div class="meta">
        <strong style="font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${item.title}</strong>
        <small>${item.group || (item.type === 'series' ? 'Sorozat' : 'Film')}</small>
      </div>
    </article>
  `;
}

// ─── Utoljára megtekintett szekció (kettéválasztva) ─────────────────────────

function renderHistorySection(history) {
  const items = history.slice(0, 12);
  if (!items.length) return '';

  const liveItems  = items.filter(i => i.type === 'live');
  const mediaItems = items.filter(i => i.type !== 'live');

  const liveBlock = liveItems.length ? `
    <div class="history-subsection">
      <div class="history-sub-head">
        <span class="history-sub-icon">📺</span>
        <span class="history-sub-label">Live TV</span>
        <span class="pill pill--cyan">${liveItems.length}</span>
      </div>
      <div class="history-grid--live">
        ${liveItems.map(renderHistoryLiveCard).join('')}
      </div>
    </div>` : '';

  const mediaBlock = mediaItems.length ? `
    <div class="history-subsection">
      <div class="history-sub-head">
        <span class="history-sub-icon">🎬</span>
        <span class="history-sub-label">Film &amp; Sorozat</span>
        <span class="pill pill--yellow">${mediaItems.length}</span>
      </div>
      <div class="history-grid--media">
        ${mediaItems.map(renderHistoryMediaCard).join('')}
      </div>
    </div>` : '';

  return `
    <div class="section-head">
      <h3>Utoljára megtekintett</h3>
      <span class="pill">${items.length} tétel</span>
    </div>
    ${liveBlock}
    ${mediaBlock}
  `;
}

// ─── Élő most (Hungary) ─────────────────────────────────────────────────────

function renderLiveNowCard(ch) {
  return `
    <article class="card live-now-card"
      data-live-key="${ch.key}"
      data-live-stream-id="${ch.streamId || ''}"
      data-open-player="${ch.key}"
      title="${ch.title}">
      <div class="live-now-thumb">
        <span class="hist-live-badge">LIVE</span>
        ${ch.logo
          ? `<img class="live-now-logo" src="${ch.logo}" alt="${ch.title}" loading="lazy" onerror="this.style.display='none'">`
          : `<span class="hist-no-logo-title">${ch.title.replace(/ /g,'<br>')}</span>`
        }
        <div class="live-now-epg-overlay" id="epg-overlay-${ch.key}">
          <div class="live-now-epg-inner">EPG betöltése…</div>
        </div>
      </div>
      <div class="meta">
        <strong style="font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${ch.title}</strong>
        <small>${ch.group || 'Hungary'}</small>
      </div>
    </article>
  `;
}

function renderLiveNowSection(channels) {
  if (!channels.length) return '';
  return `
    <div class="section-head">
      <h3>Élő most</h3>
      <span class="pill live-dot">Hungary</span>
    </div>
    <div class="live-now-grid">
      ${channels.map(renderLiveNowCard).join('')}
    </div>
  `;
}

// ─── Fő export ───────────────────────────────────────────────────────────────

export async function renderHomeView() {
  const playlist = getImportedPlaylist();
  const history  = getWatchHistory();

  const heroItem = history.length > 0 ? history[0] : null;

  // Hungary kategórijú live csatornák
  const allLive   = playlist ? (playlist.liveChannels || playlist.channels || []) : [];
  const hungary   = allLive.filter(ch =>
    (ch.group || '').toLowerCase().includes('hungary')
  );
  const liveCards = sample(hungary.length > 0 ? hungary : allLive, Math.min(5, (hungary.length > 0 ? hungary : allLive).length));

  return `
    <section class="content-grid" data-search-scope>
      ${renderHero(heroItem)}
      ${renderHistorySection(history)}
      ${renderLiveNowSection(liveCards)}
      <div class="empty-state hidden" data-empty-search>Nincs találat erre a keresésre.</div>
    </section>
  `;
}

// ─── EPG hover bind (app.js hívja meg renderHomeView után) ───────────────────

export function bindLiveNowEpg() {
  const creds = loadXtreamCredentials();
  document.querySelectorAll('.live-now-card').forEach(card => {
    let loaded = false;
    card.addEventListener('mouseenter', async () => {
      if (loaded) return;
      loaded = true;
      const streamId = card.dataset.liveStreamId;
      const key      = card.dataset.liveKey;
      const overlay  = document.getElementById(`epg-overlay-${key}`);
      if (!overlay) return;
      if (!creds || !streamId) {
        overlay.querySelector('.live-now-epg-inner').textContent = 'EPG nem elérhető';
        return;
      }
      try {
        const rows = await fetchShortEpg(creds, streamId, 3);
        if (!rows.length) {
          overlay.querySelector('.live-now-epg-inner').innerHTML = '<em>Nincs EPG adat</em>';
          return;
        }
        overlay.querySelector('.live-now-epg-inner').innerHTML = `
          <div style="font-size:.72rem;font-weight:700;color:#f6c800;letter-spacing:.05em;margin-bottom:4px">MOST MEGY</div>
          <div style="font-weight:700;font-size:.85rem;line-height:1.3">${rows[0].title}</div>
          <div style="font-size:.75rem;color:#ccc;margin-top:2px">${rows[0].time}${rows[0].endTime ? ' – ' + rows[0].endTime : ''}</div>
          ${rows[1] ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.15);font-size:.75rem;color:#bbb">→ ${rows[1].title}<br><span style="color:#aaa">${rows[1].time}</span></div>` : ''}
        `;
      } catch {
        overlay.querySelector('.live-now-epg-inner').textContent = 'EPG hiba';
      }
    });
  });
}
