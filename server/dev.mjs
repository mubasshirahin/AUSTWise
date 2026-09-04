import { drainBootLogs, rawConsole as rc } from './bootLog.mjs';
import 'dotenv/config';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { extractRoutineFromImage } from './routineExtractor.mjs';
import { 
  sendDailyNotifications, 
  sendTestNotification,
  registerUserForNotifications,
  sendTestAttendanceMessage,
  handleAttendanceCallback,
  handleStartCommand,
  getTodayClasses,
  setTelegramWebhook,
  getWebhookInfo,
  sendNoticeToAllUsers
} from './telegramNotifier.mjs';
import {
  unregisterUser,
  getUser,
  getAllUsers,
  updateUserRoutine,
  toggleUserStatus,
  getStats,
  isRegistered,
  getUserByAwid,
  unregisterByAwid,
  saveAttendanceRecord,
  saveAttendanceRecordForDate,
  getTodayAttendanceRecord,
  getUserAttendanceRecords,
  getAttendanceSummary
} from './telegramDB.mjs';
import {
  recordCheckIn,
  recordCheckOut,
  getOccupancy
} from './libraryDB.mjs';
import {
  trackUserPresence,
  getLivePulse,
  isInsideGeofence
} from './liveLibraryDB.mjs';
import { initializeDatabase, resetDatabase, query, sql, testConnection } from './db.mjs';
import { handleOAuthRequest } from './socialOAuth.mjs';
import { handleCleanerRequest } from './googleCleaner.mjs';
import { handleAuthRoute, readTokenCookie, handleDevSwitchUser, handleDevSeedUsers, handleDevUsers } from './auth.mjs';
import { requireRole, requireAuth } from './middleware.mjs';
import { rateLimit, extractRoutineRateLimiter } from './rateLimiter.mjs';
import { getUserById, getUserByEmail, getAllUsersSafe, updateUserProfile, deleteUserById, countUsers, ADMIN_ASSIGNABLE_ROLES } from './userStore.mjs';
import {
  listMarketplace,
  addMarketplaceListing,
  deleteMarketplaceListing,
  saveMessage,
  getConversations,
  getThread,
  deleteMessageById,
  editMessageById,
  addReaction,
  getSemesterResults,
  saveSemesterResult,
  listNotices,
  createNotice,
  deleteNotice,
  listCanteenMenu,
  upsertCanteenItem,
  deleteCanteenItem,
  listClubs,
  joinClub,
  leaveClub,
  listCheatsheets,
  createCheatsheet,
  deleteCheatsheet,
  listCampusLocations,
  upsertCampusLocation,
  deleteCampusLocation,
  listCourses,
  upsertCourse,
  deleteCourse,
  listSharedRoutines,
  upsertSharedRoutine,
  deleteSharedRoutineBySlot,
  getSharedRoutineStats,
  listRoomBookings,
  computeRoomAvailabilityServer,
  serverRoomCatalog,
  listQuestionPapers,
  getQuestionPaperById,
  addQuestionPaper,
  deleteQuestionPaperById,
} from './prisma.js';
import {
  ensureUploadsDir,
  saveNote,
  listNotes,
  getNoteById,
  deleteNoteById,
  ALLOWED_TYPES as NOTE_ALLOWED_TYPES,
  MAX_SIZE_BYTES as NOTE_MAX_SIZE,
  UPLOADS_DIR,
  verifyMimeType,
} from './vaultNotesDB.mjs';
import {
  listRoleApplications,
  getRoleApplicationsByUser,
  createRoleApplication,
  updateRoleApplication,
} from './roleAppDB.mjs';
import {
  saveCredential,
  updateCredential,
  listCredentials,
  deleteCredential,
  revealPassword,
} from './passwordVaultDB.mjs';
import { createCharge, verifyPayment } from './payment.mjs';
import { createWSServer, closeWSServer, broadcastToAll, broadcastToUsers, broadcastToUser, getPresenceMap } from './wsServer.mjs';
import {
  getUserStoreValue, setUserStoreValue, deleteUserStoreValue, listUserStoreKeys,
  getSharedStoreValue, setSharedStoreValue, deleteSharedStoreValue,
  isUserStoreDeleted, isSharedStoreDeleted,
} from './storeDB.mjs';

// ── SSE: member-count live stream ─────────────────────────────────────────
const memberCountSSEClients = new Set();
let memberCountSSETimer = null;
let lastBroadcastedCount = -1;

/** Push current member count to every connected SSE client. */
async function broadcastMemberCount() {
  const count = await countUsers();
  if (count === lastBroadcastedCount) return;
  lastBroadcastedCount = count;
  const data = `data: ${JSON.stringify({ count })}\n\n`;
  for (const res of memberCountSSEClients) {
    try { res.write(data); } catch { memberCountSSEClients.delete(res); }
  }
}

/** Start the SSE sweep (idempotent). Checks every 5 s; push only on change. */
function ensureMemberCountSweep() {
  if (memberCountSSETimer) return;
  memberCountSSETimer = setInterval(broadcastMemberCount, 5_000);
  memberCountSSETimer.unref?.();
}

// Helper function to answer callback query
async function answerCallbackQueryFn(botToken, callbackQueryId, text) {
  const https = await import('node:https');
  const postData = JSON.stringify({
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: false
  });
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/answerCallbackQuery`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.default.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ success: result.ok });
        } catch {
          resolve({ success: false });
        }
      });
    });
    
    req.on('error', () => resolve({ success: false }));
    req.write(postData);
    req.end();
  });
}

// Helper function to update message keyboard (remove buttons)
async function updateMessageKeyboardFn(botToken, chatId, messageId, _clickedCallbackData, _isAttended, _courseCode) {
  const https = await import('node:https');
  const postData = JSON.stringify({
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] }
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/editMessageReplyMarkup`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.default.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ success: result.ok });
        } catch {
          resolve({ success: false });
        }
      });
    });
    
    req.on('error', () => resolve({ success: false }));
    req.write(postData);
    req.end();
  });
}

const port = Number(process.env.PORT || 5174);
const maxBodyBytes = 15 * 1024 * 1024;

// Global flood guard — every request counts toward one per-IP window, so a
// scanner can't pin the server or blow its connection pool. Auth/extract keep
// their own stricter limits. Tune via RATE_LIMIT_GLOBAL_MAX.
const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 600,
});
// Per-user throttle for notice posts (30s)
const noticePostLastByUser = new Map(); // userId -> timestamp
const useViteMiddleware = process.argv.includes('--vite');

