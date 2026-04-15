/**
 * PusztaPlay — Főapp
 */

import { getRoute, go }                            from './core/router.js';
import { renderSidebar }                           from './components/sidebar.js';
import { renderTopbar }                            from './components/topbar.js';
import { getUser, getWatchHistory }               from './store/selectors.js';
import { setCurrentPlayerItem, setView, setUser, addToHistory, toggleFavorite, isFavorite } from './store/actions.js';
import { renderHomeView, renderHomeLoadingView, bindLiveNowEpg } from './views/home.js';
import { renderLiveView, renderLiveLoadingView, getAllLiveChannels, renderChannelPage } from './views/live.js';
import { renderMoviesView, renderMoviesLoadingView, getAllMovies, renderMoviePage } from './views/movies.js';
import { renderSeriesView, renderSeriesLoadingView, getAllSeries, renderSeriesPage } from './views/series.js';
import { renderFavoritesView }                     from './views/favorites.js';
import { renderPlayerView, renderPlayerLoadingView } from './views/player-view.js';
import { createPlaybackSession }                   from './services/playback-session.js';
import { playerService }                           from './services/player.js';
import { xtreamGetSeriesInfo, xtreamGetVodInfo, buildEpisodeUrl } from './services/xtream-api.js';
import { fetchShortEpg }                           from './services/epg-service.js';
import {
  xtreamLogin,
  initPlaylistFromCache,
  clearImportedPlaylist,
  getImportedPlaylist,
  loadXtreamCredentials
} from './services/playlist-import.js';

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
  bindLoadMore();
  bindMoviesLoadMore();
  bindSeriesLoadMore();
  bindGroupFilter();
  bindMoviesFilter();
  bindSeriesFilter();
  bindMovieCards();
  bindSeriesCards();
  bindSeriesDetailPanel();
  bindXtreamLogin();
  bindPlaylistClear();
  bindNextEpisode();
  bindFavoriteButtons();   // szívgombok minden nézetben
  bindFavMovieCards();     // kedvencek: film-kártya kattintás
  bindFavSeriesCards();    // kedvencek: sorozat-kártya kattintás
  bindPlayerVodMeta();     // player alatt VOD/sorozat meta Xtream infóból
  bindPlayerLiveEpg();     // ÚJ: Live TV EPG „Most / Következik”
  applySearch(searchTerm);

  if (currentView === 'player') await mountPlayer(playerKey);
  if (currentView === 'live')   triggerFirstChannelEpg();
  if (currentView === 'home')   bindLiveNowEpg();  // hover EPG a kezdőlapon
}

/* ═══════════════════════════════════════════════════════════
   FAVORITES — szívgombok és kedvencek nézet interakciók
   ═══════════════════════════════════════════════════════════ */

export function renderHeartBtn(key) {
  const active = isFavorite(key);
  return `<button
    class="fav-heart${active ? ' fav-heart--active' : ''}"
    data-fav-toggle="${key}"
    title="${active ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
    aria-label="${active ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
    aria-pressed="${active}">${active ? '♥' : '♡'}</button>`;
}

function bindFavoriteButtons() {
  document.querySelectorAll('[data-fav-toggle]').forEach(btn => {
    if (btn._favBound) return;
    btn._favBound = true;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key  = btn.dataset.favToggle;
      if (!key) return;

      const card = btn.closest('[data-fav-key],[data-channel-key],[data-movie-key],[data-open-series],[data-series-key]');

      let type  = 'movie';
      let title = key;
      let group = '';
      let logo  = '';
      let streamUrl = '';
      let seriesId  = '';
      let streamId  = '';

      if (card) {
        if (card.dataset.channelKey) {
          type      = 'live';
          title     = card.dataset.channelTitle  || key;
          group     = card.dataset.channelGroup  || '';
          logo      = card.dataset.channelLogo   || '';
          streamId  = card.dataset.channelStreamId || '';
        } else if (card.dataset.movieKey) {
          type      = 'movie';
          title     = card.dataset.movieTitle  || key;
          group     = card.dataset.movieGroup  || '';
          logo      = card.dataset.movieLogo   || '';
          streamId  = card.dataset.movieStreamId || '';
        } else if (card.dataset.openSeries || card.dataset.seriesKey) {
          type      = 'series';
          title     = card.dataset.seriesTitle || key;
          group     = card.dataset.seriesGroup || '';
          logo      = card.dataset.seriesLogo  || '';
          seriesId  = card.dataset.openSeries  || key;
        } else if (card.dataset.favKey) {
          // már ismert elem; csak toggle
        }
      }

      const playlist = getImportedPlaylist();
      if (playlist) {
        if (type === 'live') {
          const ch = (playlist.liveChannels || playlist.channels || []).find(c => c.key === key);
          if (ch) { logo = ch.logo || logo; streamId = ch.streamId || streamId; }
        } else if (type === 'movie') {
          const mv = (playlist.movies || []).find(m => m.key === key);
          if (mv) { logo = mv.logo || logo; streamUrl = mv.streamUrl || streamUrl; streamId = mv.streamId || streamId; }
        } else if (type === 'series') {
          const sr = (playlist.series || []).find(s => s.key === key || s.seriesId === seriesId);
          if (sr) { logo = sr.logo || logo; seriesId = sr.seriesId || seriesId; }
        }
      }

      const added = toggleFavorite({ key, title, type, group, logo, streamUrl, seriesId, streamId });

      btn.classList.toggle('fav-heart--active', added);
      btn.textContent         = added ? '♥' : '♡';
      btn.title               = added ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez';
      btn.setAttribute('aria-pressed', String(added));
      btn.setAttribute('aria-label',   added ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez');

      if (!added) {
        const favCard = btn.closest('.fav-card');
        if (favCard) {
          favCard.style.transition = 'opacity .25s,transform .25s';
          favCard.style.opacity    = '0';
          favCard.style.transform  = 'scale(.9)';
          setTimeout(() => favCard.remove(), 260);
        }
      }
    });
  });
}

