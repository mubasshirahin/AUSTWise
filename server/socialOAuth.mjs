const CREDENTIALS = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    apiUrl: 'https://api.github.com/user',
    scope: 'read:user',
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    apiUrl: 'https://discord.com/api/users/@me',
    scope: 'identify',
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiUrl: 'https://api.spotify.com/v1/me',
    scope: 'user-read-email',
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    apiUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large),link',
    scope: 'public_profile,email',
  },
  steam: {
    apiKey: process.env.STEAM_API_KEY || '',
  },
};

// Validate required OAuth credentials on startup
for (const [provider, creds] of Object.entries(CREDENTIALS)) {
  const missing = Object.entries(creds)
    .filter(([k, v]) => k !== 'authUrl' && k !== 'tokenUrl' && k !== 'apiUrl' && k !== 'scope' && !v)
    .map(([k]) => k);
  if (missing.length) {
    console.warn(`⚠️  OAuth [${provider}]: ${missing.join(', ')} not set in .env — ${provider} login will not work.`);
  }
}

const CALLBACK_HTML = (provider, profile) => `<!DOCTYPE html>
<html><body><script>
const data = ${JSON.stringify({ provider, profile })};
if (window.opener) {
  window.opener.postMessage(data, '*');
  document.body.innerHTML = '<h3>✅ Connected! You may close this window.</h3>';
  setTimeout(() => window.close(), 1500);
} else {
  document.body.innerHTML = '<h3>No opener found. Try again.</h3>';
}
<\/script></body></html>`;

