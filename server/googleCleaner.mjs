// ═══════════════════════════════════════════════════════════════════════════
// DIGITAL FOOTPRINT CLEANER — full-inbox → platform mapper (RAM only)
// ─────────────────────────────────────────────────────────────────────────────
// Takes a Gmail access token obtained from the browser (Google Identity
// Services, gmail.readonly scope) and walks the mailbox:
//   • `quick` mode — the most recent ~1,000 messages (fast preview)
//   • `full`  mode — the ENTIRE mailbox history via nextPageToken pagination
// For every message only the `From:` header is fetched (format=metadata);
// bodies are never read. Sender domains are mapped to brand names +
// categories and deduped into a single platform list. Nothing is written to
// disk or a database — the token and the extracted senders exist only in
// memory for the lifetime of one request and are dropped when the response
// finishes.
//
// Rate-limit strategy: message metadata is fetched in chunks through a
// bounded-concurrency worker pool with a small delay between chunks, and
// every request retries 429 / 5xx / network errors with exponential backoff
// and jitter before an individual message is skipped (the scan degrades
// gracefully instead of aborting). Progress is streamed to the client as
// SSE events so the UI can show "X emails scanned · Y services found" live,
// and the moment the client disconnects the scan stops.
// ═══════════════════════════════════════════════════════════════════════════
import https from 'node:https';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

// Query targets the ENTIRE account (inbox + archive + sent copies of signup
// confirmations + spam/trash) while skipping Hangouts/Chat entries and the
// user's own outgoing mail. Domain-level noise is filtered in code below.
const INBOX_QUERY = 'in:anywhere -is:chat -from:me';

const PAGE_SIZE = 500;       // messages per gmail.users.messages.list page
const CHUNK_SIZE = 50;       // messages per parsing chunk
const CONCURRENCY = 10;      // parallel metadata fetches within a chunk
const BATCH_DELAY_MS = 150;  // breather between list pages / parse chunks
const RETRY_ATTEMPTS = 4;    // per-request retry budget (429/5xx/network)
const RETRY_BASE_MS = 600;   // exponential backoff: 600ms → 1.2s → 2.4s → 4.8s
const PROGRESS_MIN_MS = 200; // throttle for SSE progress events
const HEARTBEAT_MS = 15_000; // SSE comment ping so proxies keep the stream open

// Senders from these domains are email-delivery infrastructure, not services
// the user signed up with — they add noise, so they are excluded.
const NOISE_DOMAINS = new Set([
  'sendgrid.net',
  'sendgrid.com',
  'mandrillapp.com',
  'mandrill.com',
  'mcsv.net',
  'mailchimp.com',
  'mailchimpapp.net',
  'mailgun.com',
  'mailgun.org',
  'postmarkapp.com',
  'postmark.com',
  'sparkpostmail.com',
  'sparkpost.com',
  'amazonses.com',
  'amazonaws.com',
  'ses.amazonaws.com',
  'awsapps.com',
  'hubspotemail.net',
  'hubspot.com',
  'marketo.com',
  'mktomail.com',
  'pipedream.com',
  'zendesk.com',
  'sendinblue.com',
  'sendinblue.net',
  'brevo.com',
  'mailjet.com',
  'intercom-mail.com',
  'intercommail.com',
  'exacttarget.com',
  'constantcontact.com',
  'campaign-archive.com',
  'emailsrvr.com',
]);

// Campaign/relay subdomain patterns that vary by instance (e.g. Mailchimp's
// cmail20.com, cmail19.com …) — matched against the full domain.
const NOISE_PATTERNS = [/^cmail\d+\./, /^smtp\d*\./];

