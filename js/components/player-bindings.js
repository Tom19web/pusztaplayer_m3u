/**
 * player-bindings.js
 * Player mount, EPG betöltés, VOD/sorozat meta, Live EPG a player nézetben.
 * + bindPlayerControls(): play/pause, hangsáv, felirat, kedvenc, fullscreen
 */

import { playerService }                              from '../services/player.js';
import { createPlaybackSession }                      from '../services/playback-session.js';
import { fetchShortEpg }                              from '../services/epg-service.js';
import { xtreamGetVodInfo, xtreamGetSeriesInfo }      from '../services/xtream-api.js';
import { loadXtreamCredentials }                      from '../services/playlist-import.js';
import { getImportedPlaylist }                        from '../services/playlist-import.js';
import { addToHistory }                               from '../store/actions.js';
import { getWatchHistory }                            from '../store/selectors.js';
import { toggleFavorite, isFavorite }                 from '../store/actions.js';
import { bindFavoriteButtons }                        from '../components/favorites-bindings.js';

/* ═════════════════════════════════════════
   PLAYER MOUNT
   ═════════════════════════════════════════ */

export async function mountPlayer(key) {
  const video        = document.getElementById('main-video');
  const status       = document.getElementById('player-status');
  const progressFill = document.getElementById('progress-fill');
  const progressBar  = document.getElementById('progress-bar');
  if (!video) return;

  const history     = typeof getWatchHistory === 'function' ? getWatchHistory() : [];
  const historyItem = history.find(h => h.key === key);
  let resumeFrom        = 0;
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
    if (resumeFrom > 0) playerService.seek(resumeFrom);

    status.innerHTML = '<strong>Lejátszás kész.</strong> A stream sikeresen elindult.';

    // Live TV esetén progress bar elrejtése
    if (session.isLive) {
      if (progressBar) progressBar.style.display = 'none';
    }

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
      key,
      title:     histMeta?.title     || session.title || key,
      type:      histMeta?.type      || (session.isLive ? 'live' : 'movie'),
      group:     histMeta?.group     || '',
      logo:      histMeta?.logo      || '',
      streamUrl: session.streamUrl   || ''
    });

    playerService.onProgress(({ current, duration, ratio }) => {
      // Progress bar csak VOD / sorozat esetén frissül
      if (!session.isLive) {
        if (progressFill) {
          progressFill.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
        }
        if (duration && Number.isFinite(duration)) {
          const delta = Math.abs(current - lastSavedProgress);
          if (current >= 5 && delta >= 15) {
            lastSavedProgress = current;
            addToHistory({
              key,
              title:     histMeta?.title     || session.title || key,
              type:      histMeta?.type      || 'movie',
              group:     histMeta?.group     || '',
              logo:      histMeta?.logo      || '',
              streamUrl: session.streamUrl   || '',
              position:  current,
              duration
            });
          }
        }
      }
    });

    // Controls bekötése miután a session megvan
    bindPlayerControls(key, session);

  } catch (error) {
    status.classList.add('error');
    status.innerHTML = `<strong>Stream hiba.</strong> ${error.message}`;
  }
}

/* ═════════════════════════════════════════
   PLAYER CONTROLS BINDING
   ═════════════════════════════════════════ */

