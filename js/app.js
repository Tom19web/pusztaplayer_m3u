/**
 * PusztaPlay — Főapp (lecsupaszított orchestrátor)
 *
 * Felelőssége:
 *  - shell renderelés
 *  - routing
 *  - globális keresés
 *  - event-bind hívások delegálása a komponensekbe
 */

import { getRoute, go }                            from './core/router.js';
import { renderSidebar }                           from './components/sidebar.js';
import { renderTopbar }                            from './components/topbar.js';
import { getUser }                                 from './store/selectors.js';
import { setCurrentPlayerItem, setView, setUser }  from './store/actions.js';
import { renderHomeView, renderHomeLoadingView, bindLiveNowEpg } from './views/home.js';
import { renderLiveView, renderLiveLoadingView }   from './views/live.js';
import { renderMoviesView, renderMoviesLoadingView } from './views/movies.js';
import { renderSeriesView, renderSeriesLoadingView } from './views/series.js';
import { renderFavoritesView }                     from './views/favorites.js';
import { renderPlayerView, renderPlayerLoadingView } from './views/player-view.js';
import { playerService }                           from './services/player.js';
import { xtreamGetVodInfo, xtreamGetSeriesInfo }   from './services/xtream-api.js';
import {
  xtreamLogin, initPlaylistFromCache, clearImportedPlaylist,
  loadXtreamCredentials, getImportedPlaylist
}                                                  from './services/playlist-import.js';

import { renderHeartBtn, bindFavoriteButtons, bindFavMovieCards, bindFavSeriesCards } from './components/favorites-bindings.js';
import { bindGroupFilter, bindMoviesFilter, bindSeriesFilter, bindLoadMore, bindMoviesLoadMore, bindSeriesLoadMore } from './components/filters.js';
import { mountPlayer, loadEpgIntoPanel, triggerFirstChannelEpg, bindPlayerVodMeta, bindPlayerLiveEpg } from './components/player-bindings.js';
import { openEpisodePanel }                        from './components/episode-panel.js';

export { renderHeartBtn };

const app = document.getElementById('app');
let searchTerm = '';

function navigateTo(view, params) {
  playerService.destroy();
  go(view, params);
}