// Personal mailbox providers — mail from these is correspondence or another
// person's account, never a platform the user registered with.
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de',
  'live.com', 'live.co.uk', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aim.com',
  'protonmail.com', 'protonmail.ch', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com',
  'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de', 'freenet.de',
  'mail.com', 'email.com',
  'yandex.com', 'yandex.ru', 'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru', 'internet.ru',
  'rediffmail.com',
  'qq.com', '163.com', '126.com', 'sina.com', 'aliyun.com',
  'naver.com', 'daum.net', 'hanmail.net',
  'fastmail.com', 'fastmail.fm', 'tutanota.com', 'tuta.io', 'hey.com', 'hushmail.com',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net', 'sfr.fr',
  'btinternet.com', 'talktalk.net', 'sky.com', 'virginmedia.com',
  'comcast.net', 'verizon.net', 'att.net', 'charter.net', 'cox.net',
  'bell.net', 'rogers.com', 'telus.net', 'shaw.ca',
  'bigpond.com', 'optusnet.com.au', 'iinet.net.au',
  'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br',
]);

// Two-label TLDs so `me@news.example.co.uk` resolves to `example.co.uk`,
// not the nonsense `co.uk`.
const MULTI_PART_TLD = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk', 'com.au', 'net.au', 'org.au',
  'com.bd', 'co.bd', 'org.bd', 'com.pk', 'com.ng', 'co.ke', 'com.ke', 'co.za',
  'com.za', 'com.br', 'com.ar', 'com.mx', 'com.co', 'co.id', 'com.id', 'co.nz',
  'com.my', 'com.sg', 'com.ph', 'co.jp', 'ne.jp', 'co.kr', 'com.tw', 'com.hk',
  'com.cn', 'com.tr', 'co.th', 'com.vn', 'com.sa', 'com.ae', 'com.eg', 'com.ua',
  'com.pl', 'com.in', 'co.in', 'net.in', 'org.in', 'com.ng', 'co.ng',
]);

