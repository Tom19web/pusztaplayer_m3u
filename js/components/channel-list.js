export function renderChannelList(channels) {
  return channels.map((c, i) => `
    <button class="channel-item ${i===0?'active':''}" data-open-player="${c.key}">
      ${c.title}<span class="sub">${c.status}</span>
    </button>
  `).join('');
}
