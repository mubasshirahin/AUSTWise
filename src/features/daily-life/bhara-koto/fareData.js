// ═══════════════════════════════════════════════════════════════
//  BHARA KOTO — researched fare & route data (Dhaka → AUST)
//
//  Edit this file to update fares; the UI (BharaKoto.jsx) and the
//  calculator (fareEngine.js) read everything from here.
//
//  Honesty rules used when building this file:
//   • "official"  → number comes straight from a published chart/tariff
//                   (MRT-6 fare chart, BRTA per-km bus rate, 2015 CNG tariff).
//   • "computed"  → official rate × road distance (OSRM). The rate is real,
//                   the distance is a routing estimate.
//   • "estimate"  → no official fare exists (rickshaw) or the operator does
//                   not publish current rates (Pathao/Uber). Shown as a range
//                   with the reason, never as a precise number.
// ═══════════════════════════════════════════════════════════════

export const LAST_VERIFIED = '2026-11-13';

export const DESTINATION = {
  name: 'AUST — Ahsanullah University of Science and Technology',
  short: 'AUST',
  address: '141–142 Love Road, Tejgaon Industrial Area, Dhaka 1208',
  lat: 23.76345,
  lon: 90.40721,
};

// ── Sources (referenced by id from rates / modes) ───────────────
export const SOURCES = {
  mrtChart: {
    label: 'MRT Line-6 full fare chart (DTCA chart, reproduced by BD Railway Info)',
    url: 'https://www.bdrailwayinfo.org/metro-rail/fare',
  },
  mrtCheck: {
    label: 'Mapa-Metro Dhaka MRT-6 guide (cross-check: Uttara North → Farmgate ৳70)',
    url: 'https://mapa-metro.com/en/bangladesh/dhaka/dhaka-metro-map.htm',
  },
  mrtDtca: {
    label: 'Banglanews24 — DTCA fare list to Motijheel (Uttara North ৳100)',
    url: 'https://www.banglanews24.com/national/news/bd/1218283.details',
  },
  busRate: {
    label: 'The Daily Star — city bus fare raised to ৳2.70/km (22 Sep 2026)',
    url: 'https://www.thedailystar.net/news/transport/news/bus-fares-rise-17-paisa-km-amid-fuel-price-hike-4279791',
  },
  busRateTbs: {
    label: 'TBS — City bus fares rise to ৳2.70/km, minimum ৳10',
    url: 'https://www.tbsnews.net/bangladesh/transport/city-bus-fares-rise-tk270km-long-route-fares-tk240-after-fuel-price-hike',
  },
  busRoutes: {
    label: 'Outlook Bangla — Dhaka local bus route list (buses via Mogbazar–Satrasta–Mohakhali)',
    url: 'https://outlookbangla.com/2023/12/22/%E0%A6%A2%E0%A6%BE%E0%A6%95%E0%A6%BE%E0%A6%B0-%E0%A6%B2%E0%A7%8B%E0%A6%95%E0%A6%BE%E0%A6%B2-%E0%A6%AC%E0%A6%BE%E0%A6%B8%E0%A7%87%E0%A6%B0-%E0%A6%B0%E0%A7%81%E0%A6%9F-%E0%A6%93-%E0%A6%B2%E0%A6%BF/',
  },
  busRationalization: {
    label: 'Ittefaq — 2026 bus route rationalisation ("City Paribahan" boards)',
    url: 'https://www.ittefaq.com.bd/820664/',
  },
  cngTariff: {
    label: 'The Independent — CNG tariff: ৳40 first 2 km, ৳12/km, ৳2/min waiting (in force since 1 Nov 2015)',
    url: 'https://www.theindependentbd.com/arcprint/details/15352/2015-09-11',
  },
  cngMeters: {
    label: 'Prothom Alo — CNG drivers ignore meters, passengers pay roughly double',
    url: 'https://en.prothomalo.com/bangladesh/city/ak08ei9ita',
  },
  pathao: {
    label: 'The Business Post — Pathao bike: ৳25 base + ৳15/km + ৳0.5/min, min ৳50 (Aug 2022, latest published)',
    url: 'https://businesspostbd.com/front/pathao-raises-bike-ride-fare-by-25-2022-08-08',
  },
  uber: {
    label: 'Rest of World — Uber Bangladesh ৳50 base + ৳21/km (2022)',
    url: 'https://restofworld.org/2022/bangladesh-abandoning-bike-taxi-apps/',
  },
  rideHike2026: {
    label: 'The Daily Star — ride-share fares climb after 2026 fuel price hike (e.g. ৳200 → ৳230)',
    url: 'https://www.thedailystar.net/news/bangladesh/news/ride-fares-climb-after-record-fuel-price-hike-4155186',
  },
  osrm: {
    label: 'Road distances: OSRM routing on OpenStreetMap data (computed 13 Nov 2026)',
    url: 'https://project-osrm.org/',
  },
  austLocation: {
    label: 'AUST address & map (aust.edu contact page)',
    url: 'https://www.aust.edu/contact',
  },
};

