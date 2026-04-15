import { loadXtreamCredentials } from '../services/playlist-import.js';
import { loadHistoryFromStorage, loadFavoritesFromStorage } from './actions.js';

const creds = (() => {
  try { return loadXtreamCredentials(); } catch (e) { return null; }
})();

export const state = {
  user: {
    name:   creds ? creds.username : 'PusztaPlay fiók',
    status: creds ? 'Xtream bejelentkezve' : 'nincs aktív session'
  },
  navigation: { currentView: 'home' },
  player:     { current: 'royal' },
  // Kedvencek – { key, title, type:'live'|'movie'|'series', group, logo, streamUrl, seriesId? }
  favorites: loadFavoritesFromStorage(),
  // Nézett tartalmak előzménye – localStorage-ból töltödik, max 20 bejegyzés
  watchHistory: loadHistoryFromStorage()
};
