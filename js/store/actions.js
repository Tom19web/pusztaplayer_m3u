import { state } from './state.js';

/* ─── Watch History ─────────────────────────────────────────────────────── */
const HISTORY_KEY = 'pusztaplay_watch_history';
const HISTORY_MAX = 20;

function persistHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.watchHistory)); } catch (_) {}
}
export function loadHistoryFromStorage() {
  try { const r = localStorage.getItem(HISTORY_KEY); return r ? JSON.parse(r) : []; } catch (_) { return []; }
}
export function clearHistory() {
  state.watchHistory = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
}
export function addToHistory(item) {
  if (!item?.key) return;
  state.watchHistory = state.watchHistory.filter(h => h.key !== item.key);
  state.watchHistory.unshift({ ...item, addedAt: Date.now() });
  if (state.watchHistory.length > HISTORY_MAX) state.watchHistory.length = HISTORY_MAX;
  persistHistory();
}
export function getWatchHistory() { return state.watchHistory; }

/* ─── Favorites ─────────────────────────────────────────────────────────── */
const FAV_KEY = 'pusztaplay_favorites';

function persistFavorites() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites)); } catch (_) {}
}
export function loadFavoritesFromStorage() {
  try { const r = localStorage.getItem(FAV_KEY); return r ? JSON.parse(r) : []; } catch (_) { return []; }
}

/**
 * Kedvenc hozzáadása / eltávolítása (toggle).
 * @param {{ key:string, title:string, type:'live'|'movie'|'series', group?:string, logo?:string, streamUrl?:string, seriesId?:string }} item
 * @returns {boolean} true = hozzáadva, false = eltávolítva
 */
export function toggleFavorite(item) {
  if (!item?.key) return false;
  const idx = state.favorites.findIndex(f => f.key === item.key);
  if (idx !== -1) {
    state.favorites.splice(idx, 1);
    persistFavorites();
    return false;
  } else {
    state.favorites.unshift({ ...item, savedAt: Date.now() });
    persistFavorites();
    return true;
  }
}
export function isFavorite(key) {
  return state.favorites.some(f => f.key === key);
}
export function getFavoritesByType(type) {
  return state.favorites.filter(f => f.type === type);
}
export function clearFavorites() {
  state.favorites = [];
  try { localStorage.removeItem(FAV_KEY); } catch (_) {}
}

/* ─── Misc ───────────────────────────────────────────────────────────────── */
export function setView(view)             { state.navigation.currentView = view; }
export function setCurrentPlayerItem(key) { state.player.current = key; }
export function setUser(name, status)     { state.user = { name, status }; }
