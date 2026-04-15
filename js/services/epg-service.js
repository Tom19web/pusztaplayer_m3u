/**
 * PusztaPlay — EPG Service
 * Xtream get_short_epg végpont, in-memory cache (30 perces TTL)
 *
 * Használat:
 *   import { fetchShortEpg } from './epg-service.js';
 *   const rows = await fetchShortEpg(creds, streamId, 5);
 *   // rows: [{ time, endTime, title, description }]
 */

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 perc
const _cache = new Map(); // streamId -> { ts, rows }

/**
 * Rövid EPG lekérdezése egy csatornához.
 * @param {{ username:string, password:string, server?:string }} creds
 * @param {string|number} streamId
 * @param {number} [limit=5]
 * @returns {Promise<Array<{ time:string, endTime:string, title:string, description:string }>>}
 */
export async function fetchShortEpg(creds, streamId, limit = 5) {
  if (!creds?.username || !creds?.password || !streamId) return [];
  const cacheKey = `${streamId}`;
  const now = Date.now();
  const cached = _cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.rows;

  const server = creds.server || 'http://movaloget.cc:42310';
  const url = `${server}/player_api.php` +
    `?username=${encodeURIComponent(creds.username)}` +
    `&password=${encodeURIComponent(creds.password)}` +
    `&action=get_short_epg` +
    `&stream_id=${encodeURIComponent(streamId)}` +
    `&limit=${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const listings = data?.epg_listings || data?.EPG_Listings || [];
    const rows = listings.slice(0, limit).map(item => ({
      time:        _formatEpgTime(item.start || item.start_timestamp),
      endTime:     _formatEpgTime(item.stop  || item.end_timestamp),
      title:       _safeDecodeBase64(item.title)       || 'Ismeretlen műsor',
      description: _safeDecodeBase64(item.description) || ''
    }));
    _cache.set(cacheKey, { ts: now, rows });
    return rows;
  } catch {
    return [];
  }
}

export function invalidateEpgCache(streamId) { _cache.delete(`${streamId}`); }
export function clearEpgCache()              { _cache.clear(); }

// ── Segédfüggvények ──────────────────────────────────────────────────────────

/**
 * Base64 → UTF-8 szöveg dekódolás.
 * Az Xtream API MINDIG Base64-ben adja a title és description mezőket.
 * A magyar ékezetes karakterek (UTF-8 multi-byte) miatt atob() önmagában
 * nem elég – TextDecoder kell a helyes visszafejtéshez.
 *
 * Folyamat:
 *   1. atob()  → bináris string (raw bytes)
 *   2. Uint8Array-be konvertálás
 *   3. TextDecoder('utf-8') → helyes unicode string
 */
function _safeDecodeBase64(str) {
  if (!str || typeof str !== 'string') return '';
  // Ha nyilvánvalóan nem Base64 (pl. már plain text), visszaadjuk
  if (/[\s\u0080-\uFFFF]/.test(str) && !/^[A-Za-z0-9+/=]+$/.test(str.trim())) return str;
  try {
    const binary = atob(str.trim());
    // Bináris string → Uint8Array
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8').decode(bytes);
    // Üres vagy csak whitespace → ne adjuk vissza
    return decoded.trim() || '';
  } catch {
    // Ha nem valid Base64, visszaadjuk az eredetit
    return str;
  }
}

/**
 * EPG időbélyeg formázás magyar HH:MM alakra.
 * Két formátumot kezel:
 *   - Unix timestamp (szám, másodpercben)
 *   - Xtream saját formátum: 'YYYYMMDDHHMMSS ±ZZZZ'
 */
function _formatEpgTime(raw) {
  if (!raw) return '';
  let d;
  if (typeof raw === 'number' || /^\d+$/.test(raw)) {
    // Unix sec → ms (ha 10 jegynél kevesebb, biztosan másodperc)
    const n = Number(raw);
    d = new Date(n < 1e10 ? n * 1000 : n);
  } else {
    const m = String(raw).match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})/);
    if (m) {
      const [, yr, mo, day, hr, mn, sc, tz] = m;
      const sign = tz[0] === '+' ? 1 : -1;
      const tzH  = parseInt(tz.slice(1, 3), 10);
      const tzM  = parseInt(tz.slice(3),    10);
      const utc  = Date.UTC(+yr, +mo - 1, +day, +hr, +mn, +sc) - sign * (tzH * 60 + tzM) * 60000;
      d = new Date(utc);
    } else {
      d = new Date(raw);
    }
  }
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}
