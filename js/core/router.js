export function getRoute() {
  const hash = window.location.hash.replace('#', '') || 'home';
  const [name, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  return { name, params };
}
export function go(route, params = {}) {
  const qs = new URLSearchParams(params).toString();
  window.location.hash = qs ? `${route}?${qs}` : route;
}