// Known sender domains grouped by category. Each section flattens into a
// single BRAND_MAP of domain → { name, category }; anything not listed falls
// back to a title-cased domain guess in the 'Other' category.
const BRAND_SECTIONS = {
  Social: {
    'instagram.com': 'Instagram',
    'facebook.com': 'Facebook',
    'fb.com': 'Facebook',
    'facebookmail.com': 'Facebook',
    'messenger.com': 'Messenger',
    'x.com': 'X (Twitter)',
    'twitter.com': 'X (Twitter)',
    'tiktok.com': 'TikTok',
    'snapchat.com': 'Snapchat',
    'linkedin.com': 'LinkedIn',
    'reddit.com': 'Reddit',
    'pinterest.com': 'Pinterest',
    'discord.com': 'Discord',
    'whatsapp.com': 'WhatsApp',
    'telegram.org': 'Telegram',
    'youtube.com': 'YouTube',
    'quora.com': 'Quora',
    'medium.com': 'Medium',
    'twitch.tv': 'Twitch',
    'threads.net': 'Threads',
    'behance.net': 'Behance',
    'dribbble.com': 'Dribbble',
    'tumblr.com': 'Tumblr',
    'flickr.com': 'Flickr',
    'imo.im': 'IMO',
    'viber.com': 'Viber',
    'skype.com': 'Skype',
  },
  Streaming: {
    'netflix.com': 'Netflix',
    'spotify.com': 'Spotify',
    'primevideo.com': 'Amazon Prime Video',
    'hulu.com': 'Hulu',
    'disneyplus.com': 'Disney+',
    'hbomax.com': 'HBO Max',
    'hotstar.com': 'Disney+ Hotstar',
    'chorki.com': 'Chorki',
    'bioscopelive.com': 'Bioscope',
    'hoichoi.tv': 'hoichoi',
    'crunchyroll.com': 'Crunchyroll',
    'imdb.com': 'IMDb',
    'letterboxd.com': 'Letterboxd',
    'goodreads.com': 'Goodreads',
    '9anime.com': '9anime',
  },
  Gaming: {
    'steampowered.com': 'Steam',
    'steamcommunity.com': 'Steam',
    'epicgames.com': 'Epic Games',
    'roblox.com': 'Roblox',
    'nintendo.com': 'Nintendo',
    'playstation.com': 'PlayStation',
    'xbox.com': 'Xbox',
    'ea.com': 'EA',
    'rockstargames.com': 'Rockstar Games',
    'riotgames.com': 'Riot Games',
    'mobygames.com': 'MobyGames',
    'ubisoft.com': 'Ubisoft',
    'square-enix.com': 'Square Enix',
    'minecraft.net': 'Minecraft',
    'valorant.com': 'Valorant',
    'pubgmobile.com': 'PUBG Mobile',
    'freefire.com': 'Free Fire',
  },
  Work: {
    'openai.com': 'OpenAI',
    'notion.so': 'Notion',
    'notion.com': 'Notion',
    'slack.com': 'Slack',
    'zoom.us': 'Zoom',
    'zoom.com': 'Zoom',
    'meet.google.com': 'Google Meet',
    'asana.com': 'Asana',
    'trello.com': 'Trello',
    'figma.com': 'Figma',
    'canva.com': 'Canva',
    'adobe.com': 'Adobe',
    'dropbox.com': 'Dropbox',
    'onedrive.com': 'OneDrive',
    'box.com': 'Box',
    'evernote.com': 'Evernote',
    'docs.google.com': 'Google Docs',
    'drive.google.com': 'Google Drive',
    'github.com': 'GitHub',
    'gitlab.com': 'GitLab',
    'bitbucket.org': 'Bitbucket',
    'stackoverflow.com': 'Stack Overflow',
    'stackexchange.com': 'Stack Exchange',
    'wix.com': 'Wix',
    'wordpress.com': 'WordPress',
    'substack.com': 'Substack',
    'squarespace.com': 'Squarespace',
    'webflow.com': 'Webflow',
    'framer.com': 'Framer',
    'airtable.com': 'Airtable',
    'miro.com': 'Miro',
    'monday.com': 'Monday.com',
    'clickup.com': 'ClickUp',
    'linear.app': 'Linear',
    'teams.microsoft.com': 'Microsoft Teams',
    'office.com': 'Microsoft 365',
    'jira.com': 'Jira',
    'atlassian.com': 'Atlassian',
    'confluence.com': 'Confluence',
    'mailchimp.com': 'Mailchimp',
    'typeform.com': 'Typeform',
    'calendly.com': 'Calendly',
    'glassdoor.com': 'Glassdoor',
    'indeed.com': 'Indeed',
    'bdjobs.com': 'Bdjobs',
    'bdcirculars.com': 'BD Circulars',
  },
  Tech: {
    'google.com': 'Google',
    'accounts.google.com': 'Google',
    'microsoft.com': 'Microsoft',
    'outlook.com': 'Outlook',
    'icloud.com': 'Apple',
    'apple.com': 'Apple',
  },
  Education: {
    'coursera.org': 'Coursera',
    'udemy.com': 'Udemy',
    'udacity.com': 'Udacity',
    'khanacademy.org': 'Khan Academy',
    'duolingo.com': 'Duolingo',
    'edx.org': 'edX',
    'unacademy.com': 'Unacademy',
    'byjus.com': "BYJU'S",
    'leapfrog.com': 'Leapfrog',
    'myob.com': 'MYOB',
    'brilliant.org': 'Brilliant',
    'codecademy.com': 'Codecademy',
    'freecodecamp.org': 'freeCodeCamp',
    'leetcode.com': 'LeetCode',
    'codeforces.com': 'Codeforces',
    'hackerrank.com': 'HackerRank',
    'hackerearth.com': 'HackerEarth',
    'geeksforgeeks.org': 'GeeksforGeeks',
    'aust.edu': 'AUST',
    'mbstu.ac.bd': 'MBSTU',
    'buet.ac.bd': 'BUET',
    'du.ac.bd': 'DU',
    'northsouth.edu': 'North South University',
    'bracu.ac.bd': 'BRAC University',
    'iub.edu.bd': 'IUB',
    'aiub.edu': 'AIUB',
  },
  Shopping: {
    'amazon.com': 'Amazon',
    'amazon.in': 'Amazon India',
    'ebay.com': 'eBay',
    'alibaba.com': 'Alibaba',
    'aliexpress.com': 'AliExpress',
    'flipkart.com': 'Flipkart',
    'daraz.com': 'Daraz',
    'daraz.com.bd': 'Daraz Bangladesh',
    'shopify.com': 'Shopify',
    'etsy.com': 'Etsy',
    'nike.com': 'Nike',
    'adidas.com': 'Adidas',
    'zara.com': 'Zara',
    'uniqlo.com': 'Uniqlo',
    'hm.com': 'H&M',
    'myntra.com': 'Myntra',
    'ajio.com': 'AJIO',
    'pathao.com': 'Pathao',
    'foodpanda.com': 'Foodpanda',
    'foodpanda.com.bd': 'Foodpanda',
    'swiggy.com': 'Swiggy',
    'zomato.com': 'Zomato',
    'rokomari.com': 'Rokomari',
  },
  Travel: {
    'uber.com': 'Uber',
    'lyft.com': 'Lyft',
    'grab.com': 'Grab',
    'gojek.com': 'Gojek',
    'olacabs.com': 'Ola',
    'inDrive.com': 'inDrive',
    'airbnb.com': 'Airbnb',
    'booking.com': 'Booking.com',
    'agoda.com': 'Agoda',
    'expedia.com': 'Expedia',
    'tripadvisor.com': 'Tripadvisor',
    'makemytrip.com': 'MakeMyTrip',
    'biman-airlines.com': 'Biman Bangladesh Airlines',
    'usbair.com': 'US-Bangla Airlines',
    'novoair.com': 'Novoair',
    'shohoz.com': 'Shohoz',
    'railway.gov.bd': 'Bangladesh Railway',
  },
  Fintech: {
    'paypal.com': 'PayPal',
    'stripe.com': 'Stripe',
    'venmo.com': 'Venmo',
    'cash.app': 'Cash App',
    'wise.com': 'Wise',
    'revolut.com': 'Revolut',
    'binance.com': 'Binance',
    'coinbase.com': 'Coinbase',
    'kraken.com': 'Kraken',
    'bkash.com': 'bKash',
    'nagad.com': 'Nagad',
    'rocket.com.bd': 'Rocket',
    'dbbl.com.bd': 'DBBL',
    'bracbank.com': 'BRAC Bank',
    'citybank.com.bd': 'City Bank',
    'islamibankbd.com': 'Islami Bank',
    'sonalibank.com.bd': 'Sonali Bank',
    'surecash.com.bd': 'SureCash',
    'sslcommerz.com': 'SSLCommerz',
    'fawry.com': 'Fawry',
    'squareup.com': 'Square',
    'gpay.com': 'Google Pay',
    'paytm.com': 'Paytm',
    'phonepe.com': 'PhonePe',
    'khalti.com': 'Khalti',
    'esewa.com.np': 'eSewa',
  },
  Health: {
    'strava.com': 'Strava',
    'fitbit.com': 'Fitbit',
    'myfitnesspal.com': 'MyFitnessPal',
    'healthify.me': 'HealthifyMe',
    'cult.fit': 'Cult.fit',
  },
  News: {
    'cnn.com': 'CNN',
    'bbc.co.uk': 'BBC',
    'bbc.com': 'BBC',
    'nytimes.com': 'The New York Times',
    'wsj.com': 'The Wall Street Journal',
    'theguardian.com': 'The Guardian',
    'forbes.com': 'Forbes',
    'wired.com': 'WIRED',
    'techcrunch.com': 'TechCrunch',
    'theverge.com': 'The Verge',
    'wikipedia.org': 'Wikipedia',
    'wikimedia.org': 'Wikimedia',
    'weather.com': 'The Weather Channel',
    'accuweather.com': 'AccuWeather',
    'prothomalo.com': 'Prothom Alo',
    'thedailystar.net': 'The Daily Star',
    'bdnews24.com': 'bdnews24.com',
    'jugantor.com': 'Jugantor',
    'dhakatribune.com': 'Dhaka Tribune',
    'financialexpress.com.bd': 'The Financial Express',
    'somoynews.tv': 'Somoy News',
    'jamuna.tv': 'Jamuna TV',
  },
  Telecom: {
    'gp.com.bd': 'Grameenphone',
    'robi.com.bd': 'Robi',
    'airtel.com.bd': 'Airtel',
    'banglalink.com.bd': 'Banglalink',
    'teletalk.com.bd': 'Teletalk',
    'airtel.in': 'Airtel India',
    'vodafone.com': 'Vodafone',
  },
  Government: {
    'gov.bd': 'Bangladesh Government',
    'a2i.gov.bd': 'a2i',
    'e.gov.bd': 'Bangladesh Government',
  },
};