/* ── Kedvencek: film-kártya közvetlen lejátszás ── */
function bindFavMovieCards() {
  document.querySelectorAll('[data-fav-movie-play]').forEach(card => {
    if (card._favMovieBound) return;
    card._favMovieBound = true;
    const play = () => {
      const key = card.dataset.favMoviePlay || card.dataset.movieKey;
      if (!key) return;
      setCurrentPlayerItem(key);
      navigateTo('player', { id: key });
    };
    card.addEventListener('click', e => {
      // ha szívgombot nyomtak, azt a bindFavoriteButtons kezeli
      if (e.target.closest('[data-fav-toggle]')) return;
      play();
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
    });
  });
}

/* ── Kedvencek: sorozat-kártya — epizód panel megnyitása ── */
function bindFavSeriesCards() {
  const panel = document.getElementById('series-episode-panel');
  if (!panel) return;
  const creds = loadXtreamCredentials();
  if (!creds) return;

  document.querySelectorAll('.fav-card[data-open-series]').forEach(card => {
    if (card._favSeriesBound) return;
    card._favSeriesBound = true;
    card.addEventListener('click', e => {
      if (e.target.closest('[data-fav-toggle]')) return;
      const seriesId = card.dataset.openSeries;
      const title    = card.dataset.seriesTitle || 'Sorozat';
      if (seriesId) openEpisodePanel(panel, creds, seriesId, title);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (e.target.closest('[data-fav-toggle]')) return;
        const seriesId = card.dataset.openSeries;
        const title    = card.dataset.seriesTitle || 'Sorozat';
        if (seriesId) openEpisodePanel(panel, creds, seriesId, title);
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   PLAYER mount
   ═══════════════════════════════════════════════════════════ */
async function mountPlayer(key) {
  const video       = document.getElementById('main-video');
  const status      = document.getElementById('player-status');
  const progressBar = document.querySelector('.progress > div');
  const buttons     = [...document.querySelectorAll('.control-btn')];
  if (!video) return;

  const history     = typeof getWatchHistory === 'function' ? getWatchHistory() : [];
  const historyItem = history.find(h => h.key === key);
  let resumeFrom    = 0;
  let lastSavedProgress = 0;

  status.innerHTML = '<strong>Betöltés...</strong> Stream inicializálása.';
  playerService.init(video);

  try {
    const session = await createPlaybackSession(key);

    if (!session.isLive && historyItem &&
        Number.isFinite(historyItem.position) &&
        Number.isFinite(historyItem.duration) &&
        historyItem.duration > 0 &&
        historyItem.position > 5 &&
        historyItem.position < historyItem.duration - 5) {
      resumeFrom = historyItem.position;
    }

    await playerService.load(session);

    if (resumeFrom > 0) {
      playerService.seek(resumeFrom);
    }

    status.innerHTML = '<strong>Lejátszás kész.</strong> A stream sikeresen elindult.';

    const playlist = getImportedPlaylist();
    let histMeta = null;
    if (playlist) {
      const allCh = playlist.liveChannels || playlist.channels || [];
      histMeta = allCh.find(c => c.key === key)
        || (playlist.movies  || []).find(c => c.key === key)
        || (playlist.series  || []).find(c => c.key === key)
        || null;
    }
    addToHistory({
      key, title: histMeta?.title || session.title || key,
      type: histMeta?.type || (session.isLive ? 'live' : 'movie'),
      group: histMeta?.group || '', logo: histMeta?.logo || '',
      streamUrl: session.streamUrl || ''
    });

    playerService.onProgress(({ current, duration, ratio }) => {
      if (progressBar) {
        const clamped = Math.max(0, Math.min(100, ratio));
        progressBar.style.width = `${clamped}%`;
      }

      if (!session.isLive && duration && Number.isFinite(duration)) {
        const delta = Math.abs(current - lastSavedProgress);
        if (current >= 5 && delta >= 15) {
          lastSavedProgress = current;
          addToHistory({
            key,
            title: histMeta?.title || session.title || key,
            type: histMeta?.type || (session.isLive ? 'live' : 'movie'),
            group: histMeta?.group || '',
            logo: histMeta?.logo || '',
            streamUrl: session.streamUrl || '',
            position: current,
            duration
          });
        }
      }
    });
  } catch (error) {
    status.classList.add('error');
    status.innerHTML = `<strong>Stream hiba.</strong> ${error.message}`;
  }

  buttons.forEach(btn => {
    const label = btn.textContent.trim();
    if (label.includes('Lejátszás'))  btn.addEventListener('click', () => playerService.play());
    if (label.includes('Hang'))       btn.addEventListener('click', () => playerService.setVolume(video.volume > 0 ? 0 : 1));
    if (label.includes('Fullscreen')) btn.addEventListener('click', () => video.requestFullscreen?.());
  });
}

async function loadEpgIntoPanel(streamId) {
  const epgEl = document.getElementById('live-detail-epg');
  if (!epgEl) return;
  const creds = loadXtreamCredentials();
  if (!creds || !streamId) {
    epgEl.innerHTML = '<div class="muted" style="margin-top:12px">EPG nem elérhető – Xtream bejelentkezés szükséges.</div>';
    return;
  }
  epgEl.innerHTML = '<div class="epg-loading" style="color:var(--color-text-muted);font-size:.85rem;margin-top:12px">⏳ EPG betöltése...</div>';
  const rows = await fetchShortEpg(creds, streamId, 5);
  if (!rows.length) {
    epgEl.innerHTML = '<div class="muted" style="margin-top:12px">Ehhez a csatórnához most nincs EPG adat.</div>';
    return;
  }
  epgEl.innerHTML = `
    <div class="epg-now" style="background:var(--color-primary-highlight);border-left:3px solid var(--color-primary);padding:8px 10px;border-radius:0 6px 6px 0;margin:10px 0 6px;">
      <span style="font-size:.72rem;color:var(--color-primary);font-weight:700;letter-spacing:.05em">MOST MEGY</span><br>
      <strong style="font-size:.95rem">${rows[0].title}</strong>
      <div style="font-size:.8rem;color:var(--color-text-muted);margin-top:2px">${rows[0].time}${rows[0].endTime ? ' – ' + rows[0].endTime : ''}</div>
      ${rows[0].description ? `<div style="font-size:.8rem;color:var(--color-text-muted);margin-top:4px;max-width:32ch">${rows[0].description.slice(0,120)}${rows[0].description.length>120?'…':''}</div>` : ''}
    </div>
    <div class="epg-grid">
      ${rows.slice(1).map(r => `
        <div class="epg-row">
          <div class="epg-time">${r.time}${r.endTime ? ' – '+r.endTime : ''}</div>
          <div class="epg-show">${r.title}</div>
        </div>`).join('')}
    </div>
  `;
}

function triggerFirstChannelEpg() {
  const firstBtn = document.querySelector('[data-channel-key]');
  if (!firstBtn) return;
  loadEpgIntoPanel(firstBtn.dataset.channelStreamId || '');
}

/* ── Film kattintás – detail panel frissítése ── */
function bindMovieCards() {
  const panel      = document.getElementById('movie-detail-panel');
  if (!panel) return;
  const titleEl    = document.getElementById('movie-detail-title');
  const groupEl    = document.getElementById('movie-detail-group');
  const infoEl     = document.getElementById('movie-detail-info');
  const playBtn    = document.getElementById('movie-detail-play');
  const creds      = loadXtreamCredentials();

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
    if (playBtn) { playBtn.dataset.openPlayer = key; }
    if (infoEl)  infoEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:.85rem;margin-top:4px">⏳ Info betöltése...</div>';

    clearTimeout(vodInfoTimer);
    if (!creds || !streamId) {
      if (infoEl) infoEl.innerHTML = '';
      return;
    }
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
          ${plot ? `<p style="font-size:.82rem;color:var(--color-text-muted);margin-top:10px;line-height:1.5;border-top:1px solid var(--color-border);padding-top:10px">${plot.slice(0,220)}${plot.length>220?'…':''}</p>` : ''}
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

/* ── Sorozat kattintás – detail panel frissítése ── */
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
    if (openBtn) {
      openBtn.dataset.openSeries   = seriesId;
      openBtn.dataset.seriesTitle  = title;
    }
    if (infoEl) infoEl.innerHTML = '<div style="color:var(--color-text-muted);font-size:.85rem;margin-top:4px">⏳ Info betöltése...</div>';

    clearTimeout(infoTimer);
    if (!creds || !seriesId) { if (infoEl) infoEl.innerHTML = ''; return; }

    infoTimer = setTimeout(async () => {
      try {
        const data     = await xtreamGetSeriesInfo(creds.username, creds.password, seriesId);
        const info     = data.info || {};
        const seasons  = data.seasons || [];
        const episodes = data.episodes || {};
        const seasonCount = Object.keys(episodes).length;
        const year     = info.releaseDate || info.year || '';
        const genre    = info.genre || '';
        const dir      = info.director || '';
        const cast     = info.cast || '';
        const plot     = info.plot || '';
        const rating   = info.rating || '';
        const cover    = info.cover || info.backdrop_path?.[0] || '';

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
          ${plot ? `<p style="font-size:.82rem;color:var(--color-text-muted);margin-top:10px;line-height:1.5;border-top:1px solid var(--color-border);padding-top:10px">${plot.slice(0,220)}${plot.length>220?'…':''}</p>` : ''}
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

/* ── Sorozat epizód panel (kattintásra nyílik) ── */
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
   openEpisodePanel — branded hero stílusú sorozat panel
   ═══════════════════════════════════════════════════════════ */
async function openEpisodePanel(panel, creds, seriesId, title) {
  panel.style.display = 'block';
  panel.className = 'series-ep-panel';
  panel.innerHTML = `
    <div class="sep-hero sep-hero--loading">
      <div class="sep-hero-copy">
        <div class="headline" style="font-size:1.4rem">⏳ Betöltés…</div>
        <p class="sep-hero-subtitle">${title} epizódjai töltődnek be.</p>
      </div>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const info      = await xtreamGetSeriesInfo(creds.username, creds.password, seriesId);
    const seasons   = info.seasons   || [];
    const episodes  = info.episodes  || {};
    const seasonKeys = Object.keys(episodes).sort((a, b) => Number(a) - Number(b));

    if (!seasonKeys.length) {
      panel.innerHTML = `
        <div class="sep-hero">
          <div class="sep-hero-copy">
            <div class="headline" style="font-size:1.4rem">Nincs epizód</div>
            <p class="sep-hero-subtitle">Ehhez a sorozathoz nem találtunk évad/epizód adatot.</p>
          </div>
        </div>`;
      return;
    }

    const cover  = info.info?.cover || info.info?.backdrop_path?.[0] || '';
    const back   = info.info?.backdrop_path?.[0] || cover || '';
    const plot   = info.info?.plot  || '';
    const cast   = info.info?.cast  || '';
    const rating = info.info?.rating || '';
    const genre  = info.info?.genre  || '';
    const year   = info.info?.releaseDate || info.info?.year || '';
    const totalEps = seasonKeys.reduce((acc, k) => acc + (episodes[k]?.length || 0), 0);

    panel.innerHTML = `
      <!-- ── HERO FEJLÉC ── -->
      <div class="sep-hero${back ? ' sep-hero--has-backdrop' : ''}" ${back ? `style="--sep-backdrop:url('${back}')"` : ''}>
        ${cover ? `
          <div class="sep-poster-art">
            <img src="${cover}" alt="${title}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>` : ''}
        <div class="sep-hero-copy">
          <div class="headline" style="font-size:clamp(1.4rem,3vw,2.4rem);margin-bottom:10px">${title}</div>
          <div class="sep-hero-meta-row">
            ${rating ? `<span class="pill">★ ${rating}</span>` : ''}
            ${year   ? `<span class="sep-meta-tag">${year}</span>` : ''}
            ${genre  ? `<span class="sep-meta-tag">${genre}</span>` : ''}
            <span class="sep-meta-tag">${seasonKeys.length} évad · ${totalEps} epizód</span>
          </div>
          ${plot ? `<p class="sep-hero-subtitle">${plot.slice(0,200)}${plot.length>200?'…':''}</p>` : ''}
          ${cast ? `<p class="sep-cast"><strong>Szereplők:</strong> ${cast.slice(0,120)}${cast.length>120?'…':''}</p>` : ''}
        </div>
        <button class="sep-close-btn btn" id="sep-close-btn" title="Panel bezárása" aria-label="Panel bezárása">✕</button>
      </div>

      <!-- ── ÉVADOK / EPIZÓDOK ── -->
      <div class="sep-seasons">
        ${seasonKeys.map((seasonNum, si) => {
          const eps = episodes[seasonNum] || [];
          const seasonLabel = seasons.find(s => String(s.season_number) === seasonNum)?.name
            || `${seasonNum}. évad`;
          return `
            <div class="sep-season-block">
              <button class="sep-season-toggle${si === 0 ? ' open' : ''}" data-season-toggle="${si}">
                <span class="sep-season-label">${seasonLabel}</span>
                <span class="sep-season-count">${eps.length} epizód</span>
                <span class="sep-season-arrow">${si === 0 ? '▲' : '▼'}</span>
              </button>
              <div class="sep-episode-grid${si === 0 ? '' : ' hidden'}" id="sep-season-${si}">
                ${eps.map(ep => {
                  const epKey   = `ep_${ep.id}`;
                  const epTitle = ep.title || `${ep.episode_num}. epizód`;
                  const epThumb = ep.info?.movie_image || ep.info?.cover_big || '';
                  const ext     = ep.container_extension || 'mkv';
                  const streamUrl = buildEpisodeUrl(creds.username, creds.password, ep.id, ext);
                  const duration  = ep.info?.duration || '';
                  const epNum    = `S${String(seasonNum).padStart(2,'0')}·E${String(ep.episode_num).padStart(2,'0')}`;
                  return `
                    <article class="sep-ep-card"
                      data-open-player="${epKey}"
                      data-ep-url="${streamUrl}"
                      data-ep-title="${epTitle.replace(/"/g,'&quot;')}"
                      data-ep-type="series"
                      data-ep-series-id="${seriesId}"
                      data-ep-season="${seasonNum}"
                      tabindex="0"
                      title="${epTitle}">
                      <div class="sep-ep-thumb" style="${epThumb ? `background:url('${epThumb}') center/cover no-repeat` : 'background:linear-gradient(145deg,#f6c800,#1a1a1a)'}">
                        ${!epThumb ? `<span class="sep-ep-thumb-title">${epTitle}</span>` : ''}
                        <span class="sep-ep-badge">${epNum}</span>
                        <div class="sep-ep-play-overlay"><span class="sep-ep-play-icon">▶</span></div>
                      </div>
                      <div class="sep-ep-meta">
                        <strong class="sep-ep-title">${epTitle}</strong>
                        ${duration ? `<span class="sep-ep-duration">${duration} perc</span>` : ''}
                      </div>
                    </article>`;
                }).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>`;

    /* Bezárás gomb */
    panel.querySelector('#sep-close-btn')?.addEventListener('click', () => {
      panel.style.display = 'none';
      panel.innerHTML = '';
    });

    /* Évad toggle */
    panel.querySelectorAll('[data-season-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.seasonToggle;
        const grid = panel.querySelector(`#sep-season-${idx}`);
        const isOpen = btn.classList.contains('open');
        btn.classList.toggle('open', !isOpen);
        grid?.classList.toggle('hidden', isOpen);
        btn.querySelector('.sep-season-arrow').textContent = isOpen ? '▼' : '▲';
      });
    });

    /* Epizód kattintás */
    panel.querySelectorAll('[data-open-player][data-ep-url]').forEach(epCard => {
      const play = () => {
        const key      = epCard.dataset.openPlayer;
        const url      = epCard.dataset.epUrl;
        const epTitle  = epCard.dataset.epTitle;
        const epSeason = epCard.dataset.epSeason;
        const playlist = getImportedPlaylist();
        if (playlist && !(playlist.series || []).find(s => s.key === key)) {
          playlist.series = playlist.series || [];
          playlist.series.push({ key, title: epTitle, streamUrl: url, type: 'series', seriesId, seasonNum: epSeason, group: '' });
        }
        setCurrentPlayerItem(key);
        navigateTo('player', { id: key });
      };
      epCard.addEventListener('click', play);
      epCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
    });

  } catch (err) {
    panel.innerHTML = `
      <div class="sep-hero">
        <div class="sep-hero-copy">
          <div class="headline" style="font-size:1.4rem;color:#ff6b74">Hiba</div>
          <p class="sep-hero-subtitle">${err.message}</p>
        </div>
        <button class="sep-close-btn btn" id="sep-close-btn" aria-label="Bezárás">✕</button>
      </div>`;
    panel.querySelector('#sep-close-btn')?.addEventListener('click', () => {
      panel.style.display = 'none'; panel.innerHTML = '';
    });
  }
}

function bindXtreamLogin() {
  const loginBtn  = document.getElementById('xtream-login-btn');
  const logoutBtn = document.getElementById('xtream-logout-btn');
  const statusEl  = document.getElementById('xtream-login-status');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('xtream-username')?.value.trim();
      const password = document.getElementById('xtream-password')?.value.trim();
      if (!username || !password) { statusEl.textContent = 'Add meg a felhasználónevet és jelszót.'; return; }
      loginBtn.disabled = true; loginBtn.textContent = '⏳ Betöltés...'; statusEl.textContent = 'Csatlakozás...';
      try {
        const playlist = await xtreamLogin(username, password);
        setUser(username, 'Xtream bejelentkezve');
        statusEl.textContent = `✓ ${playlist.liveChannels?.length??0} élő · ${playlist.movies?.length??0} film · ${playlist.series?.length??0} sorozat betöltve.`;
        setTimeout(() => { navigateTo('live'); renderApp(); }, 600);
      } catch (err) {
        loginBtn.disabled = false; loginBtn.textContent = '▶ Bejelentkezés'; statusEl.textContent = '⚠ ' + err.message;
      }
    });
    document.getElementById('xtream-password')?.addEventListener('keydown', e => { if (e.key==='Enter') loginBtn.click(); });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      playerService.destroy(); clearImportedPlaylist();
      setUser('PusztaPlay fiók', 'nincs aktív session');
      navigateTo('home'); renderApp();
    });
  }
}

function bindPlaylistClear() {
  const clearBtn = document.getElementById('playlist-clear-btn');
  if (!clearBtn) return;
  clearBtn.addEventListener('click', () => { clearImportedPlaylist(); renderApp(); });
}

/* ── Live csatórna lista renderer (megosztott) ── */
function renderChannelListHTML(channels) {
  const PAGE = 200;
  const page    = channels.slice(0, PAGE);
  const hasMore = channels.length > PAGE;
  const rem     = channels.length - PAGE;
  return `<div class="channel-grid">${
    page.map(c => `<button class="channel-item"
      data-open-player="${c.key}" data-channel-key="${c.key}"
      data-channel-stream-id="${c.streamId||''}"
      data-channel-title="${c.title.replace(/"/g,'&quot;')}"
      data-channel-group="${(c.group||'Egyéb').replace(/"/g,'&quot;')}"
      data-channel-status="${(c.status||'Élő').replace(/"/g,'&quot;')}"
      data-channel-logo="${(c.logo||'').replace(/"/g,'&quot;')}">
      ${c.logo?`<img src="${c.logo}" alt="" class="channel-logo" loading="lazy" onerror="this.style.display='none'"/>`:''}${c.title}
      <span class="sub">${c.status||c.group||'Élő'}</span>
    </button>`).join('')
  }</div>${hasMore
    ? `<button class="btn btn-secondary load-more-btn" data-load-offset="${PAGE}" style="width:100%;margin-top:8px">⬇ Következő ${Math.min(rem,PAGE)} csatórna (${PAGE}/${channels.length})</button>`
    : `<div class="muted" style="padding:12px 0;font-size:.85rem;text-align:center">Összes csatórna megjelenítve (${channels.length} db)</div>`}`;
}