// ── Rates ───────────────────────────────────────────────────────
export const RATES = {
  bus: {
    perKm: 2.7, // ৳ per passenger-km, Dhaka metro area non-AC bus (from 22 Sep 2026)
    min: 10, // ৳ minimum per bus (minibus ৳8)
    overcharge: 5, // news reports: conductors often charge ৳5 more (৳15 for a ৳10 trip)
    status: 'computed',
    sources: ['busRate', 'busRateTbs'],
  },
  mrt: {
    cardDiscount: 0.1, // MRT Pass / Rapid Pass
    status: 'official',
    sources: ['mrtChart', 'mrtCheck', 'mrtDtca'],
  },
  cng: {
    first2km: 40,
    perKm: 12,
    waitPerMin: 2,
    // Real asking price vs meter — derived from the Prothom Alo report
    // (7.8 km trip: meter ≈ ৳110, passenger paid ≈ ৳110 more ⇒ ~2×).
    askLow: 1.5,
    askHigh: 2.0,
    status: 'estimate',
    sources: ['cngTariff', 'cngMeters'],
  },
  rickshaw: {
    // No official rickshaw tariff exists in Dhaka — every fare is negotiated.
    // Range = typical negotiated fares for short hops; treat as a haggling guide.
    min: 30,
    lowPerKm: 15,
    lowBase: 15,
    highPerKm: 25,
    highBase: 15,
    maxKm: 4.5,
    status: 'estimate',
    sources: [],
  },
  bike: {
    base: 25,
    perKm: 15,
    perMin: 0.5,
    min: 50,
    upper: 1.4, // 2022 rate card + two 2026 fuel hikes + surge
    status: 'estimate',
    sources: ['pathao', 'rideHike2026'],
  },
  car: {
    base: 50,
    perKm: 21,
    upper: 1.8, // surge / per-minute charge not published
    status: 'estimate',
    sources: ['uber', 'rideHike2026'],
  },
  walk: { kmh: 4.5, maxKm: 3.2 },
};

// ── MRT Line-6 — station order & official single-journey fare to Farmgate ──
// (row "Farmgate" of the DTCA chart; Karwan Bazar fare kept for reference)
export const MRT_STATIONS = [
  { name: 'Uttara North', toFarmgate: 70, toKarwanBazar: 80 },
  { name: 'Uttara Center', toFarmgate: 60, toKarwanBazar: 70 },
  { name: 'Uttara South', toFarmgate: 60, toKarwanBazar: 60 },
  { name: 'Pallabi', toFarmgate: 40, toKarwanBazar: 50 },
  { name: 'Mirpur 11', toFarmgate: 40, toKarwanBazar: 50 },
  { name: 'Mirpur 10', toFarmgate: 30, toKarwanBazar: 40 },
  { name: 'Kazipara', toFarmgate: 30, toKarwanBazar: 30 },
  { name: 'Shewrapara', toFarmgate: 20, toKarwanBazar: 30 },
  { name: 'Agargaon', toFarmgate: 20, toKarwanBazar: 20 },
  { name: 'Bijoy Sarani', toFarmgate: 20, toKarwanBazar: 20 },
  { name: 'Farmgate', toFarmgate: 0, toKarwanBazar: 20 },
  { name: 'Karwan Bazar', toFarmgate: 20, toKarwanBazar: 0 },
  { name: 'Shahbag', toFarmgate: 20, toKarwanBazar: 20 },
  { name: 'Dhaka University', toFarmgate: 20, toKarwanBazar: 20 },
  { name: 'Bangladesh Secretariat', toFarmgate: 20, toKarwanBazar: 20 },
  { name: 'Motijheel', toFarmgate: 30, toKarwanBazar: 30 },
];
export const MRT_MIN_PER_STATION = 2.2; // 33 min end-to-end over 15 hops (DMTCL)

// ── Points near AUST used by the step-by-step guides ───────────
export const AUST_ACCESS = {
  busDrop:
    'Satrasta / Tejgaon Thana (Tejgaon Industrial Area Police Station) on Shaheed Tajuddin Ahmed Avenue — Love Road starts right beside the thana',
  walkFromBusKm: 0.8, // straight line ≈ 0.7 km; walking via Love Road ≈ 0.8–1 km
  walkFromBus:
    'Walk east along Love Road for about 800 m–1 km (10–15 min). AUST is near Kunipara, close to the Hatirjheel lake edge — ask anyone for “Ahsanullah University”.',
  farmgateToAustKm: 3.0, // OSRM
  landmarks: 'Landmarks for drivers: "Love Road, Tejgaon Thana er pashe", Milk Vita, Roads & Highways (Sarak Bhaban) area, Kunipara.',
};

// Buses that pass Mogbazar → Satrasta → Nabisco → Mohakhali (busRoutes source).
// Operators may be renamed under the 2026 "City Paribahan" rationalisation — always read the route board.
export const SATRASTA_BUSES = ['Provati Banasri', 'Balaka', 'Raida', 'Panjeri', 'Jatrabari Paribahan'];