const BRAND_MAP = Object.fromEntries(
  Object.entries(BRAND_SECTIONS).flatMap(([category, domains]) =>
    Object.entries(domains).map(([domain, name]) => [domain, { name, category }])
  )
);

// Fallback for unmapped domains: title-case the registrable domain's first
// label, keeping a few well-known acronyms intact.
const ACRONYM_OVERRIDES = new Map([
  ['ai', 'AI'], ['gpt', 'GPT'], ['faq', 'FAQ'], ['api', 'API'],
  ['iq', 'IQ'], ['id', 'ID'], ['io', 'IO'],
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Thrown when the client disconnects mid-scan — unwinds the whole scan. */
class ScanCancelled extends Error {
  constructor() {
    super('Scan cancelled by client.');
    this.name = 'ScanCancelled';
  }
}

function registrableDomain(domain) {
  const labels = domain.split('.');
  if (labels.length <= 2) return domain;
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_PART_TLD.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

/** Domain → { name, category }, falling back to a title-cased 'Other'. */
function brandEntry(registrable) {
  const hit = BRAND_MAP[registrable];
  if (hit) return hit;
  const sld = registrable.split('.')[0].replace(/[-_]/g, ' ');
  const name = sld
    ? sld
        .split(' ')
        .filter(Boolean)
        .map((w) => {
          const lower = w.toLowerCase();
          if (ACRONYM_OVERRIDES.has(lower)) return ACRONYM_OVERRIDES.get(lower);
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ') || registrable
    : registrable;
  return { name, category: 'Other' };
}

function extractEmail(from) {
  if (!from) return null;
  const match = from.match(/[\w.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+/);
  return match ? match[0] : null;
}

function isExcludedDomain(domain, registrable) {
  if (PERSONAL_DOMAINS.has(domain) || PERSONAL_DOMAINS.has(registrable)) return true;
  if (NOISE_DOMAINS.has(domain) || NOISE_DOMAINS.has(registrable)) return true;
  return NOISE_PATTERNS.some((re) => re.test(domain) || re.test(registrable));
}

// ── Gmail API plumbing with retry/backoff ────────────────────────────────

function gapiGet(url, token) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
          resolve({ statusCode: res.statusCode, parsed });
        });
      })
      .on('error', reject);
  });
}

