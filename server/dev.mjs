import 'dotenv/config';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
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
  getTodayClasses,
  setTelegramWebhook,
  getWebhookInfo
} from './telegramNotifier.mjs';
import {
  registerUser,
  unregisterUser,
  getUser,
  getAllUsers,
  updateUserRoutine,
  toggleUserStatus,
  getStats,
  isRegistered,
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
import { initializeDatabase, resetDatabase, query, sql } from './db.mjs';
import { handleOAuthRequest } from './socialOAuth.mjs';
import { handleAuthRoute } from './auth.mjs';
import { requireRole } from './middleware.mjs';
import {
  listMarketplace,
  addMarketplaceListing,
  deleteMarketplaceListing,
  saveMessage,
  getConversations,
  getThread,
  deleteMessageById,
  editMessageById,
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
} from './prisma.js';
import { createWSServer, broadcastToAll } from './wsServer.mjs';

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
async function updateMessageKeyboardFn(botToken, chatId, messageId, clickedCallbackData, isAttended, courseCode) {
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
const useViteMiddleware = process.argv.includes('--vite');
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

function sendJson(res, status, payload) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

async function sendStaticFile(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidatePath = path.resolve(distDir, relativePath);
  const filePath = candidatePath.startsWith(distDir) ? candidatePath : path.join(distDir, 'index.html');

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  } catch {
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

// CORS preflight handler
function handleCorsPreflight(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

const vite = useViteMiddleware
  ? await createViteServer({
      server: { middlewareMode: true },
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

// Check DB credential env vars
const dbVarMap = { DB_SERVER: 'Server', DB_DATABASE: 'Database', DB_USER: 'User', DB_PASSWORD: 'Password' };
const missingDbVars = Object.entries(dbVarMap).filter(([k]) => !process.env[k]).map(([, label]) => label);
FEATURES.dbConfig = missingDbVars.length === 0;

function validateEnv() {
  const warnings = [];

  if (!FEATURES.openai) {
    warnings.push('⚠️  OPENAI_API_KEY not set — routine image extraction (/api/extract-routine) will return 503');
  }
  if (!FEATURES.telegram) {
    warnings.push('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram notifications, broadcasts & webhook will return 503');
  }
  if (!FEATURES.gemini) {
    warnings.push('⚠️  GEMINI_API_KEY not set — AI chat proxy (/api/gemini/chat) will return an error');
  }
  if (!FEATURES.googleApi) {
    warnings.push('⚠️  VITE_GOOGLE_API_KEY not set — YouTube search & PDF proxy will return an error');
  }
  if (!FEATURES.dbConfig) {
    warnings.push(`⚠️  Missing DB credentials (${missingDbVars.join(', ')}) — all database features will be unavailable`);
  }
  if (!FEATURES.db && FEATURES.dbConfig) {
    warnings.push('⚠️  SQL Server connection failed — all database features will be unavailable');
  }

  // Social OAuth checks (non-critical — just info)
  if (!process.env.GITHUB_CLIENT_ID)    warnings.push('ℹ️  GITHUB_CLIENT_ID not set — GitHub OAuth login disabled');
  if (!process.env.DISCORD_CLIENT_ID)   warnings.push('ℹ️  DISCORD_CLIENT_ID not set — Discord OAuth login disabled');
  if (!process.env.SPOTIFY_CLIENT_ID)   warnings.push('ℹ️  SPOTIFY_CLIENT_ID not set — Spotify OAuth login disabled');
  if (!process.env.FACEBOOK_CLIENT_ID)  warnings.push('ℹ️  FACEBOOK_CLIENT_ID not set — Facebook OAuth login disabled');
  if (!process.env.STEAM_API_KEY)       warnings.push('ℹ️  STEAM_API_KEY not set — Steam OAuth login disabled');

  if (warnings.length > 0) {
    console.warn('\n🔧 Environment check:\n  ' + warnings.join('\n  ') + '\n');
  } else {
    console.log('✅ Environment check: all required variables present.');
  }
}

// Guard helpers — return true if the feature is available, otherwise send 503
function requireFeature(feature, res, label) {
  if (!FEATURES[feature]) {
    sendJson(res, 503, { error: `Service unavailable: ${label || feature} is not configured.` });
    return false;
  }
  return true;
}

// Auto-create database & tables on startup
initializeDatabase().then(() => {
  FEATURES.db = true;
  console.log('✅ SQL Server connected & tables ready');
}).catch(err => {
  console.warn('⚠️  SQL Server init failed:', err.message);
  console.warn('   Server will still start, but DB features won\'t work.');
}).finally(() => {
  // validateEnv runs after DB init attempt so FEATURES.db reflects reality
  validateEnv();
});

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    handleCorsPreflight(req, res);
    return;
  }

  // Add CORS headers to all responses
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Extract routine from image (rate-limited — OpenAI-backed endpoint)
  if (req.url === '/api/extract-routine' && req.method === 'POST') {
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

  // Test Telegram notification
  if (req.url === '/api/telegram/test' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
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

  // Register user for Telegram notifications (only Chat ID needed)
  if (req.url === '/api/telegram/register' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
    try {
      const { chatId, routine } = await readJsonBody(req);
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }

      // Check if already registered
      if (await isRegistered(chatId)) {
        sendJson(res, 409, {
          success: false,
          error: 'This Chat ID is already registered.'
        });
        return;
      }

      // Validate credentials and register
      const result = await registerUserForNotifications(chatId, routine);
      
      if (result.success) {
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

  // Unregister user from Telegram notifications
  if (req.url === '/api/telegram/unregister' && req.method === 'POST') {
    try {
      const { chatId } = await readJsonBody(req);
      
      if (!chatId) {
        sendJson(res, 400, {
          success: false,
          error: 'Chat ID is required.'
        });
        return;
      }

      const removed = await unregisterUser(chatId);
      
      if (removed) {
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

  // Test 9 PM Attendance notification
  if (req.url === '/api/telegram/test-attendance' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
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

  // Handle attendance callback from Telegram bot (webhook)
  if (req.url === '/api/telegram/attendance-callback' && req.method === 'POST') {
    if (!requireFeature('telegram', res, 'TELEGRAM_BOT_TOKEN')) return;
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
      const update = await readJsonBody(req);
      console.log('📩 Telegram Webhook Update:', JSON.stringify(update).substring(0, 200) + '...');
      
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
            const classIndex = parseInt(parts[2]);
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
  if (req.url === '/api/library/checkin' && req.method === 'POST') {
    try {
      const { deviceId, lat, lng } = await readJsonBody(req);
      const result = await recordCheckIn(deviceId, Number(lat), Number(lng));
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
  if (req.url === '/api/library/checkout' && req.method === 'POST') {
    try {
      const { deviceId } = await readJsonBody(req);
      if (!deviceId) {
        sendJson(res, 400, { success: false, error: 'deviceId is required.' });
        return;
      }
      const result = await recordCheckOut(deviceId);
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
        'SELECT Id, Status FROM Invitations WHERE Email = @email',
        { email: { value: email } }
      );

      const pendingInvite = existing.recordset.find(i => i.Status === 'pending');
      if (pendingInvite) {
        sendJson(res, 409, { success: false, error: 'An active invitation already exists for this email.' });
        return;
      }

      // Generate unique token
      const crypto = await import('node:crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiry to 7 days from now
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await query(
        `INSERT INTO Invitations (Email, Role, Token, Status, InvitedBy, ExpiresAt)
         VALUES (@email, @role, @token, 'pending', @invitedBy, @expiresAt)`,
        {
          email: { value: email },
          role: { value: role },
          token: { value: token },
          invitedBy: { value: invitedBy || 'Admin' },
          expiresAt: { value: expiresAt },
        }
      );

      console.log(`📨 Invitation sent to ${email} (${role}), token=${token.substring(0, 12)}...`);

      // In production, send email here via SMTP/API
      // For now, return the invite link so admin can share it
      const inviteLink = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:5174'}/accept-invite?token=${token}`;

      sendJson(res, 201, {
        success: true,
        message: `Invitation sent to ${email}`,
        inviteLink,
        token: token.substring(0, 8) + '...',
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

      const countResult = await query('SELECT COUNT(*) AS total FROM Invitations');
      const total = countResult.recordset[0].total;

      const result = await query(
        `SELECT Id, Email, Role, Token, Status, InvitedBy, CreatedAt, ExpiresAt, AcceptedAt
         FROM Invitations
         ORDER BY CreatedAt DESC
         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
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

  // Validate invitation token
  if (req.url.startsWith('/api/invite/validate') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        sendJson(res, 400, { success: false, error: 'Token is required.' });
        return;
      }

      const result = await query(
        `SELECT Id, Email, Role, Status, ExpiresAt FROM Invitations WHERE Token = @token`,
        { token: { value: token } }
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

      const result = await query(
        `SELECT Id, Email, Role, Status, ExpiresAt FROM Invitations WHERE Token = @token`,
        { token: { value: token } }
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
        `UPDATE Invitations SET Status = 'accepted', AcceptedAt = GETDATE() WHERE Id = @id`,
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

  // Admin: full database reset
  if (req.url === '/api/admin/reset' && req.method === 'POST') {
    if (!requireFeature('db', res, 'Database connection')) return;
    const auth = requireRole('admin', 'moderator')(req, res);
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
        'Access-Control-Allow-Origin': '*',
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
    try {
      const { query: searchQuery } = await readJsonBody(req);
      if (!searchQuery || !searchQuery.trim()) {
        sendJson(res, 200, { success: true, suggestions: [] });
        return;
      }

      const https = await import('node:https');
      const sugUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(searchQuery.trim())}`;
      
      const data = await new Promise((resolve, reject) => {
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

  if (await handleAuthRoute(req, res)) {
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
  // Social OAuth Endpoints

  if (await handleOAuthRequest(req, res)) {
    return;
  }

  // ========== Google Auth Endpoint ==========

  if (req.url === '/api/auth/google' && req.method === 'POST') {
    try {
      const { credential } = await readJsonBody(req);
      if (!credential) {
        sendJson(res, 400, { success: false, error: 'Credential is required.' });
        return;
      }
      // Verify the Google JWT via Google's token info endpoint
      const https = await import('node:https');
      const verifyUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
      verifyUrl.searchParams.set('id_token', credential);
      const response = await new Promise((resolve, reject) => {
        https.default.get(verifyUrl.toString(), (resp) => {
          let data = '';
          resp.on('data', (chunk) => data += chunk);
          resp.on('end', () => {
            if (resp.statusCode === 200) {
              try { resolve(JSON.parse(data)); }
              catch { reject(new Error('Invalid response')); }
            } else {
              reject(new Error(data));
            }
          });
        }).on('error', reject);
      });
      sendJson(res, 200, { success: true, user: response });
    } catch (error) {
      sendJson(res, 401, { success: false, error: error.message || 'Google verification failed.' });
    }
    return;
  }

  if (vite) {
    // Don't route WebSocket upgrade requests through Vite — our custom WS server
    // (wsServer.mjs) handles those via the http.Server 'upgrade' event.
    if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
      vite.middlewares(req, res);
    }
    return;
  }

  await sendStaticFile(req, res);
});

// Initialize WebSocket server for real-time messaging
createWSServer(server);

server.listen(port, '0.0.0.0', () => {
  validateEnv();
  console.log(`AUSTWise running at http://localhost:${port}`);
  console.log(`Mode: ${useViteMiddleware ? 'Vite middleware' : 'static dist (no HMR)'}`);
  console.log('');
  console.log('Telegram API Endpoints:');
  console.log('  POST /api/telegram/register           - Register user (Chat ID only)');
  console.log('  POST /api/telegram/unregister         - Unregister user');
  console.log('  GET  /api/telegram/status              - Check user registration status');
  console.log('  PUT  /api/telegram/routine             - Update user routine');
  console.log('  POST /api/telegram/toggle              - Toggle notification status');
  console.log('  GET  /api/telegram/users               - List all users (admin)');
  console.log('  POST /api/telegram/broadcast           - Send notifications to all users');
  console.log('  POST /api/telegram/test                - Send test notification (8 AM)');
  console.log('  POST /api/telegram/test-attendance     - Send test attendance message (9 PM)');
  console.log('  POST /api/telegram/attendance-callback - Handle attendance button callback');
  console.log('  POST /api/telegram/webhook             - Telegram webhook handler (for button clicks)');
  console.log('  POST /api/telegram/set-webhook         - Set Telegram webhook URL');
  console.log('  GET  /api/telegram/webhook-info        - Get webhook status');
  console.log('  GET  /api/telegram/attendance          - Get attendance records');
  console.log('  POST /api/telegram/attendance          - Record attendance manually');
  console.log('  GET  /api/telegram/today-classes       - Get today\'s classes');
  console.log('');
  console.log('Library Occupancy Endpoints:');
  console.log('  POST /api/library/checkin              - GPS check-in / heartbeat');
  console.log('  POST /api/library/checkout             - Leave the library');
  console.log('  GET  /api/library/occupancy            - Live occupancy count');
  console.log('');
  console.log('Invitation Endpoints:');
  console.log('  POST /api/invites                      - Create invitation');
  console.log('  GET  /api/invites                      - List invitations (paginated)');
  console.log('  GET  /api/invite/validate              - Validate invitation token');
  console.log('  POST /api/invite/accept                - Accept invitation');
  console.log('');
  console.log('Auth Endpoints:');
  console.log('  POST /api/auth/google                  - Verify Google OAuth JWT');
  console.log('  GET  /api/auth/github/(login|callback) - GitHub OAuth');
  console.log('  GET  /api/auth/discord/(login|callback)- Discord OAuth');
  console.log('  GET  /api/auth/spotify/(login|callback)- Spotify OAuth');
  console.log('  GET  /api/auth/facebook/(login|callback)- Facebook OAuth');
  console.log('  GET  /api/auth/steam/(login|callback)   - Steam OpenID');
  console.log('');
  console.log('📞 Telegram Webhook Setup:');
  console.log('  To enable button clicks in Telegram, set your webhook URL using:');
  console.log('  POST /api/telegram/set-webhook with body: { "webhookUrl": "https://your-domain.com/api/telegram/webhook" }');
});
