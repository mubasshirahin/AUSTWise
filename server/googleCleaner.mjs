// ═══════════════════════════════════════════════════════════════════════════
// DIGITAL FOOTPRINT CLEANER — inbox → platform mapper (RAM only)
// ─────────────────────────────────────────────────────────────────────────────
// Takes a Gmail access token obtained from the browser (Google Identity
// Services, gmail.readonly scope), lists recent Inbox messages, extracts the
// `From:` header of each, maps the sender domain to a human brand name and
// dedupes into a single platform list. Nothing is written to disk or a
// database — the token and the extracted senders exist only in memory for the
// lifetime of one request and are dropped when the response finishes.
// ═══════════════════════════════════════════════════════════════════════════
import https from 'node:https';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const DEFAULT_MAX = 300;
const MAX_CAP = 500;
const INBOX_QUERY = 'category:primary OR category:updates';
const CONCURRENCY = 10;

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
  'sparkpostmail.com',
  'sparkpost.com',
  'amazonaws.com',
  'ses.amazonaws.com',
  'hubspotemail.net',
  'marketo.com',
  'pipedream.com',
  'zendesk.com',
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

// Known sender domains → brand names. The registrable domain is looked up
// first; anything not listed falls back to a title-cased domain guess.
const BRAND_MAP = {
  // Social
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
  // Streaming & entertainment
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
  'imo.im': 'IMO',
  'viber.com': 'Viber',
  'skype.com': 'Skype',
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
  'crunchyroll.com': 'Crunchyroll',
  'imdb.com': 'IMDb',
  'letterboxd.com': 'Letterboxd',
  'goodreads.com': 'Goodreads',
  '9anime.com': '9anime',
  'openai.com': 'OpenAI',
  // Work & productivity
  'google.com': 'Google',
  'accounts.google.com': 'Google',
  'microsoft.com': 'Microsoft',
  'outlook.com': 'Outlook',
  'icloud.com': 'Apple',
  'apple.com': 'Apple',
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
  // Education
  'coursera.org': 'Coursera',
  'udemy.com': 'Udemy',
  'udacity.com': 'Udacity',
  'khanacademy.org': 'Khan Academy',
  'duolingo.com': 'Duolingo',
  'edx.org': 'edX',
  'unacademy.com': 'Unacademy',
  'byjus.com': 'BYJU\'S',
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
  // Shopping & delivery
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
  'uber.com': 'Uber',
  'lyft.com': 'Lyft',
  'grab.com': 'Grab',
  'gojek.com': 'Gojek',
  'olacabs.com': 'Ola',
  'inDrive.com': 'inDrive',
  // Travel
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
  // Fintech & banking
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
  // Health & fitness
  'strava.com': 'Strava',
  'fitbit.com': 'Fitbit',
  'myfitnesspal.com': 'MyFitnessPal',
  'healthify.me': 'HealthifyMe',
  'cult.fit': 'Cult.fit',
  // News & info
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
  // Telecom (Bangladesh)
  'gp.com.bd': 'Grameenphone',
  'robi.com.bd': 'Robi',
  'airtel.com.bd': 'Airtel',
  'banglalink.com.bd': 'Banglalink',
  'teletalk.com.bd': 'Teletalk',
  'airtel.in': 'Airtel India',
  'vodafone.com': 'Vodafone',
  // Job & professional
  'glassdoor.com': 'Glassdoor',
  'indeed.com': 'Indeed',
  'bdjobs.com': 'Bdjobs',
  'bdcirculars.com': 'BD Circulars',
  'rokomari.com': 'Rokomari',
  // Gaming
  'ubisoft.com': 'Ubisoft',
  'square-enix.com': 'Square Enix',
  'minecraft.net': 'Minecraft',
  'valorant.com': 'Valorant',
  'pubgmobile.com': 'PUBG Mobile',
  'freefire.com': 'Free Fire',
  // Productivity misc
  'gov.bd': 'Bangladesh Government',
  'a2i.gov.bd': 'a2i',
  'e.gov.bd': 'Bangladesh Government',
};

// Fallback for unmapped domains: title-case the registrable domain's first
// label, keeping a few well-known acronyms intact.
const ACRONYM_OVERRIDES = new Map([
  ['ai', 'AI'], ['gpt', 'GPT'], ['faq', 'FAQ'], ['api', 'API'],
  ['iq', 'IQ'], ['id', 'ID'], ['io', 'IO'],
]);

