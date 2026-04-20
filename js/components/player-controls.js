// js/components/player-controls.js

export function renderPlayerControls(key = '') {
  return `
    <div class="controls">
      <button class="control-btn" id="ctrl-playpause" data-action="playpause" title="Lejátszás / Szünet">
        ▶ Lejátszás
      </button>
      <div class="ctrl-group" style="position:relative">
        <button class="control-btn" id="ctrl-audio" data-action="audio" title="Hangsáv választás">
          🔊 Hang
        </button>
        <div id="audio-menu" class="ctrl-dropdown hidden"></div>
      </div>
      <div class="ctrl-group" style="position:relative">
        <button class="control-btn" id="ctrl-subtitle" data-action="subtitle" title="Felirat választás">
          💬 Felirat
        </button>
        <div id="subtitle-menu" class="ctrl-dropdown hidden"></div>
      </div>
      <button
        class="control-btn fav-heart"
        id="ctrl-fav"
        data-fav-toggle="${key}"
        title="Hozzáadás a kedvencekhez"
        aria-pressed="false">
        ♡ Kedvencekhez
      </button>
      <div class="progress" id="progress-bar">
        <div id="progress-fill"></div>
      </div>
      <button class="control-btn" id="ctrl-fullscreen" data-action="fullscreen" title="Teljes képernyő">
        ⛶ Fullscreen
      </button>
    </div>
  `;
}