export function bindPlayerControls(key, session = null) {
  const video = document.getElementById('main-video');
  if (!video) return;

  // ── Play / Pause ──────────────────────────────
  const playBtn = document.getElementById('ctrl-playpause');
  if (playBtn) {
    const updatePlayBtn = () => {
      playBtn.textContent = video.paused ? '▶ Lejátszás' : '⏸ Szünet';
    };
    video.addEventListener('play',  updatePlayBtn);
    video.addEventListener('pause', updatePlayBtn);
    updatePlayBtn();
    playBtn.addEventListener('click', () => {
      video.paused ? playerService.play() : playerService.pause();
    });
  }

  // ── Fullscreen ────────────────────────────────
  const fsBtn = document.getElementById('ctrl-fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const wrap = video.closest('.video-wrap') || video;
      wrap.requestFullscreen?.();
    });
  }

  // ── Hang (audio track) ────────────────────────
  const audioBtn  = document.getElementById('ctrl-audio');
  const audioMenu = document.getElementById('audio-menu');
  if (audioBtn && audioMenu) {
    const getHls = () => window.__hlsInstance || null;
    audioBtn.addEventListener('click', e => {
      e.stopPropagation();
      const hls = getHls();
      if (!hls) {
        showDropdown(audioMenu, [{ label: 'Natív lejátszás – hangsáv nem váltható', disabled: true }]);
        toggleMenu(audioMenu, subtitleMenu);
        return;
      }
      const tracks = hls.audioTracks || [];
      if (tracks.length <= 1) {
        showDropdown(audioMenu, [{ label: 'Nincs alternatív hangsáv', disabled: true }]);
      } else {
        showDropdown(audioMenu, tracks.map((t, i) => ({
          label:   t.name || t.lang || `Hangsáv ${i + 1}`,
          active:  hls.audioTrack === i,
          onClick: () => { hls.audioTrack = i; closeAllMenus(); }
        })));
      }
      toggleMenu(audioMenu, subtitleMenu);
    });
  }

  // ── Felirat (subtitle track) ──────────────────
  const subBtn       = document.getElementById('ctrl-subtitle');
  const subtitleMenu = document.getElementById('subtitle-menu');
  if (subBtn && subtitleMenu) {
    const getHls = () => window.__hlsInstance || null;
    subBtn.addEventListener('click', e => {
      e.stopPropagation();
      const hls = getHls();
      if (!hls) {
        showDropdown(subtitleMenu, [{ label: 'Natív lejátszás – felirat nem elérhető', disabled: true }]);
        toggleMenu(subtitleMenu, audioMenu);
        return;
      }
      const tracks = hls.subtitleTracks || [];
      if (!tracks.length) {
        showDropdown(subtitleMenu, [{ label: 'Nincs elérhető felirat', disabled: true }]);
      } else {
        const items = [
          { label: 'Kikapcsolva', active: hls.subtitleTrack === -1, onClick: () => { hls.subtitleTrack = -1; closeAllMenus(); } },
          ...tracks.map((t, i) => ({
            label:   t.name || t.lang || `Felirat ${i + 1}`,
            active:  hls.subtitleTrack === i,
            onClick: () => { hls.subtitleTrack = i; closeAllMenus(); }
          }))
        ];
        showDropdown(subtitleMenu, items);
      }
      toggleMenu(subtitleMenu, audioMenu);
    });
  }

  // ── Outside click zárja a menüket ────────────
  document.addEventListener('click', closeAllMenus);

  // ── Kedvenc gomb bekötése ─────────────────────
  bindFavoriteButtons();
}

/* ── Dropdown segédfüggvények ── */

function showDropdown(menuEl, items) {
  menuEl.innerHTML = items.map(item => `
    <button
      class="ctrl-dropdown-item${item.active ? ' active' : ''}"
      ${item.disabled ? 'disabled' : ''}
      style="display:block;width:100%;padding:8px 14px;text-align:left;background:none;border:none;
             cursor:${item.disabled ? 'default' : 'pointer'};
             color:${item.disabled ? 'var(--color-text-muted)' : 'var(--color-text)'};
             font-size:.875rem;
             background-color:${item.active ? 'var(--color-primary-highlight)' : 'transparent'}"
    >${item.label}</button>
  `).join('');
  items.forEach((item, i) => {
    if (item.onClick && !item.disabled) {
      menuEl.querySelectorAll('.ctrl-dropdown-item')[i]
        ?.addEventListener('click', e => { e.stopPropagation(); item.onClick(); });
    }
  });
}

function toggleMenu(target, other) {
  other?.classList.add('hidden');
  target.classList.toggle('hidden');
}