function registrableDomain(domain) {
  const labels = domain.split('.');
  if (labels.length <= 2) return domain;
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_PART_TLD.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

function brandName(registrable) {
  if (BRAND_MAP[registrable]) return BRAND_MAP[registrable];
  const sld = registrable.split('.')[0].replace(/[-_]/g, ' ');
  if (!sld) return registrable;
  return sld
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (ACRONYM_OVERRIDES.has(lower)) return ACRONYM_OVERRIDES.get(lower);
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function extractEmail(from) {
  if (!from) return null;
  const match = from.match(/[\w.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+/);
  return match ? match[0] : null;
}

function gapiGet(url, token) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
          if (res.statusCode >= 400) {
            const err = new Error(
              parsed?.error?.message || `Gmail API error ${res.statusCode}`
            );
            err.statusCode = res.statusCode;
            reject(err);
            return;
          }
          resolve(parsed);
        });
      })
      .on('error', reject);
  });
}

/**
 * Scan the user's Inbox and reduce it to a deduplicated platform list.
 *
 * @param {string} token       Gmail OAuth access token (gmail.readonly)
 * @param {object} [opts]
 * @param {string} [opts.userEmail]  The authenticated email — self-emails excluded
 * @param {number} [opts.maxResults] Message count to scan (default 300, cap 500)
 * @param {Function} [opts.onProgress]  (processed, total) called as messages parse
 * @returns {Promise<{platforms: Array, scanned: number}>}
 */
export async function scanGmail(token, opts = {}) {
  const maxResults = Math.min(MAX_CAP, Math.max(1, Number(opts.maxResults) || DEFAULT_MAX));
  const userEmail = (opts.userEmail || '').toLowerCase();

  const listUrl = `${GMAIL_API}/users/me/messages?${new URLSearchParams({
    maxResults: String(maxResults),
    q: INBOX_QUERY,
  }).toString()}`;
  const list = await gapiGet(listUrl, token);
  const ids = (list.messages || []).map((m) => m.id);

  if (ids.length === 0) {
    return { platforms: [], scanned: 0, total: 0 };
  }

  const platforms = new Map(); // registrable domain → { name, domain, count, sender, firstSeen }
  let cursor = 0;

  const handleMessage = async (id) => {
    try {
      const msg = await gapiGet(
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
        if (
          domain &&
          domain !== 'gmail.com' &&
          senderEmail !== userEmail &&
          !NOISE_DOMAINS.has(domain) &&
          !NOISE_DOMAINS.has(registrableDomain(domain))
        ) {
          const registrable = registrableDomain(domain);
          const existing = platforms.get(registrable);
          if (existing) {
            existing.count += 1;
            existing.senders.add(senderEmail);
            if (!existing.sender) existing.sender = fromHeader;
          } else {
            platforms.set(registrable, {
              name: brandName(registrable),
              domain: registrable,
              sender: fromHeader,
              senders: new Set([senderEmail]),
              count: 1,
            });
          }
        }
      }
    } catch {
      // Individual message failures (deleted mid-scan, rate limits) are
      // skipped — the scan degrades gracefully instead of aborting.
    }
  };

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      await handleMessage(id);
      if (opts.onProgress) opts.onProgress(cursor, ids.length);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const platformsArr = [...platforms.values()]
    .map(({ name, domain, sender, senders, count }) => ({
      name,
      domain,
      sender,
      emailCount: count,
      accountCount: senders.size,
    }))
    .sort((a, b) => b.emailCount - a.emailCount);

  return { platforms: platformsArr, scanned: ids.length, total: ids.length };
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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

/**
 * Routes:
 *   POST /api/cleaner/scan  { accessToken, email, maxResults }
 *     → Server-Sent Events stream of progress, ending with the platform list.
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
      sendJson(res, 400, { error: err.message });
      return true;
    }

    const { accessToken, email, maxResults } = body || {};
    if (!accessToken || typeof accessToken !== 'string') {
      sendJson(res, 400, { error: 'A Gmail access token is required. Connect your Google account first.' });
      return true;
    }

    // SSE stream: keeps the client informed of scan progress without holding
    // the whole result hostage until the last message.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      const result = await scanGmail(accessToken, {
        userEmail: email,
        maxResults,
        onProgress: (processed, total) => emit({ type: 'progress', processed, total }),
      });
      emit({ type: 'done', ...result });
    } catch (err) {
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
    } finally {
      res.end();
    }
    return true;
  }

  return false;
}