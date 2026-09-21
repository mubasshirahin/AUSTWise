/**
 * Telegram Class Notification Service (Single Bot - Multi-User)
 * Sends daily class schedule notifications via Telegram to all registered users
 * 
 * Setup Instructions:
 * 1. Create a Telegram bot with @BotFather and get the BOT_TOKEN
 * 2. Set TELEGRAM_BOT_TOKEN in your .env file
 * 3. Users register their Chat ID via the web interface
 * 4. Daily notifications are sent automatically at 8 AM via cron job
 * 
 * Run as cron job: 0 8 * * * node server/telegramScheduler.mjs
 * (Runs every day at 8 AM)
 */

import https from 'node:https';
import { getAllUsers, registerUser, updateUserRoutine, getUser, saveAttendanceRecord } from './telegramDB.mjs';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Bengali numerals for formatting
const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

function toBengaliNumber(num) {
  return num.toString().split('').map(digit => bengaliNumerals[parseInt(digit)] || digit).join('');
}

// Get the day name for the classes that would be shown in the next 8 AM notification
// The 8 AM notification shows "today's classes" (the day the notification is sent)
// If current time is before 8 AM, next notification is today at 8 AM, showing today's classes
// If current time is after 8 AM, next notification is tomorrow at 8 AM, showing tomorrow's classes
function getNextNotificationDay() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Before 8 AM: next notification is today at 8 AM, showing today's classes
  // After 8 AM: next notification is tomorrow at 8 AM, showing tomorrow's classes
  if (now.getHours() >= 8) {
    // After 8 AM, next notification is tomorrow at 8 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return days[tomorrow.getDay()];
  } else {
    // Before 8 AM, next notification is today at 8 AM
    return days[now.getDay()];
  }
}

// Get the date for the classes that would be shown in the next 8 AM notification
function getNextNotificationDate() {
  const now = new Date();
  let classesDay;
  
  if (now.getHours() >= 8) {
    // After 8 AM, next notification is tomorrow at 8 AM, showing tomorrow's classes
    classesDay = new Date(now);
    classesDay.setDate(classesDay.getDate() + 1);
  } else {
    // Before 8 AM, next notification is today at 8 AM, showing today's classes
    classesDay = new Date(now);
  }
  
  const options = { day: 'numeric', month: 'long' };
  return classesDay.toLocaleDateString('bn-BD', options);
}

// Get tomorrow's day name (for daily notifications - always shows tomorrow's classes)
function getTomorrowDay() {
  const today = new Date();
  today.setDate(today.getDate() + 1);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[today.getDay()];
}

// Get tomorrow's date in Bengali format (for daily notifications)
function getTomorrowDate() {
  const today = new Date();
  today.setDate(today.getDate() + 1);
  const options = { day: 'numeric', month: 'long' };
  return today.toLocaleDateString('bn-BD', options);
}

// Format class time (convert to Bengali-friendly format)
function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split('-');
  const startTime = parts[0].trim();
  
  // Try to extract time
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2];
    const period = (match[3] || 'AM').toUpperCase();
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    const bengaliHour = toBengaliNumber(hour);
    const bengaliMinute = toBengaliNumber(minute);
    return `${bengaliHour}:${bengaliMinute}`;
  }
  
  return startTime;
}

// Get tomorrow's classes from routine
function getTomorrowsClasses(routine) {
  const tomorrow = getTomorrowDay();
  return routine[tomorrow] || [];
}

// Get classes for the next 8 AM notification (used for test)
function getNextNotificationClasses(routine) {
  const nextDay = getNextNotificationDay();
  return routine[nextDay] || [];
}

// Format notification message
function formatNotification(classes, customDate) {
  const displayDate = customDate || getTomorrowDate();
  const classCount = toBengaliNumber(classes.length);
  
  let message = `🌅 সকাল ৮টায়:\n\n`;
  message += `আজ আপনার ${classCount}টি ক্লাস আছে (${displayDate})\n\n`;
  
  if (classes.length === 0) {
    message += `🎉 কোনো ক্লাস নেই! উপভোগ করুন!`;
    return message;
  }
  
  classes.forEach((cls, index) => {
    const num = toBengaliNumber(index + 1);
    const time = formatTime(cls.time);
    const room = cls.room || 'TBA';
    const type = cls.type === 'Lab' ? '🧪' : '📚';
    
    message += `${num}️⃣ ${type} ${cls.course} – ${cls.name}\n`;
    message += `   ⏰ ${time} | 📍 Room ${room}\n\n`;
  });
  
  message += `\n📖 AUSTWise থেকে`;
  
  return message;
}

