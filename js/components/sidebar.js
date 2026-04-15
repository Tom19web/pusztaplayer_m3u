/**
 * PusztaPlay v7 — Sidebar
 * FEAT: Xtream Codes API bejelentkezési kártya
 *       (hardcoded szerver: http://movaloget.cc:42310)
 *       Fájl import eltávolítva – Xtream login váltja
 */

import { getImportedPlaylist, loadXtreamCredentials } from '../services/playlist-import.js';

const NAV_ITEMS = [
  ['home',      '🏠 Home'],
  ['live',      '📺 Live TV'],
  ['movies',    '🎬 Filmek'],
  ['series',    '📦 Sorozatok'],
  ['favorites', '⭐ Kedvencek'],
  ['player',    '▶ Lejátszó']
];

export function renderSidebar(activeView) {
  const imported = getImportedPlaylist();
  const creds    = loadXtreamCredentials();

  const liveCount   = imported?.liveChannels?.length ?? imported?.channels?.length ?? 0;
  const movieCount  = imported?.movies?.length  ?? 0;
  const seriesCount = imported?.series?.length  ?? 0;

  // ── Xtream státusz blokk ──────────────────────────
  const loginBlock = creds
    ? `
      <div class="side-card" style="border:1px solid #1fd6e8;">
        <p style="margin:0 0 6px">✅ <strong>${creds.username}</strong></p>
        <p class="muted" style="margin:0 0 10px;font-size:.85rem">movaloget.cc · Xtream API</p>
        <p class="import-success" style="margin:0 0 10px">
          ${liveCount} élő · ${movieCount} film · ${seriesCount} sorozat
        </p>
        <button class="btn btn-secondary" id="xtream-logout-btn" style="width:100%">⏏ Kijelentkezés</button>
      </div>`
    : `
      <div class="side-card">
        <strong>🔐 Xtream bejelentkezés</strong>
        <p class="muted" style="margin:8px 0 4px;font-size:.82rem">Szerver: movaloget.cc:42310</p>
        <input
          id="xtream-username"
          type="text"
          placeholder="Felhasználónév"
          autocomplete="username"
          style="display:block;width:100%;box-sizing:border-box;margin-bottom:8px;padding:7px 10px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;font-size:.95rem"
        />
        <input
          id="xtream-password"
          type="password"
          placeholder="Jelszó"
          autocomplete="current-password"
          style="display:block;width:100%;box-sizing:border-box;margin-bottom:12px;padding:7px 10px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;font-size:.95rem"
        />
        <button class="btn btn-primary" id="xtream-login-btn" style="width:100%">▶ Bejelentkezés</button>
        <p id="xtream-login-status" class="muted" style="margin-top:10px;font-size:.88rem;min-height:18px"></p>
      </div>`;

  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">▶</div>
        <div>
          <h1>pusztaplay</h1>
          <p>dark pop-art player app · v7</p>
        </div>
      </div>
      <div class="headline">Pörögj rá a nézésre</div>
      <nav class="nav" aria-label="Fő navigáció">
        ${NAV_ITEMS.map(([key, label]) =>
          `<button class="nav-btn ${activeView === key ? 'active' : ''}" data-route="${key}">${label}</button>`
        ).join('')}
      </nav>
      <div class="side-card">
        <small>Aktív csomag</small>
        <strong>Prémium hozzáférés</strong>
        <small>Xtream Codes API · PusztaPlayer Prototipus</small>
      </div>
      ${loginBlock}
    </aside>
  `;
}