/* ── Film lista renderer (megosztott) ── */
function renderMovieListHTML(items) {
  const PAGE    = 100;
  const page    = items.slice(0, PAGE);
  const hasMore = items.length > PAGE;
  const rem     = items.length - PAGE;
  return `<div class="rail" id="vod-movies-rail">${
    page.map(item => {
      const bg = item.logo ? `background:url('${item.logo}') center/cover no-repeat` : 'background:linear-gradient(145deg,#1fd6e8,#ff5b63 55%,#1a1a1a)';
      const fav = isFavorite(item.key);
      return `<article class="card"
        data-movie-key="${item.key}"
        data-movie-stream-id="${item.streamId||''}"
        data-movie-title="${item.title.replace(/"/g,'&quot;')}"
        data-movie-group="${(item.group||'').replace(/"/g,'&quot;')}"
        data-movie-logo="${(item.logo||'').replace(/"/g,'&quot;')}">
        <div class="thumb" style="${bg}">${!item.logo?`<span>${item.title.replace(/ /g,'<br>')}</span>`:''}
          <button class="fav-heart${fav?' fav-heart--active':''}" data-fav-toggle="${item.key}"
            title="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}"
            aria-label="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}" aria-pressed="${fav}">${fav?'♥':'♡'}</button>
        </div>
        <div class="meta"><strong>${item.title}</strong><small>${item.group||''}</small></div>
      </article>`;
    }).join('')
  }${hasMore
    ? `<button class="btn btn-secondary load-more-movies-btn" data-movies-offset="${PAGE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem,PAGE)} film (${PAGE}/${items.length})</button>`
    : `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes film megjelenítve (${items.length} db)</div>`
  }</div>`;
}

/* ── Sorozat lista renderer (megosztott) ── */
function renderSeriesListHTML(items) {
  const PAGE    = 100;
  const page    = items.slice(0, PAGE);
  const hasMore = items.length > PAGE;
  const rem     = items.length - PAGE;
  return `<div class="rail" id="vod-series-rail">${
    page.map(item => {
      const bg = item.logo ? `background:url('${item.logo}') center/cover no-repeat` : 'background:linear-gradient(145deg,#f6c800,#ff5b63 55%,#1a1a1a)';
      const fav = isFavorite(item.key);
      return `<article class="card"
        data-open-series="${item.seriesId}"
        data-series-key="${item.key}"
        data-series-title="${item.title.replace(/"/g,'&quot;')}"
        data-series-group="${(item.group||'').replace(/"/g,'&quot;')}"
        data-series-logo="${(item.logo||'').replace(/"/g,'&quot;')}" style="cursor:pointer">
        <div class="thumb" style="${bg}">${!item.logo?`<span>${item.title.replace(/ /g,'<br>')}</span>`:''}
          <button class="fav-heart${fav?' fav-heart--active':''}" data-fav-toggle="${item.key}"
            title="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}"
            aria-label="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}" aria-pressed="${fav}">${fav?'♥':'♡'}</button>
        </div>
        <div class="meta"><strong>${item.title}</strong><small>${item.group||''}</small></div>
      </article>`;
    }).join('')
  }${hasMore
    ? `<button class="btn btn-secondary load-more-series-btn" data-series-offset="${PAGE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem,PAGE)} sorozat (${PAGE}/${source.length})</button>`
    : `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes sorozat megjelenítve (${items.length} db)</div>`
  }</div>`;
}

/* ── Live Load More ── */
function bindLoadMore() {
  const listEl = document.getElementById('live-channel-list');
  if (!listEl) return;
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.load-more-btn');
    if (!btn) return;
    const offset = parseInt(btn.dataset.loadOffset, 10);
    if (isNaN(offset)) return;
    const source = listEl._filteredChannels || getAllLiveChannels();
    const PAGE = 200;
    const page = source.slice(offset, offset + PAGE);
    const hasMore = offset + PAGE < source.length;
    const rem = source.length - offset - PAGE;
    const grid = listEl.querySelector('.channel-grid');
    if (grid) grid.insertAdjacentHTML('beforeend', page.map(c => {
      const fav = isFavorite(c.key);
      return `<button class="channel-item"
        data-open-player="${c.key}" data-channel-key="${c.key}"
        data-channel-stream-id="${c.streamId||''}"
        data-channel-title="${c.title.replace(/"/g,'&quot;')}"
        data-channel-group="${(c.group||'Egyéb').replace(/"/g,'&quot;')}"
        data-channel-status="${(c.status||'Élő').replace(/"/g,'&quot;')}"
        data-channel-logo="${(c.logo||'').replace(/"/g,'&quot;')}">
        ${c.logo?`<img src="${c.logo}" alt="" class="channel-logo" loading="lazy" onerror="this.style.display='none'"/>`:''}${c.title}
        <span class="sub">${c.status||c.group||'Élő'}</span>
      </button>`;
    }).join(''));
    btn.remove();
    if (hasMore) {
      listEl.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary load-more-btn" data-load-offset="${offset+PAGE}" style="width:100%;margin-top:8px">⬇ Következő ${Math.min(rem,PAGE)} csatórna (${offset+PAGE}/${source.length})</button>`);
    } else {
      listEl.insertAdjacentHTML('beforeend', `<div class="muted" style="padding:12px 0;font-size:.85rem;text-align:center">Összes csatórna megjelenítve (${source.length} db)</div>`);
    }
    bindLiveInteractions(); bindRouteEvents(); bindFavoriteButtons();
  });
}