// Send message via Telegram Bot API
export async function sendTelegramMessage(botToken, chatId, message) {
  if (!botToken) {
    return { 
      success: false, 
      error: 'Telegram Bot Token not configured. Please set TELEGRAM_BOT_TOKEN environment variable.' 
    };
  }
  
  if (!chatId) {
    return { 
      success: false, 
      error: 'Chat ID is required.' 
    };
  }
  
  const postData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  });
  
  return new Promise((resolve, _reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve({ success: true, messageId: result.result.message_id });
          } else {
            resolve({ success: false, error: result.description || 'Unknown Telegram error' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse Telegram response: ' + e.message });
        }
      });
    });
    
    req.on('error', (e) => {
      resolve({ success: false, error: 'Network error: ' + e.message });
    });
    
    req.write(postData);
    req.end();
  });
}

/** * Send notification to a specific user using the system bot
 * @param {string} chatId - User's Telegram Chat ID
 * @param {Object} routine - User's routine data
 * @param {boolean} _isTest - Unused; kept for API compatibility
 * @returns {Object} Result of the notification attempt
 */
export async function sendNotificationToUser(chatId, routine, _isTest = false) {
  const botToken = TELEGRAM_BOT_TOKEN;
  let classes;
  let message;
  
  // Daily digest now always previews tomorrow's classes (sent at 12 AM).
  {
    classes = getTomorrowsClasses(routine);
    message = formatNotification(classes);
  }
  
  console.log(`Sending notification to user ${chatId}...`);
  console.log('Message:', message.substring(0, 100) + '...');
  
  try {
    const result = await sendTelegramMessage(botToken, chatId, message);
    if (result.success) {
      console.log(`✅ Notification sent to user ${chatId} successfully!`);
    } else {
      console.error(`❌ Failed to send notification to user ${chatId}:`, result.error);
    }
    return result;
  } catch (error) {
    console.error(`❌ Error sending notification to user ${chatId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send daily notifications to all registered users
 * This is the main function called by the scheduler
 * @returns {Object} Summary of all notification attempts
 */
export async function sendDailyNotifications() {
  const users = await getAllUsers();
  
  if (users.length === 0) {
    console.log('No registered users found. Skipping notification.');
    return { 
      success: true, 
      totalUsers: 0, 
      sent: 0, 
      failed: 0, 
      results: [] 
    };
  }
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not configured. Skipping notification.');
    return { 
      success: false, 
      error: 'TELEGRAM_BOT_TOKEN not configured in environment variables.',
      totalUsers: users.length,
      sent: 0,
      failed: users.length,
      results: []
    };
  }
  
  console.log(`Sending daily notifications to ${users.length} users...`);
  
  const results = [];
  let sentCount = 0;
  let failedCount = 0;
  
  for (const user of users) {
    const result = await sendNotificationToUser(
      user.chatId,
      user.routine
    );
    
    results.push({
      chatId: user.chatId,
      ...result
    });
    
    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }
    
    // Small delay between requests to avoid rate limiting
    if (users.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\nNotification Summary:`);
  console.log(`Total users: ${users.length}`);
  console.log(`Sent: ${sentCount}`);
  console.log(`Failed: ${failedCount}`);
  
  return {
    success: true,
    totalUsers: users.length,
    sent: sentCount,
    failed: failedCount,
    results
  };
}

/**
 * Escape Markdown (v1) special characters so notice text renders as plain text
 */
function escapeMarkdown(text) {
  return String(text || '').replace(/([_*[\]`])/g, '\\$1');
}

/**
 * Broadcast a notice to scoped users via the system bot
 * @param {Object} notice - { title, content, pinned, postedByName, postedByRole, scope? {department,semester,section,labSection} }
 * @returns {Object} Summary of all send attempts
 */
export async function sendNoticeToAllUsers(notice) {
  if (!TELEGRAM_BOT_TOKEN) {
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN not configured in environment variables.',
      totalUsers: 0,
      sent: 0,
      failed: 0,
      results: []
    };
  }

  let users = await getAllUsers();
  if (users.length === 0) {
    return {
      success: true,
      totalUsers: 0,
      sent: 0,
      failed: 0,
      results: []
    };
  }
  // Scope-aware filtering: CR (lab 25) vs SR (section 50) — only deliver to matching cohort
  if (notice.scope && (notice.scope.labSection || notice.scope.section)) {
    try {
      const { getUserById: getAustUserById } = await import('./userStore.mjs');
      const filtered = [];
      for (const tu of users) {
        if (!tu.awid) continue;
        const u = await getAustUserById(String(tu.awid));
        if (!u) continue;
        if (notice.scope.department && String(notice.scope.department) !== String(u.department || '')) continue;
        if (notice.scope.semester && String(notice.scope.semester) !== String(u.semester || '')) continue;
        if (notice.scope.labSection && String(notice.scope.labSection) !== String(u.labSection || '')) continue;
        if (notice.scope.section && String(notice.scope.section) !== String(u.section || '')) continue;
        filtered.push(tu);
      }
      users = filtered;
      if (users.length === 0) {
        return { success: true, totalUsers: 0, sent: 0, failed: 0, results: [], scoped: true, note: 'No Telegram users matched scope' };
      }
    } catch { /* fallback to broadcast all */ }
  }

  const title = escapeMarkdown(notice.title || 'New Notice');
  const content = escapeMarkdown(notice.content || '');
  const postedBy = escapeMarkdown(notice.postedByName || '');
  const role = String(notice.postedByRole || '').toUpperCase();

  let message = `📢 *New Notice*\n\n`;
  message += `*${title}*\n\n`;
  if (content) message += `${content}\n`;
  message += `\n👤 Posted by ${postedBy}${role ? ` (${role})` : ''}${notice.pinned ? '\n📌 Pinned' : ''}`;
  message += `\n\n📖 AUSTWise`;

  console.log(`Broadcasting notice to ${users.length} Telegram users...`);

  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const user of users) {
    const result = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, user.chatId, message);
    results.push({ chatId: user.chatId, ...result });
    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }
    if (users.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`Notice broadcast summary: Total ${users.length}, Sent ${sentCount}, Failed ${failedCount}`);

  return {
    success: true,
    totalUsers: users.length,
    sent: sentCount,
    failed: failedCount,
    results
  };
}

/**
 * Send a test notification to a specific user
 * This simulates what the next 8 AM notification would look like
 * @param {string} chatId - User's Telegram Chat ID
 * @param {Object} routine - User's routine data
 * @returns {Object} Result of the test notification
 */
export async function sendTestNotification(chatId, routine) {
  console.log('Sending test notification (simulating next 8 AM notification)...');
  return await sendNotificationToUser(chatId, routine, true);
}

/**
 * Register a user for Telegram notifications
 * @param {string} chatId - User's Telegram Chat ID
 * @param {Object} routine - User's routine data
 * @returns {Object} Registered user object
 */
export async function registerUserForNotifications(chatId, routine, awid = null) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { 
      success: false, 
      error: 'Telegram Bot Token not configured. Please contact the administrator.' 
    };
  }
  
  // Validate credentials by sending a test message first
  const testResult = await sendTelegramMessage(
    TELEGRAM_BOT_TOKEN,
    chatId,
    '✅ Welcome to AUSTWise Telegram Notifications!\n\nYour Chat ID has been registered successfully. You will receive a class digest at 12 AM, pre-class alerts, and attendance prompts.'
  );
  
  if (!testResult.success) {
    return { 
      success: false, 
      error: testResult.error || 'Failed to validate Telegram credentials. Make sure you have started a chat with the bot.' 
    };
  }
  
  const user = registerUser(chatId, routine, awid);
  
  return {
    success: true,
    user
  };
}

/**
 * Update routine for all users (bulk update)
 * This can be called when the system needs to update routines for all users
 * @param {Object} routine - New routine data to apply to all users
 * @returns {Object} Summary of updates
 */
export async function updateAllUserRoutines(routine) {
  const users = await getAllUsers();
  const updatedUsers = [];
  
  for (const user of users) {
    const updatedUser = await updateUserRoutine(user.chatId, routine);
    if (updatedUser) {
      updatedUsers.push(updatedUser);
    }
  }
  
  return {
    success: true,
    updatedCount: updatedUsers.length,
    users: updatedUsers
  };
}

/**
 * Get today's classes from routine for attendance tracking
 * @param {Object} routine - User's routine data
 * @returns {Array} Array of today's classes
 */
export function getTodayClasses(routine) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  return routine[today] || [];
}

/**
 * Format a single class attendance message with Yes/No buttons
 * @param {Object} cls - Class object
 * @param {number} index - Index of the class
 * @param {number} total - Total number of classes
 * @param {string} today - Today's day name in Bengali
 * @param {string} date - Today's date
 * @returns {Object} Object with message text and inline keyboard
 */
function formatSingleClassMessage(cls, index, total, today, date) {
  const num = toBengaliNumber(index + 1);
  const time = formatTime(cls.time);
  const room = cls.room || 'TBA';
  const type = cls.type === 'Lab' ? '🧪' : '📚';
  
  let message = `🌙 রাত ৯টায়: ক্লাস ${num}/${toBengaliNumber(total)}\n\n`;
  message += `আজকের ক্লাসের উপস্থিতি নিশ্চিত করুন (${today}, ${date})\n\n`;
  message += `${type} ${cls.course} – ${cls.name}\n`;
  message += `   ⏰ ${time} | 📍 Room ${room}\n\n`;
  message += `📖 AUSTWise থেকে`;
  
  // Create Yes/No buttons for this class
  const callbackDataYes = `attend_yes_${index}_${cls.course.replace(/\s/g, '_')}`;
  const callbackDataNo = `attend_no_${index}_${cls.course.replace(/\s/g, '_')}`;
  
  const keyboard = [
    [
      { text: `✅ Yes - Present`, callback_data: callbackDataYes },
      { text: `❌ No - Absent`, callback_data: callbackDataNo }
    ]
  ];
  
  return { message, keyboard };
}

/**
 * Format attendance message with inline buttons for each class (all at once)
 * @param {Array} classes - Array of class objects for today
 * @returns {Object} Object with message text and inline keyboard
 */

/**
 * Send message with inline keyboard via Telegram Bot API
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - User's Chat ID
 * @param {string} message - Message text
 * @param {Array} keyboard - Inline keyboard layout
 * @returns {Promise<Object>} Result of the send operation
 */
export async function sendTelegramMessageWithKeyboard(botToken, chatId, message, keyboard) {
  if (!botToken) {
    return { 
      success: false, 
      error: 'Telegram Bot Token not configured. Please set TELEGRAM_BOT_TOKEN environment variable.' 
    };
  }
  
  if (!chatId) {
    return { 
      success: false, 
      error: 'Chat ID is required.' 
    };
  }
  
  const postData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
    reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
  });
  
  return new Promise((resolve, _reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve({ success: true, messageId: result.result.message_id });
          } else {
            resolve({ success: false, error: result.description || 'Unknown Telegram error' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse Telegram response: ' + e.message });
        }
      });
    });
    
    req.on('error', (e) => {
      resolve({ success: false, error: 'Network error: ' + e.message });
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Send attendance tracking messages one by one for each class
 * @param {string} chatId - User's Telegram Chat ID
 * @param {Object} routine - User's routine data
 * @param {boolean} isTest - If true, simulates the 9 PM attendance message
 * @returns {Object} Result of the attendance message attempt
 */
export async function sendAttendanceMessageToUser(chatId, routine, _isTest = false) {
  const botToken = TELEGRAM_BOT_TOKEN;
  const classes = getTodayClasses(routine);
  
  const dayNames = {
    'Sunday': 'রবিবার',
    'Monday': 'সোমবার',
    'Tuesday': 'মঙ্গলবার',
    'Wednesday': 'বুধবার',
    'Thursday': 'বৃহস্পতিবার',
    'Friday': 'শুক্রবার',
    'Saturday': 'শনিবার'
  };
  const today = dayNames[['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]];
  const date = new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' });
  
  if (classes.length === 0) {
    // No classes today
    const message = `🌙 রাত ৯টায়:\n\n🎉 আজ কোনো ক্লাস ছিল না!\n\n📖 AUSTWise থেকে`;
    return await sendTelegramMessage(botToken, chatId, message);
  }
  
  console.log(`Sending ${classes.length} attendance messages to user ${chatId}...`);
  
  const results = [];
  
  // Send each class as a separate message with Yes/No buttons
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    const { message, keyboard } = formatSingleClassMessage(cls, i, classes.length, today, date);
    
    console.log(`  Sending class ${i + 1}/${classes.length}: ${cls.course}`);
    
    try {
      const result = await sendTelegramMessageWithKeyboard(botToken, chatId, message, keyboard);
      results.push({ course: cls.course, ...result });
      
      // Small delay between messages to avoid rate limiting
      if (i < classes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`❌ Failed to send class ${cls.course}:`, error.message);
      results.push({ course: cls.course, success: false, error: error.message });
    }
  }
  
  const sentCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Attendance messages sent: ${sentCount}/${classes.length}`);
  
  return {
    success: sentCount > 0,
    totalClasses: classes.length,
    sent: sentCount,
    failed: failedCount,
    results
  };
}

/**
 * Send 9 PM attendance messages to all registered users
 * @returns {Object} Summary of all attendance message attempts
 */
export async function sendDailyAttendanceMessages() {
  const users = await getAllUsers();
  
  if (users.length === 0) {
    console.log('No registered users found. Skipping attendance notification.');
    return { 
      success: true, 
      totalUsers: 0, 
      sent: 0, 
      failed: 0, 
      results: [] 
    };
  }
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not configured. Skipping attendance notification.');
    return { 
      success: false, 
      error: 'TELEGRAM_BOT_TOKEN not configured in environment variables.',
      totalUsers: users.length,
      sent: 0,
      failed: users.length,
      results: []
    };
  }
  
  console.log(`Sending 9 PM attendance messages to ${users.length} users...`);
  
  const results = [];
  let sentCount = 0;
  let failedCount = 0;
  
  for (const user of users) {
    const result = await sendAttendanceMessageToUser(
      user.chatId,
      user.routine
    );
    
    results.push({
      chatId: user.chatId,
      ...result
    });
    
    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }
    
    // Small delay between requests to avoid rate limiting
    if (users.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\nAttendance Message Summary:`);
  console.log(`Total users: ${users.length}`);
  console.log(`Sent: ${sentCount}`);
  console.log(`Failed: ${failedCount}`);
  
  return {
    success: true,
    totalUsers: users.length,
    sent: sentCount,
    failed: failedCount,
    results
  };
}

/**
 * Send a test 9 PM attendance message to a specific user
 * @param {string} chatId - User's Telegram Chat ID
 * @param {Object} routine - User's routine data
 * @returns {Object} Result of the test attendance message
 */
export async function sendTestAttendanceMessage(chatId, routine) {
  console.log('Sending test 9 PM attendance message...');
  return await sendAttendanceMessageToUser(chatId, routine, true);
}

/**
 * Handle inline button callback from Telegram
 * @param {string} botToken - Telegram Bot Token
 * @param {number} callbackQueryId - Callback query ID from Telegram
 * @param {string} chatId - User's Chat ID
 * @param {string} callbackData - Callback data (e.g., "attend_yes_0_CSE101")
 * @param {number} messageId - The message ID containing the buttons
 * @returns {Object} Result of the callback handling
 */
export async function handleAttendanceCallback(botToken, callbackQueryId, chatId, callbackData, messageId) {
  if (!botToken) {
    return { 
      success: false, 
      error: 'Telegram Bot Token not configured.' 
    };
  }
  
  // Parse callback data: attend_yes_0_CSE101 or attend_no_0_CSE101
  const parts = callbackData.split('_');
  if (parts.length < 4 || parts[0] !== 'attend') {
    return { success: false, error: 'Invalid callback data' };
  }
  
  const isAttended = parts[1] === 'yes';
  const courseCode = parts.slice(3).join('_');
  
  // Save attendance record first
  const user = await getUser(chatId);
  if (user) {
    await saveAttendanceRecord(chatId, courseCode, isAttended);
    console.log(`✅ Attendance recorded for user ${chatId}: ${courseCode} = ${isAttended ? 'Present' : 'Absent'}`);
  }
  
  // Answer the callback query
  const answerText = isAttended 
    ? `✅ ${courseCode.replace(/_/g, ' ')} - Present marked!` 
    : `❌ ${courseCode.replace(/_/g, ' ')} - Absent marked!`;
  
  await answerCallbackQuery(botToken, callbackQueryId, answerText);
  
  // Update the message to show the button was clicked (remove the clicked button)
  if (messageId) {
    await updateMessageKeyboard(botToken, chatId, messageId, callbackData, isAttended, courseCode);
  }
  
  return {
    success: true,
    courseCode,
    attended: isAttended
  };
}

/**
 * Answer a callback query from Telegram
 * @param {string} botToken - Telegram Bot Token
 * @param {number} callbackQueryId - Callback query ID
 * @param {string} text - Text to show in the alert
 * @returns {Promise<Object>} Result of the operation
 */
async function answerCallbackQuery(botToken, callbackQueryId, text) {
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
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: result.description || 'Unknown Telegram error' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse Telegram response: ' + e.message });
        }
      });
    });
    
    req.on('error', (e) => {
      resolve({ success: false, error: 'Network error: ' + e.message });
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Update message keyboard to show button was clicked
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - User's Chat ID
 * @param {number} messageId - Message ID to edit
 * @param {string} clickedCallbackData - The callback data that was clicked
 * @param {boolean} isAttended - Whether the class was attended
 * @param {string} courseCode - Course code
 * @returns {Promise<Object>} Result of the operation
 */
async function updateMessageKeyboard(botToken, chatId, messageId, _clickedCallbackData, _isAttended, _courseCode) {
  // We'll just remove the buttons for the clicked course to show it's been answered
  // This is a simplified approach - in a full implementation, you'd parse the original
  // keyboard and remove only the clicked button pair
  
  const postData = JSON.stringify({
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] } // Remove all buttons after any click
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
    
    const req = https.request(options, (res) => {
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


/**
 * Set Telegram webhook to receive updates
 * @param {string} botToken - Telegram Bot Token
 * @param {string} webhookUrl - The URL where Telegram should send updates
 * @returns {Promise<Object>} Result of the webhook setup
 */
export async function setTelegramWebhook(botToken, webhookUrl) {
  if (!botToken) {
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const postData = JSON.stringify({
    url: webhookUrl,
    // Telegram sends this back in X-Telegram-Bot-Api-Secret-Token on every
    // update, letting us reject forged webhook calls.
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/setWebhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch {
          resolve({ ok: false, description: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ ok: false, description: 'Network error: ' + e.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Get Telegram webhook info
 * @param {string} botToken - Telegram Bot Token
 * @returns {Promise<Object>} Webhook info from Telegram
 */
export async function getWebhookInfo(botToken) {
  if (!botToken) {
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/getWebhookInfo`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch {
          resolve({ ok: false, description: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ ok: false, description: 'Network error: ' + e.message });
    });

    req.end();
  });
}

