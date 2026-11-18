// Live title search for Orbit "Favourites" lists. Each field key maps to a
// public API; a picked result is stored as { title, image, sub } instead of a
// bare string, so the station card can show the poster / cover / artwork.
// Plain strings are still valid list items (old data, or typed by hand).
//
// Keys for OMDb / RAWG are the same ones the Chill Zone Media Tracker uses
// (user override in localStorage 'media-tracker-api-keys', else the defaults).

const API_KEYS_KEY = 'media-tracker-api-keys';
const DEFAULT_KEYS = { omdb: 'a6b92d31', rawg: '0a5ed22357d941438089378e466e3acf' };

function apiKeys() {
  try {
    const raw = localStorage.getItem(API_KEYS_KEY);
    if (raw) return { ...DEFAULT_KEYS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_KEYS;
}

const getJson = async (url, signal) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const q = (s) => encodeURIComponent(s.trim());
const LIMIT = 6;

const SOURCES = {
  movie: {
    label: 'OMDb',
    shape: 'poster',
    async search(query, signal) {
      const d = await getJson(`https://www.omdbapi.com/?apikey=${apiKeys().omdb}&s=${q(query)}`, signal);
      return (d.Search || []).slice(0, LIMIT).map((r) => ({
        title: r.Title,
        image: r.Poster && r.Poster !== 'N/A' ? r.Poster : '',
        sub: [r.Year, r.Type === 'series' ? 'Series' : r.Type === 'movie' ? 'Movie' : r.Type].filter(Boolean).join(' · '),
      }));
    },
  },
  game: {
    label: 'RAWG',
    shape: 'wide',
    async search(query, signal) {
      const d = await getJson(`https://api.rawg.io/api/games?key=${apiKeys().rawg}&search=${q(query)}&page_size=${LIMIT}`, signal);
      return (d.results || []).map((r) => ({
        title: r.name,
        image: r.background_image || '',
        sub: [r.released?.slice(0, 4), r.genres?.[0]?.name].filter(Boolean).join(' · '),
      }));
    },
  },
  anime: {
    label: 'MyAnimeList',
    shape: 'poster',
    async search(query, signal) {
      const d = await getJson(`https://api.jikan.moe/v4/anime?q=${q(query)}&limit=${LIMIT}&sfw=true`, signal);
      return (d.data || []).map((r) => ({
        title: r.title_english || r.title,
        image: r.images?.jpg?.image_url || '',
        sub: [r.year || r.aired?.prop?.from?.year, r.type].filter(Boolean).join(' · '),
      }));
    },
  },
  manga: {
    label: 'MyAnimeList',
    shape: 'poster',
    async search(query, signal) {
      const d = await getJson(`https://api.jikan.moe/v4/manga?q=${q(query)}&limit=${LIMIT}&sfw=true`, signal);
      return (d.data || []).map((r) => ({
        title: r.title_english || r.title,
        image: r.images?.jpg?.image_url || '',
        sub: [r.published?.prop?.from?.year, r.type].filter(Boolean).join(' · '),
      }));
    },
  },
  book: {
    label: 'Open Library',
    shape: 'poster',
    async search(query, signal) {
      const d = await getJson(`https://openlibrary.org/search.json?q=${q(query)}&limit=${LIMIT}&fields=title,author_name,first_publish_year,cover_i`, signal);
      return (d.docs || []).map((r) => ({
        title: r.title,
        image: r.cover_i ? `https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg` : '',
        sub: [r.author_name?.[0], r.first_publish_year].filter(Boolean).join(' · '),
      }));
    },
  },
  music: {
    label: 'iTunes',
    shape: 'square',
    async search(query, signal) {
      const d = await getJson(`https://itunes.apple.com/search?term=${q(query)}&entity=song&limit=${LIMIT}`, signal);
      return (d.results || []).map((r) => ({
        title: r.trackName,
        image: (r.artworkUrl100 || '').replace('100x100bb', '300x300bb'),
        sub: [r.artistName, r.collectionName].filter(Boolean).join(' · '),
      }));
    },
  },
  country: {
    label: 'REST Countries',
    shape: 'flag',
    async search(query, signal) {
      const d = await getJson(`https://restcountries.com/v3.1/name/${q(query)}?fields=name,flags,region`, signal);
      return (Array.isArray(d) ? d : []).slice(0, LIMIT).map((r) => ({
        title: r.name?.common,
        image: r.flags?.svg || r.flags?.png || '',
        sub: r.region || '',
      }));
    },
  },
};

// Orbit field key → source
const FIELD_SOURCE = {
  movies_tv: 'movie',
  games: 'game',
  anime_manga: 'anime',
  comics: 'manga',
  books_literature: 'book',
  music_soundtracks: 'music',
  country: 'country',
};

export const mediaSourceFor = (fieldKey) => {
  const id = FIELD_SOURCE[fieldKey];
  return id ? { id, ...SOURCES[id] } : null;
};

export const mediaShapeFor = (fieldKey) => SOURCES[FIELD_SOURCE[fieldKey]]?.shape || 'poster';

/** List item → display parts. Works for plain strings and picked results. */
export function mediaItem(item) {
  if (item && typeof item === 'object') {
    return { title: String(item.title ?? ''), image: String(item.image ?? ''), sub: String(item.sub ?? '') };
  }
  return { title: String(item ?? ''), image: '', sub: '' };
}

export const isMediaItem = (item) => Boolean(item && typeof item === 'object' && 'title' in item);