/* ── Film Load More ── */
function bindMoviesLoadMore() {
  const listEl = document.getElementById('vod-movies-list');
  if (!listEl) return;
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.load-more-movies-btn');
    if (!btn) return;
    const offset = parseInt(btn.dataset.moviesOffset, 10);
    if (isNaN(offset)) return;
    const source = listEl._filteredMovies || getAllMovies();
    const PAGE = 100;
    const page = source.slice(offset, offset + PAGE);
    const hasMore = offset + PAGE < source.length;
    const rem = source.length - offset - PAGE;
    const rail = listEl.querySelector('#vod-movies-rail') || listEl;
    rail.insertAdjacentHTML('beforeend', page.map(c => {
      const bg = c.logo ? `background:url('${c.logo}') center/cover no-repeat` : 'background:linear-gradient(145deg,#1fd6e8,#ff5b63 55%,#1a1a1a)';
      const fav = isFavorite(c.key);
      return `<article class="card" data-movie-key="${c.key}" data-movie-stream-id="${c.streamId||''}" data-movie-title="${c.title.replace(/"/g,'&quot;')}" data-movie-group="${(c.group||'').replace(/"/g,'&quot;')}" data-movie-logo="${(c.logo||'').replace(/"/g,'&quot;')}">
        <div class="thumb" style="${bg}">${!c.logo?`<span>${c.title.replace(/ /g,'<br>')}</span>`:''}
          <button class="fav-heart${fav?' fav-heart--active':''}" data-fav-toggle="${c.key}"
            title="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}" aria-label="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}" aria-pressed="${fav}">${fav?'♥':'♡'}</button>
        </div>
        <div class="meta"><strong>${c.title}</strong><small>${c.group||''}</small></div>
      </article>`;
    }).join(''));
    btn.remove();
    if (hasMore) {
      listEl.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary load-more-movies-btn" data-movies-offset="${offset+PAGE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem,PAGE)} film (${offset+PAGE}/${source.length})</button>`);
    } else {
      listEl.insertAdjacentHTML('beforeend', `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes film megjelenítve (${source.length} db)</div>`);
    }
    bindMovieCards(); bindRouteEvents(); bindFavoriteButtons();
  });
}

/* ── Sorozat Load More ── */
function bindSeriesLoadMore() {
  const listEl = document.getElementById('vod-series-list');
  if (!listEl) return;
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('.load-more-series-btn');
    if (!btn) return;
    const offset = parseInt(btn.dataset.seriesOffset, 10);
    if (isNaN(offset)) return;
    const source = listEl._filteredSeries || getAllSeries();
    const PAGE = 100;
    const page = source.slice(offset, offset + PAGE);
    const hasMore = offset + PAGE < source.length;
    const rem = source.length - offset - PAGE;
    const rail = listEl.querySelector('#vod-series-rail') || listEl;
    rail.insertAdjacentHTML('beforeend', page.map(c => {
      const bg = c.logo ? `background:url('${c.logo}') center/cover no-repeat` : 'background:linear-gradient(145deg,#f6c800,#ff5b63 55%,#1a1a1a)';
      const fav = isFavorite(c.key);
      return `<article class="card" data-open-series="${c.seriesId}" data-series-key="${c.key}" data-series-title="${c.title.replace(/"/g,'&quot;')}" data-series-group="${(c.group||'').replace(/"/g,'&quot;')}" data-series-logo="${(c.logo||'').replace(/"/g,'&quot;')}" style="cursor:pointer">
        <div class="thumb" style="${bg}">${!c.logo?`<span>${c.title.replace(/ /g,'<br>')}</span>`:''}
          <button class="fav-heart${fav?' fav-heart--active':''}" data-fav-toggle="${c.key}"
            title="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}" aria-label="${fav?'Eltávolítás a kedvencekből':'Hozzáadás a kedvencekhez'}" aria-pressed="${fav}">${fav?'♥':'♡'}</button>
        </div>
        <div class="meta"><strong>${c.title}</strong><small>${c.group||''}</small></div>
      </article>`;
    }).join(''));
    btn.remove();
    if (hasMore) {
      listEl.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary load-more-series-btn" data-series-offset="${offset+PAGE}" style="grid-column:1/-1;margin-top:8px">⬇ Következő ${Math.min(rem,PAGE)} sorozat (${offset+PAGE}/${source.length})</button>`);
    } else {
      listEl.insertAdjacentHTML('beforeend', `<div class="muted" style="grid-column:1/-1;padding:12px 0;font-size:.85rem;text-align:center">Összes sorozat megjelenítve (${source.length} db)</div>`);
    }
    bindSeriesDetailPanel(); bindSeriesCards(); bindRouteEvents(); bindFavoriteButtons();
  });
}