/**
 * Delete Telegram webhook
 * @param {string} botToken - Telegram Bot Token
 * @returns {Promise<Object>} Result of the webhook deletion
 */
export async function deleteWebhook(botToken) {
  if (!botToken) {
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/deleteWebhook`,
      method: 'POST'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch {
          resolve({ ok: false, description: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ ok: false, description: 'Network error: ' + e.message });
    });

    req.end();
  });
}

// Export the new functions for webhook handling
export { answerCallbackQuery, updateMessageKeyboard };

/**
 * Handle /start command from a user
 * @param {string} chatId - Telegram Chat ID
 * @returns {Object} Result
 */
export async function handleStartCommand(chatId) {
  const botToken = TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: 'Bot token not configured' };
  }

  const message =
    '🌅 AUSTWise বটে আপনাকে স্বাগতম!\n\n' +
    `✅ আপনার চ্যাট আইডি: <code>${chatId}</code>\n\n` +
    'দৈনিক ক্লাস ও অ্যাটেন্ডেন্স নোটিফিকেশন পেতে এই চ্যাট আইডিটি AUSTWise ওয়েবসাইটে আপনার প্রোফাইলে যুক্ত করুন।\n\n' +
    '📖 AUSTWise থেকে';

  return await sendTelegramMessage(botToken, chatId, message);
}

// Test function - run directly to test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing Telegram notification system...');
  sendDailyNotifications().then(result => {
    console.log('Result:', result);
    process.exit(result.success ? 0 : 1);
  });
}