// 429 and 5xx are always transient. 403 is only retryable when Google says
// it's a rate/quota problem (userRateLimitExceeded etc.), not a permission
// denial — the latter must fail fast so the user can reconnect.
function isRetryable(statusCode, parsed) {
  if (statusCode === 429 || statusCode >= 500) return true;
  if (statusCode === 403) {
    const reason =
      parsed?.error?.errors?.[0]?.reason || parsed?.error?.message || '';
    return /rate|quota|backend/i.test(reason);
  }
  return false;
}

/**
 * GET with exponential backoff + jitter on transient failures. Throws an
 * Error carrying `.statusCode` once the retry budget is exhausted or the
 * failure is non-retryable (401/403 permission, 404, …).
 */
async function gapiGetWithRetry(url, token) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * 250);
    }
    let res;
    try {
      res = await gapiGet(url, token);
    } catch (err) {
      lastErr = err; // network hiccup — worth another attempt
      continue;
    }
    if (res.statusCode < 400) return res.parsed;
    lastErr = new Error(res.parsed?.error?.message || `Gmail API error ${res.statusCode}`);
    lastErr.statusCode = res.statusCode;
    if (!isRetryable(res.statusCode, res.parsed)) throw lastErr;
  }
  throw lastErr || new Error('Gmail API request failed.');
}