// ── Zones (for the filter chips) ────────────────────────────────
export const ZONES = ['Uttara & Airport', 'Gulshan & East', 'Mirpur & West', 'Dhanmondi & Mohammadpur', 'Central', 'Motijheel & South', 'Old Dhaka', 'Outskirts'];

// ── Origins ─────────────────────────────────────────────────────
// km      = OSRM road distance from the area to AUST (door-to-door, for CNG/ride-share/rickshaw)
// bus     = how to do it by local bus:
//   kind 'satrasta'      → one bus straight to Satrasta/Tejgaon Thana. side: which way the bus is heading.
//   kind 'farmgate'      → bus to Farmgate, then last mile to AUST.
//   kind 'via-gulistan'  → get to Gulistan first (legKm), then a Satrasta bus.
//   km = road km of the bus leg; access = what to do before boarding.
// metro   = nearest MRT-6 station (+ km from area centre to station). Always alight at Farmgate.
// note    = extra local tip.
export const ORIGINS = [
  // ── Uttara & Airport ──
  { id: 'uttara', name: 'Uttara', zone: 'Uttara & Airport', km: 14.4, aliases: ['uttara sector', 'azampur', 'house building', 'rajlakshmi', 'jasimuddin', 'sector 1', 'sector 3', 'sector 4', 'sector 6', 'sector 7', 'sector 9', 'sector 10', 'sector 11', 'sector 12', 'sector 13', 'sector 14', 'diabari', 'sector 15', 'sector 16', 'sector 17', 'sector 18'],
    bus: { kind: 'satrasta', board: 'House Building, Azampur or Jasimuddin stop on Airport Road (Dhaka–Mymensingh highway)', side: 'south, toward Airport / Mohakhali', km: 13.2 },
    metro: { station: 'Uttara Center', accessKm: 3.0, access: 'Sectors 15–18 / Diabari are next to Uttara North, Center and South stations. From sectors 1–14 take a rickshaw west to Uttara Center or Uttara South station (~2–3 km).' },
    note: 'The Dhaka Elevated Expressway makes CNG/car trips much faster outside peak hours (toll extra).' },
  { id: 'abdullahpur', name: 'Abdullahpur', zone: 'Uttara & Airport', km: 15.9, aliases: ['tongi bridge', 'kamarpara', 'ashulia road', 'uttarkhan', 'dakshin khan', 'faidabad'],
    bus: { kind: 'satrasta', board: 'Abdullahpur bus stand (many routes start here, so seats are easier)', side: 'south, toward Airport / Mohakhali', km: 14.7 },
    metro: { station: 'Uttara North', accessKm: 3.7, access: 'Rickshaw/leguna west to Uttara North station (Diabari, ~3–4 km).' } },
  { id: 'tongi', name: 'Tongi', zone: 'Outskirts', km: 22.4, aliases: ['tongi station road', 'gazipur', 'cherag ali'],
    bus: { kind: 'satrasta', board: 'Tongi Station Road / College Gate stop on the highway', side: 'south, toward Abdullahpur / Airport', km: 21.2 } },
  { id: 'airport', name: 'Airport Area', zone: 'Uttara & Airport', km: 12.4, aliases: ['airport', 'kawla', 'biman bandar', 'shewra', 'ashkona', 'haji camp', 'hazi camp'],
    bus: { kind: 'satrasta', board: 'Airport (Biman Bandar) or Kawla stop on Airport Road', side: 'south, toward Khilkhet / Mohakhali', km: 11.2 } },
  { id: 'khilkhet', name: 'Khilkhet', zone: 'Uttara & Airport', km: 11.4, aliases: ['lake city concord', 'namapara', 'kuratoli', 'nikunja 1', 'nikunja'],
    bus: { kind: 'satrasta', board: 'Khilkhet stop on Airport Road', side: 'south, toward Kuril / Mohakhali', km: 10.2 } },
  { id: 'nikunja', name: 'Nikunja 2', zone: 'Uttara & Airport', km: 12.0, aliases: ['nikunja residential area', 'aabahanikunja', 'joarshahara'],
    bus: { kind: 'satrasta', board: 'Khilkhet stop on Airport Road (walk/rickshaw out of Nikunja 2)', side: 'south, toward Kuril / Mohakhali', km: 10.8 } },
  { id: 'kuril', name: 'Kuril', zone: 'Uttara & Airport', km: 9.6, aliases: ['kuril bishwa road', 'jamuna future park', 'kuril flyover', 'kuratoli'],
    bus: { kind: 'satrasta', board: 'Kuril Bishwa Road stop', side: 'south, toward Kakoli / Mohakhali', km: 8.4 } },
  { id: 'bashundhara', name: 'Bashundhara R/A', zone: 'Uttara & Airport', km: 11.4, aliases: ['bashundhara', 'nsu', 'iub', 'apollo', 'evercare', 'block a', 'block b', 'block c', 'block d', 'block e', 'block f', 'block g', 'block h', 'block i', 'block j', 'block k', 'block l', 'block m', 'block n'],
    bus: { kind: 'satrasta', board: 'Kuril Bishwa Road stop (rickshaw from the Bashundhara gate, ~1–2 km)', side: 'south, toward Kakoli / Mohakhali', km: 8.4, accessRickshawKm: 1.5 } },
  { id: 'banani', name: 'Banani', zone: 'Gulshan & East', km: 4.9, aliases: ['kakoli', 'chairman bari', 'banani dohs', 'sainik club'],
    bus: { kind: 'satrasta', board: 'Kakoli or Chairman Bari stop on Airport Road', side: 'south, toward Mohakhali', km: 3.7 },
    note: 'Rickshaws are not allowed on Airport Road — a rickshaw has to use inner roads via Mohakhali, so CNG/bike is easier.' },
  { id: 'mohakhali', name: 'Mohakhali', zone: 'Gulshan & East', km: 4.0, aliases: ['mohakhali bus terminal', 'amtoli', 'wireless gate', 'tb gate', 'nabisco', 'tibbet'],
    bus: { kind: 'satrasta', board: 'Mohakhali (Amtoli / bus terminal side)', side: 'south, toward Nabisco / Satrasta', km: 2.9 } },
  { id: 'mohakhali-dohs', name: 'Mohakhali DOHS', zone: 'Gulshan & East', km: 3.9, aliases: ['dohs mohakhali', 'arjatpara', 'niketan mohakhali'],
    bus: { kind: 'satrasta', board: 'Mohakhali flyover stop (walk out of DOHS)', side: 'south, toward Nabisco / Satrasta', km: 2.8 } },

  // ── Gulshan & East ──
  { id: 'gulshan-1', name: 'Gulshan-1', zone: 'Gulshan & East', km: 3.8, aliases: ['gulshan 1', 'gulshan', 'police plaza', 'shooting club'],
    bus: { kind: 'satrasta', board: 'Gulshan-1 circle', side: 'west, toward Mohakhali → Satrasta → Mogbazar', km: 3.4, routesNote: 'the Notun Bazar – Badda Link Road – Gulshan-1 – Mohakhali – Satrasta – Mogbazar – Motijheel route' } },
  { id: 'gulshan-2', name: 'Gulshan-2', zone: 'Gulshan & East', km: 5.2, aliases: ['gulshan 2'],
    bus: { kind: 'satrasta', board: 'Gulshan-1 circle (rickshaw from Gulshan-2, ~2 km)', side: 'west, toward Mohakhali → Satrasta', km: 3.4, accessRickshawKm: 2, routesNote: 'the Notun Bazar – Badda Link Road – Gulshan-1 – Mohakhali – Satrasta route' } },
  { id: 'baridhara', name: 'Baridhara', zone: 'Gulshan & East', km: 6.7, aliases: ['notun bazar', 'natun bazar', 'baridhara dohs', 'baridhara dit project', 'shahjadpur', 'vatara', 'bhatara'],
    bus: { kind: 'satrasta', board: 'Notun Bazar stop on Pragati Sarani', side: 'toward Badda Link Road / Gulshan-1', km: 6.2, routesNote: 'the Notun Bazar – Badda Link Road – Gulshan-1 – Mohakhali – Satrasta route' } },
  { id: 'badda', name: 'Badda', zone: 'Gulshan & East', km: 5.7, aliases: ['uttar badda', 'north badda', 'middle badda', 'badda link road', 'gupipara', 'shahjadpur'],
    bus: { kind: 'satrasta', board: 'Badda Link Road stop', side: 'west, toward Gulshan-1 / Mohakhali', km: 5.7, routesNote: 'the Notun Bazar – Badda Link Road – Gulshan-1 – Mohakhali – Satrasta route' } },
  { id: 'merul-badda', name: 'Merul Badda', zone: 'Gulshan & East', km: 4.3, aliases: ['merul', 'hatirjheel police plaza', 'south badda'],
    note: 'No convenient direct bus — Hatirjheel road takes you almost to AUST, so CNG/bike or rickshaw is the practical choice.' },
  { id: 'rampura', name: 'Rampura', zone: 'Gulshan & East', km: 3.3, aliases: ['east rampura', 'west rampura', 'rampura bridge', 'ulon', 'happy homes', 'btv'],
    note: 'No convenient direct bus. Via Hatirjheel the trip is only ~3 km — rickshaw or CNG is cheapest and fastest.' },
  { id: 'banasree', name: 'Banasree', zone: 'Gulshan & East', km: 4.2, aliases: ['banashree', 'meradia', 'south banasree'],
    note: 'No convenient direct bus. Rickshaw/CNG to Rampura Bridge and then across Hatirjheel.' },
  { id: 'aftabnagar', name: 'Aftab Nagar', zone: 'Gulshan & East', km: 5.9, aliases: ['aftabnagar', 'aftab nagar block', 'jahurul islam city', 'ewu', 'east west university'],
    note: 'No convenient direct bus. CNG/bike via Rampura Bridge and Hatirjheel.' },
  { id: 'niketon', name: 'Niketon', zone: 'Gulshan & East', km: 3.1, aliases: ['niketan', 'gulshan niketon', 'hatirjheel'],
    bus: { kind: 'satrasta', board: 'Gulshan-1 circle (walk ~1 km from Niketon)', side: 'west, toward Mohakhali → Satrasta', km: 3.4, routesNote: 'the Notun Bazar – Gulshan-1 – Mohakhali – Satrasta route' } },

  // ── Central ──
  { id: 'mogbazar', name: 'Mogbazar', zone: 'Central', km: 1.6, aliases: ['moghbazar', 'mogbazar wireless', 'boro mogbazar', 'nayatola', 'eskaton', 'new eskaton'],
    bus: { kind: 'satrasta', board: 'Mogbazar crossing', side: 'north, toward Satrasta / Mohakhali', km: 3.0 } },
  { id: 'malibagh', name: 'Malibagh', zone: 'Central', km: 3.4, aliases: ['mouchak', 'chowdhurypara', 'malibag', 'siddheswari', 'shantibag'],
    bus: { kind: 'satrasta', board: 'Malibagh mor / Mouchak', side: 'north-west, toward Mogbazar / Satrasta', km: 4.0 } },
  { id: 'khilgaon', name: 'Khilgaon', zone: 'Central', km: 3.4, aliases: ['khilgaon taltola', 'goran', 'basabo', 'bashabo', 'sabujbag', 'mugda', 'madartek'],
    bus: { kind: 'satrasta', board: 'Malibagh mor (rickshaw from Khilgaon, ~1.5 km)', side: 'toward Mogbazar / Satrasta', km: 4.0, accessRickshawKm: 1.5 } },
  { id: 'shantinagar', name: 'Shantinagar', zone: 'Central', km: 4.2, aliases: ['razarbagh', 'rajarbagh', 'baily road', 'kakrail'],
    bus: { kind: 'satrasta', board: 'Malibagh mor or Shantinagar crossing', side: 'toward Mogbazar / Satrasta', km: 4.8 } },
  { id: 'paltan', name: 'Paltan', zone: 'Motijheel & South', km: 4.7, aliases: ['naya paltan', 'purana paltan', 'bijoynagar', 'press club', 'segunbagicha', 'topkhana'],
    bus: { kind: 'satrasta', board: 'Paltan / Kakrail stop', side: 'toward Malibagh / Mogbazar / Satrasta', km: 5.2 },
    metro: { station: 'Bangladesh Secretariat', accessKm: 0.4 } },
  { id: 'gulistan', name: 'Gulistan', zone: 'Motijheel & South', km: 6.5, aliases: ['bangabandhu stadium', 'baitul mukarram', 'fulbaria', 'nawabpur'],
    bus: { kind: 'satrasta', board: 'Gulistan (Provati Banasri / Panjeri start here)', side: 'toward Paltan / Mogbazar / Satrasta', km: 6.1 },
    metro: { station: 'Bangladesh Secretariat', accessKm: 0.7 } },
  { id: 'motijheel', name: 'Motijheel', zone: 'Motijheel & South', km: 5.9, aliases: ['dilkusha', 'arambag', 'fakirapool', 'shapla chattar', 'dainik bangla'],
    bus: { kind: 'satrasta', board: 'Motijheel / Shapla Chattar stop', side: 'toward Malibagh / Mogbazar / Satrasta', km: 6.5 },
    metro: { station: 'Motijheel', accessKm: 0.2 } },
  { id: 'kamalapur', name: 'Kamalapur', zone: 'Motijheel & South', km: 6.7, aliases: ['kamalapur railway station', 'shahjahanpur', 'gopibagh', 'tilpapara'],
    bus: { kind: 'satrasta', board: 'Kamalapur station road', side: 'toward Rajarbagh / Malibagh / Mogbazar', km: 7.3 },
    metro: { station: 'Motijheel', accessKm: 0.8 } },
  { id: 'sayedabad', name: 'Saidabad', zone: 'Motijheel & South', km: 9.4, aliases: ['sayedabad', 'saydabad', 'manik nagar', 'maniknagar', 'jurain'],
    bus: { kind: 'satrasta', board: 'Saidabad bus terminal side', side: 'toward Kamalapur / Malibagh / Mogbazar', km: 10.0 },
    metro: { station: 'Motijheel', accessKm: 1.7 } },
  { id: 'jatrabari', name: 'Jatrabari', zone: 'Motijheel & South', km: 9.9, aliases: ['shonir akhra', 'kajla', 'kazla', 'dholaipar', 'rayerbag', 'matuail', 'donia'],
    bus: { kind: 'satrasta', board: 'Jatrabari crossing (Jatrabari Paribahan / Raida)', side: 'toward Saidabad / Kamalapur / Mogbazar', km: 10.5 },
    metro: { station: 'Motijheel', accessKm: 2.6 } },
  { id: 'demra', name: 'Demra', zone: 'Outskirts', km: 13.0, aliases: ['demra staff quarter', 'sarulia', 'konapara', 'staff quarter'],
    bus: { kind: 'satrasta', board: 'Demra / Staff Quarter (Jatrabari Paribahan starts at Demra)', side: 'toward Jatrabari / Kamalapur / Mogbazar', km: 13.6 } },

  // ── Old Dhaka ──
  { id: 'wari', name: 'Wari', zone: 'Old Dhaka', km: 7.5, aliases: ['tikatuli', 'narinda', 'gendaria', 'dayaganj', 'sutrapur', 'swamibag', 'rankin street'],
    bus: { kind: 'via-gulistan', board: 'Gulistan', legKm: 2.2, legMode: 'rickshaw', km: 6.1 },
    metro: { station: 'Motijheel', accessKm: 1.1 } },
  { id: 'sadarghat', name: 'Sadarghat', zone: 'Old Dhaka', km: 8.3, aliases: ['puran dhaka', 'old dhaka', 'babubazar', 'bangshal', 'shankhari bazar', 'sankharia bazar', 'islampur', 'kotwali', 'laxmibazar', 'lakshmibazar', 'farashganj', 'patuatuli', 'victoria park'],
    bus: { kind: 'via-gulistan', board: 'Gulistan', legKm: 3.3, legMode: 'bus', km: 6.1 },
    metro: { station: 'Motijheel', accessKm: 2.7 } },
  { id: 'keraniganj', name: 'Keraniganj', zone: 'Outskirts', km: 10.5, aliases: ['jinjira', 'keraniganj upazila', 'aganagar'],
    bus: { kind: 'via-gulistan', board: 'Gulistan (cross Babubazar / Buriganga bridge first)', legKm: 6.1, legMode: 'bus', km: 6.1 } },
  { id: 'lalbagh', name: 'Lalbagh', zone: 'Old Dhaka', km: 6.8, aliases: ['lalbag', 'chawk bazar', 'chowk bazar', 'bakshi bazar', 'chankharpul', 'nazirabazar', 'islambag', 'kamrangirchar', 'posta'],
    bus: { kind: 'farmgate', board: 'Azimpur / Palashi (rickshaw from Lalbagh)', km: 6.5 },
    metro: { station: 'Dhaka University', accessKm: 1.7, access: 'Rickshaw to the Dhaka University station (TSC / Doel Chattar side).' } },

  // ── Dhanmondi & Mohammadpur ──
  { id: 'azimpur', name: 'Azimpur', zone: 'Dhanmondi & Mohammadpur', km: 5.1, aliases: ['palashi', 'pilkhana', 'bgb gate', 'dhaka college', 'ati bazar'],
    bus: { kind: 'farmgate', board: 'Azimpur bus stand / Nilkhet', km: 4.9 },
    metro: { station: 'Dhaka University', accessKm: 1.3 } },
  { id: 'new-market', name: 'New Market', zone: 'Dhanmondi & Mohammadpur', km: 5.1, aliases: ['nilkhet', 'newmarket', 'chandni chowk', 'dhaka university area', 'du', 'buet area', 'bakshibazar'],
    bus: { kind: 'farmgate', board: 'New Market / Nilkhet stop on Mirpur Road', km: 4.1 },
    metro: { station: 'Dhaka University', accessKm: 1.3 } },
  { id: 'science-lab', name: 'Science Lab', zone: 'Dhanmondi & Mohammadpur', km: 4.4, aliases: ['city college', 'elephant road', 'katabon', 'hatirpool', 'kathal bagan', 'central road', 'green road', 'circular road'],
    bus: { kind: 'farmgate', board: 'Science Lab / City College stop on Mirpur Road', km: 3.4 },
    metro: { station: 'Shahbag', accessKm: 1.3 } },
  { id: 'shahbag', name: 'Shahbag', zone: 'Central', km: 4.5, aliases: ['shahbagh', 'bangla motor', 'banglamotor', 'paribag', 'ramna', 'pg hospital', 'bsmmu'],
    bus: { kind: 'farmgate', board: 'Shahbag crossing (any Farmgate / Mohakhali-bound bus on Kazi Nazrul Islam Avenue)', km: 4.2 },
    metro: { station: 'Shahbag', accessKm: 0.1 } },
  { id: 'kalabagan', name: 'Kalabagan', zone: 'Dhanmondi & Mohammadpur', km: 4.3, aliases: ['lake circus', 'panthapath', 'basundhara city', 'bashundhara city', 'kalabagan lake circus'],
    bus: { kind: 'farmgate', board: 'Kalabagan stop on Mirpur Road', km: 2.5 },
    metro: { station: 'Farmgate', accessKm: 1.4 } },
  { id: 'dhanmondi', name: 'Dhanmondi', zone: 'Dhanmondi & Mohammadpur', km: 5.0, aliases: ['dhanmondi 27', 'dhanmondi 32', 'dhanmondi 15', 'jigatola', 'sobhanbag', 'shukrabad'],
    bus: { kind: 'farmgate', board: 'Dhanmondi 27 / Sobhanbag stop on Mirpur Road', km: 2.0 },
    metro: { station: 'Farmgate', accessKm: 1.7 } },
  { id: 'hazaribagh', name: 'Hazaribag', zone: 'Dhanmondi & Mohammadpur', km: 8.6, aliases: ['hazaribagh', 'zigatola', 'west dhanmondi'],
    bus: { kind: 'farmgate', board: 'Jigatola / Dhanmondi 15 stop (rickshaw from Hazaribag)', km: 5.7 } },
  { id: 'rayer-bazar', name: 'Rayer Bazar', zone: 'Dhanmondi & Mohammadpur', km: 8.1, aliases: ['rayerbazar', 'beribadh', 'bosila', 'basila', 'shankar', 'sankar'],
    bus: { kind: 'farmgate', board: 'Shankar / Dhanmondi 15 stop on Satmasjid Road', km: 5.1 } },
  { id: 'mohammadpur', name: 'Mohammadpur', zone: 'Dhanmondi & Mohammadpur', km: 6.3, aliases: ['mohammadpur bus stand', 'town hall', 'lalmatia', 'tajmahal road', 'nurjahan road', 'adabor', 'shekhertek', 'mohammadpur housing', 'japan garden city', 'chan mia housing'],
    bus: { kind: 'farmgate', board: 'Mohammadpur bus stand / Town Hall', km: 3.3 },
    metro: { station: 'Bijoy Sarani', accessKm: 2.4, access: 'Rickshaw/CNG via Asad Gate to Farmgate is usually simpler than going to a station — Farmgate itself is the station.' } },
  { id: 'asad-gate', name: 'Asad Gate', zone: 'Dhanmondi & Mohammadpur', km: 4.6, aliases: ['asadgate', 'college gate', 'manik mia avenue', 'sangsad bhaban', 'sher-e-bangla nagar'],
    bus: { kind: 'farmgate', board: 'Asad Gate stop on Mirpur Road', km: 1.6 },
    metro: { station: 'Farmgate', accessKm: 1.3 } },

  // ── Central (very near AUST) ──
  { id: 'karwan-bazar', name: 'Karwan Bazar', zone: 'Central', km: 2.2, aliases: ['kawran bazar', 'karwan bazar', 'sonargaon', 'fdc', 'tejturi bazar'] },
  { id: 'farmgate', name: 'Farmgate', zone: 'Central', km: 3.0, aliases: ['khamarbari', 'tejgaon college', 'indira road', 'raza bazar', 'west rajabazar', 'east rajabazar', 'monipuri para', 'monipuripara', 'green road farmgate'] },
  { id: 'tejgaon', name: 'Tejgaon', zone: 'Central', km: 2.6, aliases: ['tejkunipara', 'tejkuni para', 'tejgaon railway station', 'nakhalpara', 'tejgaon industrial area', 'begunbari', 'kunipara', 'satrasta', 'nabisco'] },

  // ── Mirpur & West ──
  { id: 'agargaon', name: 'Agargaon', zone: 'Mirpur & West', km: 4.7, aliases: ['agargaon taltola', 'taltola', 'bijoy sarani', 'idb bhaban', 'passport office', 'kochukhet', 'kachukhet'],
    bus: { kind: 'farmgate', board: 'Agargaon stop on Begum Rokeya Sarani', km: 3.0 },
    metro: { station: 'Agargaon', accessKm: 0 } },
  { id: 'shyamoli', name: 'Shyamoli', zone: 'Mirpur & West', km: 6.2, aliases: ['shyamoli square', 'kallyanpur', 'kollanpur', 'darussalam', 'ring road'],
    bus: { kind: 'farmgate', board: 'Shyamoli stop on Mirpur Road', km: 3.9 },
    metro: { station: 'Agargaon', accessKm: 1.6, access: 'Rickshaw to Agargaon station (~1.5 km) — or just take a Farmgate bus.' } },
  { id: 'kafrul', name: 'Kafrul', zone: 'Mirpur & West', km: 5.9, aliases: ['north kafrul', 'ibrahimpur', 'kafrul taltola', 'kochukhet bazar'],
    bus: { kind: 'farmgate', board: 'Shewrapara / Taltola stop on Begum Rokeya Sarani', km: 5.4 },
    metro: { station: 'Shewrapara', accessKm: 1.1 } },
  { id: 'shewrapara', name: 'Shewrapara', zone: 'Mirpur & West', km: 5.7, aliases: ['senpara', 'senpara parbata', 'west shewrapara'],
    bus: { kind: 'farmgate', board: 'Shewrapara stop on Begum Rokeya Sarani', km: 4.0 },
    metro: { station: 'Shewrapara', accessKm: 0 } },
  { id: 'kazipara', name: 'Kazipara', zone: 'Mirpur & West', km: 6.7, aliases: ['east kazipara', 'west kazipara'],
    bus: { kind: 'farmgate', board: 'Kazipara stop on Begum Rokeya Sarani', km: 5.0 },
    metro: { station: 'Kazipara', accessKm: 0 } },
  { id: 'mirpur-1', name: 'Mirpur 1', zone: 'Mirpur & West', km: 9.2, aliases: ['mirpur-1', 'shah ali', 'shah ali bag', 'chiriyakhana', 'zoo', 'botanical garden', 'mazar road', 'golartek', 'diabari mirpur'],
    bus: { kind: 'farmgate', board: 'Mirpur 1 (Shah Ali) stop', km: 6.9 },
    metro: { station: 'Mirpur 10', accessKm: 1.9, access: 'Rickshaw to Mirpur 10 station (~2 km).' } },
  { id: 'mirpur-2', name: 'Mirpur 2', zone: 'Mirpur & West', km: 10.1, aliases: ['mirpur-2', 'stadium', 'sher-e-bangla stadium', 'mirpur 6', 'mirpur 7', 'monipur', 'rupnagar', 'mirpur 3', 'mirpur 4', 'mirpur 5'],
    bus: { kind: 'farmgate', board: 'Mirpur 2 / Mirpur 10 crossing', km: 7.6 },
    metro: { station: 'Mirpur 10', accessKm: 1.2 } },
  { id: 'mirpur-10', name: 'Mirpur 10', zone: 'Mirpur & West', km: 8.6, aliases: ['mirpur-10', 'mirpur 10 golchottor', 'senpara', 'mirpur 13', 'mirpur 14', 'bhashantek', 'bhasantek', 'kafrul mirpur'],
    bus: { kind: 'farmgate', board: 'Mirpur 10 golchottor', km: 6.1 },
    metro: { station: 'Mirpur 10', accessKm: 0 } },
  { id: 'mirpur-11', name: 'Mirpur 11', zone: 'Mirpur & West', km: 11.8, aliases: ['mirpur-11', 'mirpur 11.5', 'benaroshi polli', 'mirpur 12', 'mirpur dohs', 'mirpur cantonment'],
    bus: { kind: 'farmgate', board: 'Mirpur 11 stop on Begum Rokeya Sarani', km: 9.3 },
    metro: { station: 'Mirpur 11', accessKm: 0 } },
  { id: 'pallabi', name: 'Pallabi', zone: 'Mirpur & West', km: 11.0, aliases: ['pallabi extension', 'mirpur 12 pallabi', 'purobi'],
    bus: { kind: 'farmgate', board: 'Pallabi / Purobi stop', km: 8.5 },
    metro: { station: 'Pallabi', accessKm: 0 } },
  { id: 'kalshi', name: 'Kalshi', zone: 'Mirpur & West', km: 11.3, aliases: ['kalshi flyover', 'ecb chattar', 'matikata', 'manikdi', 'balughat'],
    bus: { kind: 'farmgate', board: 'Mirpur 11 / Purobi stop (rickshaw from Kalshi)', km: 8.7 },
    metro: { station: 'Mirpur 11', accessKm: 1.3 } },
  { id: 'gabtoli', name: 'Gabtoli', zone: 'Outskirts', km: 9.8, aliases: ['gabtali', 'amin bazar', 'technical', 'mazar road'],
    bus: { kind: 'farmgate', board: 'Gabtoli (towards Technical / Shyamoli)', km: 7.2 } },
  { id: 'savar', name: 'Savar', zone: 'Outskirts', km: 22.2, aliases: ['savar dohs', 'hemayetpur', 'nabinagar', 'ashulia', 'jahangirnagar'],
    bus: { kind: 'farmgate', board: 'Savar bus stand on the Dhaka–Aricha highway', km: 19.9 },
    note: 'Long trip — leave early; traffic at Gabtoli/Amin Bazar can add 30–60 min.' },
];

