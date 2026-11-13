// ═══════════════════════════════════════════════════════════════
//  BHARA KOTO — turns fareData.js into per-origin travel options.
//  Pure functions, no React. Every option returns:
//    { key, legacyKey, label, fare:[min,max], status, time:[min,max],
//      legs:[{ text, fare? }], steps:[string], tips:[string], sources:[id] }
// ═══════════════════════════════════════════════════════════════
import {
  RATES, MRT_STATIONS, MRT_MIN_PER_STATION, AUST_ACCESS, SATRASTA_BUSES, MODE_TIPS,
} from './fareData.js';

const r5 = (n) => Math.round(n / 5) * 5;
const r10 = (n) => Math.round(n / 10) * 10;
const mins = (km, kmhFast, kmhSlow, extra = 0) => [
  Math.max(1, Math.round((km / kmhFast) * 60 + extra)),
  Math.max(2, Math.round((km / kmhSlow) * 60 + extra)),
];
const sum = (...ranges) => ranges.reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);

// ── Single-leg fare calculators ──
export function busFare(km) {
  const base = Math.max(RATES.bus.min, Math.round(RATES.bus.perKm * km));
  return [base, base + RATES.bus.overcharge];
}
export function cngMeter(km) {
  return Math.round(km <= 2 ? RATES.cng.first2km : RATES.cng.first2km + RATES.cng.perKm * (km - 2));
}
export function cngFare(km) {
  const m = cngMeter(km);
  return [r10(m * RATES.cng.askLow), r10(m * RATES.cng.askHigh)];
}
export function rickshawFare(km) {
  const R = RATES.rickshaw;
  return [Math.max(R.min, r5(R.lowBase + R.lowPerKm * km)), Math.max(R.min + 10, r5(R.highBase + R.highPerKm * km))];
}
export function bikeFare(km) {
  const R = RATES.bike;
  const minutes = (km / 15) * 60;
  const base = Math.max(R.min, R.base + R.perKm * km + R.perMin * minutes);
  return [r5(base), r5(base * R.upper)];
}
export function carFare(km) {
  const R = RATES.car;
  const base = R.base + R.perKm * km;
  return [r10(base), r10(base * R.upper)];
}
export function mrtFare(stationName) {
  const s = MRT_STATIONS.find((x) => x.name === stationName);
  if (!s) return null;
  return { single: s.toFarmgate, card: Math.round(s.toFarmgate * (1 - RATES.mrt.cardDiscount)) };
}
const stationHops = (name) => {
  const i = MRT_STATIONS.findIndex((x) => x.name === name);
  const f = MRT_STATIONS.findIndex((x) => x.name === 'Farmgate');
  return i < 0 ? 0 : Math.abs(i - f);
};

const fmtKm = (km) => `${km.toFixed(1)} km`;
const tk = ([a, b]) => (a === b ? `৳${a}` : `৳${a}–${b}`);

// Last mile from Farmgate (bus stop or MRT station) to the AUST gate.
function farmgateLastMile() {
  const km = AUST_ACCESS.farmgateToAustKm;
  const rick = rickshawFare(km);
  const cng = cngFare(km);
  return {
    fare: rick,
    time: mins(km, 9, 6),
    text: `Farmgate → AUST (${fmtKm(km)}): rickshaw ${tk(rick)} (negotiate) or CNG ${tk(cng)} (meter ≈ ৳${cngMeter(km)}).`,
    steps: [
      `At Farmgate, find a rickshaw or CNG and ask for “Love Road, Ahsanullah University — Tejgaon Thana er pashe”. Rickshaw ${tk(rick)} after bargaining, CNG ${tk(cng)}. Pathao bike is also cheap for this hop.`,
      'The ride goes east through Tejgaon (via Tejkunipara / the rail crossing) to Love Road — about 10–20 min depending on traffic.',
    ],
  };
}

// ── Option builders ──
function walkOption(o) {
  if (o.km > RATES.walk.maxKm) return null;
  const t = Math.round((o.km / RATES.walk.kmh) * 60);
  return {
    key: 'walk', legacyKey: null, label: 'Walking', fare: [0, 0], status: 'official',
    time: [t, t + 10],
    legs: [{ text: `Walk ${fmtKm(o.km)} to the AUST gate.` }],
    steps: [
      `From ${o.name}, head toward Tejgaon / Satrasta. It is about ${fmtKm(o.km)} by road (${t}–${t + 10} min).`,
      `Once you reach Shaheed Tajuddin Ahmed Avenue near Tejgaon Thana, turn into Love Road. ${AUST_ACCESS.walkFromBus}`,
    ],
    tips: MODE_TIPS.walk, sources: ['osrm'],
  };
}

