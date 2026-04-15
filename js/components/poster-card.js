export function renderPosterCard(key, title, subtitle, style = '') {
  return `
    <article class="card" data-open-player="${key}">
      <div class="thumb" style="${style}"><span>${title.replace(/ /g, '<br>')}</span></div>
      <div class="meta"><strong>${title}</strong><small>${subtitle}</small></div>
    </article>
  `;
}
