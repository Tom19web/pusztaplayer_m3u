import { getFavoritesByType, toggleFavorite, isFavorite } from '../store/actions.js';

/* ═══════════════════════════════════════════════════
   KÁRTYA RENDEREK
   ═══════════════════════════════════════════════════ */

function heartBtn(key, active) {
  return `<button
    class="fav-heart${active ? ' fav-heart--active' : ''}"
    data-fav-toggle="${key}"
    title="${active ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
    aria-label="${active ? 'Eltávolítás' : 'Hozzáadás'}"
    aria-pressed="${active}">${active ? '♥' : '♡'}</button>`;
}

function favChannelCard(item) {
  const bg = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat #111`
    : 'background:linear-gradient(145deg,#22c6d6,#1a1a1a)';
  return `
    <article class="card fav-card"
      data-fav-key="${item.key}"
      data-open-player="${item.key}"
      data-channel-key="${item.key}"
      tabindex="0">
      <div class="thumb fav-thumb" style="aspect-ratio:16/9;${bg}">
        ${item.logo ? `<img src="${item.logo}" alt="" style="width:100%;height:100%;object-fit:contain;padding:10px" loading="lazy" onerror="this.style.display='none'">` : ''}
        ${heartBtn(item.key, true)}
      </div>
      <div class="meta">
        <strong>${item.title}</strong>
        <small>${item.group || 'Élő TV'}</small>
      </div>
    </article>`;
}

function favMediaCard(item) {
  const bg = item.logo
    ? `background:url('${item.logo}') center/cover no-repeat #111`
    : item.type === 'movie'
      ? 'background:linear-gradient(145deg,#1fd6e8,#ff5b63 55%,#1a1a1a)'
      : 'background:linear-gradient(145deg,#f6c800,#ff5b63 55%,#1a1a1a)';

  const dataAttr = item.type === 'series'
    ? `data-open-series="${item.seriesId || item.key}"
       data-series-title="${(item.title || '').replace(/"/g, '&quot;')}"
       data-series-key="${item.key}"
       data-series-logo="${(item.logo || '').replace(/"/g, '&quot;')}"
       data-series-group="${(item.group || '').replace(/"/g, '&quot;')}"`
    : `data-open-player="${item.key}"
       data-fav-movie-play="${item.key}"
       data-movie-key="${item.key}"
       data-movie-title="${(item.title || '').replace(/"/g, '&quot;')}"
       data-movie-group="${(item.group || '').replace(/"/g, '&quot;')}"
       data-movie-stream-id="${item.streamId || ''}"
       data-movie-logo="${(item.logo || '').replace(/"/g, '&quot;')}"` ;

  return `
    <article class="card fav-card fav-card--media" data-fav-key="${item.key}" ${dataAttr} tabindex="0">
      <div class="thumb fav-media-thumb" style="${bg}">
        ${!item.logo ? `<span style="font-family:Bangers,cursive;font-size:1.4rem;color:#fff;text-shadow:2px 2px 0 #000">${item.title.replace(/ /g,'<br>')}</span>` : ''}
        ${heartBtn(item.key, true)}
      </div>
      <div class="meta">
        <strong>${item.title}</strong>
        <small>${item.group || ''}</small>
      </div>
    </article>`;
}

function emptySection(label) {
  return `<div class="fav-empty">
    <span class="fav-empty-icon">🤍</span>
    <p>Még nincs kedvenc ${label}.<br><span style="font-size:.82rem;color:#888">A ♥ gombra kattintva adhatsz hozzá.</span></p>
  </div>`;
}

/* ═══════════════════════════════════════════════════
   FŐ VIEW
   ═══════════════════════════════════════════════════ */
export async function renderFavoritesView() {
  const live    = getFavoritesByType('live');
  const movies  = getFavoritesByType('movie');
  const series  = getFavoritesByType('series');
  const total   = live.length + movies.length + series.length;

  return `
    <section class="content-grid" data-search-scope>
      <div class="section-head">
        <div class="headline">Kedvencek</div>
        <span class="pill">${total} összesen</span>
      </div>

      <!-- LIVE TV -->
      <div class="fav-section">
        <div class="fav-section-head">
          <span class="fav-section-icon">📡</span>
          <h2 class="fav-section-title">Élő TV</h2>
          <span class="pill">${live.length}</span>
        </div>
        ${live.length
          ? `<div class="fav-grid fav-grid--live">${live.map(favChannelCard).join('')}</div>`
          : emptySection('élő csatorna')}
      </div>

      <!-- FILMEK -->
      <div class="fav-section">
        <div class="fav-section-head">
          <span class="fav-section-icon">🎬</span>
          <h2 class="fav-section-title">Filmek</h2>
          <span class="pill">${movies.length}</span>
        </div>
        ${movies.length
          ? `<div class="fav-grid fav-grid--media">${movies.map(favMediaCard).join('')}</div>`
          : emptySection('film')}
      </div>

      <!-- SOROZATOK -->
      <div class="fav-section">
        <div class="fav-section-head">
          <span class="fav-section-icon">📺</span>
          <h2 class="fav-section-title">Sorozatok</h2>
          <span class="pill">${series.length}</span>
        </div>
        ${series.length
          ? `<div class="fav-grid fav-grid--media">${series.map(favMediaCard).join('')}</div>`
          : emptySection('sorozat')}
      </div>

      <!-- Epizód panel (sorozatokhoz, kedvencek nézetben) -->
      <div id="series-episode-panel" style="display:none"></div>

    </section>`;
}
