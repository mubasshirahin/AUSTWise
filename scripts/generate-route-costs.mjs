// ═══════════════════════════════════════════════════════════════
//  generate-route-costs.mjs
//  Batch research process for the Dhaka → AUST distance/cost table.
//
//  Reads the master location list, geocodes each area (Nominatim),
//  fetches driving-route distance (OSRM public), applies standard
//  Dhaka fare-estimation logic, and writes:
//    - src/data/dhakaRouteCosts.json          (the live table rows)
//    - src/data/dhakaRouteCosts.needsReview.json (failed/ambiguous geocodes)
//
//  Re-run any time to refresh:  node scripts/generate-route-costs.mjs
//  Results are cached in the OS temp dir so re-runs are fast.
// ═══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Destination: AUST Tejgaon Campus (geocoded via Nominatim) ──
const DEST = { name: 'AUST Tejgaon Campus', lat: 23.7634468, lon: 90.4072150 };

const SOURCE_MD = path.join(ROOT, 'dhaka_master_location_list.md');
const OUT_ROWS = path.join(ROOT, 'src', 'data', 'dhakaRouteCosts.json');
const OUT_NEEDS = path.join(ROOT, 'src', 'data', 'dhakaRouteCosts.needsReview.json');
const CACHE = path.join(os.tmpdir(), 'opencode', 'route-geocode-cache.json');

const NOMINATIM_UA = 'AUSTWise-distance-table/1.0 (research; contact: admin@austwise.app)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Existing known data (seeds where we have real estimates) ──
// Reuses the curated Dhaka area dataset so matched rows keep consistent fares.
import { DHKA_AREAS, METRO_STATIONS } from '../src/data/fareData.js';

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function seedByArea() {
  const map = new Map();
  for (const area of DHKA_AREAS) {
    const hay = [area.name, ...(area.aliases || [])].map(normalize);
    for (const h of hay) map.set(h, area);
  }
  return map;
}
const SEED = seedByArea();

// ── Master area list parsing ───────────────────────────────────
function parseMasterList(mdPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const names = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\s*\*\s*(.+?)\s*$/);
    if (!m) continue;
    let name = m[1]
      .replace(/\*\*(.*?)\*\*/g, '$1')   // strip bold
      .replace(/\s*\*.*$/, '')            // strip trailing italic notes
      .trim();
    if (!name || name.startsWith('#')) continue;
    names.push(name);
  }
  return [...new Set(names)];
}

// ── Geocoding (cached) ─────────────────────────────────────────
// Manual seed coordinates for known Dhaka areas that public geocoders
// can't resolve (sub-blocks, housing estates, local names).
const MANUAL_GEO = {
  'Aabahanikunja': { lat: 23.7903, lon: 90.4054 },
  'Aftab Nagar (Block A - L)': { lat: 23.8157, lon: 90.4421 },
  'Baridhara DIT Project': { lat: 23.7940, lon: 90.4240 },
  'Bashundhara R/A (Block A - N)': { lat: 23.8215, lon: 90.4436 },
  'Buddho Mondir': { lat: 23.7498, lon: 90.3898 },
  'BUET Area': { lat: 23.7262, lon: 90.3937 },
  'Chandni Chowk': { lat: 23.7109, lon: 90.4095 },
  'Dohar (Upazila City)': { lat: 23.6000, lon: 90.2500 },
  'Gopibagh': { lat: 23.7055, lon: 90.4285 },
  'Happy Homes Area (West Rampura)': { lat: 23.7630, lon: 90.4320 },
  'Jamuna Future Park Area': { lat: 23.8140, lon: 90.4310 },
  'Jayanagar': { lat: 23.7830, lon: 90.4110 },
  'Keraniganj (Upazila City)': { lat: 23.6810, lon: 90.3600 },
  'Modhubagh': { lat: 23.7510, lon: 90.3930 },
  'Mohammadpur Housing Limited (1-5)': { lat: 23.7650, lon: 90.3590 },
  'Naba Diganta': { lat: 23.7850, lon: 90.4150 },
  'Nazirabazar': { lat: 23.7500, lon: 90.4150 },
  'Nikunja Residential Area (All Blocks)': { lat: 23.8350, lon: 90.4120 },
  'Nirjhor Residential Area': { lat: 23.8360, lon: 90.3910 },
  'Nivedika': { lat: 23.7850, lon: 90.3800 },
  'Pallabi Extension': { lat: 23.8280, lon: 90.3700 },
  'Priyanka Runway City': { lat: 23.8500, lon: 90.3900 },
  'Razarbagh': { lat: 23.7490, lon: 90.3920 },
  'Sankharia Bazar': { lat: 23.6960, lon: 90.3910 },
  'Shah Ali Bag': { lat: 23.7810, lon: 90.3810 },
  'Shahinbag': { lat: 23.8030, lon: 90.4070 },
  'Shekhertek Housing': { lat: 23.7850, lon: 90.3330 },
  'Sunvir Valley': { lat: 23.7910, lon: 90.3570 },
  'Tejkuni Para': { lat: 23.7635, lon: 90.3970 },
};

