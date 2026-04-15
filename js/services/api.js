async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Nem sikerült betölteni: ${path}`);
  return response.json();
}

export async function getHomeData() {
  return fetchJson('./data/home.json');
}

export async function getMovies() {
  return fetchJson('./data/movies.json');
}

export async function getLiveData() {
  return fetchJson('./data/live.json');
}

export async function getFavorites() {
  return fetchJson('./data/favorites.json');
}
