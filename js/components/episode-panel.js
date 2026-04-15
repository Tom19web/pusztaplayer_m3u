/**
 * episode-panel.js
 * Sorozat epizód panel: betöltés, évad toggle, epizód lejátszás.
 */

import { xtreamGetSeriesInfo, buildEpisodeUrl } from '../services/xtream-api.js';
import { getImportedPlaylist }                  from '../services/playlist-import.js';

export async function openEpisodePanel(panel, creds, seriesId, title, { navigateTo, setCurrentPlayerItem }) {
  panel.style.display = 'block';
  panel.className     = 'series-ep-panel';
  panel.innerHTML = `
    <div class="sep-hero sep-hero--loading">
      <div class="sep-hero-copy">
        <div class="headline" style="font-size:1.4rem">⏳ Betöltés…</div>
        <p class="sep-hero-subtitle">${title} epizódjai töltődnek be.</p>
      </div>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const info       = await xtreamGetSeriesInfo(creds.username, creds.password, seriesId);
    const seasons    = info.seasons  || [];
    const episodes   = info.episodes || {};
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

    const cover  = info.info?.cover              || info.info?.backdrop_path?.[0] || '';
    const back   = info.info?.backdrop_path?.[0] || cover || '';
    const plot   = info.info?.plot      || '';
    const cast   = info.info?.cast      || '';
    const rating = info.info?.rating    || '';
    const genre  = info.info?.genre     || '';
    const year   = info.info?.releaseDate || info.info?.year || '';
    const totalEps = seasonKeys.reduce((acc, k) => acc + (episodes[k]?.length || 0), 0);

    panel.innerHTML = `
      <div class="sep-hero${back ? ' sep-hero--has-backdrop' : ''}"${back ? ` style="--sep-backdrop:url('${back}')"` : ''}>
        ${cover ? `
          <div class="sep-poster-art">
            <img src="${cover}" alt="${title}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>` : ''}
        <div class="sep-hero-copy">
          <div class="headline" style="font-size:clamp(1.4rem,3vw,2.4rem);margin-bottom:10px">${title}</div>
          <div class="sep-hero-meta-row">
            ${rating ? `<span class="pill">★ ${rating}</span>` : ''}
            ${year   ? `<span class="sep-meta-tag">${year}</span>`   : ''}
            ${genre  ? `<span class="sep-meta-tag">${genre}</span>`  : ''}
            <span class="sep-meta-tag">${seasonKeys.length} évad · ${totalEps} epizód</span>
          </div>
          ${plot ? `<p class="sep-hero-subtitle">${plot.slice(0, 200)}${plot.length > 200 ? '…' : ''}</p>` : ''}
          ${cast ? `<p class="sep-cast"><strong>Szereplők:</strong> ${cast.slice(0, 120)}${cast.length > 120 ? '…' : ''}</p>` : ''}
        </div>
        <button class="sep-close-btn btn" id="sep-close-btn" title="Panel bezárása" aria-label="Panel bezárása">✕</button>
      </div>

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
                  const epNum     = `S${String(seasonNum).padStart(2, '0')}·E${String(ep.episode_num).padStart(2, '0')}`;
                  return `
                    <article class="sep-ep-card"
                      data-open-player="${epKey}"
                      data-ep-url="${streamUrl}"
                      data-ep-title="${epTitle.replace(/"/g, '&quot;')}"
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

    // Bezárás
    panel.querySelector('#sep-close-btn')?.addEventListener('click', () => {
      panel.style.display = 'none';
      panel.innerHTML = '';
    });

    // Évad toggle
    panel.querySelectorAll('[data-season-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx    = btn.dataset.seasonToggle;
        const grid   = panel.querySelector(`#sep-season-${idx}`);
        const isOpen = btn.classList.contains('open');
        btn.classList.toggle('open', !isOpen);
        grid?.classList.toggle('hidden', isOpen);
        btn.querySelector('.sep-season-arrow').textContent = isOpen ? '▼' : '▲';
      });
    });

    // Epizód kattintás
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
      epCard.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
      });
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
      panel.style.display = 'none';
      panel.innerHTML = '';
    });
  }
}