async function geocode(name) {
  if (MANUAL_GEO[name]) return MANUAL_GEO[name];

  const cache = fs.existsSync(CACHE)
    ? JSON.parse(fs.readFileSync(CACHE, 'utf8'))
    : {};
  if (cache[name]) return cache[name];

  const queries = [
    `${name}, Dhaka, Bangladesh`,
    `${name}, Bangladesh`,
  ];
  let best = null;
  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&countrycodes=bd`;
    const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA } });
    if (!res.ok) {
      await sleep(1500);
      continue;
    }
    const results = await res.json();
    // Prefer a result whose display_name clearly mentions Dhaka.
    best = results.find((r) => /dhaka/i.test(r.display_name)) || results[0] || null;
    if (best) break;
    await sleep(1100); // respect rate limit
  }

  const entry = best
    ? { lat: parseFloat(best.lat), lon: parseFloat(best.lon), name: best.display_name }
    : null;
  cache[name] = entry;
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  await sleep(1100); // Nominatim: max 1 req/sec
  return entry;
}

// ── OSRM driving distance ──────────────────────────────────────
async function routeKm(src, dst) {
  const url = `https://router.project-osrm.org/route/v1/driving/${src.lon},${src.lat};${dst.lon},${dst.lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;
  const m = data.routes[0].distance;
  if (!Number.isFinite(m) || m <= 0) return null;
  return Math.max(1, Math.round(m / 100) / 10); // km, 1 decimal
}

// ── Fare estimation logic ──────────────────────────────────────
const fmt = (n) => Math.round(n / 5) * 5;
const rng = (a, b) => `৳${fmt(Math.min(a, b))}–${fmt(Math.max(a, b))}`;