/**
 * Drain a bounded worker pool over `items`, honouring cancellation between
 * items. Each item is handled exactly once; a thrown ScanCancelled aborts
 * the whole pool so the scan unwinds promptly on client disconnect.
 */
async function runPool(items, worker, concurrency) {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await worker(items[idx]);
      }
    }
  );
  await Promise.all(runners);
}

/**
 * Scan the user's mailbox and reduce it to a deduplicated platform list.
 *
 * @param {string} token   Gmail OAuth access token (gmail.readonly)
 * @param {object} [opts]
 * @param {string} [opts.userEmail]   Authenticated email — self-emails excluded
 * @param {string} [opts.mode]        'quick' (latest ~1,000) | 'full' (all history)
 * @param {number} [opts.maxResults]  Override the quick-scan window size
 * @param {Function} [opts.onEvent]   SSE sink: ({type, ...}) for start/list/progress/done
 * @param {Function} [opts.isCancelled] polled between steps; true stops the scan
 * @returns {Promise<{platforms: Array, scanned: number, total: number, mode: string}>}
 */
export async function scanGmail(token, opts = {}) {
  const mode = opts.mode === 'full' ? 'full' : 'quick';
  const limit = mode === 'full'
    ? Infinity
    : Math.min(5000, Math.max(100, Number(opts.maxResults) || 1000));
  const userEmail = (opts.userEmail || '').toLowerCase();
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
  const isCancelled =
    typeof opts.isCancelled === 'function' ? opts.isCancelled : () => false;

  onEvent({
    type: 'start',
    mode,
    query: INBOX_QUERY,
    limit: Number.isFinite(limit) ? limit : null,
  });

  // Phase 1 — index the mailbox: paginate users/me/messages via nextPageToken
  // until the whole history is listed (full) or the quick window is reached.
  const ids = [];
  let pageToken;
  do {
    if (isCancelled()) throw new ScanCancelled();
    const params = new URLSearchParams({
      maxResults: String(PAGE_SIZE),
      q: INBOX_QUERY,
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await gapiGetWithRetry(
      `${GMAIL_API}/users/me/messages?${params.toString()}`,
      token
    );
    for (const m of page.messages || []) {
      if (ids.length < limit) ids.push(m.id);
    }
    onEvent({ type: 'list', listed: ids.length });
    pageToken = ids.length >= limit ? null : page.nextPageToken;
    if (pageToken) await sleep(BATCH_DELAY_MS);
  } while (pageToken);

  if (ids.length === 0) {
    onEvent({ type: 'done', platforms: [], scanned: 0, total: 0, mode });
    return { platforms: [], scanned: 0, total: 0, mode };
  }

  // Phase 2 — fetch each message's From: header in chunks through a
  // bounded-concurrency pool, streaming progress between chunks.
  const platforms = new Map(); // registrable domain → { name, category, count, sender, senders }
  let processed = 0;
  let skipped = 0;

  const handleMessage = async (id) => {
    if (isCancelled()) throw new ScanCancelled();
    try {
      const msg = await gapiGetWithRetry(
        `${GMAIL_API}/users/me/messages/${id}?${new URLSearchParams({
          format: 'metadata',
          metadataHeaders: 'From',
        }).toString()}`,
        token
      );
      const fromHeader = (msg.payload?.headers || []).find(
        (h) => h.name.toLowerCase() === 'from'
      )?.value;
      const email = extractEmail(fromHeader);
      if (email) {
        const domain = email.split('@')[1].toLowerCase().replace(/\.$/, '');
        const senderEmail = email.toLowerCase();
        if (domain && senderEmail !== userEmail) {
          const registrable = registrableDomain(domain);
          if (!isExcludedDomain(domain, registrable)) {
            const existing = platforms.get(registrable);
            if (existing) {
              existing.count += 1;
              existing.senders.add(senderEmail);
              if (!existing.sender) existing.sender = fromHeader;
            } else {
              const { name, category } = brandEntry(registrable);
              platforms.set(registrable, {
                name,
                category,
                domain: registrable,
                sender: fromHeader,
                senders: new Set([senderEmail]),
                count: 1,
              });
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof ScanCancelled) throw err;
      // Individual message failures (deleted mid-scan, exhausted retries)
      // are skipped — the scan degrades gracefully instead of aborting.
      skipped += 1;
    }
  };

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    if (isCancelled()) throw new ScanCancelled();
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    await runPool(chunk, handleMessage, CONCURRENCY);
    processed = Math.min(i + CHUNK_SIZE, ids.length);
    onEvent({ type: 'progress', processed, total: ids.length, found: platforms.size });
    if (i + CHUNK_SIZE < ids.length) await sleep(BATCH_DELAY_MS);
  }

  const platformsArr = [...platforms.values()]
    .map(({ name, category, domain, sender, senders, count }) => ({
      name,
      category,
      domain,
      sender,
      emailCount: count,
      accountCount: senders.size,
    }))
    .sort((a, b) => b.emailCount - a.emailCount);

  onEvent({
    type: 'done',
    platforms: platformsArr,
    scanned: processed,
    total: ids.length,
    skipped,
    mode,
  });
  return { platforms: platformsArr, scanned: processed, total: ids.length, skipped, mode };
}

// ── HTTP dispatch (raw-node style, matching server/dev.mjs) ──────────────

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON request body.')); }
    });
    req.on('error', reject);
  });
}