/* ── Csoport szűrés (Live) ── */
function bindGroupFilter() {
  const groupButtons = [...document.querySelectorAll('[data-group-filter]')];
  const listEl       = document.getElementById('live-channel-list');
  if (!groupButtons.length || !listEl) return;
  const masterChannels = getAllLiveChannels();
  if (!masterChannels.length) return;
  groupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      groupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter   = btn.dataset.groupFilter;
      const filtered = filter === 'Összes csatórna' ? masterChannels : masterChannels.filter(ch => ch.group === filter);
      listEl._filteredChannels = filtered;
      listEl.innerHTML = renderChannelListHTML(filtered);
      bindLiveInteractions(); bindRouteEvents(); bindFavoriteButtons();
    });
  });
}

/* ── Kategória szűrés (Filmek) ── */
function bindMoviesFilter() {
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
      const filtered = filter === 'Összes film' ? master : master.filter(m => m.group === filter);
      listEl._filteredMovies = filtered;
      listEl.innerHTML = renderMovieListHTML(filtered);
      bindMovieCards(); bindRouteEvents(); bindFavoriteButtons();
    });
  });
}

/* ── Kategória szűrés (Sorozatok) ── */
function bindSeriesFilter() {
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
      const filtered = filter === 'Összes sorozat' ? master : master.filter(s => s.group === filter);
      listEl._filteredSeries = filtered;
      listEl.innerHTML = renderSeriesListHTML(filtered);
      bindSeriesDetailPanel(); bindSeriesCards(); bindRouteEvents(); bindFavoriteButtons();
    });
  });
}