function walkingTime(km) {
  if (km >= 4) return '-';
  const min = Math.round((km / 4.8) * 60);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

function rickshaw(km, seed) {
  if (km > 5) return '-';
  if (seed?.rickshaw_fare) return rng(seed.rickshaw_fare[0], seed.rickshaw_fare[1]);
  const min = Math.max(30, Math.round(12 * km));
  const max = Math.max(50, Math.round(15 * km));
  return rng(min, max);
}

// Master-list name → MRT-6 station (approx reachable within ~2km).
// Fares are single-journey to Farmgate per published MRT-6 chart.
const MRT = [
  [/uttara sector 1|uttara sector 2|uttara sector 3|uttara sector 4/, 'Uttara North', 80],
  [/uttara sector 5|uttara sector 6|uttara sector 7|uttara sector 8|uttara sector 9|uttara sector 10/, 'Uttara Center', 60],
  [/uttara sector 1[1-9]/, 'Uttara South', 60],
  [/diabari/, 'Uttara South', 60],
  [/azampur|abdullahpur|ashkona/, 'Uttara North', 80],
  [/khilkhet|nikunja 1|nikunja 2|nikunja residential/, 'Uttara South', 60],
  [/pallabi|rupnagar/, 'Pallabi', 50],
  [/mirpur 1[1-4]|monipur|kalshi|senpara/, 'Mirpur 11', 50],
  [/mirpur 10|mirpur 6|mirpur 7|mirpur 9|mazar road|beribadh/, 'Mirpur 10', 40],
  [/mirpur 1|mirpur 2|mirpur 3|mirpur 4|mirpur 5|mirpur 60 feet/, 'Mirpur 10', 40],
  [/ibrahimpur|kazipara/, 'Kazipara', 40],
  [/kafrul|north kafrul|shewrapara/, 'Shewrapara', 30],
  [/kochukhet|kachukhet/, 'Agargaon', 20],
  [/agargaon/, 'Agargaon', 20],
  [/bijoy sarani|sher e bangla|sher-e-bangla|dhaka uddan/, 'Bijoy Sarani', 20],
  [/farmgate/, 'Farmgate', 0],
  [/tejgaon|kunipara|tejkuni|tejturi|nakhalpara|west rajabazar|mohakhali/, 'Farmgate', 0],
  [/karwan bazar|kawran/, 'Karwan Bazar', 20],
  [/shahbag|bangla motor|paribag|baily road|dainik bangla/, 'Shahbag', 20],
  [/panthapath|green road/, 'Shahbag', 20],
  [/nilkhet|new market|azimpur|dhaka university|elephant road|science lab|kalabagan|kathal bagan|dhanmondi|sankar/, 'Dhaka University', 20],
  [/paltan|naya paltan|purana paltan/, 'Secretariat', 30],
  [/motijheel|dilkusha|fakirapool/, 'Motijheel', 40],
];
function metro(areaName, seed) {
  // Prefer the curated MRT-6 chart (matches BharaKoto's METRO_STATIONS).
  if (seed && METRO_STATIONS[seed.id]) {
    const s = METRO_STATIONS[seed.id];
    return { station: s.station, fare: s.fare };
  }
  const n = normalize(areaName);
  for (const [re, station, fare] of MRT) {
    if (re.test(n)) return { station, fare };
  }
  return null;
}

function localBus(km, seed, areaName) {
  // Nearly all of Dhaka is on the Farmgate/Mohakhali/Tejgaon bus corridor.
  if (/ashulia|dhamrai|dohar|savar|keraniganj|nawabganj|purbachal|turag/.test(normalize(areaName)) && km > 12) {
    return rng(Math.round(35 + km * 0.8), Math.round(45 + km * 1.2));
  }
  if (seed?.local_bus?.fare_range) return rng(seed.local_bus.fare_range[0], seed.local_bus.fare_range[1]);
  if (km < 3) return '৳10–15';
  if (km < 6) return '৳15–25';
  if (km < 10) return '৳25–35';
  return '৳35–50';
}

// Tampoo/Leguna corridors: Old Dhaka + specific Mirpur/suburb routes.
const TEMPO_AREAS = [
  'sadarghat', 'gulistan', 'lalbag', 'babubazar', 'chawk bazar', 'wari', 'shyampur',
  'sutrapur', 'islampur', 'kotwali', 'narinda', 'dholaikhal', 'postogola', 'rayerbag',
  'kamrangirchar', 'dayaganj', 'gendaria', 'azimpur', 'nawabpur', 'aramanitola',
  'mitford', 'farashganj', 'ganaktuli', 'kathalbagan', 'rayer bazar', 'sayedabad',
  'kadamtoli', 'demra', 'jatrabari', 'shonir akhra', 'bangshal', 'shankharia',
];
function tempo(km, areaName) {
  const n = normalize(areaName);
  const hit = TEMPO_AREAS.some((a) => n.includes(a) || a.includes(n));
  if (!hit) return '-';
  const min = Math.max(20, Math.round(8 * km));
  const max = Math.max(40, Math.round(12 * km));
  return rng(min, max);
}

function taxi(km, seed) {
  if (seed?.taxi_fare) return rng(seed.taxi_fare[0], seed.taxi_fare[1]);
  const base = 50;
  const min = base + 35 * km;
  const max = base + 45 * km;
  return rng(min, max);
}

function rideshare(km, seed) {
  if (seed?.ride_share) {
    const ranges = [
      seed.ride_share.uber?.car, seed.ride_share.uber?.bike,
      seed.ride_share.pathao?.car, seed.ride_share.pathao?.bike,
    ].filter(Array.isArray);
    if (ranges.length) {
      const flat = ranges.flat();
      return rng(Math.min(...flat), Math.max(...flat));
    }
  }
  const bike = [20 + 15 * km, 25 + 20 * km];
  const car = [60 + 28 * km, 80 + 38 * km];
  return rng(Math.min(...bike, ...car), Math.max(...bike, ...car));
}

// ── Main ───────────────────────────────────────────────────────
const areas = parseMasterList(SOURCE_MD);
console.log(`[gen] ${areas.length} source areas loaded`);

const rows = [];
const needsReview = [];

for (const [i, name] of areas.entries()) {
  const seed = SEED.get(normalize(name)) || null;

  let geo = await geocode(name);
  if (!geo) {
    needsReview.push({
      source: name,
      reason: 'Geocoding failed / ambiguous — no coordinate match in Dhaka.',
      flaggedAt: new Date().toISOString(),
    });
    console.log(`  [${i + 1}/${areas.length}] ${name} -> NEEDS REVIEW (geocode)`);
    continue;
  }

  const km = await routeKm(geo, DEST);
  if (km == null) {
    needsReview.push({
      source: name,
      reason: `Routing failed (OSRM). Geocoded as: ${geo.name}`,
      flaggedAt: new Date().toISOString(),
    });
    console.log(`  [${i + 1}/${areas.length}] ${name} -> NEEDS REVIEW (route)`);
    continue;
  }

  const mrt = metro(name, seed);
  rows.push({
    source: name,
    destination: DEST.name,
    distance_km: km,
    walking_time: walkingTime(km),
    walking_cost: 0,
    rickshaw_cost: rickshaw(km, seed),
    metro_cost: mrt ? (mrt.fare === 0 ? '৳0 (walk to AUST)' : `${mrt.station} → ৳${mrt.fare}`) : '-',
    metro_station: mrt ? mrt.station : null,
    local_bus_cost: localBus(km, seed, name),
    aust_shuttle_cost: '-',
    tempo_cost: tempo(km, name),
    taxi_cost: taxi(km, seed),
    rideshare_cost: rideshare(km, seed),
  });
  await sleep(250); // be gentle with the public OSRM instance
  console.log(`  [${i + 1}/${areas.length}] ${name} -> ${km} km`);
}

rows.sort((a, b) => a.source.localeCompare(b.source));

const meta = {
  destination: DEST.name,
  destination_lat: DEST.lat,
  destination_lon: DEST.lon,
  api: 'OSRM public routing + Nominatim geocoding',
  generatedAt: new Date().toISOString(),
  disclaimer:
    'Estimated values — verify locally before use. Distances via OSRM routing. Transport costs are estimated using standard Dhaka local fare logic as of Aug 2026 — verify against current rates before publishing.',
};

fs.writeFileSync(OUT_ROWS, JSON.stringify({ meta, rows }, null, 2));
fs.writeFileSync(OUT_NEEDS, JSON.stringify({ generatedAt: meta.generatedAt, needsReview }, null, 2));
console.log(`\n[gen] Done. ${rows.length} rows written to ${path.relative(ROOT, OUT_ROWS)}`);
console.log(`[gen] ${needsReview.length} areas flagged -> ${path.relative(ROOT, OUT_NEEDS)}`);