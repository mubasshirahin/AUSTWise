const DAY_BN = {
  Sunday: 'রবিবার', Monday: 'সোমবার', Tuesday: 'মঙ্গলবার', Wednesday: 'বুধবার',
  Thursday: 'বৃহস্পতিবার', Friday: 'শুক্রবার', Saturday: 'শনিবার',
};

export const TELEGRAM_TEST_TYPES = [
  { id: 'welcome', label: 'Welcome message' },
  { id: 'midnight_digest', label: 'Tomorrow class digest' },
  { id: 'first_class_reminder', label: 'First class reminder' },
  { id: 'after_class_attendance', label: 'After class attendance' },
  { id: 'evening_attendance', label: 'Evening attendance summary' },
  { id: 'missed_attendance', label: 'Auto-missed summary' },
  { id: 'deadline_urgent', label: 'Urgent deadline alert' },
  { id: 'deadline_12h', label: '12-hour deadline reminder' },
  { id: 'notice', label: 'Notice announcement' },
];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function parseTimeMinutes(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = (match[3] || '').toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function timeRangePart(value, index) {
  return String(value || '').split(/\s*[-–—]\s*/)[index] || '';
}

export function formatClock(minutes) {
  if (!Number.isFinite(minutes)) return 'Time not set';
  const hour24 = Math.floor(minutes / 60) % 24;
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minutes % 60).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

export function getSortedClasses(routine, day) {
  return (Array.isArray(routine?.[day]) ? routine[day] : []).slice().sort((a, b) =>
    (parseTimeMinutes(a?.time) ?? 0) - (parseTimeMinutes(b?.time) ?? 0)
  );
}

function classBlock(cls, index) {
  const start = parseTimeMinutes(timeRangePart(cls?.time, 0));
  const end = parseTimeMinutes(timeRangePart(cls?.time, 1));
  return `${index + 1}. <b>${escapeHtml(cls?.course || 'Course')}</b> — ${escapeHtml(cls?.name || 'Class')}\n   ${escapeHtml(formatClock(start))}${Number.isFinite(end) ? `–${escapeHtml(formatClock(end))}` : ''}  ·  ${escapeHtml(cls?.type || 'Theory')}  ·  Room ${escapeHtml(cls?.room || 'TBA')}`;
}

function dateLabel(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}

function weekdayName(date, offsetDays = 0) {
  const shifted = new Date(date.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'long' }).format(shifted);
}

export function buildDigest(routine, date = new Date(), dayNameOverride = null, { test = false } = {}) {
  const classes = getSortedClasses(routine, dayNameOverride || weekdayName(date, 1));
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const dayName = weekdayName(date, 1);
  const heading = `<b>🌙 AUSTWise · Tomorrow’s Class Briefing${test ? ' · Test' : ''}</b>\n${escapeHtml(DAY_BN[dayName])} · ${escapeHtml(dateLabel(tomorrow))}`;
  if (!classes.length) return { text: `${heading}\n\n🎉 No classes are scheduled. Enjoy your day.`, keyboard: null };
  const firstStart = parseTimeMinutes(timeRangePart(classes[0].time, 0));
  return {
    text: `${heading}\n\n<b>${classes.length} ${classes.length === 1 ? 'class' : 'classes'}</b> · First class at ${escapeHtml(formatClock(firstStart))}\n\n${classes.map(classBlock).join('\n\n')}\n\nA reminder will arrive 30 minutes before your first class.`,
    keyboard: null,
  };
}

export function buildFirstClassReminder(classes, date = new Date(), { test = false } = {}) {
  const cls = classes[0];
  const start = parseTimeMinutes(timeRangePart(cls?.time, 0));
  const end = parseTimeMinutes(timeRangePart(cls?.time, 1));
  const dayName = weekdayName(date);
  return {
    text: `<b>⏰ AUSTWise · Class Reminder${test ? ' · Test' : ''}</b>\n${escapeHtml(DAY_BN[dayName])} · ${escapeHtml(dateLabel(date))}\n\nYour first class starts in <b>30 minutes</b>.\n\n<b>${escapeHtml(cls?.course || 'CSE 101')}</b> — ${escapeHtml(cls?.name || 'Introduction to Computing')}\n${escapeHtml(formatClock(start))}${Number.isFinite(end) ? `–${escapeHtml(formatClock(end))}` : ''}  ·  ${escapeHtml(cls?.type || 'Theory')}  ·  Room ${escapeHtml(cls?.room || 'TBA')}\n\nYou have ${classes.length || 1} ${classes.length === 1 ? 'class' : 'classes'} scheduled today.`,
    keyboard: null,
  };
}

function attendanceKeyboard(cls, index, test = false) {
  const course = String(cls?.course || 'COURSE').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'COURSE';
  const prefix = test ? 'preview_attend' : 'attend';
  return [[
    { text: 'Present', callback_data: `${prefix}_yes_${index}_${course}` },
    { text: 'Absent', callback_data: `${prefix}_no_${index}_${course}` },
  ]];
}