function bindRouteEvents() {
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.route));
  });
  // Csak valódi live csatórna-gombok (nem film/sorozat kártyák, nem ep-url-ösök)
  document.querySelectorAll('[data-open-player]:not([data-ep-url]):not([data-movie-key]):not([data-fav-movie-play])').forEach((btn, index) => {
    btn.setAttribute('tabindex', '0');
    btn.addEventListener('click', () => { setCurrentPlayerItem(btn.dataset.openPlayer); navigateTo('player', {id: btn.dataset.openPlayer}); });
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn.click();
      const items = [...document.querySelectorAll('[data-open-player]')];
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') items[Math.min(index+1, items.length-1)]?.focus();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   items[Math.max(index-1, 0)]?.focus();
    });
  });
}

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
    title.textContent  = btn.dataset.channelTitle;
    status.textContent = btn.dataset.channelStatus;
    group.textContent  = btn.dataset.channelGroup;
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

function bindNextEpisode() {
  document.querySelectorAll('.next-ep-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.epKey; const url = btn.dataset.epUrl;
      const title = btn.dataset.epTitle; const seriesId = btn.dataset.epSeriesId; const seasonNum = btn.dataset.epSeason;
      if (!key || !url) return;
      const playlist = getImportedPlaylist();
      if (playlist) {
        if (!(playlist.series || []).find(s => s.key === key)) {
          playlist.series = playlist.series || [];
          playlist.series.push({ key, title, streamUrl: url, type: 'series', seriesId: seriesId || null, seasonNum: seasonNum || null, group: '' });
        }
      }
      setCurrentPlayerItem(key); navigateTo('player', { id: key });
    });
  });
}