/**
 * Routes:
 *   POST /api/cleaner/scan  { accessToken, email, mode: 'quick'|'full', maxResults? }
 *     → Server-Sent Events stream:
 *         { type: 'start',    mode, query, limit }
 *         { type: 'list',     listed }            — mailbox indexing progress
 *         { type: 'progress', processed, total, found }
 *         { type: 'done',     platforms, scanned, total, skipped, mode }
 *         { type: 'error',    error, statusCode, hint? }
 * Returns true when it handled the request.
 */
export async function handleCleanerRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return false;
  }

  if (url.pathname === '/api/cleaner/scan' && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }

    const { accessToken, email, maxResults } = body || {};
    if (!accessToken || typeof accessToken !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A Gmail access token is required. Connect your Google account first.' }));
      return true;
    }

    // SSE stream: keeps the client informed of scan progress without holding
    // the whole result hostage until the last message.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const emit = (event) => {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* socket gone */ }
    };

    // The instant the browser aborts (cancel button, tab close), stop all
    // Gmail API work — no orphaned scanning of a mailbox nobody watches.
    let cancelled = false;
    res.on('close', () => { cancelled = true; });

    // Comment pings keep proxies/keep-alives from pruning a quiet stream
    // during long backoff waits.
    const heartbeat = setInterval(() => {
      if (!cancelled) {
        try { res.write(': ping\n\n'); } catch { /* socket gone */ }
      }
    }, HEARTBEAT_MS);

    try {
      await scanGmail(accessToken, {
        userEmail: email,
        mode: body?.mode,
        maxResults,
        onEvent: emit,
        isCancelled: () => cancelled,
      });
    } catch (err) {
      if (!(err instanceof ScanCancelled) && !cancelled) {
        const statusCode = err.statusCode || 500;
        emit({
          type: 'error',
          error: err.message || 'Gmail scan failed.',
          statusCode,
          hint:
            statusCode === 401 || statusCode === 403
              ? 'Your Google permission has expired or was revoked. Please reconnect and grant read access again.'
              : undefined,
        });
      }
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
    return true;
  }

  return false;
}