function rickshawOption(o) {
  if (o.km > RATES.rickshaw.maxKm) return null;
  const fare = rickshawFare(o.km);
  return {
    key: 'rickshaw', legacyKey: 'rickshaw_cost', label: 'Rickshaw', fare, status: 'estimate',
    time: mins(o.km, 9, 6),
    legs: [{ text: `${o.name} → AUST direct (${fmtKm(o.km)} by road).`, fare }],
    steps: [
      `Stop a rickshaw in ${o.name} and say “Love Road, Ahsanullah University (Tejgaon Thana)”.`,
      `Fix the fare first — ${tk(fare)} is a fair range for ~${fmtKm(o.km)}. Start lower and settle in the middle.`,
      'The puller will use inner lanes; it is normal if the route differs from Google Maps.',
      'Get down at the AUST main gate on Love Road.',
    ],
    tips: MODE_TIPS.rickshaw,
    reason: 'No government rickshaw tariff exists in Dhaka; range is a negotiation guide (≈ ৳15–25 per km, ৳30 minimum).',
    sources: ['osrm'],
  };
}

function busOption(o) {
  const b = o.bus;
  if (!b) return null;
  const walkLeg = `${AUST_ACCESS.walkFromBus}`;
  const ops = SATRASTA_BUSES.join(', ');

  if (b.kind === 'satrasta') {
    const fare = busFare(b.km);
    const access = b.accessRickshawKm ? rickshawFare(b.accessRickshawKm) : null;
    const total = access ? sum(fare, access) : fare;
    const routes = b.routesNote ? `${b.routesNote} (operator name not confirmed — read the route board)` : `${ops} (all listed as passing Mogbazar – Satrasta – Mohakhali)`;
    const steps = [];
    if (access) steps.push(`Take a rickshaw to ${b.board.split(' (')[0]} — about ${tk(access)}.`);
    steps.push(
      `Board at ${b.board}, on the side heading ${b.side}.`,
      `Take a bus that shows Satrasta / Mohakhali / Mogbazar on its route board — e.g. ${routes}. Ask “Satrasta jaben?” before getting on.`,
      `Pay about ${tk(fare)} (BRTA rate ৳2.70/km × ~${fmtKm(b.km)}). Tell the conductor “Satrasta / Tejgaon Thana namaben”.`,
      `Get off at ${AUST_ACCESS.busDrop}.`,
      walkLeg,
    );
    const t = mins(b.km, 15, 7, 8);
    return {
      key: 'bus', legacyKey: 'local_bus_cost', label: 'Local Bus', fare: total,
      status: access ? 'estimate' : 'computed',
      time: [t[0] + 10, t[1] + 15],
      legs: [
        ...(access ? [{ text: `Rickshaw to the bus stop (~${b.accessRickshawKm} km)`, fare: access }] : []),
        { text: `Bus ${b.board.split(' (')[0]} → Satrasta / Tejgaon Thana (~${fmtKm(b.km)})`, fare },
        { text: 'Walk Love Road to AUST (~0.8–1 km)', fare: [0, 0] },
      ],
      steps, tips: MODE_TIPS.bus,
      reason: `Bus fare = BRTA chart rate ৳2.70/km (min ৳10) × OSRM road distance; upper value allows the common ৳5 overcharge.${access ? ' Rickshaw leg is an estimate.' : ''}`,
      sources: ['busRate', 'busRateTbs', 'busRoutes', 'busRationalization', 'osrm'],
    };
  }

  if (b.kind === 'farmgate') {
    const fare = busFare(b.km);
    const lm = farmgateLastMile();
    const t = mins(b.km, 15, 7, 8);
    return {
      key: 'bus', legacyKey: 'local_bus_cost', label: 'Local Bus', fare: sum(fare, lm.fare), status: 'estimate',
      time: [t[0] + lm.time[0], t[1] + lm.time[1]],
      legs: [
        { text: `Bus ${b.board.split(' (')[0]} → Farmgate (~${fmtKm(b.km)})`, fare },
        { text: lm.text, fare: lm.fare },
      ],
      steps: [
        `Board at ${b.board}. Take any bus whose route board says Farmgate (most Mirpur Road / Rokeya Sarani buses toward Motijheel, Gulistan or Sadarghat pass Farmgate).`,
        `Pay about ${tk(fare)} (BRTA rate ৳2.70/km × ~${fmtKm(b.km)}). Get off at Farmgate.`,
        ...lm.steps,
      ],
      tips: MODE_TIPS.bus,
      reason: 'Bus leg uses the BRTA chart rate (computed). The Farmgate → AUST last mile is a rickshaw estimate, so the total is an estimate.',
      sources: ['busRate', 'busRateTbs', 'osrm'],
    };
  }

  if (b.kind === 'via-gulistan') {
    const leg1 = b.legMode === 'rickshaw' ? rickshawFare(b.legKm) : busFare(b.legKm);
    const leg2 = busFare(b.km);
    const t1 = b.legMode === 'rickshaw' ? mins(b.legKm, 9, 6) : mins(b.legKm, 15, 7, 5);
    const t2 = mins(b.km, 15, 7, 8);
    return {
      key: 'bus', legacyKey: 'local_bus_cost', label: 'Local Bus', fare: sum(leg1, leg2),
      status: b.legMode === 'rickshaw' ? 'estimate' : 'computed',
      time: [t1[0] + t2[0] + 10, t1[1] + t2[1] + 15],
      legs: [
        { text: `${b.legMode === 'rickshaw' ? 'Rickshaw' : 'Bus'} ${o.name} → Gulistan (~${fmtKm(b.legKm)})`, fare: leg1 },
        { text: `Bus Gulistan → Satrasta / Tejgaon Thana (~${fmtKm(b.km)})`, fare: leg2 },
        { text: 'Walk Love Road to AUST (~0.8–1 km)', fare: [0, 0] },
      ],
      steps: [
        b.legMode === 'rickshaw'
          ? `Take a rickshaw from ${o.name} to Gulistan (~${fmtKm(b.legKm)}) — about ${tk(leg1)}.`
          : `Take any Gulistan-bound bus from ${o.name} (~${fmtKm(b.legKm)}, ${tk(leg1)}). ${b.board.includes('(') ? b.board.slice(b.board.indexOf('(') + 1, -1) + '.' : ''}`,
        `At Gulistan, board a bus going toward Paltan → Mogbazar → Satrasta → Mohakhali — e.g. Provati Banasri or Panjeri (both start at Gulistan, so seats are easier).`,
        `Pay about ${tk(leg2)}. Ask to get off at Satrasta / Tejgaon Thana.`,
        `Get off at ${AUST_ACCESS.busDrop}.`,
        walkLeg,
      ],
      tips: MODE_TIPS.bus,
      reason: 'Bus legs use the BRTA chart rate ৳2.70/km (min ৳10 per bus).',
      sources: ['busRate', 'busRateTbs', 'busRoutes', 'osrm'],
    };
  }
  return null;
}