// Generic tips shown in the route panel per mode.
export const MODE_TIPS = {
  bus: [
    'Each bus has a minimum fare of ৳10 even for one stop; conductors often ask ৳5 more than the chart — the BRTA chart must be displayed inside the bus, so you can point at it.',
    'City buses must reserve 9 seats for women, children and people with disabilities — seats behind the driver.',
    'Peak hours (8–10 am, 5–8 pm) can double the travel time. Ask “Satrasta jaben?” before boarding.',
  ],
  metro: [
    'Use an MRT Pass or Rapid Pass card for 10% off every trip (card costs ৳500 incl. ৳200 refundable deposit).',
    'Every train has a coach reserved for women — look for the women-only sign on the platform.',
    'Friday service starts in the afternoon — check DMTCL for current hours.',
  ],
  rickshaw: [
    'There is no official rickshaw fare — always fix the price before you get on. Ask 2–3 pullers.',
    'Rickshaws are banned on main roads like Airport Road, so routes take inner lanes.',
  ],
  cng: [
    'Official meter: ৳40 for the first 2 km + ৳12/km + ৳2/min waiting. Drivers rarely use the meter — agree the fare first.',
    'If the quote is far above the range shown here, try another CNG; quoting the meter fare helps.',
  ],
  bike: [
    'Pathao/Uber Moto rates are not published since 2022 — the app shows the exact price before you confirm.',
    'Fares jump with surge (rain, office hours). Always wear the helmet.',
  ],
  car: [
    'Uber/Pathao car prices change with surge; check the in-app estimate.',
    'Toll is extra if the driver uses the Elevated Expressway.',
  ],
  walk: ['Footpaths around Satrasta are busy — use the foot-over bridges.'],
};