// Dev mode = running with the Vite dev server (HMR) or an explicit
// NODE_ENV=development. Production mode = serving the built dist/ without
// Vite. Pin NODE_ENV=production in production mode so the dev-only auth
// endpoints (/api/dev/*, /__dev/users) and any NODE_ENV-gated behaviour are
// hard-disabled even if the deployer forgets to set the variable.
const isDevMode = useViteMiddleware || process.env.NODE_ENV === 'development';
if (!isDevMode) process.env.NODE_ENV = 'production';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;

    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        reject(new Error('Image payload is too large. Please upload a smaller/compressed image.'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

function safeJsonParse(str, fallback) {
  try { const v = JSON.parse(str); return v; }
  catch { return fallback; }
}

// CORS: same-origin by default (SPA is served by this server). If the app is
// ever hosted on a different origin (e.g. CDN), whitelist it here via
// ALLOWED_ORIGIN. A wildcard is never granted — same-origin requests need no
// CORS headers, and anything else must be explicitly allowlisted.
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const isOriginAllowed = (origin) => origin && ALLOWED_ORIGIN.includes(origin);

/** Apply CORS headers if the request origin is whitelisted, else same-origin. */
function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mh-piprapay-api-key');
    // Allow the browser to send auth cookies cross-origin (Vercel FE → Render BE).
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

/** True when the request is same-origin, allowlisted, or a dev-localhost origin. */
function isSameSiteRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients carry no Origin
  if (isOriginAllowed(origin)) return true;
  // Sec-Fetch-Site is set by the browser and cannot be forged by web content.
  // Behind the Vercel → Railway proxy the browser sees the API as same-origin
  // with the frontend, so accept same-origin/same-site/none here while the
  // Origin checks below still reject genuinely cross-site requests.
  const secFetchSite = (req.headers['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') return true;
  try {
    const o = new URL(origin);
    // Same-origin (SPA and API behind the same host, e.g. local dev).
    if (req.headers.host && o.host === req.headers.host) return true;
    // Vercel → Railway proxy: the backend sees the Railway host in
    // req.headers.host, but the browser's real host may arrive via
    // x-forwarded-host (any hop in the chain) and/or the PUBLIC_BASE_URL
    // config. A matching origin is same-site; foreign origins still fail, so
    // the CSRF defense holds.
    const originHost = o.host.toLowerCase();
    const forwardedHosts = (req.headers['x-forwarded-host'] || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (forwardedHosts.includes(originHost)) return true;
    if (process.env.PUBLIC_BASE_URL) {
      try {
        if (originHost === new URL(process.env.PUBLIC_BASE_URL).host.toLowerCase()) return true;
      } catch { /* invalid PUBLIC_BASE_URL — ignore */ }
    }
  } catch { /* fall through */ }
  if (isDevMode && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

// Per-account settings synced across devices (notification prefs, Telegram
// chat id, library tracking). Stored on the user record — same pattern as the
// privacy toggles — so a change made on one device shows up on all of them.
const DEFAULT_USER_SETTINGS = {
  notifications: {
    enabled: false,
    classReminderMins: 10,
    deadlineReminderHours: 24,
    notifyClass: true,
    notifyDeadline: true,
    notifyNotices: false,
  },
  telegram: { chatId: '', enabled: false },
  libraryTracking: false,
};

function normalizeUserSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const notif = { ...DEFAULT_USER_SETTINGS.notifications, ...(s.notifications || {}) };
  const mins = Number(notif.classReminderMins);
  const hours = Number(notif.deadlineReminderHours);
  notif.classReminderMins = Number.isFinite(mins) ? Math.min(30, Math.max(5, mins)) : 10;
  notif.deadlineReminderHours = Number.isFinite(hours) ? Math.min(48, Math.max(6, hours)) : 24;
  notif.enabled = notif.enabled === true;
  notif.notifyClass = notif.notifyClass !== false;
  notif.notifyDeadline = notif.notifyDeadline !== false;
  notif.notifyNotices = notif.notifyNotices === true;
  const telegram = { ...DEFAULT_USER_SETTINGS.telegram, ...(s.telegram || {}) };
  telegram.chatId = typeof telegram.chatId === 'string' ? telegram.chatId.trim().slice(0, 64) : '';
  telegram.enabled = telegram.enabled === true;
  return {
    notifications: notif,
    telegram,
    libraryTracking: s.libraryTracking === true,
  };
}

/** Minimal, safe security headers. CSP/HSTS are opt-in via env so we don't
 *  break the inline-styles + external-embed heavy SPA by default. */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  if (process.env.ENABLE_CSP === '1') {
    res.setHeader('Content-Security-Policy', process.env.CSP_HEADER || "default-src 'self'");
  }
  if (process.env.ENABLE_HSTS === '1' || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function sendStaticFile(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    sendJson(res, 400, { error: 'Invalid request path.' });
    return;
  }
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidatePath = path.resolve(distDir, relativePath);
  const filePath = candidatePath.startsWith(distDir) ? candidatePath : path.join(distDir, 'index.html');

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    // index.html, sw.js, registerSW.js and manifest.webmanifest must NEVER be
    // cached immutable — the browser has to re-fetch them so the service
    // worker detects updates and refreshes its precache. If sw.js is pinned
    // for a year, a stale worker keeps serving an old index.html whose hashed
    // chunks no longer exist, producing exactly these 404s.
    const noCache = ext === '.html' || fileName === 'sw.js' || fileName === 'registerSW.js' || fileName === 'manifest.webmanifest';
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  } catch {
    // Real file requests (e.g. a stale hashed asset left over from an older
    // build) must get a 404, NOT the SPA fallback. Falling back to index.html
    // here made the server answer <script type="module"> requests with a
    // "text/html" MIME type, which browsers refuse with "Failed to load module
    // script".
    if (path.extname(pathname).toLowerCase()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    // Client-side routes get the SPA fallback.
    try {
      const data = await readFile(path.join(distDir, 'index.html'));
      res.writeHead(200, {
        'Content-Type': contentTypes['.html'],
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      sendJson(res, 500, { error: 'Build output missing. Run npm run build first.' });
    }
  }
}

// CORS preflight handler — headers already applied by applyCorsHeaders
function handleCorsPreflight(req, res) {
  res.writeHead(204);
  res.end();
}

// Create HTTP server early so Vite can attach HMR to it
const server = http.createServer();
server.maxConnections = 200;
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;

const vite = useViteMiddleware
  ? await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    })
  : null;

// ── Feature availability flags (checked at startup) ──
const FEATURES = {
  openai:   !!process.env.OPENAI_API_KEY,
  telegram: !!process.env.TELEGRAM_BOT_TOKEN,
  gemini:   !!process.env.GEMINI_API_KEY,
  googleApi: !!process.env.VITE_GOOGLE_API_KEY,
  db:       false,   // set to true after successful SQL Server connection
  dbConfig: false,   // set to true if DB_* vars are all present
};

// Check DB credential env vars. A single DATABASE_URL (Railway Postgres)
// is enough; otherwise all four DB_* split vars must be present.
const dbVarMap = { DB_SERVER: 'Server', DB_DATABASE: 'Database', DB_USER: 'User', DB_PASSWORD: 'Password' };
const missingDbVars = Object.entries(dbVarMap).filter(([k]) => !process.env[k]).map(([, label]) => label);
FEATURES.dbConfig = !!process.env.DATABASE_URL || missingDbVars.length === 0;

// Guard helpers — return true if the feature is available, otherwise send 503
function requireFeature(feature, res, label) {
  if (!FEATURES[feature]) {
    sendJson(res, 503, { error: `Service unavailable: ${label || feature} is not configured.` });
    return false;
  }
  return true;
}

// Create the Prisma-managed tables (User, Routine, MarketplaceListing, …) at
// boot. Runs the create-only, idempotent DDL in prismaTables.sql — the same
// shape `prisma db push` would produce, but it never drops tables that aren't
// in the Prisma schema (AuthUsers, TelegramUsers, PasswordVault, … are managed
// by raw-SQL modules and must survive).
async function ensurePrismaPush() {
  if (!process.env.DATABASE_URL && !process.env.DB_SERVER) return;
  try {
    const sqlFile = await readFile(path.resolve(__dirname, 'prismaTables.sql'), 'utf8');
    await query(sqlFile);
    console.log('✅ Prisma tables ready');
  } catch (err) {
    console.warn('⚠️  prisma tables bootstrap failed:', err.message);
  }
}

// Auto-create database & tables on startup.
// The promise is awaited inside the listen callback so the boot logs settle
// (and are drained) before the endpoint directory + env checkup print.
let dbConnected = false;
const dbInit = FEATURES.dbConfig
  ? initializeDatabase()
      .then(() => {
        FEATURES.db = true;
        dbConnected = true;
        console.log('✅ PostgreSQL connected & tables ready');
        return ensurePrismaPush();
      })
      .catch((err) => {
        console.warn('⚠️  PostgreSQL init failed:', err.message);
        console.warn('ℹ️  Using local JSON file-based database fallback.');
        FEATURES.db = true;
      })
  : Promise.resolve(false);

// Redirect HTTP → HTTPS in production behind a proxy that terminates TLS.
// Relies on the standard `x-forwarded-proto` header set by the load balancer
// (Heroku, Fly, Cloudflare, nginx, etc). No-op when the header is absent or
// when not in production so dev/localhost flow is unaffected.
//
// x-forwarded-proto may arrive comma-joined across multi-hop proxies
// (e.g. "https,https" from Vercel → Railway). We only inspect the first hop.
function requireHttps(req, res) {
  if (process.env.NODE_ENV !== 'production') return false;
  const proto = (req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  if (proto === 'https') return false;
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
  return true;
}

server.on('request', async (req, res) => {
  try {
    // HTTP→HTTPS redirect in production
    if (requireHttps(req, res)) return;

    // Security headers on every response, then CORS if origin is whitelisted
    applySecurityHeaders(res);
    applyCorsHeaders(req, res);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      handleCorsPreflight(req, res);
      return;
    }

    // CSRF defense: browsers always send an Origin header on cross-site
    // state-changing requests. Reject any POST/PUT/PATCH/DELETE whose origin
    // isn't same-site or explicitly allowlisted (the SameSite=Strict cookie
    // blocks the request anyway; this is belt-and-suspenders).
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (!isSameSiteRequest(req)) {
        sendJson(res, 403, { success: false, error: 'Cross-origin request rejected.' });
        return;
      }
    }

    // Dev-only API auth routes — hard-disabled in production mode so they
    // can never impersonate accounts, seed data, or leak the user list.
    if (!isDevMode) {
      if (req.url === '/__dev/users' || req.url.startsWith('/api/dev/')) {
        sendJson(res, 404, { success: false, error: 'Not found.' });
        return;
      }
    } else {
      if (req.url === '/api/dev/switch-user' && req.method === 'POST') return handleDevSwitchUser(req, res);
      if (req.url === '/api/dev/seed-users' && req.method === 'POST') return handleDevSeedUsers(req, res);
      if (req.url === '/__dev/users' && req.method === 'GET') return handleDevUsers(req, res);
    }

    // Global flood guard — non-static requests count against this window.
    if (globalRateLimiter(req, res)) {
      await handleApiRequest(req, res);
    }
  } catch {
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error.' });
    } else {
      res.end();
    }
  }
});

// API + non-static request dispatch (run inside the global rate limiter).
async function handleApiRequest(req, res) {
  // ── Public stats endpoints (no auth required) ───────────────────────
  // GET /api/stats/count — lightweight member count (no user data)
  if (req.url === '/api/stats/count' && req.method === 'GET') {
    try {
      const count = await countUsers();
      lastBroadcastedCount = count; // keep SSE in sync
      sendJson(res, 200, { success: true, count });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to get count.' });
    }
    return;
  }

  // GET /api/stats/count/stream — Server-Sent Events for real-time member count
  if (req.url === '/api/stats/count/stream' && req.method === 'GET') {
    ensureMemberCountSweep();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('\n');
    memberCountSSEClients.add(res);
    // Send initial count immediately
    try {
      const count = await countUsers();
      lastBroadcastedCount = count;
      res.write(`data: ${JSON.stringify({ count })}\n\n`);
    } catch { /* ignore */ }
    // Send keep-alive every 30s so proxies don't close the connection
    const ka = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch {} }, 30_000);
    ka.unref?.();
    req.on('close', () => {
      clearInterval(ka);
      memberCountSSEClients.delete(res);
    });
    return;
  }

  // Extract routine from image (authenticated + rate-limited — OpenAI-backed)
  if (req.url === '/api/extract-routine' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!extractRoutineRateLimiter(req, res)) return;
    if (!requireFeature('openai', res, 'OPENAI_API_KEY')) return;
    try {
      const { imageDataUrl } = await readJsonBody(req);
      const result = await extractRoutineFromImage(imageDataUrl);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.statusCode || 500, {
        error: error.message || 'Routine extraction failed.',
      });
    }
    return;
  }

  // ========== Telegram API Endpoints ==========

  // Test Telegram notification (authenticated)
  if (req.url === '/api/telegram/test' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { routine, chatId } = await readJsonBody(req);
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }
      
      const result = await sendTestNotification(chatId, routine);
      sendJson(res, result.success ? 200 : 500, result);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message || 'Telegram notification failed.',
      });
    }
    return;
  }

  // Register the signed-in user's own Telegram Chat ID. Each Chat ID binds to
  // exactly one account (awid): registering a Chat ID already owned by another
  // account is rejected, and switching to a new Chat ID releases the old one.
  if (req.url === '/api/telegram/register' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { chatId, routine } = await readJsonBody(req);

      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }

      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, {
          success: false,
          error: 'User not found.'
        });
        return;
      }
      const awid = user.awid;

      // One Chat ID ↔ one account: reject if someone else already owns it.
      const existing = await getUser(chatId);
      const existingAwid = existing ? (existing.awid ?? existing.Awid) : null;
      if (existingAwid && String(existingAwid) !== String(awid)) {
        sendJson(res, 409, {
          success: false,
          error: 'This Chat ID is already linked to another account. Each Telegram Chat ID can only be connected to one user.'
        });
        return;
      }

      // Switching Chat IDs: release the previous one so it becomes reusable.
      const previous = await getUserByAwid(awid);
      const previousChatId = previous ? (previous.chatId ?? previous.ChatId) : null;
      if (previousChatId && String(previousChatId) !== String(chatId)) {
        await unregisterByAwid(awid);
      }

      const result = await registerUserForNotifications(chatId, routine, awid);

      if (result.success) {
        // Persist the Chat ID on the account so /api/user/settings reflects it
        // on every device.
        const current = normalizeUserSettings(user.settings);
        const next = { ...current, telegram: { ...current.telegram, chatId: String(chatId), enabled: true } };
        await updateUserProfile(auth.id, { settings: next });
        sendJson(res, 201, result);
      } else {
        sendJson(res, 400, result);
      }
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Registration failed.',
      });
    }
    return;
  }

  // Unregister the signed-in user from Telegram notifications. Only the owner
  // of the Chat ID (or an admin/moderator) may unregister it.
  if (req.url === '/api/telegram/unregister' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { chatId } = await readJsonBody(req);

      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }

      const user = await getUserById(auth.id);
      const awid = user?.awid;
      const existing = await getUser(chatId);
      const existingAwid = existing ? (existing.awid ?? existing.Awid) : null;
      const isOwner = existing && awid && existingAwid && String(existingAwid) === String(awid);
      const isManager = ['admin', 'moderator'].includes(auth.role);
      if (!isOwner && !isManager) {
        sendJson(res, 403, {
          success: false,
          error: 'You can only unregister your own Chat ID.'
        });
        return;
      }

      const removed = await unregisterUser(chatId);

      if (removed) {
        if (user && isOwner) {
          const current = normalizeUserSettings(user.settings);
          if (String(current.telegram.chatId) === String(chatId)) {
            const next = { ...current, telegram: { ...current.telegram, chatId: '', enabled: false } };
            await updateUserProfile(auth.id, { settings: next });
          }
        }
        sendJson(res, 200, {
          success: true,
          message: 'User unregistered successfully.'
        });
      } else {
        sendJson(res, 404, {
          success: false,
          error: 'User not found.'
        });
      }
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Unregistration failed.',
      });
    }
    return;
  }

  // Get user registration status
  if (req.url.startsWith('/api/telegram/status') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const chatId = url.searchParams.get('chatId');
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }

      const registered = await isRegistered(chatId);
      const user = await getUser(chatId);
      
      sendJson(res, 200, {
        success: true,
        registered,
        user: user ? {
          chatId: user.chatId,
          enabled: user.enabled,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        } : null
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get status.',
      });
    }
    return;
  }

  // Update user's routine
  if (req.url === '/api/telegram/routine' && req.method === 'PUT') {
    try {
      const { chatId, routine } = await readJsonBody(req);
      
      if (!chatId || !routine) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID and routine are required.'
        });
        return;
      }

      const user = await updateUserRoutine(chatId, routine);
      
      if (user) {
        sendJson(res, 200, {
          success: true,
          user
        });
      } else {
        sendJson(res, 404, {
          success: false,
          error: 'User not found.'
        });
      }
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to update routine.',
      });
    }
    return;
  }

  // Toggle user notification status (admin only)
  if (req.url === '/api/telegram/toggle' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const { chatId } = await readJsonBody(req);
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }

      const user = await toggleUserStatus(chatId);
      
      if (user) {
        sendJson(res, 200, {
          success: true,
          user
        });
      } else {
        sendJson(res, 404, {
          success: false,
          error: 'User not found.'
        });
      }
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to toggle status.',
      });
    }
    return;
  }

  // Get all registered users (admin endpoint)
  if (req.url === '/api/telegram/users' && req.method === 'GET') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const users = await getAllUsers();
      const stats = await getStats();
      
      // Remove sensitive data from response
      const sanitizedUsers = users.map(u => ({
        chatId: u.chatId,
        enabled: u.enabled,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      }));
      
      sendJson(res, 200, {
        success: true,
        stats,
        users: sanitizedUsers
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get users.',
      });
    }
    return;
  }

  // Admin: assign/change a user's role (used by CR/SR application approval
  // so the role persists server-side and the user's powers activate).
  if (req.url === '/api/admin/users/role' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { userId, role } = body || {};
      if (!userId || !role) {
        sendJson(res, 400, { success: false, error: 'userId and role are required.' });
        return;
      }
      const allowedRoles = ADMIN_ASSIGNABLE_ROLES;
      if (!allowedRoles.includes(role)) {
        sendJson(res, 400, { success: false, error: 'Invalid role.' });
        return;
      }
      const updated = await updateUserProfile(userId, { role }, { allowRole: true });
      if (!updated) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      broadcastToAll({ type: 'profile-update', payload: { userId, fields: ['role'] } });
      sendJson(res, 200, { success: true, user: updated });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to update role.' });
    }
    return;
  }

  // List all users for the admin panel (admin endpoint)
  if (req.url === '/api/admin/users' && req.method === 'GET') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const users = await getAllUsersSafe();
      sendJson(res, 200, { success: true, users });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to load users.' });
    }
    return;
  }

  // Update a user's profile from the admin panel (admin endpoint)
  if (req.url === '/api/admin/users/update' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { userId } = body || {};
      if (!userId) {
        sendJson(res, 400, { success: false, error: 'userId is required.' });
        return;
      }
      const existing = await getUserById(userId);
      if (!existing) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      if (existing.role === 'admin' && body.role && body.role !== 'admin') {
        sendJson(res, 400, { success: false, error: 'Cannot change the role of an admin account.' });
        return;
      }
      // Whitelist the fields an admin may edit.
      const allowed = ['name', 'email', 'role', 'department', 'batch', 'batchNo', 'batchName',
        'designation', 'company', 'graduationYear', 'yearSemester', 'section', 'labSection',
        'semester', 'cgpa', 'avatar', 'bloodGroup', 'facebook', 'whatsapp'];
      const patch = {};
      for (const key of allowed) {
        if (key in body) patch[key] = body[key];
      }
      if (patch.email && patch.email !== existing.email) {
        const clash = await getUserByEmail(patch.email);
        if (clash && clash.id !== userId) {
          sendJson(res, 400, { success: false, error: 'Another account already uses that email.' });
          return;
        }
      }
      const updated = await updateUserProfile(userId, patch, { allowRole: true });
      broadcastToAll({ type: 'profile-update', payload: { userId, fields: Object.keys(patch) } });
      sendJson(res, 200, { success: true, user: updated });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to update user.' });
    }
    return;
  }

  // Delete a user from the admin panel (admin endpoint)
  if (req.url === '/api/admin/users/delete' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { userId } = body || {};
      if (!userId) {
        sendJson(res, 400, { success: false, error: 'userId is required.' });
        return;
      }
      const existing = await getUserById(userId);
      if (!existing) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      if (existing.role === 'admin') {
        sendJson(res, 400, { success: false, error: 'Cannot delete an admin account.' });
        return;
      }
      const deleted = await deleteUserById(userId);
      sendJson(res, 200, { success: deleted });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to delete user.' });
    }
    return;
  }

  // Semester-view task tracker (admin) — reads every CR's `aust-week-tasks` so
  // the admin can verify the CR → students visibility flow for every section
  // and semester. Tasks are stored per-user, so this surfaces which CRs added
  // tasks and how many students sit under each of them.
  if (req.url === '/api/admin/semester-tasks' && req.method === 'GET') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const users = await getAllUsersSafe();
      const crs = users.filter((u) => u.role === 'cr');
      const rows = [];
      for (const cr of crs) {
        const stored = await getUserStoreValue(cr.id, 'aust-week-tasks', null);
        const tasks = Array.isArray(stored) ? stored : [];
        rows.push({
          id: cr.id,
          name: cr.name,
          department: cr.department,
          yearSemester: cr.yearSemester,
          section: cr.section,
          labSection: cr.labSection,
          taskCount: tasks.length,
          tasks,
        });
      }
      sendJson(res, 200, { success: true, rows });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to load semester tasks.' });
    }
    return;
  }

  // Send notifications to all users (admin endpoint - for testing)
  if (req.url === '/api/telegram/broadcast' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const result = await sendDailyNotifications();
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Broadcast failed.',
      });
    }
    return;
  }

  // Broadcast a notice to all Telegram users (CR / SR / admin / moderator)
  if (req.url === '/api/telegram/send-notice' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    const auth = requireRole('cr', 'sr', 'admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      if (!payload || !payload.title) {
        sendJson(res, 400, {
          success: false,
          error: 'Notice title is required.'
        });
        return;
      }
      // Derive name + scope server-side from authenticated user to prevent spoofing.
      let serverUser = null;
      try { serverUser = await getUserById(auth.id); } catch {}
      const safeName = serverUser?.name || payload.postedByName || '';
      let scope = null;
      if (serverUser && auth.role === 'cr' && serverUser.labSection) scope = { department: serverUser.department, semester: String(serverUser.semester), labSection: serverUser.labSection };
      else if (serverUser && auth.role === 'sr' && serverUser.section) scope = { department: serverUser.department, semester: String(serverUser.semester), section: serverUser.section };
      const result = await sendNoticeToAllUsers({
        title: payload.title,
        content: payload.content,
        pinned: !!payload.pinned,
        postedByName: safeName,
        postedByRole: auth.role,
        scope,
      });
      broadcastToAll({ type: 'notice-new', payload: { title: payload.title, content: payload.content, postedByName: safeName, postedByRole: auth.role, scope } });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to send notice.',
      });
    }
    return;
  }

  // Test 9 PM Attendance notification (authenticated)
  if (req.url === '/api/telegram/test-attendance' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { routine, chatId } = await readJsonBody(req);
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }
      
      const result = await sendTestAttendanceMessage(chatId, routine);
      sendJson(res, result.success ? 200 : 500, result);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message || 'Telegram attendance notification failed.',
      });
    }
    return;
  }

  // Handle attendance callback from Telegram bot (webhook) — authenticated so
  // third parties can't forge attendance records.
  if (req.url === '/api/telegram/attendance-callback' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { callbackQueryId, chatId, callbackData, messageId } = await readJsonBody(req);
      
      if (!callbackQueryId || !chatId || !callbackData) {
        sendJson(res, 400, {
          success: false,
          error: 'Callback query ID, Chat ID, and callback data are required.'
        });
        return;
      }
      
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const result = await handleAttendanceCallback(botToken, callbackQueryId, chatId, callbackData, messageId);
      sendJson(res, result.success ? 200 : 500, result);
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to handle attendance callback.',
      });
    }
    return;
  }

  // ========== Telegram Webhook Handler ==========
  // This endpoint receives updates directly from Telegram servers
  // including callback queries when users click inline buttons
  if (req.url === '/api/telegram/webhook' && req.method === 'POST') {
    try {
      // Verify the webhook secret token so only Telegram's servers can post
      // updates here. In production the secret MUST be configured; without it
      // the webhook refuses to process anything (forged-attendance defense).
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (!webhookSecret) {
        if (!isDevMode) {
          sendJson(res, 503, { ok: false, description: 'TELEGRAM_WEBHOOK_SECRET not configured.' });
          return;
        }
        console.warn('⚠️  TELEGRAM_WEBHOOK_SECRET not set — accepting webhook updates without verification (dev only).');
      } else {
        const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (receivedSecret !== webhookSecret) {
          sendJson(res, 403, { ok: false, description: 'Invalid webhook secret.' });
          return;
        }
      }

      const update = await readJsonBody(req);
      // Redact PII before logging — never log full Telegram updates (phone,
      // messages, text) to stdout. Only log structural signal.
      console.log('📩 Telegram Webhook Update:', JSON.stringify({
        has_callback_query: !!update.callback_query,
        has_message: !!update.message,
        has_inline_query: !!update.inline_query,
        update_id: update.update_id,
      }));
      
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        sendJson(res, 200, { ok: true }); // Still return ok to Telegram
        return;
      }

      // Handle callback query (inline button clicks)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message?.chat?.id;
        const messageId = callbackQuery.message?.message_id;
        const callbackData = callbackQuery.data;
        const callbackQueryId = callbackQuery.id;

        console.log(`🔘 Callback received: ${callbackData} from chat ${chatId}`);

        if (callbackData && callbackData.startsWith('attend_')) {
          // Parse callback data: attend_yes_0_CSE101 or attend_no_0_CSE101
          const parts = callbackData.split('_');
          if (parts.length >= 4) {
            const isAttended = parts[1] === 'yes';
            const courseCode = parts.slice(3).join('_');

            // Save attendance record
            const user = await getUser(chatId);
            if (user) {
              await saveAttendanceRecord(chatId, courseCode, isAttended);
              console.log(`✅ Attendance saved for user ${chatId}: ${courseCode} = ${isAttended ? 'Present' : 'Absent'}`);
            }

            // Answer the callback query with confirmation
            const answerText = isAttended 
              ? `✅ ${courseCode.replace(/_/g, ' ')} - Present marked!` 
              : `❌ ${courseCode.replace(/_/g, ' ')} - Absent marked!`;
            
            await answerCallbackQueryFn(botToken, callbackQueryId, answerText);

            // Update the message to remove the clicked button
            if (messageId && chatId) {
              await updateMessageKeyboardFn(botToken, chatId, messageId, callbackData, isAttended, courseCode);
            }
          }
        }
      }

      // Handle /start command — welcome message
      if (update.message?.text === '/start') {
        const chatId = update.message?.chat?.id;
        if (chatId) {
          const result = await handleStartCommand(chatId);
          console.log(`👋 /start handled for chat ${chatId}:`, result.success ? 'welcome sent' : result.error);
        }
      }

      // Always return ok to Telegram
      sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error('❌ Webhook error:', error.message);
      sendJson(res, 200, { ok: true }); // Still return ok to Telegram to avoid retries
    }
    return;
  }

  // Set Telegram webhook (admin only)
  if (req.url === '/api/telegram/set-webhook' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const { webhookUrl } = await readJsonBody(req);
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        sendJson(res, 400, {
          success: false,
          error: 'TELEGRAM_BOT_TOKEN not configured in environment variables.'
        });
        return;
      }
      
      if (!webhookUrl) {
        // Auto-detect webhook URL from request
        const host = req.headers.host || 'localhost:5174';
        const protocol = 'https';
        const autoUrl = `${protocol}://${host}/api/telegram/webhook`;
        
        sendJson(res, 200, {
          success: true,
          message: 'Webhook URL required.',
          suggestedUrl: autoUrl,
          instructions: 'For production, set up your webhook at: https://your-domain.com/api/telegram/webhook'
        });
        return;
      }

      const result = await setTelegramWebhook(botToken, webhookUrl);
      sendJson(res, result.ok ? 200 : 500, result);
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to set webhook.',
      });
    }
    return;
  }

  // Get webhook info
  if (req.url.startsWith('/api/telegram/webhook-info') && req.method === 'GET') {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        sendJson(res, 200, {
          ok: false,
          description: 'TELEGRAM_BOT_TOKEN not configured'
        });
        return;
      }

      const result = await getWebhookInfo(botToken);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get webhook info.',
      });
    }
    return;
  }

  // Get attendance records for a user
  if (req.url.startsWith('/api/telegram/attendance') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const chatId = url.searchParams.get('chatId');
      const courseCode = url.searchParams.get('course');
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }
      
      if (courseCode) {
        // Get summary for specific course
        const summary = await getAttendanceSummary(chatId, courseCode);
        const todayRecord = await getTodayAttendanceRecord(chatId, courseCode);
        sendJson(res, 200, {
          success: true,
          summary,
          today: todayRecord
        });
      } else {
        // Get all attendance records
        const records = await getUserAttendanceRecords(chatId);
        sendJson(res, 200, {
          success: true,
          records
        });
      }
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get attendance records.',
      });
    }
    return;
  }

  // Manually record attendance (from web interface)
  if (req.url === '/api/telegram/attendance' && req.method === 'POST') {
    try {
      const { chatId, courseCode, attended } = await readJsonBody(req);
      
      if (!chatId || !courseCode) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID and course code are required.'
        });
        return;
      }
      
      const record = await saveAttendanceRecord(chatId, courseCode, attended === true);
      
      if (record) {
        sendJson(res, 200, {
          success: true,
          record
        });
      } else {
        sendJson(res, 404, {
          success: false,
          error: 'User not found.'
        });
      }
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to record attendance.',
      });
    }
    return;
  }

  // ========== Attendance Sync Endpoint (Telegram Bot Webhook) ==========
  // Called by the Telegram Bot when a student marks Present/Absent.
  // Payload: { studentId, courseId, date, status }
  //   studentId -> Telegram Chat ID
  //   courseId  -> Course code (e.g. 'CSE101')
  //   date      -> YYYY-MM-DD string
  //   status    -> 'Present' | 'Absent'
  if (req.url === '/api/attendance/telegram-sync' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { studentId, courseId, date, status } = await readJsonBody(req);

      if (!studentId || !courseId || !date || !status) {
        sendJson(res, 400, {
          success: false,
          error: 'studentId, courseId, date, and status are required.'
        });
        return;
      }

      const attended = status.toLowerCase() === 'present';

      // Save to database with the specific date from Telegram payload
      // Uses saveAttendanceRecordForDate to support backdated entries
      const record = await saveAttendanceRecordForDate(studentId, courseId, attended, date);

      if (record) {
        // Broadcast real-time update to all connected WebSocket clients
        broadcastToAll({
          type: 'attendance-sync',
          payload: {
            studentId,
            courseId,
            date,
            attended,
            timestamp: new Date().toISOString(),
          }
        });

        console.log(`📡 Attendance synced: ${courseId} for student ${studentId} = ${attended ? 'Present' : 'Absent'} on ${date}`);

        sendJson(res, 200, {
          success: true,
          record: {
            chatId: studentId,
            course: courseId,
            attended,
            recordDate: date,
          }
        });
      } else {
        sendJson(res, 404, {
          success: false,
          error: 'Failed to save attendance record — user not found or DB error.'
        });
      }
    } catch (error) {
      console.error('❌ Attendance sync error:', error.message);
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Attendance sync failed.'
      });
    }
    return;
  }

  // Get today's classes for a user
  if (req.url.startsWith('/api/telegram/today-classes') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const routine = JSON.parse(url.searchParams.get('routine') || '{}');
      
      const classes = getTodayClasses(routine);
      sendJson(res, 200, {
        success: true,
        classes
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get today\'s classes.',
      });
    }
    return;
  }

  // ========== Library Occupancy Endpoints ==========

  // Check in (or heartbeat refresh) with the device's GPS position.
  // The server verifies the position is inside the library geofence.
  // Authentication required — deviceId is bound to the logged-in user.
  if (req.url === '/api/library/checkin' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { deviceId, lat, lng } = await readJsonBody(req);
      const device = deviceId || auth.id;
      const result = await recordCheckIn(device, Number(lat), Number(lng));
      broadcastToAll({ type: 'library-occupancy', payload: { action: 'checkin', userId: auth.id } });
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      sendJson(res, 400, {
        success: false,
        error: error.message || 'Check-in failed.',
      });
    }
    return;
  }

  // Explicit check out (user left the library or tapped "check out").
  // Authentication required — a user may only check out their own session.
  if (req.url === '/api/library/checkout' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { deviceId } = await readJsonBody(req);
      const device = deviceId || auth.id;
      const result = await recordCheckOut(device);
      broadcastToAll({ type: 'library-occupancy', payload: { action: 'checkout', userId: auth.id } });
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Check-out failed.',
      });
    }
    return;
  }

  // Current live occupancy (anyone can read this).
  if (req.url === '/api/library/occupancy' && req.method === 'GET') {
    try {
      const result = await getOccupancy();
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get occupancy.',
      });
    }
    return;
  }

  // ── Live geofence occupancy (user_id based real-time tracking) ──

  // POST /api/library/track — UPSERT a user's inside/outside state via MERGE.
  // Authentication required. userId is taken from the JWT (auth.id), never from
  // the client, so users cannot spoof another account's presence.
  // isInside is optional; when omitted (or no lat/lng), the server only flips
  // the flag using the already-verified value. When lat/lng are present the
  // server re-verifies the geofence before trusting the client.
  if (req.url === '/api/library/track' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { isInside, lat, lng } = await readJsonBody(req);
      let verified = isInside;
      if (lat !== undefined && lng !== undefined) {
        const check = isInsideGeofence(Number(lat), Number(lng));
        verified = check.inside;
        if (verified !== !!isInside) {
          sendJson(res, 200, {
            success: true,
            clientClaimed: !!isInside,
            verified,
            distance: check.distance,
            radius: Number(process.env.LIBRARY_RADIUS_M || 60),
            note: 'Position re-verified server-side; client flag was overridden.',
          });
          return;
        }
      }
      const result = await trackUserPresence(auth.id, verified, Number(lat), Number(lng));
      broadcastToAll({ type: 'library-occupancy', payload: { action: 'track', userId: auth.id, isInside: verified } });
      sendJson(res, 200, { success: true, verified, ...result });
    } catch (error) {
      sendJson(res, 400, {
        success: false,
        error: error.message || 'Unable to update presence.',
      });
    }
    return;
  }

  // GET /api/library/pulse — real-time occupancy snapshot (count users inside
  // with a heartbeat within the last 5 minutes).
  if (req.url === '/api/library/pulse' && req.method === 'GET') {
    try {
      const result = await getLivePulse();
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to get live pulse.',
      });
    }
    return;
  }


  // ========== Invitation Endpoints ==========

  // Create a new invitation (admin only)
  if (req.url === '/api/invites' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const { email, role, invitedBy } = await readJsonBody(req);

      if (!email || !role) {
        sendJson(res, 400, { success: false, error: 'Email and role are required.' });
        return;
      }

      if (!['faculty', 'alumni'].includes(role)) {
        sendJson(res, 400, { success: false, error: 'Role must be "faculty" or "alumni".' });
        return;
      }

      const emailPattern = /@.*\./;
      if (!emailPattern.test(email)) {
        sendJson(res, 400, { success: false, error: 'Please enter a valid email address.' });
        return;
      }

      // Check if already invited with this email
      const existing = await query(
        'SELECT "Id", "Status" FROM "Invitations" WHERE "Email" = @email',
        { email: { value: email } }
      );

      const pendingInvite = existing.recordset.find(i => i.Status === 'pending');
      if (pendingInvite) {
        sendJson(res, 409, { success: false, error: 'An active invitation already exists for this email.' });
        return;
      }

      // Generate unique single-use token and store ONLY its SHA-256 hash so a
      // DB read can never reveal a usable token.
      const crypto = await import('node:crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Set expiry to 7 days from now
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await query(
        `INSERT INTO "Invitations" ("Email", "Role", "Token", "Status", "InvitedBy", "ExpiresAt")
         VALUES (@email, @role, @tokenHash, 'pending', @invitedBy, @expiresAt)`,
        {
          email: { value: email },
          role: { value: role },
          tokenHash: { value: tokenHash },
          invitedBy: { value: invitedBy || 'Admin' },
          expiresAt: { value: expiresAt },
        }
      );

      console.log(`📨 Invitation sent to ${email} (${role}); hash=${tokenHash.substring(0, 12)}...`);

      // In production, send email here via SMTP/API. Build the link from the
      // server-configured base URL (PUBLIC_BASE_URL) to avoid host-header
      // injection / phishing via a spoofed Host header.
      const baseUrl = process.env.PUBLIC_BASE_URL ||
        (req.headers.host && /localhost:?/.test(req.headers.host)
          ? `http://${req.headers.host}`
          : 'https://austwise.example');
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const inviteLink = `${cleanBase}/accept-invite?token=${encodeURIComponent(token)}`;

      sendJson(res, 201, {
        success: true,
        message: `Invitation sent to ${email}`,
        inviteLink,
        isHash: true, // server stores only the hash; plaintext token leaves via this link only
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to create invitation.',
      });
    }
    return;
  }

  // List invitations with pagination (admin only)
  if (req.url.startsWith('/api/invites') && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
      const offset = (page - 1) * limit;

      const countResult = await query('SELECT COUNT(*)::int AS total FROM "Invitations"');
      const total = countResult.recordset[0].total;

      const result = await query(
        `SELECT "Id", "Email", "Role", "Status", "InvitedBy", "CreatedAt", "ExpiresAt", "AcceptedAt"
         FROM "Invitations"
         ORDER BY "CreatedAt" DESC
         OFFSET @offset LIMIT @limit`,
        { offset: { type: sql.Int, value: offset }, limit: { type: sql.Int, value: limit } }
      );

      sendJson(res, 200, {
        success: true,
        invitations: result.recordset,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to list invitations.',
      });
    }
    return;
  }

  // Validate invitation token — look up by SHA-256 hash (token never stored in clear)
  if (req.url.startsWith('/api/invite/validate') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        sendJson(res, 400, { success: false, error: 'Token is required.' });
        return;
      }

      const crypto = await import('node:crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = await query(
        `SELECT "Id", "Email", "Role", "Status", "ExpiresAt" FROM "Invitations" WHERE "Token" = @tokenHash`,
        { tokenHash: { value: tokenHash } }
      );

      if (result.recordset.length === 0) {
        sendJson(res, 404, { success: false, error: 'Invalid or expired invitation link.' });
        return;
      }

      const invite = result.recordset[0];

      if (invite.Status === 'accepted') {
        sendJson(res, 410, { success: false, error: 'This invitation has already been used.' });
        return;
      }

      if (invite.ExpiresAt && new Date(invite.ExpiresAt) < new Date()) {
        sendJson(res, 410, { success: false, error: 'This invitation has expired.' });
        return;
      }

      sendJson(res, 200, {
        success: true,
        email: invite.Email,
        role: invite.Role,
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to validate invitation.',
      });
    }
    return;
  }

  // Accept invitation & create account
  if (req.url === '/api/invite/accept' && req.method === 'POST') {
    try {
      const { token, name, password } = await readJsonBody(req);

      if (!token || !name || !password) {
        sendJson(res, 400, { success: false, error: 'Token, name, and password are required.' });
        return;
      }

      const crypto = await import('node:crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = await query(
        `SELECT "Id", "Email", "Role", "Status", "ExpiresAt" FROM "Invitations" WHERE "Token" = @tokenHash`,
        { tokenHash: { value: tokenHash } }
      );

      if (result.recordset.length === 0) {
        sendJson(res, 404, { success: false, error: 'Invalid invitation link.' });
        return;
      }

      const invite = result.recordset[0];

      if (invite.Status === 'accepted') {
        sendJson(res, 410, { success: false, error: 'This invitation has already been used.' });
        return;
      }

      if (invite.ExpiresAt && new Date(invite.ExpiresAt) < new Date()) {
        sendJson(res, 410, { success: false, error: 'This invitation has expired.' });
        return;
      }

      // Mark invitation as accepted
      await query(
        `UPDATE "Invitations" SET "Status" = 'accepted', "AcceptedAt" = NOW() WHERE "Id" = @id`,
        { id: { type: sql.Int, value: invite.Id } }
      );

      console.log(`✅ Invitation accepted: ${invite.Email} registered as ${invite.Role}`);

      sendJson(res, 200, {
        success: true,
        message: 'Account created successfully!',
        email: invite.Email,
        role: invite.Role,
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || 'Failed to accept invitation.',
      });
    }
    return;
  }

  // Admin: full database reset — admin-only and disabled in production mode so
  // a leaked moderator account (or the role-escalation bug fixed elsewhere)
  // can never wipe application data.
  if (req.url === '/api/admin/reset' && req.method === 'POST') {
    if (!isDevMode) {
      sendJson(res, 404, { success: false, error: 'Not found.' });
      return;
    }
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      if (body?.confirm !== 'RESET_ALL_DATA') {
        sendJson(res, 400, { success: false, error: 'Missing confirmation token.' });
        return;
      }
      await resetDatabase();
      sendJson(res, 200, { success: true, message: 'Database tables truncated.' });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Database reset failed.' });
    }
    return;
  }

  // ========== PDF Proxy (bypass CORS for Google Drive) ==========
  // Uses Google Drive API v3 (alt=media) with API key — no virus scan page issues
  if (req.url.startsWith('/api/proxy/pdf') && req.method === 'GET') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const fileId = url.searchParams.get('id');
      if (!fileId) {
        sendJson(res, 400, { error: 'File ID is required.' });
        return;
      }

      const apiKey = process.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) {
        sendJson(res, 500, { error: 'Google API key not configured.' });
        return;
      }

      const https = await import('node:https');

      // SSRF/content-access hardening: only serve files that live inside the
      // allowlisted Drive folder IDs configured via GOOGLE_DRIVE_ALLOWED_FOLDERS.
      // When unset we fall back to open-fetch but log a loud warning so dev
      // deployments don't silently proxy arbitrary public Drive content.
      const allowedFolders = (process.env.GOOGLE_DRIVE_ALLOWED_FOLDERS || '')
        .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (allowedFolders.length === 0) {
        console.warn('⚠️  GOOGLE_DRIVE_ALLOWED_FOLDERS not set — PDF proxy will fetch ANY public Drive file in this auth context.');
      } else {
        // Resolve parents of the requested file and reject if none intersect the
        // allowlist. Drive API `files.get` with `fields=parents` lists the
        // immediate parent folders of the file.
        const parentCheck = await new Promise((resolve, reject) => {
          const pUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents,mimeType&key=${encodeURIComponent(apiKey)}`;
          https.default.get(pUrl, { timeout: 15000 }, (resp) => {
            let data = '';
            resp.on('data', (c) => data += c);
            resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
          }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('Drive parent-check timeout')); });
        });
        if (parentCheck.status !== 200) {
          throw new Error(`Drive API parent-check failed: ${parentCheck.status}`);
        }
        let parents = [];
        try { parents = JSON.parse(parentCheck.body).parents || []; } catch {}
        const allowed = parents.some(p => allowedFolders.includes(String(p).toLowerCase()));
        if (!allowed) {
          sendJson(res, 403, { error: 'File not in an allowed folder.' });
          return;
        }
      }

      const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;

      const pdfBuffer = await new Promise((resolve, reject) => {
        https.default.get(apiUrl, { timeout: 30000 }, (resp) => {
          const chunks = [];
          resp.on('data', (chunk) => chunks.push(chunk));
          resp.on('end', () => {
            if (resp.statusCode === 200) {
              resolve(Buffer.concat(chunks));
            } else {
              let msg = `Drive API error: ${resp.statusCode}`;
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                msg = body.error?.message || msg;
              } catch {}
              reject(new Error(msg));
            }
          });
        }).on('error', reject)
         .on('timeout', function() { this.destroy(); reject(new Error('Drive API timeout')); });
      });

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(pdfBuffer);
    } catch (error) {
      console.error('PDF proxy error:', error.message);
      sendJson(res, 500, { success: false, error: error.message || 'PDF proxy failed.' });
    }
    return;
  }

  // ========== YouTube Search Proxy ==========
  // Calls YouTube Data API v3 from server-side to avoid browser API restrictions
  // ========== YouTube Suggestions Proxy ==========
  // Returns autocomplete suggestions as user types
  if (req.url === '/api/youtube/suggestions' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { query: searchQuery } = await readJsonBody(req);
      if (!searchQuery || !searchQuery.trim()) {
        sendJson(res, 200, { success: true, suggestions: [] });
        return;
      }

      const https = await import('node:https');
      const sugUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(searchQuery.trim())}`;
      
      const data = await new Promise((resolve, _reject) => {
        https.default.get(sugUrl, (resp) => {
          let body = '';
          resp.on('data', (chunk) => body += chunk);
          resp.on('end', () => {
            try {
              // google returns: ["query",["sug1","sug2",...],...]
              const parsed = JSON.parse(body);
              const suggestions = Array.isArray(parsed[1]) ? parsed[1] : [];
              resolve(suggestions);
            } catch {
              resolve([]);
            }
          });
        }).on('error', () => resolve([]));
      });
      
      sendJson(res, 200, { success: true, suggestions: data });
    } catch {
      sendJson(res, 200, { success: true, suggestions: [] });
    }
    return;
  }

  if (req.url === '/api/youtube/search' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { query: searchQuery } = await readJsonBody(req);
      
      if (!searchQuery || !searchQuery.trim()) {
        sendJson(res, 400, { error: 'Search query is required.' });
        return;
      }

      const apiKey = process.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) {
        sendJson(res, 500, { error: 'Google API key not configured.' });
        return;
      }

      const https = await import('node:https');
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery.trim())}&maxResults=12&type=video&key=${apiKey}`;
      
      const data = await new Promise((resolve, reject) => {
        https.default.get(ytUrl, (resp) => {
          let body = '';
          resp.on('data', (chunk) => body += chunk);
          resp.on('end', () => {
            if (resp.statusCode === 200) {
              try { resolve(JSON.parse(body)); }
              catch { reject(new Error('Invalid YouTube API response')); }
            } else {
              let errMsg = `YouTube API error: ${resp.statusCode}`;
              try {
                const errBody = JSON.parse(body);
                errMsg = errBody.error?.message || errMsg;
              } catch {}
              reject(new Error(errMsg));
            }
          });
        }).on('error', reject);
      });
      
      sendJson(res, 200, { success: true, items: data.items || [], error: null });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'YouTube search failed.' });
    }
    return;
  }

  // ========== Gemini AI Chat Proxy ==========
  // Proxies requests to Google's Gemini API from server-side to avoid CORS & model issues
  if (req.url === '/api/gemini/chat' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { messages } = await readJsonBody(req);
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendJson(res, 200, { success: false, error: 'GEMINI_API_KEY not set in .env file. Get a free key at https://aistudio.google.com/apikey and add it to your .env file.' });
        return;
      }
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        sendJson(res, 400, { success: false, error: 'Messages array is required.' });
        return;
      }

      const https = await import('node:https');
      const model = 'gemini-2.0-flash';

      // Add a system-style first message as context (system_instruction not supported in some API versions)
      const systemMsg = {
        role: 'user',
        parts: [{ text: '[System context: You are a knowledgeable academic tutor for university students in Bangladesh. ' +
          'You help with study-related questions. Answer clearly in English or Bengali as needed. ' +
          'Keep answers educational and focused on helping the student understand the topic better.]'
        }]
      };
      const contents = [systemMsg, ...messages];

      // Build the request payload
      const payload = JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      });

      const geminiResponse = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          port: 443,
          path: `/v1/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 30000,
        };

        const req2 = https.default.request(options, (resp) => {
          let data = '';
          resp.on('data', (chunk) => { data += chunk; });
          resp.on('end', () => {
            try {
              resolve({ status: resp.statusCode, body: JSON.parse(data) });
            } catch {
              resolve({ status: resp.statusCode, body: { raw: data } });
            }
          });
        });

        req2.on('error', (err) => reject(new Error(err.message)));
        req2.on('timeout', () => { req2.destroy(); reject(new Error('Gemini API timeout')); });
        req2.write(payload);
        req2.end();
      });

      if (geminiResponse.status === 200) {
        const reply = geminiResponse.body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        sendJson(res, 200, { success: true, reply });
      } else {
        const errMsg = geminiResponse.body?.error?.message || `Gemini API error: ${geminiResponse.status}`;
        console.error('Gemini API error:', errMsg);
        sendJson(res, 200, { success: false, error: errMsg });
      }
    } catch (error) {
      console.error('Gemini proxy error:', error.message);
      sendJson(res, 500, { success: false, error: error.message || 'Gemini proxy failed.' });
    }
    return;
  }

  // ========== Auth Endpoints (JWT + HttpOnly cookie) ==========

  // Auth endpoints are handled by handleAuthRoute (in auth.mjs), which already
  // strips query strings via safePathname(). No extra handling needed here.
  if (await handleAuthRoute(req, res)) {
    return;
  }

  // ========== Password Vault (Daily Life — Password Manager) ==========
  // All endpoints require login. Credentials are scoped per-user via auth.id
  // and stored AES-256-GCM encrypted — plaintext is never persisted or logged.

  // POST /api/passwords/save — encrypt + store a credential.
  if (req.url === '/api/passwords/save' && req.method === 'POST') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const { platform, email, username, password } = await readJsonBody(req);
      if (!password || !String(password)) {
        sendJson(res, 400, { success: false, error: 'Password is required.' });
        return;
      }
      // Encrypt instantly — the raw password exists only in this request scope.
      const enc = (await import('./passwordCrypto.mjs')).encrypt(String(password));
      const record = await saveCredential(auth.id, { platform, email, username, enc });
      sendJson(res, 201, { success: true, credential: record });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message || 'Failed to save credential.' });
    }
    return;
  }

  // GET /api/passwords/list — fetch user's credentials, decrypt in-memory.
  if (req.url === '/api/passwords/list' && req.method === 'GET') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const records = await listCredentials(auth.id);
      const credentials = records.map((r) => {
        try {
          return { ...r, password: revealPassword(r), decrypted: true };
        } catch {
          return { ...r, password: '', decrypted: false };
        }
      });
      sendJson(res, 200, { success: true, credentials });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to load credentials.' });
    }
    return;
  }

  // PUT /api/passwords/:id — update a credential (ownership enforced).
  if (req.url.startsWith('/api/passwords/') && req.method === 'PUT') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const { platform, email, username, password } = await readJsonBody(req);
      if (!password || !String(password)) {
        sendJson(res, 400, { success: false, error: 'Password is required.' });
        return;
      }
      // Re-encrypt the (possibly changed) password.
      const enc = (await import('./passwordCrypto.mjs')).encrypt(String(password));
      const record = await updateCredential(id, auth.id, { platform, email, username, enc });
      if (!record) {
        sendJson(res, 404, { success: false, error: 'Credential not found.' });
        return;
      }
      sendJson(res, 200, { success: true, credential: record });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message || 'Failed to update credential.' });
    }
    return;
  }

  // DELETE /api/passwords/:id — remove a credential (ownership enforced).
  if (req.url.startsWith('/api/passwords/') && req.method === 'DELETE') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const deleted = await deleteCredential(id, auth.id);
      if (!deleted) {
        sendJson(res, 404, { success: false, error: 'Credential not found.' });
        return;
      }
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to delete credential.' });
    }
    return;
  }

  // ========== Presence / Active Members ==========

  // GET /api/presence/members — sanitized directory of every registered user
  // with live presence (online/idle/offline) merged in, plus privacy-gated
  // cgpa/attendance. PUBLIC — anyone (guest or logged in) can read the member
  // list so the Active Members sidebar works without an account. Sensitive
  // stats (CGPA/attendance) stay privacy-gated per user below.
  if (req.url === '/api/presence/members' && req.method === 'GET') {
    try {
      const users = await getAllUsersSafe();
      const presence = getPresenceMap();
      const members = users
        .filter(u => u.id && u.name && u.id !== 'guest')
        .map(u => {
          const p = presence[u.id] || { status: 'offline', lastSeenAt: null };
          const privacy = u.privacy || {};
          const showCgpa = privacy.showCgpa !== false;
          return {
            id: u.id,
            awid: u.awid || '',
            name: u.name,
            initials: String(u.name || 'AU').trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || 'AU',
            avatar: u.avatar || null,
            role: u.role || 'student',
            department: u.department || '',
            batch: u.batch || u.batchName || u.batchNo || '',
            batchNo: u.batchNo || '',
            batchName: u.batchName || '',
            semester: u.semester ?? 1,
            yearSemester: u.yearSemester || '',
            section: u.section || '',
            labSection: u.labSection || '',
            designation: u.designation || '',
            status: p.status,
            lastSeenAt: p.lastSeenAt || (u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : null),
            cgpa: showCgpa && u.cgpa > 0 ? Number(u.cgpa) : null,
            // Attendance is always private — never exposed to other members.
            attendancePct: null,
            privacy: {
              showCgpa,
            },
            // The member's configured orbit (checkpoints + favorite color) —
            // public by design so anyone visiting their orbit sees it.
            orbit: u.orbit || null,
          };
        });
      sendJson(res, 200, { success: true, members });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to load members.' });
    }
    return;
  }

  // POST /api/presence/privacy — update the viewer's own privacy toggles
  // ({ showCgpa, showAttendance }). Stored on the user record in users.json.
  if (req.url === '/api/presence/privacy' && req.method === 'POST') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      const next = {
        ...(user.privacy || {}),
        showCgpa: typeof body.showCgpa === 'boolean' ? body.showCgpa : (user.privacy?.showCgpa !== false),
        showAttendance: typeof body.showAttendance === 'boolean' ? body.showAttendance : (user.privacy?.showAttendance === true),
      };
      const updated = await updateUserProfile(auth.id, { privacy: next });
      broadcastToAll({ type: 'profile-update', payload: { userId: auth.id, fields: ['privacy'] } });
      sendJson(res, 200, { success: true, privacy: next, user: updated });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to update privacy settings.' });
    }
    return;
  }

  // GET /api/user/settings — the viewer's cross-device settings (notification
  // prefs, Telegram chat id/status, library tracking). Stored on the user
  // record; Telegram registration status is recomputed from the Telegram store.
  if (req.url === '/api/user/settings' && req.method === 'GET') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      const settings = normalizeUserSettings(user.settings);
      let registered = false;
      if (settings.telegram.chatId) {
        try { registered = await isRegistered(settings.telegram.chatId); } catch { /* store unavailable */ }
      }
      sendJson(res, 200, { success: true, settings: { ...settings, telegram: { ...settings.telegram, registered } } });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to load settings.' });
    }
    return;
  }

  // POST /api/user/settings — save the viewer's cross-device settings.
  // Accepts partial payloads; merged over the stored settings.
  if (req.url === '/api/user/settings' && req.method === 'POST') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      const current = normalizeUserSettings(user.settings);
      const next = normalizeUserSettings({
        notifications: { ...current.notifications, ...(body.notifications || {}) },
        telegram: { ...current.telegram, ...(body.telegram || {}) },
        libraryTracking: typeof body.libraryTracking === 'boolean' ? body.libraryTracking : current.libraryTracking,
      });
      await updateUserProfile(auth.id, { settings: next });
      broadcastToAll({ type: 'profile-update', payload: { userId: auth.id, fields: ['settings'] } });
      let registered = false;
      if (next.telegram.chatId) {
        try { registered = await isRegistered(next.telegram.chatId); } catch { /* store unavailable */ }
      }
      sendJson(res, 200, { success: true, settings: { ...next, telegram: { ...next.telegram, registered } } });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to save settings.' });
    }
    return;
  }

  // ── Generic KV Store API ──────────────────────────────────────────────
  // GET /api/store/user/:key — read a per-user stored value
  if (req.url.startsWith('/api/store/user/') && req.method === 'GET') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    const key = decodeURIComponent(req.url.slice('/api/store/user/'.length));
    try {
      const value = await getUserStoreValue(auth.id, key, null);
      sendJson(res, 200, { success: true, key, value });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to read store.' });
    }
    return;
  }

  // PUT /api/store/user/:key — write a per-user stored value
  if (req.url.startsWith('/api/store/user/') && req.method === 'PUT') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    const key = decodeURIComponent(req.url.slice('/api/store/user/'.length));
    try {
      const body = await readJsonBody(req);
      await setUserStoreValue(auth.id, key, body.value);
      // Notify the user's OTHER open devices that this key changed in real time.
      broadcastToUser(auth.id, { type: 'store-change', payload: { scope: 'user', key } });
      sendJson(res, 200, { success: true, key });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to write store.' });
    }
    return;
  }

  // DELETE /api/store/user/:key — delete a per-user stored value
  if (req.url.startsWith('/api/store/user/') && req.method === 'DELETE') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    const key = decodeURIComponent(req.url.slice('/api/store/user/'.length));
    try {
      await deleteUserStoreValue(auth.id, key);
      // Notify other devices that this key was removed (not just changed) so
      // they can drop it from their cache instead of re-fetching stale data.
      broadcastToUser(auth.id, { type: 'store-change', payload: { scope: 'user', key, deleted: true } });
      sendJson(res, 200, { success: true, key });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to delete store.' });
    }
    return;
  }

  // GET /api/store/user — list all keys for the current user
  if (req.url === '/api/store/user' && req.method === 'GET') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const keys = await listUserStoreKeys(auth.id);
      sendJson(res, 200, { success: true, keys });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to list store keys.' });
    }
    return;
  }

  // GET /api/store/shared/:key — read a shared stored value
  if (req.url.startsWith('/api/store/shared/') && req.method === 'GET') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    const key = decodeURIComponent(req.url.slice('/api/store/shared/'.length));
    try {
      const value = await getSharedStoreValue(key, null);
      sendJson(res, 200, { success: true, key, value });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to read shared store.' });
    }
    return;
  }

  // PUT /api/store/shared/:key — write a shared stored value
  if (req.url.startsWith('/api/store/shared/') && req.method === 'PUT') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    const key = decodeURIComponent(req.url.slice('/api/store/shared/'.length));
    try {
      const body = await readJsonBody(req);
      // Only admins may overwrite the global notice board (prevents student takeover).
      if (key === 'aust-notices' && !['admin', 'moderator'].includes(auth.role)) {
        sendJson(res, 403, { success: false, error: 'Only admin or moderator can update notices.' });
        return;
      }
      // CR/SR scoped notices are managed via this shared key (server-synced, not localStorage).
      if (key === 'aust-cr-sr-notices' && !['cr', 'sr', 'admin', 'moderator'].includes(auth.role)) {
        sendJson(res, 403, { success: false, error: 'Only CR/SR or admin can update CR/SR notices.' });
        return;
      }
      // Server-side rate limit for CR/SR notice bursts (30s per user)
      if (key === 'aust-cr-sr-notices') {
        const last = noticePostLastByUser.get(auth.id) || 0;
        if (Date.now() - last < 30000 && !['admin','moderator'].includes(auth.role)) {
          const wait = Math.ceil((30000 - (Date.now() - last))/1000);
          sendJson(res, 429, { success: false, error: `Rate limited — wait ${wait}s before next notice.` });
          return;
        }
        noticePostLastByUser.set(auth.id, Date.now());
      }
      // Server-derived scope validation: prevent spoofing (SR cannot post with labSection, CR cannot spoof section).
      if (key === 'aust-cr-sr-notices' && Array.isArray(body.value)) {
        try {
          const dbUser = await getUserById(auth.id);
          if (!dbUser) { sendJson(res, 404, { success: false, error: 'User not found.' }); return; }
          for (const n of body.value) {
            if (!n || typeof n !== 'object') continue;
            const s = n.scope || {};
            // Normalize client sent scope, then overwrite with server truth where role dictates
            if (auth.role === 'cr') {
              if (!dbUser.labSection) { sendJson(res, 400, { success: false, error: 'CR profile missing labSection — complete profile first.' }); return; }
              if (s.labSection && s.labSection !== dbUser.labSection) { sendJson(res, 400, { success: false, error: 'Scope labSection must match your profile.' }); return; }
              if (s.section && s.section !== dbUser.section) { /* allow but server will correct */ }
              // Enforce server truth
              n.scope = { department: dbUser.department, semester: String(dbUser.semester), labSection: dbUser.labSection };
              n.postedBy = auth.id;
              n.postedByName = dbUser.name || n.postedByName;
              n.postedByRole = auth.role;
            } else if (auth.role === 'sr') {
              if (!dbUser.section) { sendJson(res, 400, { success: false, error: 'SR profile missing section — complete profile first.' }); return; }
              if (s.section && s.section !== dbUser.section) { sendJson(res, 400, { success: false, error: 'Scope section must match your profile.' }); return; }
              n.scope = { department: dbUser.department, semester: String(dbUser.semester), section: dbUser.section };
              n.postedBy = auth.id;
              n.postedByName = dbUser.name || n.postedByName;
              n.postedByRole = auth.role;
            } else if (['admin','moderator'].includes(auth.role)) {
              // Admin can manage but scope must be present and non-empty
              if (!s.department || (!s.labSection && !s.section)) {
                // Allow global cleanup — no strict check
              }
            }
            // Length guards (prevent 15MB store bloat)
            if (typeof n.title === 'string' && n.title.length > 80) n.title = n.title.slice(0,80);
            if (typeof n.content === 'string' && n.content.length > 5000) n.content = n.content.slice(0,5000);
          }
        } catch (e) {
          if (e.message && e.message.includes('Scope')) throw e;
          // On DB miss, fall through to store raw (offline fallback will validate client-side)
        }
      }
      // The semester start date is a single admin/CR-controlled value: everyone
      // reads the same date and students must not be able to override it.
      if (key === 'semester-start-date' && !['admin', 'moderator', 'cr'].includes(auth.role)) {
        sendJson(res, 403, { success: false, error: 'Only admin or CR can change the semester start date.' });
        return;
      }
      // The shared exam schedule (Zero Hour) is CR/SR-controlled per section:
      // every section member reads the same key, but only editors may write it.
      if (key.startsWith('aust-exam-schedule:') && !['admin', 'moderator', 'cr', 'sr'].includes(auth.role)) {
        sendJson(res, 403, { success: false, error: 'Only CR/SR or admin can update the shared exam schedule.' });
        return;
      }
      await setSharedStoreValue(key, body.value, auth.id);
      broadcastToAll({ type: 'store-change', payload: { scope: 'shared', key } });
      sendJson(res, 200, { success: true, key });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to write shared store.' });
    }
    return;
  }

  // DELETE /api/store/shared/:key — delete a shared stored value
  if (req.url.startsWith('/api/store/shared/') && req.method === 'DELETE') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    const key = decodeURIComponent(req.url.slice('/api/store/shared/'.length));
    if ((key === 'aust-notices' || key === 'aust-cr-sr-notices') && !['admin', 'moderator'].includes(auth.role) && !(key === 'aust-cr-sr-notices' && ['cr','sr'].includes(auth.role))) {
      // Re-use the PUT logic: aust-notices admin-only, aust-cr-sr-notices cr/sr/admin.
      if (key === 'aust-notices') { sendJson(res, 403, { success: false, error: 'Only admin or moderator can delete notices.' }); return; }
      if (key === 'aust-cr-sr-notices' && !['cr','sr','admin','moderator'].includes(auth.role)) { sendJson(res, 403, { success: false, error: 'Only CR/SR or admin can delete CR/SR notices.' }); return; }
    }
    if (key.startsWith('aust-exam-schedule:') && !['admin', 'moderator', 'cr', 'sr'].includes(auth.role)) {
      sendJson(res, 403, { success: false, error: 'Only CR/SR or admin can modify the shared exam schedule.' });
      return;
    }
    try {
      await deleteSharedStoreValue(key);
      broadcastToAll({ type: 'store-change', payload: { scope: 'shared', key, deleted: true } });
      sendJson(res, 200, { success: true, key });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to delete shared store.' });
    }
    return;
  }

  // PUT /api/store/migrate — bulk migrate localStorage keys to server
  if (req.url === '/api/store/migrate' && req.method === 'PUT') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { userEntries = {}, sharedEntries = {} } = body || {};
      let migrated = 0;
      // Server wins over stale localStorage: skip keys the user deliberately
      // deleted (tombstones) and keys the server already has a value for, so
      // a device that missed a live delete/reset can never resurrect it.
      for (const [key, value] of Object.entries(userEntries)) {
        if (await isUserStoreDeleted(auth.id, key)) continue;
        const existing = await getUserStoreValue(auth.id, key, null);
        if (existing !== null) continue;
        await setUserStoreValue(auth.id, key, value);
        migrated += 1;
      }
      for (const [key, value] of Object.entries(sharedEntries)) {
        if (await isSharedStoreDeleted(key)) continue;
        const existing = await getSharedStoreValue(key, null);
        if (existing !== null) continue;
        await setSharedStoreValue(key, value, auth.id);
        migrated += 1;
      }
      sendJson(res, 200, { success: true, migrated });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Migration failed.' });
    }
    return;
  }

  // POST /api/presence/attendance — sync the user's attendance percentage to
  // their record so the Active Members popup can show a real value when the
  // "Show my attendance" privacy toggle is enabled.
  if (req.url === '/api/presence/attendance' && req.method === 'POST') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const pct = Number(body.attendancePct);
      if (typeof body.attendancePct !== 'number' || Number.isNaN(pct) || pct < 0 || pct > 100) {
        sendJson(res, 400, { success: false, error: 'attendancePct must be a number between 0 and 100.' });
        return;
      }
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      const updated = await updateUserProfile(auth.id, { attendancePct: Math.round(pct * 10) / 10 });
      broadcastToAll({ type: 'profile-update', payload: { userId: auth.id, fields: ['attendancePct'] } });
      sendJson(res, 200, { success: true, user: updated });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to update attendance.' });
    }
    return;
  }

  // ========== Shared Routines (CRs publish their routine) ==========

  // List every routine CRs have published, so anyone can load one.
  if (req.url === '/api/routines/shared' && req.method === 'GET') {
    try {
      const items = await listSharedRoutines();
      const routines = items.map(r => ({
        ...r,
        routine: safeJsonParse(r.routine, {}),
        weekDays: safeJsonParse(r.weekDays, []),
      }));
      sendJson(res, 200, { success: true, routines });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to list shared routines.' });
    }
    return;
  }

  // CR publishes (or updates) their own routine — one per CR slot, replaces old.
  if (req.url === '/api/routines/shared' && req.method === 'POST') {
    const auth = requireRole('cr')(req, res);
    if (!auth) return;
    try {
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      if (!user.department || !user.yearSemester || !user.section || !user.labSection) {
        sendJson(res, 400, { success: false, error: 'Complete your profile (department, year-semester, section, lab group) before sharing your routine.' });
        return;
      }

      const { routine, weekDays } = await readJsonBody(req);
      if (!routine || typeof routine !== 'object') {
        sendJson(res, 400, { success: false, error: 'Routine is required.' });
        return;
      }

      const record = await upsertSharedRoutine({
        crId: user.id,
        crName: user.name,
        department: user.department,
        yearSemester: user.yearSemester,
        section: user.section,
        labSection: user.labSection,
        routine: JSON.stringify(routine),
        weekDays: JSON.stringify(weekDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']),
      });
      sendJson(res, 200, { success: true, routine: { ...record, routine, weekDays: weekDays || [] } });
      broadcastToAll({ type: 'routine-shared', payload: { action: 'publish', crId: user.id } });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to share routine.' });
    }
    return;
  }

  // CR removes their shared routine from the load list.
  if (req.url === '/api/routines/shared' && req.method === 'DELETE') {
    const auth = requireRole('cr')(req, res);
    if (!auth) return;
    try {
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 404, { success: false, error: 'User not found.' });
        return;
      }
      const removed = await deleteSharedRoutineBySlot({
        department: user.department,
        yearSemester: user.yearSemester,
        section: user.section,
        labSection: user.labSection,
      });
      broadcastToAll({ type: 'routine-shared', payload: { action: 'delete', crId: user.id } });
      sendJson(res, 200, { success: true, removed });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to remove shared routine.' });
    }
    return;
  }

  // Counter: how many of the CR slots have published a routine (total served
  // by getSharedRoutineStats — 512 for the A-D section matrix).
  if (req.url === '/api/routines/shared/stats' && req.method === 'GET') {
    try {
      const stats = await getSharedRoutineStats();
      sendJson(res, 200, { success: true, stats });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to get shared routine stats.' });
    }
    return;
  }

  // ========== Room / Lab Availability (Free Rooms) ==========

  // GET /api/rooms/availability?day=Sunday&time=10:30
  // Live busy/free state derived from CR-published routines.
  if (req.url.startsWith('/api/rooms/availability') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const day = url.searchParams.get('day') || '';
      const time = url.searchParams.get('time') || '';
      const bookings = await listRoomBookings();
      const floors = computeRoomAvailabilityServer(serverRoomCatalog, bookings, day, time);
      const allRooms = floors.flatMap((f) => f.rooms);
      const free = allRooms.filter((r) => r.status === 'free').length;
      const busy = allRooms.filter((r) => r.status === 'busy').length;
      sendJson(res, 200, {
        success: true,
        day,
        time,
        building: serverRoomCatalog.building,
        floors,
        totals: { free, busy, total: free + busy },
        crShared: bookings.length > 0,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to compute room availability.' });
    }
    return;
  }

  // ========== PostgreSQL-backed REST API ==========

  // ── Marketplace ──
  if (req.url === '/api/marketplace' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const type = url.searchParams.get('type') || 'EXCHANGE';
      const items = await listMarketplace(type.toUpperCase());
      sendJson(res, 200, { success: true, items });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/marketplace' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
      if (!auth) return;
      const payload = await readJsonBody(req);
      payload.contributorId = auth.id;
      const item = await addMarketplaceListing(payload);
      broadcastToAll({ type: 'marketplace-listing', payload: { action: 'create', item } });
      sendJson(res, 201, { success: true, item });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/marketplace/') && req.method === 'DELETE') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
      if (!auth) return;
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      await deleteMarketplaceListing(id, auth.id, auth.role === 'admin' || auth.role === 'moderator');
      broadcastToAll({ type: 'marketplace-listing', payload: { action: 'delete', id } });
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, error.message === 'Forbidden' ? 403 : 404, { success: false, error: error.message });
    }
    return;
  }

  // ── Grades ──
  if (req.url === '/api/grades' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const results = await getSemesterResults(auth.id);
      sendJson(res, 200, { success: true, results });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/grades' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const data = await readJsonBody(req);
      const result = await saveSemesterResult(auth.id, data);
      sendJson(res, 201, { success: true, result });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  // ── Messages ──
  if (req.url === '/api/messages' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const peerId = url.searchParams.get('peer');
      if (peerId) {
        const thread = await getThread(auth.id, peerId);
        sendJson(res, 200, { success: true, thread });
      } else {
        const convs = await getConversations(auth.id);
        sendJson(res, 200, { success: true, conversations: convs });
      }
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/messages' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      const convId = [auth.id, payload.toId].sort().join('|');
      const msg = await saveMessage({
        conversationId: convId,
        fromId: auth.id,
        toId: payload.toId,
        text: payload.text,
      });
      sendJson(res, 201, { success: true, message: msg });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  // PUT /api/messages/:id — edit own message (ownership enforced)
  if (req.url.startsWith('/api/messages/') && req.method === 'PUT') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const body = await readJsonBody(req);
      const cleaned = String(body.text || '').trim().slice(0, 4000);
      if (!cleaned) {
        sendJson(res, 400, { success: false, error: 'Message text is required.' });
        return;
      }
      const updated = await editMessageById(id, cleaned);
      if (!updated || updated.fromId !== auth.id) {
        sendJson(res, 403, { success: false, error: 'Not your message to edit.' });
        return;
      }
      sendJson(res, 200, { success: true, message: updated });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  // DELETE /api/messages/:id — soft-delete own message
  if (req.url.startsWith('/api/messages/') && req.method === 'DELETE') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const removed = await deleteMessageById(id);
      sendJson(res, 200, { success: true, message: removed });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  // POST /api/messages/:id/reaction — toggle a reaction
  if (req.url.startsWith('/api/messages/') && req.url.endsWith('/reaction') && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').slice(-2)[0];
      const { emoji } = await readJsonBody(req);
      if (!emoji) {
        sendJson(res, 400, { success: false, error: 'Emoji is required.' });
        return;
      }
      const reactions = await addReaction(id, auth.id, emoji);
      sendJson(res, 200, { success: true, reactions });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  // ── Notices ──
  if (req.url === '/api/notices' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const notices = await listNotices();
      sendJson(res, 200, { success: true, notices });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/notices' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      const notice = await createNotice({ ...payload, postedBy: auth.id });
      sendJson(res, 201, { success: true, notice });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/notices/') && req.method === 'DELETE') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      await deleteNotice(id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 404, { success: false, error: error.message });
    }
    return;
  }

  // ── Canteen ──
  if (req.url === '/api/canteen' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const menu = await listCanteenMenu();
      sendJson(res, 200, { success: true, menu });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/canteen' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      const item = await upsertCanteenItem(payload);
      sendJson(res, 201, { success: true, item });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/canteen/') && req.method === 'DELETE') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      await deleteCanteenItem(id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 404, { success: false, error: error.message });
    }
    return;
  }

  // ── Clubs ──
  if (req.url === '/api/clubs' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const clubs = await listClubs();
      sendJson(res, 200, { success: true, clubs });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/clubs/') && req.url.endsWith('/join') && req.method === 'POST') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const clubId = new URL(req.url, `http://${req.headers.host}`).pathname.split('/')[3];
      await joinClub(clubId, auth.id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/clubs/') && req.url.endsWith('/leave') && req.method === 'POST') {
    const auth = requireRole('student', 'faculty', 'alumni', 'admin', 'moderator', 'cr', 'sr', 'senior')(req, res);
    if (!auth) return;
    try {
      const clubId = new URL(req.url, `http://${req.headers.host}`).pathname.split('/')[3];
      await leaveClub(clubId, auth.id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  // ── Cheatsheets ──
  if (req.url === '/api/cheatsheets' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const sheets = await listCheatsheets();
      const parsed = sheets.map(s => ({ ...s, formulas: safeJsonParse(s.formulas, []) }));
      sendJson(res, 200, { success: true, cheatsheets: parsed });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/cheatsheets' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      const sheet = await createCheatsheet({
        title: payload.title,
        category: payload.category || 'General',
        course: payload.course || '',
        formulas: JSON.stringify(payload.formulas || []),
        contributorId: auth.id,
      });
      sendJson(res, 201, { success: true, cheatsheet: { ...sheet, formulas: safeJsonParse(sheet.formulas, []) } });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/cheatsheets/') && req.method === 'DELETE') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      await deleteCheatsheet(id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 404, { success: false, error: error.message });
    }
    return;
  }

  // ── Campus Locations ──
  if (req.url === '/api/campus-locations' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const locations = await listCampusLocations();
      // Group by floor for the frontend
      const floorsMap = new Map();
      for (const loc of locations) {
        if (!floorsMap.has(loc.floor)) {
          floorsMap.set(loc.floor, { floor: loc.floor, mapImage: loc.mapImage || '', rooms: [] });
        }
        const hotspotData = safeJsonParse(loc.hotspotData, {});
        const room = { id: loc.roomId, name: loc.name, type: loc.type };
        if (Array.isArray(hotspotData) && hotspotData.length > 0) {
          room.hotspots = hotspotData;
        } else if (hotspotData && Object.keys(hotspotData).length > 0) {
          room.hotspot = hotspotData;
        }
        if (loc.x != null) room.x = loc.x;
        if (loc.y != null) room.y = loc.y;
        floorsMap.get(loc.floor).rooms.push(room);
      }
      const floors = [...floorsMap.values()];
      sendJson(res, 200, { success: true, floors });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/campus-locations' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      const loc = await upsertCampusLocation({
        floor: payload.floor,
        roomId: payload.roomId,
        name: payload.name,
        type: payload.type,
        hotspotData: JSON.stringify(payload.hotspotData || {}),
        x: payload.x ?? null,
        y: payload.y ?? null,
        mapImage: payload.mapImage || '',
      });
      sendJson(res, 201, { success: true, location: loc });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/campus-locations/') && req.method === 'DELETE') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const id = parseInt(new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop());
      await deleteCampusLocation(id);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 404, { success: false, error: error.message });
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Vault Notes — file upload / download for lecture notes

  // Upload a note file (base64-encoded in JSON body to avoid multipart) —
  // authenticated only, so the upload endpoint can't be abused for disk fill.
  if (req.url === '/api/vault/notes/upload' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      if (!body.fileData || !body.fileName) {
        sendJson(res, 400, { success: false, error: 'fileData (base64) and fileName are required.' });
        return;
      }

      // Decode base64 data URL or raw base64
      let base64Data = body.fileData;
      let mimeType = body.mimeType || 'application/octet-stream';
      if (base64Data.startsWith('data:')) {
        const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      // Validate file type
      if (!NOTE_ALLOWED_TYPES.includes(mimeType)) {
        sendJson(res, 400, { success: false, error: `File type "${mimeType}" not allowed. Accepted: pdf, png, jpg, docx.` });
        return;
      }

      // Decode and check size
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > NOTE_MAX_SIZE) {
        sendJson(res, 413, { success: false, error: `File too large (${(buffer.length / (1024*1024)).toFixed(1)}MB). Max 15MB.` });
        return;
      }

      // Verify by magic bytes, not just the client-supplied MIME type.
      if (!verifyMimeType(buffer, mimeType)) {
        sendJson(res, 400, { success: false, error: `File content doesn't match declared type "${mimeType}". Rejected.` });
        return;
      }

      await ensureUploadsDir();
      const safeName = Date.now() + '-' + body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(UPLOADS_DIR, safeName);
      await writeFile(filePath, buffer);

      // Read auth from cookie for uploader info
      const authPayload = readTokenCookie(req);
      const record = await saveNote({
        originalName: body.fileName,
        filename: safeName,
        uploader: authPayload?.id || 'anonymous',
        uploaderName: authPayload?.name || body.uploaderName || 'Anonymous',
        course: body.course || '',
        department: body.department || '',
        semester: body.semester || '',
        size: buffer.length,
        mimeType,
      });

      sendJson(res, 201, { success: true, note: record });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Upload failed.' });
    }
    return;
  }

  // ── Question Bank routes ──

  // ── Question Bank (shared papers) ──
  // List papers, optionally filtered
  if (req.url.startsWith('/api/question-papers') && req.method === 'GET' && !req.url.includes('/download/')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const papers = await listQuestionPapers({
        course: url.searchParams.get('course') || '',
        department: url.searchParams.get('department') || '',
        yearSem: url.searchParams.get('yearSem') || '',
        type: url.searchParams.get('type') || '',
      });
      sendJson(res, 200, { success: true, papers });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // Upload a question paper (metadata + file written to uploads/)
  if (req.url === '/api/question-papers' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      if (!body.fileData || !body.fileName || !body.course || !body.type) {
        sendJson(res, 400, { success: false, error: 'fileData, fileName, course and type are required.' });
        return;
      }
      let base64Data = body.fileData;
      let mimeType = body.mimeType || 'application/octet-stream';
      if (base64Data.startsWith('data:')) {
        const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }
      if (!NOTE_ALLOWED_TYPES.includes(mimeType)) {
        sendJson(res, 400, { success: false, error: 'Only PDF, PNG, JPG and DOCX question papers are accepted.' });
        return;
      }
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > NOTE_MAX_SIZE) {
        sendJson(res, 413, { success: false, error: 'File too large (max 15MB).' });
        return;
      }
      if (!verifyMimeType(buffer, mimeType)) {
        sendJson(res, 400, { success: false, error: 'File content does not match its type.' });
        return;
      }
      await ensureUploadsDir();
      const safeName = 'qp-' + Date.now() + '-' + body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(UPLOADS_DIR, safeName);
      await writeFile(filePath, buffer);

      const authPayload = readTokenCookie(req);
      const paper = await addQuestionPaper({
        contributorId: authPayload?.id || 'guest',
        contributorName: authPayload?.name || body.contributorName || 'Anonymous',
        department: body.department || '',
        yearSem: body.yearSem || '',
        course: body.course,
        name: body.name || '',
        type: body.type,
        year: body.year || '',
        semester: body.semester || '',
        paperNo: body.paperNo ?? 1,
        solved: Boolean(body.solved),
        fileName: body.fileName,
        fileType: mimeType === 'application/pdf' ? 'pdf' : 'image',
        filename: safeName,
        size: buffer.length,
      });
      sendJson(res, 201, { success: true, paper });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Upload failed.' });
    }
    return;
  }

  // Download a paper's binary file
  if (req.url.startsWith('/api/question-papers/download/') && req.method === 'GET') {
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const paper = await getQuestionPaperById(id);
      if (!paper || !paper.filename) {
        sendJson(res, 404, { success: false, error: 'Paper not found.' });
        return;
      }
      const filePath = path.join(UPLOADS_DIR, paper.filename);
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': paper.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
        'Content-Length': data.length,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(paper.fileName || 'question-paper')}"`,
      });
      res.end(data);
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // Delete a paper (owner or admin)
  if (req.url.startsWith('/api/question-papers/') && req.method === 'DELETE') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const id = decodeURIComponent(req.url.split('/').pop());
      const result = await deleteQuestionPaperById(id, auth.id, auth.role === 'admin' || auth.role === 'moderator');
      if (!result.deleted) {
        sendJson(res, 403, { success: false, error: result.error || 'Delete failed.' });
        return;
      }
      if (result.paper?.filename) {
        try { await unlink(path.join(UPLOADS_DIR, result.paper.filename)); } catch { /* already gone */ }
      }
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