export function buildAfterClassAttendance(cls, index = 0, total = 1, { test = false, date = new Date() } = {}) {
  const start = parseTimeMinutes(timeRangePart(cls?.time, 0));
  const end = parseTimeMinutes(timeRangePart(cls?.time, 1));
  return {
    text: `<b>📝 AUSTWise · Attendance Check-in</b>\n${escapeHtml(DAY_BN[weekdayName(date)])} · ${escapeHtml(dateLabel(date))}\n\n<b>${escapeHtml(cls?.course || 'CSE 101')}</b> — ${escapeHtml(cls?.name || 'Introduction to Computing')}\n${escapeHtml(formatClock(start))}${Number.isFinite(end) ? `–${escapeHtml(formatClock(end))}` : ''}  ·  Room ${escapeHtml(cls?.room || 'TBA')}\n\nWere you present in this class?${test ? '\n\n<i>Test message · buttons will not change your attendance record.</i>' : ''}`,
    keyboard: attendanceKeyboard(cls, index, test),
  };
}

export function buildEveningAttendance(classes, answeredMap = {}, { test = false, date = new Date() } = {}) {
  const keyboard = classes.flatMap((cls, index) => answeredMap[index] ? [] : attendanceKeyboard(cls, index, test));
  return {
    text: `<b>🌙 AUSTWise · Attendance Summary</b>\n${escapeHtml(DAY_BN[weekdayName(date)])} · ${escapeHtml(dateLabel(date))}\n\n${classes.map((cls, index) => `${answeredMap[index] ? '✓' : '•'} ${escapeHtml(cls?.course || 'Course')} — ${escapeHtml(cls?.name || 'Class')} · ${escapeHtml(formatClock(parseTimeMinutes(timeRangePart(cls?.time, 0))))}`).join('\n')}\n\n${keyboard.length ? 'Please confirm any classes that still need an attendance response.' : 'All attendance responses are complete.'}${test ? '\n\n<i>Test message · buttons will not change your attendance record.</i>' : ''}`,
    keyboard,
  };
}

export function buildMissedAttendance(count, date = new Date(), { test = false } = {}) {
  const previous = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return { text: `<b>🌙 AUSTWise · Attendance Update${test ? ' · Test' : ''}</b>\n${escapeHtml(dateLabel(previous))}\n\n${count} unanswered ${count === 1 ? 'class has' : 'classes have'} been marked as missed. You can review your attendance in AUSTWise.` };
}

export function buildDeadlineMessage(deadline, phase, { test = false } = {}) {
  const dueDate = new Date(deadline?.dueDate || Date.now() + (phase === 'urgent' ? 24 : 12) * 60 * 60 * 1000);
  const dueLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(dueDate);
  const urgent = phase === 'urgent';
  return {
    text: `<b>${urgent ? '🚨 AUSTWise · Urgent Deadline' : '⏳ AUSTWise · Deadline Reminder'}</b>\n\n<b>${escapeHtml(deadline?.title || 'Project submission')}</b>\n${escapeHtml(deadline?.course || 'Course')} · ${escapeHtml(deadline?.priority || (urgent ? 'High' : 'Medium'))} priority\nDue ${escapeHtml(dueLabel)}\n\n${urgent ? 'This high-priority deadline is approaching. Please review your next steps.' : 'Your deadline is 12 hours away. Please plan enough time to finish and submit.'}${test ? '\n\n<i>Test message</i>' : ''}`,
  };
}

export function buildNoticeMessage(notice = {}, { test = false } = {}) {
  return {
    text: `<b>📢 AUSTWise · Notice${test ? ' · Test' : ''}</b>\n\n<b>${escapeHtml(notice.title || 'Academic notice preview')}</b>${notice.content ? `\n\n${escapeHtml(notice.content)}` : '\n\nThe university has published a new update. Open AUSTWise to view the details.'}${notice.postedByName ? `\n\nPosted by ${escapeHtml(notice.postedByName)}${notice.postedByRole ? ` · ${escapeHtml(String(notice.postedByRole).toUpperCase())}` : ''}` : ''}${notice.pinned ? '\n📌 Pinned notice' : ''}`,
  };
}

export function buildWelcomeMessage(chatId = '', { test = false } = {}) {
  return {
    text: `<b>✨ AUSTWise notifications are connected${test ? ' · Test' : ''}</b>\n\nYou will receive the updates enabled in your notification settings:\n\n• Tomorrow’s class briefing at 12:00 AM\n• A reminder 30 minutes before your first class\n• Attendance check-ins after class\n• Attendance summary at 9:00 PM\n• Deadline reminders\n\n${chatId ? `<b>Your Telegram Chat ID</b>\n<code>${escapeHtml(chatId)}</code>\n\n` : ''}Manage these updates any time in <b>AUSTWise · Settings · Notifications</b>.`,
  };
}
