// Mock data for the Stalk Road-Trip portfolio feature.
// Every community member gets a deterministic, personality-driven portfolio
// seeded from their id + name so the data stays stable across refreshes.

// Favorite color palette — vivid hues that pop on the dark road overlay.
const COLORS = [
  '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899',
  '#22c55e', '#eab308', '#fb7185', '#34d399', '#60a5fa', '#f97316',
];

// Hobby icon keys — resolved to lucide icons in the components.
const HOBBY_POOL = ['movies', 'gaming', 'anime', 'music', 'coffee', 'books', 'code', 'food'];

const MOVIE_POOL = [
  { title: 'Interstellar', year: 2014, rating: 8.7, genre: 'Sci-Fi', colors: ['#0ea5e9', '#312e81'] },
  { title: 'The Dark Knight', year: 2008, rating: 9.0, genre: 'Action', colors: ['#1e293b', '#f59e0b'] },
  { title: 'Spirited Away', year: 2001, rating: 8.6, genre: 'Animation', colors: ['#10b981', '#0f172a'] },
  { title: 'Inception', year: 2010, rating: 8.8, genre: 'Thriller', colors: ['#64748b', '#0f172a'] },
  { title: 'Your Name', year: 2016, rating: 8.4, genre: 'Romance', colors: ['#8b5cf6', '#ec4899'] },
  { title: 'Parasite', year: 2019, rating: 8.5, genre: 'Drama', colors: ['#4d7c0f', '#1c1917'] },
  { title: 'La La Land', year: 2016, rating: 8.0, genre: 'Musical', colors: ['#3b82f6', '#f472b6'] },
  { title: 'Fight Club', year: 1999, rating: 8.8, genre: 'Thriller', colors: ['#dc2626', '#111827'] },
  { title: 'Forrest Gump', year: 1994, rating: 8.8, genre: 'Drama', colors: ['#059669', '#78350f'] },
  { title: 'Everything Everywhere All at Once', year: 2022, rating: 7.8, genre: 'Sci-Fi', colors: ['#c026d3', '#14b8a6'] },
  { title: 'The Batman', year: 2022, rating: 7.8, genre: 'Action', colors: ['#450a0a', '#fca5a5'] },
  { title: 'Whiplash', year: 2014, rating: 8.5, genre: 'Drama', colors: ['#b45309', '#0c0a09'] },
];

const GAME_POOL = [
  { name: 'Valorant', platform: 'PC', hours: 412, rank: 'Immortal 1', achievements: 48, total: 61 },
  { name: 'Elden Ring', platform: 'PC', hours: 186, rank: 'Completionist', achievements: 42, total: 42 },
  { name: 'Minecraft', platform: 'PC', hours: 905, rank: 'Veteran', achievements: 87, total: 102 },
  { name: 'FIFA 24', platform: 'PS5', hours: 240, rank: 'Div 2', achievements: 18, total: 37 },
  { name: 'Genshin Impact', platform: 'Mobile', hours: 520, rank: 'AR 58', achievements: 312, total: 350 },
  { name: 'Counter-Strike 2', platform: 'PC', hours: 1300, rank: 'LEM', achievements: 74, total: 120 },
  { name: 'The Witcher 3', platform: 'PC', hours: 150, rank: 'Completionist', achievements: 78, total: 78 },
  { name: 'PUBG Mobile', platform: 'Mobile', hours: 640, rank: 'Conqueror', achievements: 205, total: 268 },
  { name: 'Mario Kart 8', platform: 'Switch', hours: 88, rank: '2★', achievements: 33, total: 42 },
  { name: 'Sekiro', platform: 'PC', hours: 96, rank: 'Sword Saint', achievements: 34, total: 34 },
];

const ANIME_POOL = [
  { title: 'Attack on Titan', status: 'Completed', episodes: 87, total: 87, score: 9.2, studio: 'MAPPA' },
  { title: 'Fullmetal Alchemist: Brotherhood', status: 'Completed', episodes: 64, total: 64, score: 9.1, studio: 'Bones' },
  { title: 'Jujutsu Kaisen', status: 'Watching', episodes: 37, total: 47, score: 8.6, studio: 'MAPPA' },
  { title: 'One Piece', status: 'Watching', episodes: 1085, total: 1200, score: 8.9, studio: 'Toei' },
  { title: 'Naruto Shippuden', status: 'Completed', episodes: 500, total: 500, score: 8.2, studio: 'Pierrot' },
  { title: 'Death Note', status: 'Completed', episodes: 37, total: 37, score: 8.6, studio: 'Madhouse' },
  { title: 'Demon Slayer', status: 'Completed', episodes: 55, total: 55, score: 8.3, studio: 'ufotable' },
  { title: 'Steins;Gate', status: 'Completed', episodes: 24, total: 24, score: 9.0, studio: 'White Fox' },
  { title: 'Vinland Saga', status: 'Watching', episodes: 24, total: 48, score: 8.8, studio: 'Wit' },
  { title: 'Frieren', status: 'Watching', episodes: 26, total: 28, score: 9.1, studio: 'Madhouse' },
  { title: 'Chainsaw Man', status: 'Plan to Watch', episodes: 0, total: 12, score: 0, studio: 'MAPPA' },
  { title: 'Kimi no Na wa', status: 'Completed', episodes: 1, total: 1, score: 8.8, studio: 'CoMix Wave' },
];