function closeAllMenus() {
  document.getElementById('audio-menu')?.classList.add('hidden');
  document.getElementById('subtitle-menu')?.classList.add('hidden');
}

/* ═════════════════════════════════════════
   EPG
   ═════════════════════════════════════════ */

export async function loadEpgIntoPanel(streamId) {
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
      ${rows[0].description ? `<div style="font-size:.8rem;color:var(--color-text-muted);margin-top:4px;max-width:32ch">${rows[0].description.slice(0, 120)}${rows[0].description.length > 120 ? '…' : ''}</div>` : ''}
    </div>
    <div class="epg-grid">
      ${rows.slice(1).map(r => `
        <div class="epg-row">
          <div class="epg-time">${r.time}${r.endTime ? ' – ' + r.endTime : ''}</div>
          <div class="epg-show">${r.title}</div>
        </div>`).join('')}
    </div>
  `;
}

export function triggerFirstChannelEpg() {
  const firstBtn = document.querySelector('[data-channel-key]');
  if (!firstBtn) return;
  loadEpgIntoPanel(firstBtn.dataset.channelStreamId || '');
}

/* ═════════════════════════════════════════
   PLAYER — VOD / SOROZAT META
   ═════════════════════════════════════════ */

export function bindPlayerVodMeta() {
  const card = document.querySelector('.player-layout .detail-card');
  if (!card) return;

  const vodId    = card.dataset.vodId;
  const seriesId = card.dataset.seriesId;
  if (!vodId && !seriesId) return;

  const releaseEl = card.querySelector('#player-detail-release');
  const castEl    = card.querySelector('#player-detail-cast');
  const genreEl   = card.querySelector('#player-detail-genre');
  const plotEl    = card.querySelector('#player-detail-plot');
  if (!releaseEl || !castEl) return;

  const creds = loadXtreamCredentials();
  if (!creds) {
    releaseEl.textContent = 'Ismeretlen';
    castEl.textContent    = 'Nincs adat';
    if (genreEl) genreEl.textContent = 'Nincs adat';
    if (plotEl)  plotEl.textContent  = 'Nincs tartalom';
    return;
  }

  releaseEl.textContent = 'Betöltés…';
  castEl.textContent    = '';
  if (genreEl) genreEl.textContent = '–';
  if (plotEl)  plotEl.textContent  = '–';

  const loader = vodId
    ? xtreamGetVodInfo(creds.username, creds.password, vodId).then(data => {
        const info = data?.info || {};
        return { release: info.releasedate || info.year || '', cast: info.cast || info.actors || '', genre: info.genre || '', plot: info.plot || info.description || '' };
      })
    : xtreamGetSeriesInfo(creds.username, creds.password, seriesId).then(data => {
        const info = data?.info || {};
        return { release: info.releaseDate || info.year || '', cast: info.cast || '', genre: info.genre || '', plot: info.plot || '' };
      });

  loader
    .then(meta => {
      releaseEl.textContent = meta.release || 'Ismeretlen';
      castEl.textContent    = meta.cast    || 'Nincs adat';
      if (genreEl) genreEl.textContent = meta.genre || 'Nincs adat';
      if (plotEl) {
        const trimmed = meta.plot?.slice(0, 260) || '';
        plotEl.textContent = trimmed ? trimmed + (meta.plot.length > 260 ? '…' : '') : 'Nincs tartalom';
      }
    })
    .catch(() => {
      releaseEl.textContent = 'Nincs adat';
      castEl.textContent    = 'Nincs adat';
      if (genreEl) genreEl.textContent = 'Nincs adat';
      if (plotEl)  plotEl.textContent  = 'Nincs tartalom';
    });
}

/* ═════════════════════════════════════════
   PLAYER — LIVE EPG
   ═════════════════════════════════════════ */

export function bindPlayerLiveEpg() {
  const card = document.querySelector('.player-layout .detail-card[data-live-stream-id]');
  if (!card) return;
  const streamId = card.dataset.liveStreamId;
  if (streamId) loadEpgIntoPanel(streamId);
}
