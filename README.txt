PusztaPlay App v7 — Dark Pop-Art IPTV Player
=============================================

v6 → v7 változások:
- M3U / M3U8 playlist import (FileReader, EXTINF parse)
- EXTINF attribútumok: tvg-id, tvg-logo, group-title, name
- Csatorna logók megjelenítése (tvg-logo)
- localStorage cache: újratöltés után is megmarad az importált playlist
- Playlist törlés gomb a sidebarban
- Csoportszűrés a Live TV nézetben (groups panel kattintható)
- Importált csatornák + mock adatok automatikus fallback
- Playback session: importált csatorna streamUrl-jét használja

Fájlstruktúra:
- app.html — belépési pont
- js/app.js — fő alkalmazáslogika
- js/services/m3u-parser.js — M3U parse + localStorage cache
- js/services/playlist-import.js — FileReader import + cache init
- js/services/playback-session.js — session kezelés (M3U + mock fallback)
- js/services/player.js — HLS.js player absztrakció
- js/services/mock-data.js — demo adatok
- js/views/live.js — Live TV nézet (M3U-aware)
- js/components/sidebar.js — navigáció + import UI
- styles/ — CSS tokenek, layout, komponensek
- data/ — mock JSON adatok

Futtatás:
Bármely helyi HTTP szerver, pl. VS Code Live Server.
Nem igényel npm-et, backendet, vagy buildet.
