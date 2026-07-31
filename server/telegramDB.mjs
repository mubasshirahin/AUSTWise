import { query, sql } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';

let useJsonFallback = !process.env.DB_PASSWORD;

export async function registerUser(chatId, routine = null) {
  const r = routine ? JSON.stringify(routine) : null;

  if (!useJsonFallback) {
    try {
      const result = await query(`
        MERGE TelegramUsers AS target
        USING (SELECT @chatId AS ChatId) AS source
        ON target.ChatId = source.ChatId
        WHEN MATCHED THEN UPDATE SET Routine = COALESCE(@routine, target.Routine), Enabled = 1, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN INSERT (ChatId, Routine, Enabled, CreatedAt, UpdatedAt) VALUES (@chatId, @routine, 1, GETDATE(), GETDATE())
        OUTPUT inserted.*;
      `, {
        chatId: { value: String(chatId) },
        routine: { type: sql.NVarChar(sql.MAX), value: r },
      });
      return result.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server registerUser failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  const idx = list.findIndex(u => String(u.chatId) === String(chatId));
  const user = {
    chatId: String(chatId),
    routine: routine ? (typeof routine === 'string' ? routine : JSON.stringify(routine)) : (idx !== -1 ? list[idx].routine : null),
    enabled: true,
    createdAt: idx !== -1 ? list[idx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (idx !== -1) {
    list[idx] = user;
  } else {
    list.push(user);
  }
  await writeJson('telegram_users.json', list);
  return user;
}

export async function unregisterUser(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query('DELETE FROM TelegramUsers WHERE ChatId = @chatId; SELECT @@ROWCOUNT AS deleted', { chatId: { value: String(chatId) } });
      return (r.recordset[0]?.deleted || 0) > 0;
    } catch (err) {
      console.warn('⚠️  SQL Server unregisterUser failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  let list = await readJson('telegram_users.json');
  const initialLen = list.length;
  list = list.filter(u => String(u.chatId) !== String(chatId));
  await writeJson('telegram_users.json', list);
  return list.length < initialLen;
}

export async function getUser(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT * FROM TelegramUsers WHERE ChatId = @chatId', { chatId: { value: String(chatId) } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server getUser failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  return list.find(u => String(u.chatId) === String(chatId)) || null;
}

export async function getAllUsers() {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT * FROM TelegramUsers WHERE Enabled = 1');
      return r.recordset;
    } catch (err) {
      console.warn('⚠️  SQL Server getAllUsers failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  return list.filter(u => u.enabled);
}

export async function updateUserRoutine(chatId, routine) {
  if (!useJsonFallback) {
    try {
      const r = await query("UPDATE TelegramUsers SET Routine = @routine, UpdatedAt = GETDATE() WHERE ChatId = @chatId; SELECT * FROM TelegramUsers WHERE ChatId = @chatId", {
        chatId: { value: String(chatId) },
        routine: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(routine) },
      });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server updateUserRoutine failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  const idx = list.findIndex(u => String(u.chatId) === String(chatId));
  if (idx === -1) throw new Error('Telegram user not registered');
  list[idx].routine = typeof routine === 'string' ? routine : JSON.stringify(routine);
  list[idx].updatedAt = new Date().toISOString();
  await writeJson('telegram_users.json', list);
  return list[idx];
}

export async function toggleUserStatus(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query("UPDATE TelegramUsers SET Enabled = CASE WHEN Enabled = 1 THEN 0 ELSE 1 END, UpdatedAt = GETDATE() WHERE ChatId = @chatId; SELECT * FROM TelegramUsers WHERE ChatId = @chatId", { chatId: { value: String(chatId) } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server toggleUserStatus failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  const idx = list.findIndex(u => String(u.chatId) === String(chatId));
  if (idx === -1) return null;
  list[idx].enabled = !list[idx].enabled;
  list[idx].updatedAt = new Date().toISOString();
  await writeJson('telegram_users.json', list);
  return list[idx];
}

export async function getStats() {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT COUNT(*) AS totalUsers, SUM(CASE WHEN Enabled = 1 THEN 1 ELSE 0 END) AS enabledUsers, SUM(CASE WHEN Enabled = 0 THEN 1 ELSE 0 END) AS disabledUsers FROM TelegramUsers');
      const row = r.recordset[0] || {};
      return { totalUsers: row.totalUsers || 0, enabledUsers: row.enabledUsers || 0, disabledUsers: row.disabledUsers || 0, lastUpdated: new Date().toISOString() };
    } catch (err) {
      console.warn('⚠️  SQL Server getStats failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  const total = list.length;
  const enabled = list.filter(u => u.enabled).length;
  return { totalUsers: total, enabledUsers: enabled, disabledUsers: total - enabled, lastUpdated: new Date().toISOString() };
}

export async function isRegistered(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT COUNT(1) AS cnt FROM TelegramUsers WHERE ChatId = @chatId', { chatId: { value: String(chatId) } });
      return (r.recordset[0]?.cnt || 0) > 0;
    } catch (err) {
      console.warn('⚠️  SQL Server isRegistered failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  return list.some(u => String(u.chatId) === String(chatId));
}

export async function saveAttendanceRecord(chatId, courseCode, attended) {
  if (!useJsonFallback) {
    try {
      const r = await query(`
        MERGE AttendanceRecords AS target
        USING (SELECT @chatId AS ChatId, @course AS CourseCode, CAST(GETDATE() AS DATE) AS RecordDate) AS source
        ON target.ChatId = source.ChatId AND target.CourseCode = source.CourseCode AND target.RecordDate = source.RecordDate
        WHEN MATCHED THEN UPDATE SET Attended = @attended, Timestamp = GETDATE()
        WHEN NOT MATCHED THEN INSERT (ChatId, CourseCode, Attended, RecordDate, Timestamp) VALUES (@chatId, @course, @attended, CAST(GETDATE() AS DATE), GETDATE())
        OUTPUT inserted.*;
      `, { chatId: { value: String(chatId) }, course: { value: courseCode }, attended: { type: sql.Bit, value: attended } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server saveAttendanceRecord failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const today = new Date().toISOString().split('T')[0];
  return saveAttendanceRecordForDate(chatId, courseCode, attended, today);
}

export async function saveAttendanceRecordForDate(chatId, courseCode, attended, recordDate) {
  if (!useJsonFallback) {
    try {
      const r = await query(`
        MERGE AttendanceRecords AS target
        USING (SELECT @chatId AS ChatId, @course AS CourseCode, @recordDate AS RecordDate) AS source
        ON target.ChatId = source.ChatId AND target.CourseCode = source.CourseCode AND target.RecordDate = source.RecordDate
        WHEN MATCHED THEN UPDATE SET Attended = @attended, Timestamp = GETDATE()
        WHEN NOT MATCHED THEN INSERT (ChatId, CourseCode, Attended, RecordDate, Timestamp) VALUES (@chatId, @course, @attended, @recordDate, GETDATE())
        OUTPUT inserted.*;
      `, { 
        chatId: { value: String(chatId) }, 
        course: { value: courseCode }, 
        attended: { type: sql.Bit, value: attended },
        recordDate: { value: recordDate }
      });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server saveAttendanceRecordForDate failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('attendance.json');
  const dateStr = new Date(recordDate).toISOString().split('T')[0];
  const idx = list.findIndex(r => String(r.chatId) === String(chatId) && r.courseCode.toUpperCase() === courseCode.toUpperCase() && r.recordDate === dateStr);
  const entry = {
    id: idx !== -1 ? list[idx].id : Math.random().toString(36).substring(2, 11),
    chatId: String(chatId),
    courseCode: courseCode.toUpperCase(),
    attended: !!attended,
    recordDate: dateStr,
    timestamp: new Date().toISOString()
  };
  if (idx !== -1) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  await writeJson('attendance.json', list);
  return entry;
}

export async function getTodayAttendanceRecord(chatId, courseCode) {
  if (!useJsonFallback) {
    try {
      const r = await query("SELECT * FROM AttendanceRecords WHERE ChatId = @chatId AND CourseCode = @course AND RecordDate = CAST(GETDATE() AS DATE)", { chatId: { value: String(chatId) }, course: { value: courseCode } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server getTodayAttendanceRecord failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('attendance.json');
  const today = new Date().toISOString().split('T')[0];
  return list.find(r => String(r.chatId) === String(chatId) && r.courseCode.toUpperCase() === courseCode.toUpperCase() && r.recordDate === today) || null;
}

export async function getUserAttendanceRecords(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT * FROM AttendanceRecords WHERE ChatId = @chatId ORDER BY RecordDate DESC, Timestamp DESC', { chatId: { value: String(chatId) } });
      return r.recordset;
    } catch (err) {
      console.warn('⚠️  SQL Server getUserAttendanceRecords failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('attendance.json');
  return list.filter(r => String(r.chatId) === String(chatId)).sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate));
}

export async function getAttendanceSummary(chatId, courseCode) {
  if (!useJsonFallback) {
    try {
      const r = await query("SELECT COUNT(1) AS total, SUM(CASE WHEN Attended = 1 THEN 1 ELSE 0 END) AS attended, SUM(CASE WHEN Attended = 0 THEN 1 ELSE 0 END) AS absent FROM AttendanceRecords WHERE ChatId = @chatId AND CourseCode = @course", { chatId: { value: String(chatId) }, course: { value: courseCode } });
      const row = r.recordset[0] || {};
      return { course: courseCode, total: row.total || 0, attended: row.attended || 0, absent: row.absent || 0, percentage: row.total > 0 ? Math.round((row.attended / row.total) * 100) : 0 };
    } catch (err) {
      console.warn('⚠️  SQL Server getAttendanceSummary failed, using JSON database fallback:', err.message);
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('attendance.json');
  const records = list.filter(r => String(r.chatId) === String(chatId) && r.courseCode.toUpperCase() === courseCode.toUpperCase());
  const total = records.length;
  const attended = records.filter(r => r.attended).length;
  return { course: courseCode, total, attended, absent: total - attended, percentage: total > 0 ? Math.round((attended / total) * 100) : 0 };
}