function metroOption(o) {
  const m = o.metro;
  if (!m) return null;
  const mf = mrtFare(m.station);
  if (!mf || m.station === 'Farmgate') return null;
  const lm = farmgateLastMile();
  const legs = [];
  let access = [0, 0];
  let accessTime = [0, 0];
  if (m.accessKm > 0.8) {
    access = rickshawFare(m.accessKm);
    accessTime = mins(m.accessKm, 9, 6);
    legs.push({ text: `Rickshaw to ${m.station} station (~${fmtKm(m.accessKm)})`, fare: access });
  } else if (m.accessKm > 0) {
    accessTime = [5, 10];
    legs.push({ text: `Walk to ${m.station} station`, fare: [0, 0] });
  }
  const atFarmgate = m.station === 'Farmgate';
  if (!atFarmgate) legs.push({ text: `MRT-6 ${m.station} → Farmgate (single ৳${mf.single}, card ৳${mf.card})`, fare: [mf.card, mf.single] });
  legs.push({ text: lm.text, fare: lm.fare });
  const hops = stationHops(m.station);
  const ride = atFarmgate ? 0 : Math.round(hops * MRT_MIN_PER_STATION);
  const fare = sum(access, [mf.card, mf.single], lm.fare);
  const steps = [];
  if (m.access) steps.push(m.access);
  else if (m.accessKm > 0.8) steps.push(`Take a rickshaw to ${m.station} metro station (~${fmtKm(m.accessKm)}, ${tk(access)}).`);
  else if (m.accessKm > 0) steps.push(`Walk to ${m.station} metro station.`);
  if (!atFarmgate) {
    steps.push(
      `Buy a single-journey ticket to Farmgate for ৳${mf.single} (৳${mf.card} with an MRT/Rapid Pass) and take the train ${MRT_STATIONS.findIndex((x) => x.name === m.station) < 10 ? 'toward Motijheel' : 'toward Uttara North'}.`,
      `Ride ${hops} stop${hops === 1 ? '' : 's'} (~${ride} min) and get off at Farmgate. (Karwan Bazar is the next stop and about the same distance from AUST.)`,
    );
  } else {
    steps.push('You are already at the Farmgate station area — no train needed.');
  }
  steps.push(...lm.steps);
  return {
    key: 'metro', legacyKey: 'metro_cost', label: 'Metro + rickshaw', fare,
    status: 'estimate',
    metroFare: atFarmgate ? null : mf,
    time: [accessTime[0] + ride + 8 + lm.time[0], accessTime[1] + ride + 15 + lm.time[1]],
    legs, steps, tips: MODE_TIPS.metro,
    reason: atFarmgate
      ? 'No train ride needed; the last mile is a rickshaw estimate.'
      : `Train fare ৳${mf.single} is official (MRT-6 chart). Total also includes the Farmgate → AUST rickshaw (estimate)${m.accessKm > 0.8 ? ' and a rickshaw to the station' : ''}.`,
    sources: ['mrtChart', 'mrtCheck', 'mrtDtca', 'osrm'],
  };
}

