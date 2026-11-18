// DEV ONLY — sample content for every orbit checkpoint so every station card
// can be previewed without editing real data. The scene only uses this when
// import.meta.env.DEV is true. Nothing here is saved anywhere.
import { MASTER_CHECKPOINTS } from '../orbits/OrbitsContext';

const IMDB = 'https://m.media-amazon.com/images/M/';

const SAMPLES = {
  'cp-01': {
    name: 'Tahmid Rahman',
    id: '20230104087',
    dept: 'CSE',
    batch: '47th Batch',
    blood_group: 'O+',
    about_me: 'CSE 3rd year at AUST.\nNight owl, chai addict, part-time bug hunter. I like building tiny tools that save people five minutes a day.',
  },
  'cp-02': {
    movies_tv: [
      { title: 'Interstellar', sub: '2014 · Movie', image: `${IMDB}MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg` },
      { title: 'Spirited Away', sub: '2001 · Movie', image: `${IMDB}MV5BNTEyNmEwOWUtYzkyOC00ZTQ4LTllZmUtMjk0Y2YwOGUzYjRiXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg` },
      { title: 'The Dark Knight', sub: '2008 · Movie', image: `${IMDB}MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg` },
      { title: 'Breaking Bad', sub: '2008–2013 · Series', image: `${IMDB}MV5BMzU5ZGYzNmQtMTdhYy00OGRiLTg0NmQtYjVjNzliZTg1ZGE4XkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg` },
      'Aynabaji',
    ],
    games: [
      { title: 'Valorant', sub: '2020 · Shooter', image: 'https://media.rawg.io/media/games/b11/b11127b9ee3c3701bd15b9af3286d20e.jpg' },
      { title: 'Elden Ring', sub: '2022 · RPG', image: '' },
    ],
    anime_manga: ['Attack on Titan', 'Your Name', 'Haikyuu!!'],
    comics: ['Batman: Year One'],
    books_literature: ['Himu — Humayun Ahmed', 'Atomic Habits'],
    music_soundtracks: [
      { title: 'Yellow', sub: 'Coldplay · Parachutes', image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f5/93/8c/f5938c49-964c-31d1-4b33-78b634f71fb7/190295978075.jpg/300x300bb.jpg' },
      'Hasimukh — Arnob',
    ],
    quotes: ['Stay hungry, stay foolish.', 'It works on my machine.'],
    food: ['Kacchi biryani', 'Fuchka', 'Chai'],
    color: ['#2dd4bf', 'Midnight blue', '#f59e0b'],
    city: ['Chattogram', 'Dhaka'],
    country: ['Bangladesh', 'Japan'],
    youtubers: ['Fireship', '3Blue1Brown'],
    vloggers: ['Rafsan TheChotoBhai'],
  },
  'cp-03': {
    clubs: [
      { name: 'AUST Programming Club', designation: 'Problem setter' },
      { name: 'AUST Robotics Club', designation: 'Member' },
    ],
    societies: [{ name: 'Debating Society', designation: 'Joint secretary' }],
  },
  'cp-04': {
    github: 'tahmid-dev',
    linkedin: 'tahmidrahman',
    discord: 'tahmid#0420',
    facebook: 'tahmid.rahman',
    instagram: 'tahmid.codes',
  },
  'cp-05': {
    questions: [
      { q_id: 'q1', question: 'Morning class or night lab?', option_a: 'Morning class', option_b: 'Night lab', selected_option: 'b' },
      { q_id: 'q2', question: 'Tea or coffee?', option_a: 'Tea', option_b: 'Coffee', selected_option: 'a' },
      { q_id: 'q3', question: 'Tabs or spaces?', option_a: 'Tabs', option_b: 'Spaces', selected_option: 'b' },
    ],
  },
  'cp-06': {
    account_created_at: '2024-02-11',
    reviews_posted_count: 23,
    system_clearance_level: 'Level 3 · Contributor',
  },
  'cp-07': { list: ['Photography', 'Competitive programming', 'Cycling', 'Sketching'] },
  'cp-08': {
    items: [
      { title: 'IUPC 2025 — Honourable mention', year: '2025', certificate_url: 'https://example.com/cert/iupc' },
      { title: 'AUST Hackathon — 2nd runner-up', year: '2024', certificate_url: '' },
      { title: "Dean's list", year: '2024', certificate_url: '' },
    ],
  },
  'cp-09': {
    logs: [
      { destination: "Cox's Bazar", year: '2025', experience: 'Sunrise at Inani beach after an all-nighter of debugging. Worth it.' },
      { destination: 'Sajek Valley', year: '2024', experience: 'Clouds below the cottage, no network for two days.' },
    ],
  },
  'cp-10': {
    items: [
      'Ship a full-stack project people actually use',
      'ICPC regional',
      'Learn Japanese — N4',
      'Ride the Shinkansen once',
    ],
  },
  'cp-11': {
    favourite_course: 'Data Structures',
    toughest_course: 'Numerical Methods',
    favourite_spot: 'Library 4th floor, window side',
    canteen_order: 'Singara + milk tea',
    study_style: 'Night before + group call',
    best_memory: 'Our team pulled an all-nighter in the lab for the AUST hackathon. We lost the final, but the 4 AM khichuri on the rooftop was the best part of 2nd year.',
  },
  'cp-12': {
    languages: ['C++', 'JavaScript', 'Python', 'SQL'],
    frameworks: ['React', 'Node.js', 'Express', 'Tailwind'],
    tools: ['Git', 'Figma', 'VS Code', 'Postman', 'Docker'],
    currently_learning: ['TypeScript', 'System design'],
  },
  'cp-13': {
    items: [
      { title: 'AUSTWise', year: '2025', description: 'Campus super-app: routine, notices, money tracker and this very road trip.', url: 'https://github.com/' },
      { title: 'Bhara Koto', year: '2024', description: 'Rickshaw / CNG fare estimator for Dhaka routes, built over one weekend.', url: '' },
      { title: 'CF Streak Bot', year: '2024', description: 'Discord bot that pings the group when someone breaks their Codeforces streak.', url: '' },
    ],
  },
  'cp-14': {
    wake_up_time: '7:10 AM (three alarms)',
    sleep_time: '2:00 AM, usually',
    most_productive: '11 PM – 2 AM',
    commute: 'Bus from Mirpur · 50 min',
    daily_rituals: ['First chai before the 8 AM class', 'One Codeforces problem a day', 'Evening walk around Tejgaon', 'Lo-fi + 30 min reading before bed'],
  },
  'cp-15': {
    mbti: 'INTP-T',
    zodiac: 'Aquarius',
    social_battery: '40% · recharges with chai',
    three_words: ['Curious', 'Calm', 'Overthinker'],
    green_flags: ['Replies to memes', 'Shares notes', 'Remembers birthdays'],
    pet_peeves: ['Loud keyboard in the library', 'Group projects with ghosts', '“Bro, quick question” at 3 AM'],
  },
  'cp-16': {
    reading: 'Deep Work — Cal Newport',
    watching: 'Severance S2',
    playing: 'Hades II',
    listening_to: 'Arnob · Dhaka live session',
    learning: 'TypeScript generics',
    working_on: 'Final year thesis proposal',
  },
  'cp-17': {
    items: [
      { language: 'Bangla', level: 'Native' },
      { language: 'English', level: 'Fluent' },
      { language: 'Hindi', level: 'Conversational' },
      { language: 'Japanese', level: 'Beginner · N5' },
    ],
  },
  'cp-18': {
    events: [
      { year: '2019', title: 'Wrote my first line of code', description: 'A QBASIC loop that printed my name 100 times.' },
      { year: '2021', title: 'HSC from Notre Dame College', description: '' },
      { year: '2022', title: 'Joined AUST — CSE', description: 'Found my people in the programming club in week one.' },
      { year: '2024', title: 'First internship', description: 'Frontend intern at a Dhaka fintech startup for 3 months.' },
    ],
  },
  'cp-19': {
    dream_job: 'Product engineer',
    dream_company: 'A small team that ships fast',
    role_model: 'My elder sister',
    five_year_plan: 'Finish CSE, work two years at a product company, then build something of my own for Bangladeshi students.',
  },
  'cp-20': {
    device: 'ThinkPad E14 · Ryzen 5',
    os: 'Windows + WSL Ubuntu',
    editor: 'VS Code · One Dark Pro',
    phone: 'Pixel 7a',
    headphones: 'Soundcore Q20i',
    setup_note: 'Second monitor is a 10-year-old Samsung that refuses to die. Mechanical keyboard on the way.',
  },
  'cp-21': {
    places: [
      { name: 'Tong at Satmasjid Road', area: 'Dhanmondi', note: 'Best malai cha after 9 PM.' },
      { name: 'Hatirjheel bridge', area: 'Tejgaon', note: 'Late-night bike rides with the gang.' },
      { name: 'Nilkhet', area: 'Dhaka University', note: 'Second-hand books, haggling is mandatory.' },
    ],
  },
  'cp-22': {
    items: [
      { name: 'Mishti', species: 'Cat · Deshi', note: 'Sleeps on my keyboard during exams.' },
      { name: 'Bubbles', species: 'Goldfish', note: '' },
    ],
  },
  'cp-23': {
    items: [
      'I can solve a Rubik’s cube in under a minute',
      'Have never missed an 8 AM class (so far)',
      'Ate 14 fuchka in one sitting',
      'Named my laptop “Potato”',
    ],
  },
  'cp-24': {
    topics: ['Competitive programming', 'React', 'Budget laptops', 'Anime recs', 'Cox’s Bazar trips', 'Chai spots'],
  },
  'cp-25': {
    message: 'Thanks for riding all the way here! If anything on this road made you smile, say hi in Messages — I reply faster than my Wi-Fi loads.',
    signature: '— Tahmid',
  },
};

const filled = (v) => (Array.isArray(v)
  ? v.some((x) => (x && typeof x === 'object' ? Object.values(x).some(filled) : String(x ?? '').trim() !== ''))
  : String(v ?? '').trim() !== '' && v !== 0);

/** Real values win; any empty field is filled from the sample (dev preview only). */
export function withDevFakeFields(stops) {
  return stops.map((s) => {
    const sample = SAMPLES[s.key];
    if (!sample) return s;
    const fields = { ...sample };
    Object.entries(s.fields || {}).forEach(([k, v]) => { if (filled(v)) fields[k] = v; });
    return { ...s, fields };
  });
}

/** Every checkpoint with sample content, for when no custom stops exist. */
export const DEV_FAKE_STOPS = MASTER_CHECKPOINTS.map((cp) => ({
  key: cp.id,
  label: cp.label,
  fields: SAMPLES[cp.id] || cp.fields,
}));