function renderShell(activeView, content) {
  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(activeView)}
      <main class="main">
        ${renderTopbar(getUser())}
        ${content}
      </main>
    </div>
  `;
}

function getLoadingView(view) {
  return ({
    home:      renderHomeLoadingView(),
    live:      renderLiveLoadingView(),
    movies:    renderMoviesLoadingView(),
    series:    renderSeriesLoadingView(),
    favorites: '<section class="content-grid"><div class="status-banner"><strong>Betöltés...</strong> készülnek a kedvencek.</div></section>',
    player:    renderPlayerLoadingView()
  })[view] || renderHomeLoadingView();
}

async function getActiveView(view, playerKey) {
  switch (view) {
    case 'live':      return await renderLiveView();
    case 'movies':    return await renderMoviesView();
    case 'series':    return await renderSeriesView();
    case 'favorites': return await renderFavoritesView();
    case 'player':    return await renderPlayerView(playerKey);
    default:          return await renderHomeView();
  }
}

async function renderApp() {
  const route       = getRoute();
  const currentView = route.name || 'home';
  setView(currentView);
  const playerKey   = route.params.get('id') || 'royal';

  renderShell(currentView, getLoadingView(currentView));
  bindGlobalEvents();

  const content = await getActiveView(currentView, playerKey);

  renderShell(currentView, content);
  bindGlobalEvents();
  bindRouteEvents();
  bindLiveInteractions();

  bindLoadMore(bindLiveInteractions, bindRouteEvents, bindFavoriteButtons);
  bindMoviesLoadMore(bindMovieCards, bindRouteEvents, bindFavoriteButtons);
  bindSeriesLoadMore(bindSeriesDetailPanel, bindSeriesCards, bindRouteEvents, bindFavoriteButtons);
  bindGroupFilter(bindLiveInteractions, bindRouteEvents, bindFavoriteButtons);
  bindMoviesFilter(bindMovieCards, bindRouteEvents, bindFavoriteButtons);
  bindSeriesFilter(bindSeriesDetailPanel, bindSeriesCards, bindRouteEvents, bindFavoriteButtons);

  bindMovieCards();
  bindSeriesCards();
  bindSeriesDetailPanel();
  bindXtreamLogin();
  bindPlaylistClear();
  bindNextEpisode();
  bindFavoriteButtons();
  bindFavMovieCards(navigateTo, setCurrentPlayerItem);
  bindFavSeriesCards(openEpisodePanel, loadXtreamCredentials);
  bindPlayerVodMeta();
  bindPlayerLiveEpg();
  applySearch(searchTerm);

  if (currentView === 'player') await mountPlayer(playerKey, navigateTo);
  if (currentView === 'live')   triggerFirstChannelEpg();
  if (currentView === 'home')   bindLiveNowEpg();
}

/* ═══════════════════════════════════════════════════════════
   ROUTING
   ═══════════════════════════════════════════════════════════ */

function bindRouteEvents() {
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.route));
  });

  document.querySelectorAll('[data-open-player]:not([data-ep-url]):not([data-movie-key]):not([data-fav-movie-play])').forEach((btn, index) => {
    btn.setAttribute('tabindex', '0');
    btn.addEventListener('click', () => {
      setCurrentPlayerItem(btn.dataset.openPlayer);
      navigateTo('player', { id: btn.dataset.openPlayer });
    });
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn.click();
      const items = [...document.querySelectorAll('[data-open-player]')];
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') items[Math.min(index + 1, items.length - 1)]?.focus();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   items[Math.max(index - 1, 0)]?.focus();
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   LIVE INTERAKCIÓK
   ═══════════════════════════════════════════════════════════ */

function bindLiveInteractions() {
  const channelButtons = [...document.querySelectorAll('[data-channel-key]')];
  const zapButtons     = [...document.querySelectorAll('[data-zap-channel]')];
  const title  = document.getElementById('live-detail-title');
  const status = document.getElementById('live-detail-status');
  const group  = document.getElementById('live-detail-group');
  const play   = document.getElementById('live-detail-play');
  if (!channelButtons.length || !title) return;

  let epgTimer = null;

  const updatePanel = btn => {
    channelButtons.forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    title.textContent       = btn.dataset.channelTitle;
    status.textContent      = btn.dataset.channelStatus;
    group.textContent       = btn.dataset.channelGroup;
    play.dataset.openPlayer = btn.dataset.channelKey;
    clearTimeout(epgTimer);
    epgTimer = setTimeout(() => loadEpgIntoPanel(btn.dataset.channelStreamId || ''), 300);
  };

  channelButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => updatePanel(btn));
    btn.addEventListener('focus',      () => updatePanel(btn));
    btn.addEventListener('click',      () => updatePanel(btn));
  });

  zapButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = channelButtons.find(item => item.dataset.channelKey === btn.dataset.zapChannel);
      if (target) updatePanel(target);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   FILM DETAIL PANEL
   ═══════════════════════════════════════════════════════════ */

function bindMovieCards() {
  const panel   = document.getElementById('movie-detail-panel');
  if (!panel) return;
  const titleEl = document.getElementById('movie-detail-title');
  const groupEl = document.getElementById('movie-detail-group');
  const infoEl  = document.getElementById('movie-detail-info');
  const playBtn = document.getElementById('movie-detail-play');
  const creds   = loadXtreamCredentials();

  let vodInfoTimer = null;

  const updatePanel = (card) => {
    document.querySelectorAll('[data-movie-key]').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const key      = card.dataset.movieKey;
    const title    = card.dataset.movieTitle || '';
    const group    = card.dataset.movieGroup || '';
    const streamId = card.dataset.movieStreamId || '';

    if (titleEl) titleEl.textContent = title;
    if (groupEl) groupEl.textContent = group;
    if (playBtn) playBtn.dataset.openPlayer = key;
    if (infoEl)  infoEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:.85rem;margin-top:4px">⏳ Info betöltése...</div>';

    clearTimeout(vodInfoTimer);
    if (!creds || !streamId) { if (infoEl) infoEl.innerHTML = ''; return; }

    vodInfoTimer = setTimeout(async () => {
      try {
        const data   = await xtreamGetVodInfo(creds.username, creds.password, streamId);
        const info   = data.info || {};
        const year   = info.releasedate || info.year || '';
        const genre  = info.genre || '';
        const dir    = info.director || '';
        const cast   = info.cast || info.actors || '';
        const plot   = info.plot || info.description || '';
        const rating = info.rating || info.tmdb_rating || '';
        const cover  = info.cover_big || info.movie_image || '';

        if (titleEl && year) titleEl.textContent = `${title} (${year})`;
        if (infoEl) infoEl.innerHTML = `
          ${cover ? `<img src="${cover}" alt="" style="width:100%;border-radius:6px;margin-bottom:10px;object-fit:cover;max-height:140px" onerror="this.style.display='none'">` : ''}
          ${rating ? `<div style="margin-bottom:8px"><span class="pill">★ ${rating}</span></div>` : ''}
          <dl style="margin:0">
            ${genre ? `<div><dt>Műfaj</dt><dd>${genre}</dd></div>` : ''}
            ${dir   ? `<div><dt>Rendező</dt><dd>${dir}</dd></div>` : ''}
            ${cast  ? `<div><dt>Főszereplők</dt><dd style="max-width:20ch">${cast}</dd></div>` : ''}
          </dl>
          ${plot ? `<p style="font-size:.82rem;color:var(--color-text-muted);margin-top:10px;line-height:1.5;border-top:1px solid var(--color-border);padding-top:10px">${plot.slice(0, 220)}${plot.length > 220 ? '…' : ''}</p>` : ''}
        `;
      } catch {
        if (infoEl) infoEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:.82rem">Részletek nem elérhetők.</div>';
      }
    }, 350);
  };

  document.querySelectorAll('[data-movie-key]:not(.fav-card)').forEach(card => {
    card.addEventListener('mouseenter', () => updatePanel(card));
    card.addEventListener('focus',      () => updatePanel(card));
    card.addEventListener('click',      () => {
      updatePanel(card);
      setCurrentPlayerItem(card.dataset.movieKey);
      navigateTo('player', { id: card.dataset.movieKey });
    });
  });

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (playBtn.dataset.openPlayer) {
        setCurrentPlayerItem(playBtn.dataset.openPlayer);
        navigateTo('player', { id: playBtn.dataset.openPlayer });
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   SOROZAT DETAIL PANEL
   ═══════════════════════════════════════════════════════════ */

function bindSeriesDetailPanel() {
  const panel   = document.getElementById('series-detail-panel');
  if (!panel) return;
  const titleEl = document.getElementById('series-detail-title');
  const groupEl = document.getElementById('series-detail-group');
  const infoEl  = document.getElementById('series-detail-info');
  const openBtn = document.getElementById('series-detail-open');
  const creds   = loadXtreamCredentials();

  let infoTimer = null;

  const updatePanel = (card) => {
    document.querySelectorAll('[data-open-series]').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const seriesId = card.dataset.openSeries;
    const title    = card.dataset.seriesTitle || '';
    const group    = card.dataset.seriesGroup || '';

    if (titleEl) titleEl.textContent = title;
    if (groupEl) groupEl.textContent = group;
    if (openBtn) { openBtn.dataset.openSeries = seriesId; openBtn.dataset.seriesTitle = title; }
    if (infoEl)  infoEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:.85rem;margin-top:4px">⏳ Info betöltése...</div>';

    clearTimeout(infoTimer);
    if (!creds || !seriesId) { if (infoEl) infoEl.innerHTML = ''; return; }

    infoTimer = setTimeout(async () => {
      try {
        const data        = await xtreamGetSeriesInfo(creds.username, creds.password, seriesId);
        const info        = data.info || {};
        const episodes    = data.episodes || {};
        const seasonCount = Object.keys(episodes).length;
        const year    = info.releaseDate || info.year || '';
        const genre   = info.genre || '';
        const dir     = info.director || '';
        const cast    = info.cast || '';
        const plot    = info.plot || '';
        const rating  = info.rating || '';
        const cover   = info.cover || info.backdrop_path?.[0] || '';

        if (titleEl && year) titleEl.textContent = `${title} (${year})`;
        if (infoEl) infoEl.innerHTML = `
          ${cover ? `<img src="${cover}" alt="" style="width:100%;border-radius:6px;margin-bottom:10px;object-fit:cover;max-height:140px" onerror="this.style.display='none'">` : ''}
          ${rating ? `<div style="margin-bottom:8px"><span class="pill">★ ${rating}</span></div>` : ''}
          <dl style="margin:0">
            ${genre       ? `<div><dt>Műfaj</dt><dd>${genre}</dd></div>` : ''}
            ${dir         ? `<div><dt>Rendező</dt><dd>${dir}</dd></div>` : ''}
            ${cast        ? `<div><dt>Főszereplők</dt><dd style="max-width:20ch">${cast}</dd></div>` : ''}
            ${seasonCount ? `<div><dt>Megjelent évadok</dt><dd>${seasonCount}</dd></div>` : ''}
          </dl>
          ${plot ? `<p style="font-size:.82rem;color:var(--color-text-muted);margin-top:10px;line-height:1.5;border-top:1px solid var(--color-border);padding-top:10px">${plot.slice(0, 220)}${plot.length > 220 ? '…' : ''}</p>` : ''}
        `;
      } catch {
        if (infoEl) infoEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:.82rem">Részletek nem elérhetők.</div>';
      }
    }, 350);
  };

  document.querySelectorAll('[data-open-series]:not(.fav-card)').forEach(card => {
    card.addEventListener('mouseenter', () => updatePanel(card));
    card.addEventListener('focus',      () => updatePanel(card));
  });
}

/* ═══════════════════════════════════════════════════════════
   SOROZAT EPIZÓD PANEL (kattintásra)
   ═══════════════════════════════════════════════════════════ */

function bindSeriesCards() {
  const panel = document.getElementById('series-episode-panel');
  if (!panel) return;
  const creds = loadXtreamCredentials();
  if (!creds) return;

  const openBtn = document.getElementById('series-detail-open');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const seriesId = openBtn.dataset.openSeries;
      const title    = openBtn.dataset.seriesTitle || 'Sorozat';
      if (seriesId) openEpisodePanel(panel, creds, seriesId, title);
    });
  }

  document.querySelectorAll('[data-open-series]:not(.fav-card)').forEach(card => {
    card.addEventListener('click', () => {
      const seriesId = card.dataset.openSeries;
      const title    = card.dataset.seriesTitle || 'Sorozat';
      openEpisodePanel(panel, creds, seriesId, title);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   NEXT EPISODE
   ═══════════════════════════════════════════════════════════ */

function bindNextEpisode() {
  document.querySelectorAll('.next-ep-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key       = btn.dataset.epKey;
      const url       = btn.dataset.epUrl;
      const title     = btn.dataset.epTitle;
      const seriesId  = btn.dataset.epSeriesId;
      const seasonNum = btn.dataset.epSeason;
      if (!key || !url) return;
      const playlist = getImportedPlaylist();
      if (playlist) {
        if (!(playlist.series || []).find(s => s.key === key)) {
          playlist.series = playlist.series || [];
          playlist.series.push({ key, title, streamUrl: url, type: 'series',
            seriesId: seriesId || null, seasonNum: seasonNum || null, group: '' });
        }
      }
      setCurrentPlayerItem(key);
      navigateTo('player', { id: key });
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   XTREAM LOGIN / PLAYLIST CLEAR
   ═══════════════════════════════════════════════════════════ */

function bindXtreamLogin() {
  const loginBtn  = document.getElementById('xtream-login-btn');
  const logoutBtn = document.getElementById('xtream-logout-btn');
  const statusEl  = document.getElementById('xtream-login-status');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('xtream-username')?.value.trim();
      const password = document.getElementById('xtream-password')?.value.trim();
      if (!username || !password) { statusEl.textContent = 'Add meg a felhasználónevet és jelszót.'; return; }
      loginBtn.disabled    = true;
      loginBtn.textContent = '⏳ Betöltés...';
      statusEl.textContent = 'Csatlakozás...';
      try {
        const playlist = await xtreamLogin(username, password);
        setUser(username, 'Xtream bejelentkezve');
        statusEl.textContent = `✓ ${playlist.liveChannels?.length ?? 0} élő · ${playlist.movies?.length ?? 0} film · ${playlist.series?.length ?? 0} sorozat betöltve.`;
        setTimeout(() => { navigateTo('live'); renderApp(); }, 600);
      } catch (err) {
        loginBtn.disabled    = false;
        loginBtn.textContent = '▶ Bejelentkezés';
        statusEl.textContent = '⚠ ' + err.message;
      }
    });
    document.getElementById('xtream-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') loginBtn.click();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      playerService.destroy();
      clearImportedPlaylist();
      setUser('PusztaPlay fiók', 'nincs aktív session');
      navigateTo('home');
      renderApp();
    });
  }
}

function bindPlaylistClear() {
  const clearBtn = document.getElementById('playlist-clear-btn');
  if (!clearBtn) return;
  clearBtn.addEventListener('click', () => { clearImportedPlaylist(); renderApp(); });
}

/* ═══════════════════════════════════════════════════════════
   GLOBÁLIS KERESÉS
   ═══════════════════════════════════════════════════════════ */

function bindGlobalEvents() {
  const input = document.getElementById('global-search');
  if (!input) return;
  input.value = searchTerm;
  input.addEventListener('input', e => {
    searchTerm = e.target.value.trim().toLowerCase();
    applySearch(searchTerm);
  });
}

function applySearch(term) {
  const scope = document.querySelector('[data-search-scope]');
  if (!scope) return;
  const items = [...scope.querySelectorAll('[data-open-player],[data-open-series],[data-movie-key]')];
  const empty = scope.querySelector('[data-empty-search]');
  let visible = 0;
  items.forEach(item => {
    const show = !term || item.textContent.toLowerCase().includes(term);
    (item.closest('.card') || item).classList.toggle('hidden', !show);
    if (show) visible++;
  });
  if (empty) empty.classList.toggle('hidden', visible !== 0);
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */

window.addEventListener('hashchange', () => { playerService.destroy(); renderApp(); });
window.addEventListener('DOMContentLoaded', () => {
  initPlaylistFromCache();
  if (!window.location.hash) navigateTo('home');
  renderApp();
});
