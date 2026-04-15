import { state } from './state.js';
export const getUser            = () => state.user;
export const getCurrentPlayer  = () => state.player.current;
export const getFavoriteKeys   = () => state.favorites.map(f => f.key);
export const getFavorites      = () => state.favorites;
export const getWatchHistory   = () => state.watchHistory;
