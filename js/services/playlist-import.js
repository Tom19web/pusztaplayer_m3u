/**
 * PusztaPlay v7 — Playlist Import Service
 * FEAT: Xtream Codes player_api.php JSON API (primár)
 *       Lokális .m3u fájl import (fallback)
 */

import { parseM3u, savePlaylistToCache, loadPlaylistFromCache, clearPlaylistCache } from './m3u-parser.js';
import {
  xtreamFullLogin,
  saveXtreamCredentials,
  loadXtreamCredentials,
  clearXtreamCredentials
} from './xtream-api.js';
import { emit } from '../core/events.js';

let currentPlaylist = null;

// Re-export a sidebar és app.js számára
export { loadXtreamCredentials, clearXtreamCredentials };

// ── Xtream API login ──────────────────────────────────────
export async function xtreamLogin(username, password) {
  const playlist = await xtreamFullLogin(username, password);
  currentPlaylist = playlist;
  savePlaylistToCache(playlist);
  saveXtreamCredentials(username, password);
  emit('playlistLoaded', playlist);
  return playlist;
}

// ── Cache inicializálás induláskor ───────────────────────────
export function initPlaylistFromCache() {
  const cached = loadPlaylistFromCache();
  if (cached) {
    currentPlaylist = cached;
    emit('playlistLoaded', cached);
  }
  return cached;
}

// ── Lokális fájl import (fallback) ──────────────────────────
export function importPlaylistFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const playlist = await parseM3u(e.target.result);
        currentPlaylist = playlist;
        savePlaylistToCache(playlist);
        emit('playlistLoaded', playlist);
        resolve(playlist);
      } catch (error) {
        reject(new Error('M3U parse hiba: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Fájl olvasási hiba'));
    reader.readAsText(file);
  });
}

export function getImportedPlaylist() { return currentPlaylist; }

export function clearImportedPlaylist() {
  currentPlaylist = null;
  clearPlaylistCache();
  clearXtreamCredentials();
  emit('playlistCleared', null);
}