const TRACK_POOL = [
  { title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55' },
  { title: 'Stairway to Heaven', artist: 'Led Zeppelin', duration: '8:02' },
  { title: 'In the End', artist: 'Linkin Park', duration: '3:36' },
  { title: 'Numb', artist: 'Linkin Park', duration: '3:06' },
  { title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20' },
  { title: 'Hotel California', artist: 'Eagles', duration: '6:30' },
  { title: 'Lose Yourself', artist: 'Eminem', duration: '5:26' },
  { title: 'Smooth Criminal', artist: 'Michael Jackson', duration: '4:17' },
  { title: 'Creep', artist: 'Radiohead', duration: '3:59' },
  { title: 'Do I Wanna Know?', artist: 'Arctic Monkeys', duration: '4:32' },
];

const ARTIST_POOL = [
  'Queen', 'Linkin Park', 'The Weeknd', 'Eminem', 'Coldplay',
  'BTS', 'Arijit Singh', 'Kendrick Lamar', 'The Beatles', 'Imagine Dragons',
];

const MATCHUP_POOL = [
  { id: 'tea-coffee', a: 'Tea', b: 'Coffee', aPct: 54 },
  { id: 'owl-bird', a: 'Night Owl', b: 'Early Bird', aPct: 72 },
  { id: 'code-game', a: 'Coding', b: 'Gaming', aPct: 46 },
  { id: 'lofi-rock', a: 'Lofi', b: 'Rock', aPct: 62 },
  { id: 'chai-cold', a: 'Chai', b: 'Cold Coffee', aPct: 58 },
  { id: 'emoji-typing', a: 'Emoji', b: 'Proper Typing', aPct: 49 },
  { id: 'city-beach', a: 'City Life', b: 'Beach Vibes', aPct: 38 },
  { id: 'arcade-rpg', a: 'Arcade', b: 'RPG', aPct: 30 },
];

/* ─── deterministic seeded PRNG (mulberry32) ─── */
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(pool, rng, count) {
  const copy = [...pool];
  const out = [];
  while (out.length < count && copy.length) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

const STATUS_META = {
  Completed: { color: '#10b981', label: 'Completed' },
  Watching: { color: '#f59e0b', label: 'Watching' },
  'Plan to Watch': { color: '#64748b', label: 'Planned' },
};

export function buildStalkPortfolio(member) {
  const name = member?.name || 'Mystery Member';
  const seedKey = `${member?.id || ''}${name}${member?.department || ''}`;
  const seed = hashString(seedKey);
  const rng = mulberry32(seed);

  const favoriteColor = COLORS[seed % COLORS.length];

  const hobbies = pick(HOBBY_POOL, rng, 4);
  const movies = pick(MOVIE_POOL, rng, 6);
  const games = pick(GAME_POOL, rng, 4).map((g) => ({ ...g, hours: Math.round(g.hours * (0.7 + rng() * 0.7)) }));
  const anime = pick(ANIME_POOL, rng, 4);
  const topTracks = pick(TRACK_POOL, rng, 5);
  const topArtists = pick(ARTIST_POOL, rng, 4);
  const matchups = pick(MATCHUP_POOL, rng, 4).map((m) => ({
    ...m,
    aPct: Math.min(88, Math.max(12, m.aPct + Math.round((rng() - 0.5) * 24))),
  }));

  const vibe = ['Late-night grinder', 'Chill weekend energy', 'Caffeine-fuelled coder', 'Arcade speedrunner', 'Story-driven dreamer'][seed % 5];
  const miles = 120 + (seed % 880);

  return {
    id: member?.id || 'stalk-unknown',
    name,
    avatar: member?.avatar || null,
    initials: member?.initials || name.slice(0, 2).toUpperCase(),
    role: member?.role || 'student',
    department: member?.department || 'Undeclared',
    semester: member?.semester || null,
    favoriteColor,
    vibe,
    miles,
    hobbies,
    movies,
    games,
    anime,
    topTracks,
    topArtists,
    matchups,
  };
}

export { COLORS, HOBBY_POOL, STATUS_META };