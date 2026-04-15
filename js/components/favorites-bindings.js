/**
 * favorites-bindings.js
 * Kedvencek: szívgomb renderelés, toggle kezelés,
 * film- és sorozat-kártyák kattintásai a kedvencek nézetben.
 */

import { toggleFavorite, isFavorite } from '../store/actions.js';
import { getImportedPlaylist }        from '../services/playlist-import.js';

/* ── Szívgomb HTML generálása ── */
export function renderHeartBtn(key) {
  const active = isFavorite(key);
  return `<button
    class="fav-heart${active ? ' fav-heart--active' : ''}"
    data-fav-toggle="${key}"
    title="${active ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
    aria-label="${active ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez'}"
    aria-pressed="${active}">${active ? '♥' : '♡'}</button>`;
}

/* ── Szívgomb toggle event kötés ── */
export function bindFavoriteButtons() {
  document.querySelectorAll('[data-fav-toggle]').forEach(btn => {
    if (btn._favBound) return;
    btn._favBound = true;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.favToggle;
      if (!key) return;

      const card = btn.closest('[data-fav-key],[data-channel-key],[data-movie-key],[data-open-series],[data-series-key]');

      let type     = 'movie';
      let title    = key;
      let group    = '';
      let logo     = '';
      let streamUrl = '';
      let seriesId  = '';
      let streamId  = '';

      if (card) {
        if (card.dataset.channelKey) {
          type     = 'live';
          title    = card.dataset.channelTitle   || key;
          group    = card.dataset.channelGroup   || '';
          logo     = card.dataset.channelLogo    || '';
          streamId = card.dataset.channelStreamId || '';
        } else if (card.dataset.movieKey) {
          type     = 'movie';
          title    = card.dataset.movieTitle   || key;
          group    = card.dataset.movieGroup   || '';
          logo     = card.dataset.movieLogo    || '';
          streamId = card.dataset.movieStreamId || '';
        } else if (card.dataset.openSeries || card.dataset.seriesKey) {
          type     = 'series';
          title    = card.dataset.seriesTitle || key;
          group    = card.dataset.seriesGroup || '';
          logo     = card.dataset.seriesLogo  || '';
          seriesId = card.dataset.openSeries  || key;
        }
        // data-fav-key esetén csak toggle, nincs extra adat
      }

      // Playlist adatok kiegészítése
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

      // Gomb állapot frissítése
      btn.classList.toggle('fav-heart--active', added);
      btn.textContent = added ? '♥' : '♡';
      btn.title       = added ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez';
      btn.setAttribute('aria-pressed', String(added));
      btn.setAttribute('aria-label',   added ? 'Eltávolítás a kedvencekből' : 'Hozzáadás a kedvencekhez');

      // Ha eltávolítjuk a kedvencek nézetből, animálva tünteti el
      if (!added) {
        const favCard = btn.closest('.fav-card');
        if (favCard) {
          favCard.style.transition = 'opacity .25s, transform .25s';
          favCard.style.opacity   = '0';
          favCard.style.transform = 'scale(.9)';
          setTimeout(() => favCard.remove(), 260);
        }
      }
    });
  });
}

/* ── Kedvencek: film-kártya közvetlen lejátszás ── */
export function bindFavMovieCards(navigateTo, setCurrentPlayerItem) {
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
      if (e.target.closest('[data-fav-toggle]')) return;
      play();
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
    });
  });
}

/* ── Kedvencek: sorozat-kártya — epizód panel megnyitása ── */
export function bindFavSeriesCards(openEpisodePanel, loadXtreamCredentials) {
  const panel = document.getElementById('series-episode-panel');
  if (!panel) return;
  const creds = loadXtreamCredentials();
  if (!creds) return;

  document.querySelectorAll('.fav-card[data-open-series]').forEach(card => {
    if (card._favSeriesBound) return;
    card._favSeriesBound = true;

    const open = e => {
      if (e.target.closest('[data-fav-toggle]')) return;
      const seriesId = card.dataset.openSeries;
      const title    = card.dataset.seriesTitle || 'Sorozat';
      if (seriesId) openEpisodePanel(panel, creds, seriesId, title);
    };

    card.addEventListener('click', open);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
  });
}