function cngOption(o) {
  const fare = cngFare(o.km);
  return {
    key: 'cng', legacyKey: 'taxi_cost', label: 'CNG auto-rickshaw', fare, status: 'estimate',
    meter: cngMeter(o.km),
    time: mins(o.km, 22, 10, 3),
    legs: [{ text: `${o.name} → AUST direct (${fmtKm(o.km)}). Meter ≈ ৳${cngMeter(o.km)} + waiting.`, fare }],
    steps: [
      `Find a CNG (green auto-rickshaw) in ${o.name}. Ask “meter-e jaben?” first; most will quote a fixed price instead.`,
      `Agree the fare before you sit — ${tk(fare)} is the realistic range (official meter ≈ ৳${cngMeter(o.km)} plus ৳2/min waiting).`,
      `Destination: “Love Road, Ahsanullah University, Tejgaon Thana er pashe”. ${o.note || ''}`.trim(),
      'Get down at the AUST gate on Love Road.',
    ],
    tips: MODE_TIPS.cng,
    reason: 'Meter fare uses the official 2015 tariff (still in force). Drivers rarely use meters; the range is 1.5–2× meter, based on Prothom Alo’s report of passengers paying about double.',
    sources: ['cngTariff', 'cngMeters', 'osrm'],
  };
}

function bikeOption(o) {
  const fare = bikeFare(o.km);
  return {
    key: 'bike', legacyKey: 'rideshare_cost', label: 'Pathao / Uber Moto', fare, status: 'estimate',
    time: mins(o.km, 25, 14, 5),
    legs: [{ text: `Bike ride ${o.name} → AUST (${fmtKm(o.km)}).`, fare }],
    steps: [
      'Open Pathao or Uber, choose Bike/Moto.',
      'Set the destination to “Ahsanullah University of Science and Technology, Love Road”.',
      `Expect around ${tk(fare)}; the app shows the exact fare before you confirm. Pay cash or in-app.`,
      'Ask to be dropped at the AUST main gate.',
    ],
    tips: MODE_TIPS.bike,
    reason: 'Based on Pathao’s last published Dhaka rate card (৳25 + ৳15/km + ৳0.5/min, min ৳50, Aug 2022). Upper value adds ~40% for the 2026 fuel hikes and surge. Check the app.',
    sources: ['pathao', 'rideHike2026', 'osrm'],
  };
}

function carOption(o) {
  const fare = carFare(o.km);
  return {
    key: 'car', legacyKey: 'rideshare_cost', label: 'Uber / Pathao Car', fare, status: 'estimate',
    time: mins(o.km, 22, 10, 6),
    legs: [{ text: `Car ride ${o.name} → AUST (${fmtKm(o.km)}).`, fare }],
    steps: [
      'Open Uber or Pathao and pick a car option.',
      'Destination: “Ahsanullah University of Science and Technology, Love Road, Tejgaon”.',
      `Expect around ${tk(fare)} depending on surge; tolls are extra if the driver takes the Elevated Expressway.`,
      'Drop-off at the AUST gate on Love Road.',
    ],
    tips: MODE_TIPS.car,
    reason: 'Uber’s last reported Bangladesh rate (৳50 + ৳21/km, 2022) as the lower bound; upper ×1.8 for surge and per-minute charges. Daily Star (2026) reported short trips rising from ৳200 to ৳230.',
    sources: ['uber', 'rideHike2026', 'osrm'],
  };
}

export function buildOptions(origin) {
  return [walkOption, rickshawOption, busOption, metroOption, cngOption, bikeOption, carOption]
    .map((fn) => fn(origin))
    .filter(Boolean);
}

export function cheapest(options) {
  return options.filter((x) => x.key !== 'walk').sort((a, b) => a.fare[0] - b.fare[0])[0] || null;
}

export { tk as formatTaka };
