/**
 * PusztaPlay — Xtream Codes API Service
 * player_api.php alapú JSON API
 */

const XTREAM_SERVER = 'https://live.pusztaplay.eu';
const USER_AGENT    = 'PusztaPlayer v0.8';
const CREDS_KEY     = 'pusztaplay_xtream_user';

export function saveXtreamCredentials(u, p) {
  try { localStorage.setItem(CREDS_KEY, JSON.stringify({ username: u, password: p })); } catch (e) {}
}
export function loadXtreamCredentials() {
  try { const r = localStorage.getItem(CREDS_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
export function clearXtreamCredentials() {
  try { localStorage.removeItem(CREDS_KEY); } catch (e) {}
}

async function apiGet(username, password, action = '', extra = '') {
  const url = `${XTREAM_SERVER}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${action ? `&action=${action}` : ''}${extra}`;
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (e) {
    throw new Error('A szerver nem elérhető. Ellenőrizd az internetkapcsolatot.');
  }
  if (res.status === 401 || res.status === 403) throw new Error('Hibás felhasználónév vagy jelszó.');
  if (!res.ok) throw new Error(`Szerver hiba: ${res.status}`);
  return res.json();
}

export function buildLiveUrl(u, p, id)                 { return `${XTREAM_SERVER}/live/${u}/${p}/${id}.m3u8`; }
export function buildVodUrl(u, p, id, ext = 'mp4')     { return `${XTREAM_SERVER}/movie/${u}/${p}/${id}.${ext}`; }
export function buildEpisodeUrl(u, p, id, ext = 'mkv') { return `${XTREAM_SERVER}/series/${u}/${p}/${id}.${ext}`; }

export async function xtreamCheckLogin(username, password) {
  const data = await apiGet(username, password);
  if (!data?.user_info) throw new Error('Hibás szerver válasz.');
  if (data.user_info.auth === 0) throw new Error('Hibás felhasználónév vagy jelszó.');
  return data.user_info;
}

/**
 * Kategória lista lekérése – általános helper.
 */
async function fetchCategories(username, password, action) {
  try {
    const cats = await apiGet(username, password, action);
    if (!Array.isArray(cats)) return { catOrder: [], catById: {} };
    const catOrder = cats.map(c => c.category_name).filter(Boolean);
    const catById  = Object.fromEntries(cats.map(c => [String(c.category_id), c.category_name]));
    return { catOrder, catById };
  } catch {
    return { catOrder: [], catById: {} };
  }
}

export async function xtreamGetLive(username, password) {
  const [{ catOrder, catById }, streams] = await Promise.all([
    fetchCategories(username, password, 'get_live_categories'),
    apiGet(username, password, 'get_live_streams')
  ]);
  if (!Array.isArray(streams)) throw new Error('Hibás live stream válasz.');
  const channels = streams.map((s, i) => {
    const group = catById[String(s.category_id)] || s.category_name || 'Egyéb';
    return {
      key: `live_${s.stream_id || i}`, streamId: s.stream_id,
      title: s.name || 'Ismeretlen csatorna', group,
      logo: s.stream_icon || '', status: `Élő · ${group}`,
      epg: [], type: 'live', streamUrl: buildLiveUrl(username, password, s.stream_id)
    };
  });
  const extraGroups = [...new Set(channels.map(c => c.group))].filter(g => !catOrder.includes(g));
  return { channels, groups: ['Összes csatorna', ...catOrder, ...extraGroups] };
}

export async function xtreamGetMovies(username, password) {
  const [{ catOrder, catById }, streams] = await Promise.all([
    fetchCategories(username, password, 'get_vod_categories'),
    apiGet(username, password, 'get_vod_streams')
  ]);
  if (!Array.isArray(streams)) throw new Error('Hibás VOD válasz.');
  const movies = streams.map((s, i) => {
    const group = catById[String(s.category_id)] || s.category_name || 'Egyéb';
    const ext   = s.container_extension || 'mp4';
    return {
      key: `vod_${s.stream_id || i}`, streamId: s.stream_id,
      title: s.name || 'Ismeretlen film', group,
      logo: s.stream_icon || '', status: group, type: 'movie',
      streamUrl: buildVodUrl(username, password, s.stream_id, ext)
    };
  });
  const extraGroups = [...new Set(movies.map(m => m.group))].filter(g => !catOrder.includes(g));
  return { movies, movieGroups: ['Összes film', ...catOrder, ...extraGroups] };
}

export async function xtreamGetSeries(username, password) {
  const [{ catOrder, catById }, list] = await Promise.all([
    fetchCategories(username, password, 'get_series_categories'),
    apiGet(username, password, 'get_series')
  ]);
  if (!Array.isArray(list)) throw new Error('Hibás series válasz.');
  const series = list.map((s, i) => {
    const group = catById[String(s.category_id)] || s.category_name || 'Egyéb';
    return {
      key: `series_${s.series_id || i}`, seriesId: s.series_id,
      title: s.name || 'Ismeretlen sorozat', group,
      logo: s.cover || s.stream_icon || '', status: group, type: 'series', streamUrl: null
    };
  });
  const extraGroups  = [...new Set(series.map(s => s.group))].filter(g => !catOrder.includes(g));
  return { series, seriesGroups: ['Összes sorozat', ...catOrder, ...extraGroups] };
}

/**
 * Film részletes info: get_vod_info
 * Visszaad: { info: { name, year, genre, director, cast, plot, cover_big, rating }, movie_data: {...} }
 */
export async function xtreamGetVodInfo(username, password, vodId) {
  const data = await apiGet(username, password, 'get_vod_info', `&vod_id=${vodId}`);
  if (!data?.info) throw new Error('Nincs film info.');
  return data;
}

/**
 * Sorozat részletes info: get_series_info
 */
export async function xtreamGetSeriesInfo(username, password, seriesId) {
  const data = await apiGet(username, password, 'get_series_info', `&series_id=${seriesId}`);
  if (!data?.episodes) throw new Error('Nincs epizódadat a sorozathoz.');
  return data;
}

export async function xtreamFullLogin(username, password) {
  const userInfo = await xtreamCheckLogin(username, password);
  const [liveData, vodData, seriesData] = await Promise.all([
    xtreamGetLive(username, password),
    xtreamGetMovies(username, password),
    xtreamGetSeries(username, password)
  ]);
  return {
    liveChannels: liveData.channels, channels: liveData.channels,
    movies: vodData.movies, series: seriesData.series,
    groups: liveData.groups, movieGroups: vodData.movieGroups,
    seriesGroups: seriesData.seriesGroups, userInfo, xtreamUser: username
  };
}

export async function fetchShortEpg(creds, streamId, limit = 5) {
  return [];
}