function getRedirectUri(req, provider) {
  const host = req.headers.host || 'localhost:5174';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}/api/auth/${provider}/callback`;
}

async function fetchJson(url, options = {}) {
  const mod = await import('node:https');
  return new Promise((resolve, reject) => {
    const req = mod.default.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const ct = res.headers['content-type'] || '';
          if (ct.includes('application/x-www-form-urlencoded') || ct.includes('text/plain')) {
            const params = new URLSearchParams(data);
            resolve(Object.fromEntries(params));
          } else {
            resolve(JSON.parse(data));
          }
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function fetchJsonPost(url, body, headers = {}) {
  const mod = await import('node:https');
  const urlObj = new URL(url);
  return new Promise((resolve, reject) => {
    const req = mod.default.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const ct = res.headers['content-type'] || '';
          if (ct.includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams(data);
            resolve(Object.fromEntries(params));
          } else {
            resolve(JSON.parse(data));
          }
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(typeof body === 'string' ? body : new URLSearchParams(body).toString());
    req.end();
  });
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
  });
  res.end(html);
}

async function handleGitHub(req, res, redirectUri) {
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const code = query.get('code');
  const error = query.get('error');

  if (error) {
    sendHtml(res, CALLBACK_HTML('github', { error: `GitHub returned an error: ${error}` }));
    return;
  }

  if (!code) {
    res.writeHead(302, { Location: `${CREDENTIALS.github.authUrl}?client_id=${CREDENTIALS.github.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${CREDENTIALS.github.scope}` });
    res.end();
    return;
  }
  const tokenData = await fetchJsonPost(CREDENTIALS.github.tokenUrl, {
    client_id: CREDENTIALS.github.clientId,
    client_secret: CREDENTIALS.github.clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const accessToken = tokenData.access_token;
  if (!accessToken) { sendHtml(res, CALLBACK_HTML('github', { error: 'No access token' })); return; }
  const profile = await fetchJson(CREDENTIALS.github.apiUrl, { headers: { 'User-Agent': 'AUSTWise', 'Authorization': `Bearer ${accessToken}` } });
  sendHtml(res, CALLBACK_HTML('github', {
    id: String(profile.id),
    username: profile.login,
    displayName: profile.name || profile.login,
    email: profile.email,
    avatar: profile.avatar_url,
  }));
}

async function handleDiscord(req, res, redirectUri) {
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const code = query.get('code');
  const error = query.get('error');

  if (error) {
    sendHtml(res, CALLBACK_HTML('discord', { error: `Discord returned an error: ${error}` }));
    return;
  }

  if (!code) {
    res.writeHead(302, { Location: `${CREDENTIALS.discord.authUrl}?client_id=${CREDENTIALS.discord.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${CREDENTIALS.discord.scope}` });
    res.end();
    return;
  }
  const tokenData = await fetchJsonPost(CREDENTIALS.discord.tokenUrl, {
    client_id: CREDENTIALS.discord.clientId,
    client_secret: CREDENTIALS.discord.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const accessToken = tokenData.access_token;
  if (!accessToken) { sendHtml(res, CALLBACK_HTML('discord', { error: 'No access token' })); return; }
  const profile = await fetchJson(CREDENTIALS.discord.apiUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    : null;
  sendHtml(res, CALLBACK_HTML('discord', {
    id: profile.id,
    username: profile.username,
    displayName: profile.global_name || profile.username,
    email: profile.email,
    avatar: avatarUrl,
  }));
}

async function handleSpotify(req, res, redirectUri) {
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const code = query.get('code');
  const error = query.get('error');

  if (error) {
    sendHtml(res, CALLBACK_HTML('spotify', { error: `Spotify returned an error: ${error}` }));
    return;
  }

  if (!code) {
    res.writeHead(302, { Location: `${CREDENTIALS.spotify.authUrl}?client_id=${CREDENTIALS.spotify.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(CREDENTIALS.spotify.scope)}` });
    res.end();
    return;
  }
  const auth = Buffer.from(`${CREDENTIALS.spotify.clientId}:${CREDENTIALS.spotify.clientSecret}`).toString('base64');
  const tokenData = await fetchJsonPost(CREDENTIALS.spotify.tokenUrl, {
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  }, { 'Authorization': `Basic ${auth}` });
  const accessToken = tokenData.access_token;
  if (!accessToken) { sendHtml(res, CALLBACK_HTML('spotify', { error: 'No access token' })); return; }
  const profile = await fetchJson(CREDENTIALS.spotify.apiUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  sendHtml(res, CALLBACK_HTML('spotify', {
    id: profile.id,
    username: profile.id,
    displayName: profile.display_name || profile.id,
    email: profile.email,
    avatar: profile.images?.[0]?.url || null,
  }));
}

async function handleFacebook(req, res, redirectUri) {
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const code = query.get('code');
  const error = query.get('error');

  if (error) {
    sendHtml(res, CALLBACK_HTML('facebook', { error: `Facebook returned an error: ${error}` }));
    return;
  }

  if (!code) {
    res.writeHead(302, { Location: `${CREDENTIALS.facebook.authUrl}?client_id=${CREDENTIALS.facebook.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${CREDENTIALS.facebook.scope}` });
    res.end();
    return;
  }
  const tokenData = await fetchJson(`${CREDENTIALS.facebook.tokenUrl}?client_id=${CREDENTIALS.facebook.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${CREDENTIALS.facebook.clientSecret}&code=${code}`);
  const accessToken = tokenData.access_token;
  if (!accessToken) { sendHtml(res, CALLBACK_HTML('facebook', { error: 'No access token' })); return; }
  const profile = await fetchJson(`${CREDENTIALS.facebook.apiUrl}&access_token=${accessToken}`);
  sendHtml(res, CALLBACK_HTML('facebook', {
    id: profile.id,
    username: profile.id,
    displayName: profile.name,
    email: profile.email,
    avatar: profile.picture?.data?.url || null,
    link: profile.link || null,
  }));
}


async function handleSteam(req, res, redirectUri) {
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const openidMode = query.get('openid.mode');

  if (openidMode === 'cancel') {
    sendHtml(res, CALLBACK_HTML('steam', { error: 'Login cancelled' }));
    return;
  }

  if (!openidMode) {
    const Realm = redirectUri.replace(/\/callback.*$/, '/');
    const returnTo = redirectUri;
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': Realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });
    res.writeHead(302, { Location: `https://steamcommunity.com/openid/login?${params.toString()}` });
    res.end();
    return;
  }

  const params = {};
  for (const [k, v] of query.entries()) params[k] = v;
  params['openid.mode'] = 'check_authentication';

  const verifyBody = new URLSearchParams(params).toString();
  const mod = await import('node:https');
  const verifyResult = await new Promise((resolve) => {
    const urlObj = new URL('https://steamcommunity.com/openid/login');
    const req = mod.default.request(urlObj, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data.includes('is_valid:true')));
    });
    req.on('error', () => resolve(false));
    req.write(verifyBody);
    req.end();
  });

  if (!verifyResult) {
    sendHtml(res, CALLBACK_HTML('steam', { error: 'Verification failed' }));
    return;
  }

  const claimedId = query.get('openid.claimed_id');
  const steamId = claimedId?.match(/\/(\d+)$/)?.[1];
  if (!steamId) {
    sendHtml(res, CALLBACK_HTML('steam', { error: 'No Steam ID' }));
    return;
  }

  const profileData = await fetchJson(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${CREDENTIALS.steam.apiKey}&steamids=${steamId}`
  );
  const player = profileData?.response?.players?.[0];
  if (!player) {
    sendHtml(res, CALLBACK_HTML('steam', { username: steamId, displayName: steamId }));
    return;
  }
  sendHtml(res, CALLBACK_HTML('steam', {
    id: steamId,
    username: steamId,
    displayName: player.personaname,
    avatar: player.avatarfull || player.avatarmedium || player.avatar,
  }));
}

export async function handleOAuthRequest(req, res) {
  const url = req.url;

  const providers = ['github', 'discord', 'spotify', 'facebook', 'steam'];
  for (const provider of providers) {
    const loginPattern = new RegExp(`^/api/auth/${provider}/login(?:\\?.*)?$`);
    const callbackPattern = new RegExp(`^/api/auth/${provider}/callback(?:\\?.*)?$`);

    if ((loginPattern.test(url) || callbackPattern.test(url)) && req.method === 'GET') {
      const redirectUri = getRedirectUri(req, provider);
      const handler = {
        github: handleGitHub,
        discord: handleDiscord,
        spotify: handleSpotify,
        facebook: handleFacebook,
        steam: handleSteam,
      }[provider];
      try {
        await handler(req, res, redirectUri);
      } catch (err) {
        console.error(`OAuth error [${provider}]:`, err);
        if (!res.headersSent) {
          sendHtml(res, CALLBACK_HTML(provider, { error: err.message || 'OAuth request failed' }));
        }
      }
      return true;
    }
  }
  return false;
}
