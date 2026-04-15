/**
 * PusztaPlay v7 — Playback Session
 * FEAT: Xtream stream URL-ek minden tartalomtípushoz
 *       Fallback: mock adatok
 */

import { playerData }          from './mock-data.js';
import { getImportedPlaylist } from './playlist-import.js';

export async function createPlaybackSession(contentId) {
  const imported = getImportedPlaylist();

  if (imported) {
    // Live csatorna keresés
    const allChannels = imported.liveChannels || imported.channels || [];
    const live = allChannels.find(ch => ch.key === contentId);
    if (live) {
      return {
        contentId,
        title:      live.title,
        streamType: 'hls',
        token:      'xtream-live',
        streamUrl:  live.streamUrl,
        isLive:     true
      };
    }

    // VOD keresés
    const vod = (imported.movies || []).find(m => m.key === contentId);
    if (vod) {
      return {
        contentId,
        title:      vod.title,
        streamType: 'mp4',
        token:      'xtream-vod',
        streamUrl:  vod.streamUrl,
        isLive:     false
      };
    }

    // Sorozat / epizód keresés
    // – epizódok dinamikusan kerülnek a playlist.series tömbbe (app.js bindSeriesCards)
    // – a streamUrl itt már ki van töltve az epizód URL-jével
    const ser = (imported.series || []).find(s => s.key === contentId);
    if (ser) {
      return {
        contentId,
        title:      ser.title,
        streamType: ser.streamUrl ? 'mp4' : null,
        token:      'xtream-series',
        streamUrl:  ser.streamUrl || null,
        isLive:     false
      };
    }
  }

  // Fallback: mock adatok
  const item = playerData[contentId];
  return {
    contentId,
    title:      item?.title    || 'Ismeretlen tartalom',
    streamType: 'hls',
    token:      'demo-session-token',
    streamUrl:  item?.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    isLive:     !!item?.isLive
  };
}
