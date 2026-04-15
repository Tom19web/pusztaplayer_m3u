export function renderSkeletonGrid(count = 4) {
  return `
    <div class="skeleton-grid">
      ${Array.from({ length: count }).map(() => `
        <div class="skeleton-card">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-meta">
            <div class="skeleton-line" style="width:80%"></div>
            <div class="skeleton-line" style="width:55%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