/* ── Player nézet VOD / sorozat metaadat (get_vod_info / get_series_info) ── */
function bindPlayerVodMeta() {
  const card = document.querySelector('.player-layout .detail-card');
  if (!card) return;

  const vodId    = card.dataset.vodId;
  const seriesId = card.dataset.seriesId;
  if (!vodId && !seriesId) return;

  const releaseEl  = card.querySelector('#player-detail-release');
  const castEl     = card.querySelector('#player-detail-cast');
  const directorEl = card.querySelector('#player-detail-director');

  if (!releaseEl || !castEl || !directorEl) return;

  const creds = loadXtreamCredentials();
  if (!creds) {
    releaseEl.textContent  = '–';
    castEl.textContent     = '–';
    directorEl.textContent = '–';
    return;
  }

  releaseEl.textContent  = 'Betöltés…';
  castEl.textContent     = '';
  directorEl.textContent = '';

  let loader;

  if (vodId) {
    loader = xtreamGetVodInfo(creds.username, creds.password, vodId)
      .then(data => {
        const info = data && data.info ? data.info : {};
        return {
          release:  info.releasedate || info.year || '',
          cast:     info.cast || info.actors || '',
          director: info.director || ''
        };
      });
  } else {
    loader = xtreamGetSeriesInfo(creds.username, creds.password, seriesId)
      .then(data => {
        const info = data && data.info ? data.info : {};
        return {
          release:  info.releaseDate || info.year || '',
          cast:     info.cast || '',
          director: info.director || ''
        };
      });
  }

  loader
    .then(meta => {
      releaseEl.textContent  = meta.release  || 'Ismeretlen';
      castEl.textContent     = meta.cast     || 'Nincs adat';
      directorEl.textContent = meta.director || 'Nincs adat';
    })
    .catch(() => {
      releaseEl.textContent  = 'Nincs adat';
      castEl.textContent     = 'Nincs adat';
      directorEl.textContent = 'Nincs adat';
    });
}

