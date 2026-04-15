/**
 * PusztaPlay v7 — M3U Parser
 * PERF : chunked feldolgozás (nem fagyasztja be a UI-t)
 *        localStorage cache max 2000 live + 500 movie + 500 series
 * FEAT : háromlépcsős típusfelismerés:
 *   1. URL végződés: .m3u8 → live  |  .mp4/.avi/.mkv → VOD
 *   2. tvg-name / title: S\d{2}E\d{2} regex → series
 *   3. maradék VOD → movie
 *   4. minden más → live
 */

const STORAGE_KEY  = 'pusztaplay_m3u_channels';
const CACHE_LIVE   = 2000;
const CACHE_VOD    = 500;
const CHUNK_SIZE   = 500;
const YIELD_DELAY  = 0;

const RE_LIVE_URL  = /\.m3u8?(\?.*)?$/i;
const RE_VOD_URL   = /\.(mp4|avi|mkv|mov|wmv|flv|ts)(\?.*)?$/i;
const RE_EPISODE   = /S\d{1,2}E\d{1,2}/i;   // S01E10, s2e3, stb.

/**
 * Háromlépcsős típusmegállapítás.
 * @param {string} url    - stream URL
 * @param {string} title  - csatorna/műsorneve (tvg-name / név vesző után)
 * @returns {'live'|'movie'|'series'}
 */
function detectType(url, title) {
  // 1. URL alapján: .m3u8 → mindenképpen live
  if (RE_LIVE_URL.test(url)) return 'live';

  // 2. URL alapján: statikus fájl → VOD ág
  if (RE_VOD_URL.test(url)) {
    // 3. címen belül sorozat-minta?
    return RE_EPISODE.test(title) ? 'series' : 'movie';
  }

  // 4. nincs URL-hint, de a cím árulja el (pl. stream URL .php?... végződésű)
  if (RE_EPISODE.test(title)) return 'series';

  // 5. alapból live
  return 'live';
}

/**
 * Parsolja az M3U szöveges tartalmat.
 * @param {string} content
 * @returns {Promise<PlaylistObject>}
 */
export function parseM3u(content) {
  return new Promise(resolve => {
    const lines = content.split(/\r?\n/);
    const all   = [];
    let current = null;
    let i = 0;

    function processChunk() {
      const end = Math.min(i + CHUNK_SIZE, lines.length);
      for (; i < end; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          const extinf = parseExtinf(line);
          current = {
            key:       `m3u_${all.length}`,
            title:     extinf.name  || 'Ismeretlen',
            group:     extinf.group || 'Egyéb',
            logo:      extinf.logo  || '',
            tvgId:     extinf.tvgId || '',
            streamUrl: '',
            status:    '',
            epg:       [],
            type:      null   // URL megismerése után állítódik be
          };
        } else if (current && !line.startsWith('#')) {
          current.streamUrl = line;
          current.type      = detectType(line, current.title);
          current.status    = current.type === 'live'
            ? `Élő · ${current.group}`
            : current.group;
          all.push(current);
          current = null;
        }
      }

      if (i < lines.length) {
        setTimeout(processChunk, YIELD_DELAY);
      } else {
        resolve(buildPlaylist(all));
      }
    }

    processChunk();
  });
}

function buildPlaylist(all) {
  const liveChannels = all.filter(c => c.type === 'live');
  const movies       = all.filter(c => c.type === 'movie');
  const series       = all.filter(c => c.type === 'series');

  const toGroups = (arr, prefix) => [prefix, ...new Set(arr.map(c => c.group))];

  return {
    liveChannels,
    movies,
    series,
    groups:       toGroups(liveChannels, 'Összes csatorna'),
    movieGroups:  toGroups(movies,       'Összes film'),
    seriesGroups: toGroups(series,       'Összes sorozat'),
    channels:     liveChannels   // visszafelé kompatibilitás
  };
}

function parseExtinf(line) {
  const result    = { name: '', group: 'Egyéb', logo: '', tvgId: '' };
  const attrRegex = /([\w-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(line)) !== null) {
    const [, key, value] = match;
    if      (key === 'group-title') result.group = value || 'Egyéb';
    else if (key === 'tvg-logo')    result.logo  = value;
    else if (key === 'tvg-id')      result.tvgId = value;
  }
  const ci = line.indexOf(',');
  if (ci !== -1) result.name = line.substring(ci + 1).trim();
  return result;
}

export function savePlaylistToCache(playlist) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      groups:       playlist.groups,
      movieGroups:  playlist.movieGroups,
      seriesGroups: playlist.seriesGroups,
      liveChannels: playlist.liveChannels.slice(0, CACHE_LIVE),
      movies:       playlist.movies.slice(0, CACHE_VOD),
      series:       playlist.series.slice(0, CACHE_VOD),
      channels:     playlist.liveChannels.slice(0, CACHE_LIVE)
    }));
  } catch (e) {
    console.warn('localStorage mentés sikertelen:', e);
  }
}

export function loadPlaylistFromCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.liveChannels && !p?.channels) return null;
    // régi cache-formátum toleálása
    if (!p.liveChannels) {
      p.liveChannels = p.channels || [];
      p.movies       = [];
      p.series       = [];
      p.movieGroups  = ['Összes film'];
      p.seriesGroups = ['Összes sorozat'];
    }
    p.channels = p.liveChannels;
    return p;
  } catch (e) { return null; }
}

export function clearPlaylistCache() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* silent */ }
}
