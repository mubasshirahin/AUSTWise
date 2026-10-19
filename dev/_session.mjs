// Shared helper for the dev browser probes.
//
// The app boots, calls /api/auth/me and — when it 401s — the server clears the
// auth cookie. That clear can land AFTER a dev switch-user, wiping the fresh
// session. So: land on a static asset first (no app JS), set the cookie
// straight into the browser jar, then open the app.

export async function loginAs(page, base, userId) {
  const res = await fetch(`${base}/api/dev/switch-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`switch-user failed: ${res.status}`);
  const setCookie = res.headers.getSetCookie?.() || [];
  const raw = setCookie.find((c) => c.startsWith('aust_token='));
  if (!raw) throw new Error('no auth cookie returned');
  const value = decodeURIComponent(raw.split(';')[0].slice('aust_token='.length));
  await page.setCookie({ name: 'aust_token', value, url: base });
  return value;
}

/** Land on a static asset so the app never boots before the cookie is set. */
export async function primeOrigin(page, base) {
  await page.goto(`${base}/favicon.png`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
}