function bindGlobalEvents() {
  const input = document.getElementById('global-search');
  if (!input) return;
  input.value = searchTerm;
  input.addEventListener('input', e => { searchTerm = e.target.value.trim().toLowerCase(); applySearch(searchTerm); });
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
/* ── Player nézet Live EPG (Most / Következik) ── */
function bindPlayerLiveEpg() {
  const card = document.querySelector('.player-layout .detail-card[data-live-stream-id]');
  if (!card) return;

  const streamId = card.dataset.liveStreamId;
  const nowTitleEl  = card.querySelector('#player-epg-now-title');
  const nowTimeEl   = card.querySelector('#player-epg-now-time');
  const nextTitleEl = card.querySelector('#player-epg-next-title');
  const nextTimeEl  = card.querySelector('#player-epg-next-time');

  if (!streamId || !nowTitleEl || !nowTimeEl || !nextTitleEl || !nextTimeEl) return;

  const creds = loadXtreamCredentials();
  if (!creds) {
    nowTitleEl.textContent  = 'EPG nem elérhető';
    nowTimeEl.textContent   = 'Xtream bejelentkezés kell';
    nextTitleEl.textContent = '';
    nextTimeEl.textContent  = '';
    return;
  }

  nowTitleEl.textContent  = 'Betöltés…';
  nowTimeEl.textContent   = '';
  nextTitleEl.textContent = '';
  nextTimeEl.textContent  = '';

  fetchShortEpg(creds, streamId, 3)
    .then(rows => {
      if (!rows.length) {
        nowTitleEl.textContent  = 'Nincs EPG adat';
        nowTimeEl.textContent   = '';
        nextTitleEl.textContent = '';
        nextTimeEl.textContent  = '';
        return;
      }

      const now  = rows[0];
      const next = rows[1];

      nowTitleEl.textContent = now.title || 'Ismeretlen műsor';
      nowTimeEl.textContent  = now.time + (now.endTime ? ` – ${now.endTime}` : '');

      if (next) {
        nextTitleEl.textContent = next.title || '—';
        nextTimeEl.textContent  = next.time + (next.endTime ? ` – ${next.endTime}` : '');
      } else {
        nextTitleEl.textContent = 'Nincs következő adat';
        nextTimeEl.textContent  = '';
      }
    })
    .catch(() => {
      nowTitleEl.textContent  = 'EPG hiba';
      nowTimeEl.textContent   = '';
      nextTitleEl.textContent = '';
      nextTimeEl.textContent  = '';
    });
}

window.addEventListener('hashchange', () => { playerService.destroy(); renderApp(); });
window.addEventListener('DOMContentLoaded', () => { initPlaylistFromCache(); if (!window.location.hash) navigateTo('home'); renderApp(); });
