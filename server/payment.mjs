/**
 * PipraPay Payment Gateway Integration (Self-hosted, free forever)
 * API Docs: https://docs.piprapay.com/reference/overview
 * Sandbox: https://sandbox.piprapay.com
 *
 * InfinityFree (*.rf.gd, etc.) wraps every request in a JS cookie check
 * (aes.js / __test). Node cannot run that page, so we decrypt the cookie
 * and retry — otherwise create-charge looks like HTTP 200 HTML.
 */
import crypto from 'node:crypto';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** host → { value, expiresAt } for InfinityFree __test cookie */
const testCookieCache = new Map();

function getApiKey() {
  const key = process.env.PIPRAPAY_API_KEY;
  if (!key) throw new Error('PIPRAPAY_API_KEY not set in .env');
  return key;
}

function getBaseUrl() {
  return (process.env.PIPRAPAY_BASE_URL || 'https://sandbox.piprapay.com').replace(/\/$/, '');
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': BROWSER_UA,
    'mh-piprapay-api-key': getApiKey(),
    ...extra,
  };
}

export function isBotWallHtml(text) {
  if (typeof text !== 'string') return false;
  return text.includes('aes.js') && text.includes('toNumbers') && text.includes('__test');
}

export function solveInfinityFreeTestCookie(html) {
  const nums = [...html.matchAll(/toNumbers\("([0-9a-f]+)"\)/gi)].map((m) => m[1]);
  if (nums.length < 3) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      Buffer.from(nums[0], 'hex'),
      Buffer.from(nums[1], 'hex'),
    );
    decipher.setAutoPadding(false);
    return Buffer.concat([
      decipher.update(Buffer.from(nums[2], 'hex')),
      decipher.final(),
    ]).toString('hex');
  } catch {
    return null;
  }
}

function botWallError() {
  return {
    status: false,
    message:
      'Payment host blocked the API (browser cookie check). If this persists, host PipraPay somewhere that allows server APIs, or use https://sandbox.piprapay.com.',
  };
}

function pipraErrorMessage(data, fallback) {
  if (typeof data?.message === 'string' && data.message) return data.message;
  if (typeof data?.error === 'string' && data.error) return data.error;
  if (typeof data?.error?.message === 'string' && data.error.message) return data.error.message;
  return fallback;
}

function parsePipraBody(text, httpStatus) {
  if (isBotWallHtml(text) || (typeof text === 'string' && text.trimStart().startsWith('<') && !text.includes('{'))) {
    return botWallError();
  }
  try {
    return JSON.parse(text);
  } catch {
    return { status: false, message: `Payment host returned a non-JSON response (HTTP ${httpStatus}).` };
  }
}

async function pipraPost(pathname, payload) {
  const url = `${getBaseUrl()}${pathname}`;
  const host = new URL(url).host;
  const cached = testCookieCache.get(host);
  const cachedCookie = cached && cached.expiresAt > Date.now() ? cached.value : '';

  const send = (cookie) =>
    fetch(url, {
      method: 'POST',
      headers: headers(cookie ? { Cookie: `__test=${cookie}` } : {}),
      body: JSON.stringify(payload),
    });

  let res = await send(cachedCookie);
  let text = await res.text();

  if (isBotWallHtml(text)) {
    const solved = solveInfinityFreeTestCookie(text);
    if (solved) {
      testCookieCache.set(host, { value: solved, expiresAt: Date.now() + 5 * 60 * 60 * 1000 });
      res = await send(solved);
      text = await res.text();
    }
  }

  const data = parsePipraBody(text, res.status);
  return { res, data, text };
}

/**
 * Create a charge → returns pp_id + pp_url (checkout page)
 */
export async function createCharge({ fullName, emailMobile, amount, metadata, redirectUrl, cancelUrl, webhookUrl, currency }) {
  console.log('🔗 PipraPay create-charge →', `${getBaseUrl()}/api/create-charge`, 'amount:', amount);
  const { res, data } = await pipraPost('/api/create-charge', {
    full_name: fullName,
    email_mobile: emailMobile,
    amount: String(amount),
    metadata: metadata || {},
    redirect_url: redirectUrl,
    cancel_url: cancelUrl,
    return_type: 'GET',
    webhook_url: webhookUrl || '',
    currency: currency || 'BDT',
  });
  const logSafe = data._raw ? { ...data, _raw: '[omitted]' } : data;
  console.log('📥 PipraPay create-charge response:', res.status, JSON.stringify(logSafe).slice(0, 500));
  if (data.status === false && data.message) {
    return data;
  }
  if (!res.ok) {
    return { status: false, message: pipraErrorMessage(data, `PipraPay returned HTTP ${res.status}`) };
  }
  const isOk = data.status === true || data.status === 'success' || data.success === true;
  return { ...data, status: isOk };
}

/**
 * Verify a payment by pp_id → returns payment status + details
 */
export async function verifyPayment(ppId) {
  const { res, data } = await pipraPost('/api/verify-payments', { pp_id: String(ppId) });
  const logSafe = data._raw ? { ...data, _raw: '[omitted]' } : data;
  console.log('🔍 PipraPay verify response:', res.status, JSON.stringify(logSafe).slice(0, 500));
  if (data.status === 'error' || (data.status === false && data.message)) {
    return data;
  }
  if (!res.ok) {
    return { status: 'error', message: pipraErrorMessage(data, `Verify failed (HTTP ${res.status})`) };
  }
  return data;
}