// List notes for a course/department/semester
  if (req.url.startsWith('/api/vault/notes') && req.method === 'GET' && !req.url.includes('/download/')) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const notes = await listNotes({
        course: url.searchParams.get('course') || undefined,
        department: url.searchParams.get('department') || undefined,
        semester: url.searchParams.get('semester') || undefined,
      });
      sendJson(res, 200, { success: true, notes });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // Download a note file
  if (req.url.startsWith('/api/vault/notes/download/') && req.method === 'GET') {
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const note = await getNoteById(id);
      if (!note) {
        sendJson(res, 404, { success: false, error: 'Note not found.' });
        return;
      }
      const filePath = path.join(UPLOADS_DIR, note.filename);
      try {
        const data = await readFile(filePath);
        res.writeHead(200, {
          'Content-Type': note.mimeType || 'application/octet-stream',
          'Content-Length': data.length,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(note.originalName)}"`,
        });
        res.end(data);
      } catch {
        sendJson(res, 404, { success: false, error: 'File not found on disk.' });
      }
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // Delete a note (own upload or admin)
  if (req.url.startsWith('/api/vault/notes/') && req.method === 'DELETE') {
    try {
      const id = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      const authPayload = readTokenCookie(req);
      const isAdmin = authPayload && (authPayload.role === 'admin' || authPayload.role === 'moderator');
      const result = await deleteNoteById(id, authPayload?.id || 'anonymous', isAdmin);
      if (result.deleted) {
        sendJson(res, 200, { success: true });
      } else {
        sendJson(res, 403, { success: false, error: result.error });
      }
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // ── Courses ──
  if (req.url.startsWith('/api/courses') && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const dept = url.searchParams.get('department');
      const courses = await listCourses(dept || undefined);
      sendJson(res, 200, { success: true, courses });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/courses' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const payload = await readJsonBody(req);
      const course = await upsertCourse({
        code: payload.code,
        name: payload.name,
        credit: payload.credit || 0,
        department: payload.department || '',
      });
      sendJson(res, 201, { success: true, course });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/courses/') && req.method === 'DELETE') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const code = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').pop();
      await deleteCourse(code);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 404, { success: false, error: error.message });
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Role Applications (CR/SR)

  // POST /api/role-applications — submit a new CR/SR application.
  // Persisted server-side so the admin sees it from any device, and only the
  // admin is notified — never the applicant themselves.
  if (req.url === '/api/role-applications' && req.method === 'POST') {
    const auth = readTokenCookie(req);
    if (!auth) {
      sendJson(res, 401, { success: false, error: 'Authentication required.' });
      return;
    }
    try {
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 401, { success: false, error: 'User not found.' });
        return;
      }

      const body = await readJsonBody(req);
      const appliedRole = body.appliedRole;
      if (appliedRole !== 'cr' && appliedRole !== 'sr') {
        sendJson(res, 400, { success: false, error: 'Invalid role. Choose cr or sr.' });
        return;
      }

      // Duplicate pending application?
      const mine = await getRoleApplicationsByUser(user.id);
      if (mine.some(a => a.status === 'pending')) {
        sendJson(res, 409, { success: false, error: 'You already have a pending application.' });
        return;
      }
      if (user.role === appliedRole) {
        sendJson(res, 409, { success: false, error: 'You already have this role.' });
        return;
      }

      const targetSection = appliedRole === 'sr' ? String(body.targetSection || '').trim() : null;
      const targetLabSection = appliedRole === 'cr' ? String(body.targetLabSection || '').trim() : null;
      if (appliedRole === 'sr' && !targetSection) {
        sendJson(res, 400, { success: false, error: 'Section is required for SR applications.' });
        return;
      }
      if (appliedRole === 'cr' && !targetLabSection) {
        sendJson(res, 400, { success: false, error: 'Lab group is required for CR applications.' });
        return;
      }

      // Server-side slot vacancy check (authoritative — mirrors the client check).
      const allUsers = await getAllUsersSafe();
      const occupant = allUsers.find(u =>
        u.role === appliedRole &&
        u.department === user.department &&
        Number(u.semester) === Number(user.semester) &&
        (appliedRole === 'sr' ? u.section === targetSection : u.labSection === targetLabSection)
      );
      if (occupant) {
        if (occupant.id === user.id) {
          sendJson(res, 409, { success: false, error: 'You already hold this position.' });
          return;
        }
        sendJson(res, 409, {
          success: false,
          error: `This position is already taken by ${occupant.name}. You can only apply for vacant positions.`,
        });
        return;
      }

      const application = {
        id: `APP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userDepartment: user.department,
        userBatch: user.batch || user.batchNo || '',
        userSemester: String(user.semester || 1),
        userSection: user.section || '',
        userLabSection: user.labSection || '',
        appliedRole,
        targetLabSection,
        targetSection,
        statement: String(body.statement || ''),
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
      };
      await createRoleApplication(application);

      // Notify only admins/moderators (real-time over WebSocket).
      const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'moderator');
      broadcastToUsers(admins.map(a => a.id), {
        type: 'role-application',
        payload: {
          id: application.id,
          title: `New ${appliedRole === 'cr' ? 'CR' : 'SR'} application`,
          body: `${user.name} applied for ${appliedRole === 'cr' ? 'Class Representative' : 'Student Representative'} (${user.department} · Sem ${user.semester || 1}).`,
          path: '/admin/applications',
          timestamp: Date.now(),
        },
      });

      console.log(`📥 Role application: ${user.name} (${user.department}) → ${appliedRole.toUpperCase()}`);
      sendJson(res, 201, { success: true, application });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to submit application.' });
    }
    return;
  }

  // GET /api/role-applications — admin/mod only: all applications.
  if (req.url === '/api/role-applications' && req.method === 'GET') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      // Exclude applications whose user no longer exists (deleted accounts),
      // but keep every application from a live user — regardless of whether
      // that user's account exists in the admin's local browser storage.
      const allUsers = await getAllUsersSafe();
      const userIds = new Set(allUsers.map((u) => u.id));
      const applications = (await listRoleApplications()).filter((a) => userIds.has(a.userId));
      sendJson(res, 200, { success: true, applications });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // GET /api/role-applications/mine — current user's own applications.
  if (req.url === '/api/role-applications/mine' && req.method === 'GET') {
    const auth = readTokenCookie(req);
    if (!auth) {
      sendJson(res, 401, { success: false, error: 'Authentication required.' });
      return;
    }
    try {
      const applications = await getRoleApplicationsByUser(auth.id);
      sendJson(res, 200, { success: true, applications });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  // POST /api/role-applications/review — admin/mod approve/reject an application.
  if (req.url === '/api/role-applications/review' && req.method === 'POST') {
    const auth = requireRole('admin', 'moderator')(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { applicationId, status } = body;
      if (!applicationId || (status !== 'approved' && status !== 'rejected')) {
        sendJson(res, 400, { success: false, error: 'applicationId and status (approved|rejected) are required.' });
        return;
      }
      const app = await updateRoleApplication(applicationId, {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: auth.id,
      });
      if (!app) {
        sendJson(res, 404, { success: false, error: 'Application not found.' });
        return;
      }
      if (status === 'approved') {
        await updateUserProfile(app.userId, { role: app.appliedRole }, { allowRole: true });
        broadcastToAll({ type: 'profile-update', payload: { userId: app.userId, fields: ['role'] } });
      }
      // Notify the applicant with the decision.
      const approved = status === 'approved';
      broadcastToUsers([app.userId], {
        type: 'role-review',
        payload: {
          id: app.id,
          title: approved ? 'Application approved' : 'Application rejected',
          body: approved
            ? `Congratulations ${app.userName}! You are now the ${app.appliedRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)'}.`
            : `Your ${app.appliedRole === 'cr' ? 'CR' : 'SR'} application was rejected by the admin. You can re-apply for a vacant slot.`,
          path: '/settings',
          timestamp: Date.now(),
        },
      });
      console.log(`✅ Role application ${app.id} → ${status} by ${auth.id}`);
      sendJson(res, 200, { success: true, application: app });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to review application.' });
    }
    return;
  }

  // POST /api/role-applications/resign — a CR/SR user resigns their position.
  if (req.url === '/api/role-applications/resign' && req.method === 'POST') {
    const auth = readTokenCookie(req);
    if (!auth) {
      sendJson(res, 401, { success: false, error: 'Authentication required.' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const targetUserId = body.userId || auth.id;
      if (targetUserId !== auth.id) {
        sendJson(res, 403, { success: false, error: 'You can only resign from your own position.' });
        return;
      }
      const user = await getUserById(auth.id);
      if (!user || (user.role !== 'cr' && user.role !== 'sr')) {
        sendJson(res, 400, { success: false, error: 'You do not have a CR or SR role to resign from.' });
        return;
      }
      const resignedRole = user.role;
      await updateUserProfile(auth.id, { role: 'student' }, { allowRole: true });
      broadcastToAll({ type: 'profile-update', payload: { userId: auth.id, fields: ['role'] } });
      const all = await listRoleApplications();
      for (const app of all) {
        if (app.userId === auth.id && app.status === 'approved') {
          await updateRoleApplication(app.id, {
            status: 'resigned',
            reviewedAt: new Date().toISOString(),
            reviewedBy: auth.id,
          });
        }
      }
      console.log(`↩️ ${user.name} resigned from ${resignedRole.toUpperCase()}`);
      sendJson(res, 200, { success: true, resignedRole });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to resign.' });
    }
    return;
  }

  // POST /api/role-applications/withdraw — a user withdraws their pending application.
  if (req.url === '/api/role-applications/withdraw' && req.method === 'POST') {
    const auth = readTokenCookie(req);
    if (!auth) {
      sendJson(res, 401, { success: false, error: 'Authentication required.' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const app = await listRoleApplications();
      const pending = app.find(a => a.id === body.applicationId && a.userId === auth.id && a.status === 'pending');
      if (!pending) {
        sendJson(res, 400, { success: false, error: 'No pending application found to withdraw.' });
        return;
      }
      const updatedApp = await updateRoleApplication(pending.id, {
        status: 'withdrawn',
        reviewedAt: new Date().toISOString(),
        reviewedBy: auth.id,
      });
      sendJson(res, 200, { success: true, application: updatedApp });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Failed to withdraw application.' });
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PipraPay Payment Gateway (self-hosted, free forever)

  // POST /api/payment/create — create a payment charge
  if (req.url === '/api/payment/create' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { amount, purpose, description } = body;
      if (!amount || Number(amount) <= 0) {
        sendJson(res, 400, { success: false, error: 'Valid amount required.' });
        return;
      }
      const user = await getUserById(auth.id);
      if (!user) {
        sendJson(res, 400, { success: false, error: 'User not found.' });
        return;
      }
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5174}`;
      const metadata = {
        user_id: String(auth.id),
        user_email: auth.email,
        purpose: purpose || 'general',
        description: description || 'AUSTWise payment',
      };
      console.log('💰 Creating PipraPay charge:', { amount, purpose, user: auth.email });
      const result = await createCharge({
        fullName: user.name || auth.email,
        emailMobile: auth.email,
        amount: Number(amount),
        metadata,
        redirectUrl: `${baseUrl}/payment/success`,
        cancelUrl: `${baseUrl}/payment/cancel`,
        webhookUrl: `${baseUrl}/api/payment/webhook`,
      });
      // PipraPay may return the checkout URL in different fields
      const ppUrl = result.pp_url || result.checkout_url || result.url;
      const ppId = result.pp_id || result.invoice_id;
      const isOk = result.status === true || result.status === 'success' || result.status === true;
      if (isOk && ppUrl) {
        console.log('✅ PipraPay charge created:', ppId, ppUrl);
        sendJson(res, 200, {
          success: true,
          ppId,
          ppUrl,
        });
      } else {
        console.error('❌ PipraPay create-charge failed:', (result.message || JSON.stringify(result)).slice(0, 500));
        sendJson(res, 400, { success: false, error: result.message || 'Payment creation failed. Please try again.' });
      }
    } catch (error) {
      console.error('❌ Payment create error:', error);
      sendJson(res, 500, { success: false, error: error.message || 'Payment service unavailable. Please try again.' });
    }
    return;
  }

  // POST /api/payment/webhook — PipraPay sends payment status here
  if (req.url === '/api/payment/webhook' && req.method === 'POST') {
    try {
      // Validate PipraPay webhook signature (API key)
      const webhookApiKey = req.headers['mh-piprapay-api-key'];
      const expectedKey = process.env.PIPRAPAY_API_KEY;
      if (expectedKey && webhookApiKey !== expectedKey) {
        console.warn('⚠️  Payment webhook: invalid API key');
        sendJson(res, 403, { success: false, error: 'Unauthorized.' });
        return;
      }
      const body = await readJsonBody(req);
      const { pp_id, status, metadata: webhookMeta } = body;
      if (!pp_id) {
        sendJson(res, 400, { success: false, error: 'Missing pp_id.' });
        return;
      }
      // Verify the payment with PipraPay
      const verification = await verifyPayment(pp_id);
      console.log(`💰 Payment webhook: pp_id=${pp_id} — status: ${status}`, JSON.stringify(verification).slice(0, 300));

      // Handle both direct and nested response formats
      const payStatus = verification.status || (verification.payment && verification.payment.status);
      const payMeta = verification.metadata || (verification.payment && verification.payment.metadata) || webhookMeta || {};
      const isCompleted = payStatus === 'completed' || payStatus === 'Completed' || payStatus === 'success';

      // If payment is successful, update user's plan
      if (isCompleted) {
        const userId = payMeta.user_id;
        const purpose = payMeta.purpose;

        if (userId && purpose && purpose.startsWith('pro-')) {
          const planId = purpose.replace('pro-', '');
          try {
            await updateUserProfile(userId, { plan: planId });
            console.log(`✅ User ${userId} upgraded to ${planId}`);
          } catch (err) {
            console.error('Failed to update user plan:', err);
          }
        }
      }

      sendJson(res, 200, { success: true });
    } catch (error) {
      console.error('Payment webhook error:', error);
      sendJson(res, 200, { success: true }); // always 200 to avoid retries
    }
    return;
  }

  // POST /api/payment/verify — manually verify a payment
  if (req.url === '/api/payment/verify' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = await readJsonBody(req);
      const { ppId } = body;
      if (!ppId) {
        sendJson(res, 400, { success: false, error: 'ppId required.' });
        return;
      }
      const result = await verifyPayment(ppId);
      // Normalize: PipraPay may return { status, metadata, ... } or { payment: { ... } }
      const payStatus = result.status || (result.payment && result.payment.status);
      const payMeta = result.metadata || (result.payment && result.payment.metadata) || {};
      const isCompleted = payStatus === 'completed' || payStatus === 'Completed' || payStatus === 'success';
      sendJson(res, 200, {
        success: true,
        payment: {
          ...result,
          status: payStatus,
          metadata: payMeta,
          isCompleted,
        },
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message || 'Verification failed.' });
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Digital Footprint Cleaner — Gmail inbox → platform mapping

  // Digital Footprint Cleaner — authenticated only (it drives the caller's
  // Gmail access token, so it must be gated to logged-in users).
  if (req.url === '/api/cleaner/scan' && req.method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;
  }

  if (await handleCleanerRequest(req, res)) {
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Social OAuth Endpoints

  if (await handleOAuthRequest(req, res)) {
    return;
  }

  // ========== Google Auth Endpoint ==========
  // Handled by handleAuthRoute above (verify + find-or-create + auth cookie).

  // Health checks — handled before the static SPA fallback so they always
  // return JSON, not the index.html shell.
  const hp = (() => { try { return new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname; } catch { return null; } })();
  if (hp === '/healthz' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
    return;
  }
  if (hp === '/healthz/db' && req.method === 'GET') {
    if (!requireFeature('db', res, 'Database connection')) return;
    try {
      const ok = await testConnection();
      sendJson(res, ok ? 200 : 503, { ok, db: FEATURES.db && ok });
    } catch (e) {
      sendJson(res, 503, { ok: false, error: e.message });
    }
    return;
  }

  // Any /api/* route that wasn't matched above should return JSON, NOT the
  // SPA index.html.  Without this guard the browser gets HTML back and shows
  // "Unexpected token '<'" when it tries to parse it as JSON.
  if (hp && hp.startsWith('/api/')) {
    sendJson(res, 404, { success: false, error: `Not found: ${hp}` });
    return;
  }

  // Static assets bypass the flood guard in dev so Vite serving isn't throttled.
  if (isStaticAssetPath(req.url)) {
    // In Vite mode, only hand paths Vite actually owns (source files) to its
    // middleware. Build artifacts that only exist in dist/ — registerSW.js,
    // hashed assets/chunk-*.js — must be served from dist, otherwise they
    // 404 and a stale service worker keeps requesting old chunk names.
    if (vite && !distFileExists(req.url)) {
      vite.middlewares(req, res);
      return;
    }
    await sendStaticFile(req, res);
    return;
  }

  if (vite) {
    // Dev routing: Vite owns source files (/src), its client internals (/@...,
    // /node_modules/vite/dist/client/env.mjs) and optimized deps, plus the SPA
    // fallback. Everything else is served from dist/ as a static asset.
    if (
      req.url === '/' ||
      req.url.startsWith('/@') ||
      req.url.startsWith('/src') ||
      req.url.startsWith('/node_modules/')
    ) {
      vite.middlewares(req, res);
    } else {
      await sendStaticFile(req, res);
    }
    return;
  }

  await sendStaticFile(req, res);
}

// Graceful shutdown — stop accepting new traffic, drain open handles, then
// close. Reverse proxies (and the OS SIGTERM on container stop) can wait out
// the drain window instead of cutting in-flight clients.
let shuttingDown = false;
function startGracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);
  closeWSServer();
  server.close(() => process.exit(0));
  setTimeout(() => {
    console.error('⚠️  Shutdown timed out — force exiting.');
    process.exit(1);
  }, 10_000).unref(); // allow 10s drain
}
process.on('SIGTERM', () => startGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => startGracefulShutdown('SIGINT'));

// True when the requested path maps to a real file in dist/ — used to decide
// whether a static-looking URL is a build artifact (serve from dist) or a
// Vite source file (hand to the Vite middleware in dev).
function distFileExists(url) {
  try {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const candidatePath = path.resolve(distDir, relativePath);
    if (!candidatePath.startsWith(distDir)) return false;
    return existsSync(candidatePath);
  } catch {
    return false;
  }
}

// True for paths that map to a real file in dist/ — no router, no DB.
function isStaticAssetPath(url) {
  if (!url || url === '/' || url.startsWith('/api') || url.startsWith('/api/')) return false;
  const noQuery = url.split('?')[0];
  if (noQuery === '/' || noQuery.startsWith('/@')) return false;
  const ext = path.extname(noQuery).toLowerCase();
  return !!contentTypes[ext];
}

// Keep the process alive (log, don't die) — one bad request/upgrade must not
// take the whole server down. Production supervisor would restart; for a
// shared dev server, surviving is the point.
process.on('uncaughtException', (err) => {
  console.error('⚠️  uncaughtException:', err?.message || err);
});
process.on('unhandledRejection', (err) => {
  console.error('⚠️  unhandledRejection:', err?.message || err);
});

// Initialize WebSocket server for real-time messaging
createWSServer(server);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Endpoint directory (broad, grouped) ───────────────────────────────────────

const ENDPOINT_GROUPS = [
  { title: '📱 Telegram Bot', items: [
    ['POST', '/api/telegram/register', 'Register user (Chat ID only)'],
    ['POST', '/api/telegram/unregister', 'Unregister user'],
    ['GET',  '/api/telegram/status', 'Check user registration status'],
    ['PUT',  '/api/telegram/routine', 'Update user routine'],
    ['POST', '/api/telegram/toggle', 'Toggle notification status'],
    ['GET',  '/api/telegram/users', 'List all users (admin)'],
    ['POST', '/api/telegram/broadcast', 'Send notifications to all users'],
    ['POST', '/api/telegram/send-notice', 'Broadcast a notice to all users (CR/SR)'],
    ['POST', '/api/telegram/test', 'Send test notification (8 AM)'],
    ['POST', '/api/telegram/test-attendance', 'Send test attendance message (9 PM)'],
    ['POST', '/api/telegram/attendance-callback', 'Handle attendance button callback'],
    ['POST', '/api/telegram/webhook', 'Telegram webhook handler (button clicks)'],
    ['POST', '/api/telegram/set-webhook', 'Set Telegram webhook URL'],
    ['GET',  '/api/telegram/webhook-info', 'Get webhook status'],
    ['GET',  '/api/telegram/attendance', 'Get attendance records'],
    ['POST', '/api/telegram/attendance', 'Record attendance manually'],
    ['GET',  '/api/telegram/today-classes', "Get today's classes"],
    ['POST', '/api/attendance/telegram-sync', 'Sync Telegram attendance to a student'],
  ]},
  { title: '🏫 Auth & Accounts', items: [
    ['POST', '/api/auth/signup', 'Create an account (student only)'],
    ['POST', '/api/auth/login', 'Email + password login'],
    ['POST', '/api/auth/logout', 'Logout (clears auth cookie)'],
    ['POST', '/api/auth/google', 'Verify Google OAuth JWT'],
    ['GET',  '/api/auth/me', 'Current user'],
    ['PUT',  '/api/auth/profile', 'Update profile'],
    ['GET',  '/api/auth/admin', 'Admin user list'],
    ['GET',  '/api/auth/:provider/(login|callback)', 'GitHub / Discord / Spotify / Facebook / Steam OAuth'],
  ]},
  { title: '🏛️ Admin & Dev', items: [
    ['GET',  '/api/admin/users', 'List users (admin)'],
    ['POST', '/api/admin/users/role', 'Assign a role'],
    ['POST', '/api/admin/users/update', 'Update a user'],
    ['POST', '/api/admin/users/delete', 'Delete a user'],
    ['POST', '/api/admin/reset', 'Reset attendance/telegram data'],
    ['POST', '/api/dev/switch-user', 'Dev: switch account'],
    ['POST', '/api/dev/seed-users', 'Dev: seed demo users'],
    ['GET',  '/__dev/users', 'Dev: list users'],
  ]},
  { title: '📚 Library Occupancy', items: [
    ['POST', '/api/library/checkin', 'GPS check-in / heartbeat'],
    ['POST', '/api/library/checkout', 'Leave the library'],
    ['GET',  '/api/library/occupancy', 'Live occupancy count'],
    ['POST', '/api/library/track', 'Geofence UPSERT (MERGE)'],
    ['GET',  '/api/library/pulse', 'Real-time occupancy pulse'],
  ]},
  { title: '🎟️ Invitations', items: [
    ['POST', '/api/invites', 'Create invitation'],
    ['GET',  '/api/invites', 'List invitations (paginated)'],
    ['GET',  '/api/invite/validate', 'Validate invitation token'],
    ['POST', '/api/invite/accept', 'Accept invitation'],
  ]},
  { title: '🤖 AI & Proxies', items: [
    ['POST', '/api/extract-routine', 'Extract routine from image (OpenAI)'],
    ['POST', '/api/gemini/chat', 'AI chat proxy (Gemini)'],
    ['POST', '/api/youtube/suggestions', 'YouTube suggestions'],
    ['POST', '/api/youtube/search', 'YouTube search'],
    ['GET',  '/api/proxy/pdf', 'Google Drive PDF proxy'],
    ['POST', '/api/cleaner/scan', 'Digital Footprint: Gmail scan (SSE)'],
  ]},
  { title: '🔐 Password Vault', items: [
    ['POST', '/api/passwords/save', 'Save credential'],
    ['GET',  '/api/passwords/list', 'List credentials'],
    ['PUT',  '/api/passwords/:id', 'Update credential'],
    ['DELETE', '/api/passwords/:id', 'Delete credential'],
  ]},
  { title: '💳 Payments (PipraPay)', items: [
    ['POST', '/api/payment/create', 'Create a payment charge'],
    ['POST', '/api/payment/webhook', 'PipraPay webhook (auto)'],
    ['POST', '/api/payment/verify', 'Verify a payment'],
  ]},
  { title: '🗄️ Store (KV sync)', items: [
    ['GET',  '/api/store/user/:key', 'Get a user-store value'],
    ['PUT',  '/api/store/user/:key', 'Set a user-store value'],
    ['DELETE', '/api/store/user/:key', 'Delete a user-store value'],
    ['GET',  '/api/store/user', 'List all user-store keys'],
    ['GET',  '/api/store/shared/:key', 'Get a shared-store value'],
    ['PUT',  '/api/store/shared/:key', 'Set a shared-store value'],
    ['DELETE', '/api/store/shared/:key', 'Delete a shared-store value'],
    ['PUT',  '/api/store/migrate', 'Migrate localStorage → server store'],
  ]},
  { title: '📍 Presence & Routines', items: [
    ['GET',  '/api/presence/members', 'Active members'],
    ['POST', '/api/presence/privacy', 'Update presence privacy'],
    ['POST', '/api/presence/attendance', 'Record class presence'],
    ['GET',  '/api/routines/shared', 'List shared routines'],
    ['POST', '/api/routines/shared', 'Share a routine'],
    ['DELETE', '/api/routines/shared', 'Delete a shared routine slot'],
    ['GET',  '/api/routines/shared/stats', 'Shared routine stats'],
    ['GET',  '/api/rooms/availability', 'Room availability'],
  ]},
  { title: '🛒 Marketplace & Messaging', items: [
    ['GET',  '/api/marketplace', 'List listings'],
    ['POST', '/api/marketplace', 'Create listing'],
    ['DELETE', '/api/marketplace/:id', 'Delete listing'],
    ['GET',  '/api/messages', 'Get conversations'],
    ['POST', '/api/messages', 'Send message'],
    ['PUT',  '/api/messages/:id', 'Edit message'],
    ['DELETE', '/api/messages/:id', 'Delete message'],
    ['POST', '/api/messages/:id/reaction', 'Add a reaction'],
  ]},
  { title: '🎓 Academics & Community', items: [
    ['GET',  '/api/grades', 'Semester results'],
    ['POST', '/api/grades', 'Save semester result'],
    ['GET',  '/api/courses', 'Course catalog'],
    ['POST', '/api/courses', 'Add course'],
    ['DELETE', '/api/courses/:code', 'Delete course'],
    ['GET',  '/api/question-papers', 'List question papers'],
    ['POST', '/api/question-papers', 'Upload question paper'],
    ['GET',  '/api/question-papers/download/:id', 'Download question paper'],
    ['DELETE', '/api/question-papers/:id', 'Delete question paper'],
    ['POST', '/api/role-applications', 'Apply for CR/SR'],
    ['GET',  '/api/role-applications', 'All applications'],
    ['GET',  '/api/role-applications/mine', 'My applications'],
    ['POST', '/api/role-applications/review', 'Review an application'],
    ['POST', '/api/role-applications/resign', 'Resign a role'],
    ['POST', '/api/role-applications/withdraw', 'Withdraw an application'],
    ['POST', '/api/vault/notes/upload', 'Upload a vault note'],
    ['GET',  '/api/vault/notes', 'List vault notes'],
    ['GET',  '/api/vault/notes/download/:id', 'Download a vault note'],
    ['DELETE', '/api/vault/notes/:id', 'Delete a vault note'],
    ['GET',  '/api/notices', 'List notices'],
    ['POST', '/api/notices', 'Create notice'],
    ['DELETE', '/api/notices/:id', 'Delete notice'],
    ['GET',  '/api/canteen', 'Canteen menu'],
    ['POST', '/api/canteen', 'Add/update menu item'],
    ['DELETE', '/api/canteen/:id', 'Delete menu item'],
    ['GET',  '/api/clubs', 'List clubs'],
    ['POST', '/api/clubs/:id/join', 'Join a club'],
    ['POST', '/api/clubs/:id/leave', 'Leave a club'],
    ['GET',  '/api/cheatsheets', 'List cheatsheets'],
    ['POST', '/api/cheatsheets', 'Create cheatsheet'],
    ['DELETE', '/api/cheatsheets/:id', 'Delete cheatsheet'],
    ['GET',  '/api/campus-locations', 'Campus map / locations'],
    ['POST', '/api/campus-locations', 'Add location'],
    ['DELETE', '/api/campus-locations/:id', 'Delete location'],
  ]},
];

function printEndpointDirectory() {
  console.log('📚 Endpoint Directory');
  for (const group of ENDPOINT_GROUPS) {
    console.log('');
    console.log(`  ${group.title}`);
    for (const [method, path, desc] of group.items) {
      console.log(`    ${method.padEnd(6)} ${path.padEnd(38)} ${desc}`);
    }
  }
}

// ── Environment checkup (every variable, with status) ─────────────────────────

const ENV_GROUPS = [
  { title: 'Core / Server', items: [
    { key: 'PORT', desc: 'HTTP port (default 5174)', required: false },
    { key: 'NODE_ENV', desc: 'development | production', required: false },
    { key: 'PUBLIC_BASE_URL', desc: 'Public origin — OAuth redirects & webhook URL', required: false },
    { key: 'ALLOWED_ORIGIN', desc: 'CORS / WebSocket allowlist (comma-separated)', required: false },
  ]},
  { title: 'Database (PostgreSQL)', items: [
    { key: 'DATABASE_URL', desc: 'Connection string (Railway Postgres)' },
    { key: 'DB_SERVER', desc: 'Host — split-form fallback' },
    { key: 'DB_PORT', desc: 'Port — split-form fallback' },
    { key: 'DB_DATABASE', desc: 'Database name — split-form fallback' },
    { key: 'DB_USER', desc: 'Username — split-form fallback' },
    { key: 'DB_PASSWORD', desc: 'Password — split-form fallback' },
    { key: 'PGHOST', desc: 'PG_* host (alternative split-form)' },
    { key: 'PGPORT', desc: 'PG_* port' },
    { key: 'PGDATABASE', desc: 'PG_* database' },
    { key: 'PGUSER', desc: 'PG_* user' },
    { key: 'PGPASSWORD', desc: 'PG_* password' },
  ]},
  { title: 'AI Features', items: [
    { key: 'OPENAI_API_KEY', desc: 'Routine image extraction (/api/extract-routine)' },
    { key: 'OPENAI_ROUTINE_MODEL', desc: 'Routine model (default gpt-4.1)', required: false },
    { key: 'GEMINI_API_KEY', desc: 'AI chat proxy (/api/gemini/chat)' },
    { key: 'VITE_GOOGLE_API_KEY', desc: 'YouTube search & PDF proxy' },
  ]},
  { title: 'Telegram', items: [
    { key: 'TELEGRAM_BOT_TOKEN', desc: 'Notifications, broadcasts & webhook' },
    { key: 'TELEGRAM_WEBHOOK_SECRET', desc: 'Webhook secret (prod only)', required: false },
  ]},
  { title: 'Social OAuth', items: [
    { key: 'GITHUB_CLIENT_ID', desc: 'GitHub login', required: false },
    { key: 'GITHUB_CLIENT_SECRET', desc: 'GitHub secret', required: false },
    { key: 'DISCORD_CLIENT_ID', desc: 'Discord login', required: false },
    { key: 'DISCORD_CLIENT_SECRET', desc: 'Discord secret', required: false },
    { key: 'SPOTIFY_CLIENT_ID', desc: 'Spotify login', required: false },
    { key: 'SPOTIFY_CLIENT_SECRET', desc: 'Spotify secret', required: false },
    { key: 'FACEBOOK_CLIENT_ID', desc: 'Facebook login', required: false },
    { key: 'FACEBOOK_CLIENT_SECRET', desc: 'Facebook secret', required: false },
    { key: 'STEAM_API_KEY', desc: 'Steam OpenID', required: false },
  ]},
  { title: 'Security', items: [
    { key: 'JWT_SECRET', desc: 'Auth cookie signing (set one in prod!)' },
    { key: 'CRYPTO_SECRET_KEY', desc: 'Password vault encryption' },
    { key: 'ADMIN_DEFAULT_PASSWORD', desc: 'Default admin seed (prod)', required: false },
    { key: 'ENABLE_CSP', desc: 'Content-Security-Policy toggle', required: false },
    { key: 'CSP_HEADER', desc: 'Custom CSP header', required: false },
    { key: 'ENABLE_HSTS', desc: 'HSTS header (prod)', required: false },
  ]},
  { title: 'Library Occupancy', items: [
    { key: 'LIBRARY_LAT', desc: 'Library lat (default 23.7634)', required: false },
    { key: 'LIBRARY_LNG', desc: 'Library lng (default 90.4074)', required: false },
    { key: 'LIBRARY_RADIUS_M', desc: 'Geofence radius in metres', required: false },
    { key: 'LIBRARY_CAPACITY', desc: 'Seat capacity (default 350)', required: false },
  ]},
  { title: 'Rate Limiting', items: [
    { key: 'RATE_LIMIT_GLOBAL_MAX', desc: 'Global requests max / window', required: false },
    { key: 'RATE_LIMIT_AUTH_MAX', desc: 'Auth max / window', required: false },
    { key: 'RATE_LIMIT_AUTH_WINDOW_MS', desc: 'Auth window (ms)', required: false },
    { key: 'RATE_LIMIT_AUTH_GLOBAL_MAX', desc: 'Auth global max', required: false },
    { key: 'RATE_LIMIT_EXTRACT_MAX', desc: 'Extract-routine max / window', required: false },
    { key: 'RATE_LIMIT_EXTRACT_WINDOW_MS', desc: 'Extract-routine window (ms)', required: false },
  ]},
  { title: 'Google Drive / Misc', items: [
    { key: 'GOOGLE_DRIVE_ALLOWED_FOLDERS', desc: 'PDF proxy folder allowlist', required: false },
    { key: 'VITE_GOOGLE_CLIENT_ID', desc: 'Google sign-in client ID', required: false },
  ]},
];

const SECRET_KEYS = new Set([
  'JWT_SECRET', 'CRYPTO_SECRET_KEY', 'ADMIN_DEFAULT_PASSWORD',
  'GITHUB_CLIENT_SECRET', 'DISCORD_CLIENT_SECRET', 'SPOTIFY_CLIENT_SECRET',
  'FACEBOOK_CLIENT_SECRET', 'STEAM_API_KEY', 'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET', 'DB_PASSWORD', 'PGPASSWORD',
  'OPENAI_API_KEY', 'GEMINI_API_KEY', 'VITE_GOOGLE_API_KEY',
]);

function envStatusIcon(key, required) {
  return process.env[key] ? '✅' : (required === false ? 'ℹ️' : '⚠️');
}

function printEnvironmentCheckup() {
  console.log('🔍 Environment Checkup');
  console.log('');
  const dbState = dbConnected ? '✅ connected' : (FEATURES.dbConfig ? '⏳ connecting…' : 'ℹ️ not configured — JSON file fallback');
  console.log(`  Database: ${dbState}`);
  for (const group of ENV_GROUPS) {
    console.log('');
    console.log(`  ${group.title}`);
    for (const item of group.items) {
      const set = !!process.env[item.key];
      const icon = envStatusIcon(item.key, item.required);
      const optional = item.required === false && !set ? ' (optional)' : '';
      const shown = set && !SECRET_KEYS.has(item.key) ? ` = ${process.env[item.key]}` : (set ? ' (set)' : '');
      console.log(`    ${icon}  ${item.key.padEnd(28)} ${item.desc}${optional}${shown}`);
    }
  }
  const warnings = [];
  if (!FEATURES.openai) warnings.push('⚠️  OPENAI_API_KEY not set — routine image extraction (/api/extract-routine) returns 503');
  if (!FEATURES.telegram) warnings.push('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram notifications, broadcasts & webhook return 503');
  if (!FEATURES.gemini) warnings.push('⚠️  GEMINI_API_KEY not set — AI chat proxy (/api/gemini/chat) returns an error');
  if (!FEATURES.googleApi) warnings.push('⚠️  VITE_GOOGLE_API_KEY not set — YouTube search & PDF proxy return an error');
  if (process.env.NODE_ENV === 'production' && !process.env.TELEGRAM_WEBHOOK_SECRET) warnings.push('⚠️  TELEGRAM_WEBHOOK_SECRET not set — Telegram webhook updates will be rejected');
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_DEFAULT_PASSWORD) warnings.push('⚠️  ADMIN_DEFAULT_PASSWORD not set — default admin account will NOT be seeded');
  if (warnings.length) {
    console.log('');
    console.log('  Feature status:');
    for (const w of warnings) console.log(`    ${w}`);
  }
  console.log('');
  console.log('  ✅ Server ready.');
}

server.listen(port, '0.0.0.0', async () => {
  // 1) Link first — always on top, before any module boot log.
  rc.log('');
  rc.log('='.repeat(62));
  rc.log('  🚀 AUSTWise is running at  http://localhost:' + port);
  rc.log('  Mode: ' + (useViteMiddleware ? 'Vite middleware (HMR)' : 'static dist (no HMR)'));
  rc.log('  Node: ' + process.version + '   Started: ' + new Date().toLocaleTimeString());
  rc.log('='.repeat(62));
  rc.log('');

  // 2) Let async boot work (DB init, prisma tables, seeds) settle, then replay
  //    every captured boot log in order. A 4s guard keeps the report snappy.
  await Promise.race([dbInit, wait(4000)]);
  drainBootLogs();
  console.log('');

  // 3) Broad endpoint directory.
  printEndpointDirectory();
  console.log('');

  // 4) Full environment checkup — every variable.
  printEnvironmentCheckup();
});
