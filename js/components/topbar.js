export function renderTopbar(user) {
  return `
    <div class="topbar">
      <div class="search">
        <span>🔎</span>
        <input id="global-search" type="text" placeholder="Keresés csatornára, filmre vagy műsorra..." autocomplete="off" />
      </div>
      <div class="user-chip">
        <div class="avatar">P</div>
        <div>
          <strong>${user.name}</strong><br />
          <small class="muted">${user.status}</small>
        </div>
      </div>
    </div>
  `;
}
