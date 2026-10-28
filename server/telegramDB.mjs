import { query, sql } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';

let useJsonFallback = !(process.env.DATABASE_URL || process.env.DB_PASSWORD);

export async function registerUser(chatId, routine = null, awid = null) {
  const r = routine ? JSON.stringify(routine) : null;

  if (!useJsonFallback) {
    try {
      const result = await query(`
        INSERT INTO "TelegramUsers" ("ChatId", "Awid", "Routine", "Enabled", "CreatedAt", "UpdatedAt")
        VALUES (@chatId, @awid, @routine, TRUE, NOW(), NOW())
        ON CONFLICT ("ChatId") DO UPDATE SET
          "Awid" = EXCLUDED."Awid",
          "Routine" = COALESCE(EXCLUDED."Routine", "TelegramUsers"."Routine"),
          "Enabled" = TRUE,
          "UpdatedAt" = NOW()
        RETURNING *;
      `, {
        chatId: { value: String(chatId) },
        awid: { value: awid ? String(awid) : null },
        routine: { type: sql.NVarChar(sql.MAX), value: r },
      });
      return result.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server registerUser failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  const idx = list.findIndex(u => String(u.chatId) === String(chatId));
  const user = {
    chatId: String(chatId),
    awid: awid ? String(awid) : (idx !== -1 ? list[idx].awid : null),
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

export async function getUserByAwid(awid) {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT * FROM "TelegramUsers" WHERE "Awid" = @awid ORDER BY "UpdatedAt" DESC', { awid: { value: String(awid) } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server getUserByAwid failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  const list = await readJson('telegram_users.json');
  return list.find(u => u.awid && String(u.awid) === String(awid)) || null;
}

export async function unregisterByAwid(awid) {
  if (!useJsonFallback) {
    try {
      const r = await query('DELETE FROM "TelegramUsers" WHERE "Awid" = @awid', { awid: { value: String(awid) } });
      return (r.rowsAffected && r.rowsAffected[0] > 0) || r.rowCount > 0;
    } catch (err) {
      console.warn('⚠️  SQL Server unregisterByAwid failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
      useJsonFallback = true;
    }
  }

  // JSON Fallback
  let list = await readJson('telegram_users.json');
  const initialLen = list.length;
  list = list.filter(u => !u.awid || String(u.awid) !== String(awid));
  await writeJson('telegram_users.json', list);
  return list.length < initialLen;
}

export async function unregisterUser(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query('DELETE FROM "TelegramUsers" WHERE "ChatId" = @chatId', { chatId: { value: String(chatId) } });
      return r.rowsAffected[0] > 0;
    } catch (err) {
      console.warn('⚠️  SQL Server unregisterUser failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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

export async function unregisterAllUsers() {
  if (!useJsonFallback) {
    try {
      const result = await query('DELETE FROM "TelegramUsers"');
      return result.rowCount ?? result.rowsAffected?.[0] ?? 0;
    } catch (err) {
      console.warn('⚠️  SQL Server unregisterAllUsers failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
      useJsonFallback = true;
    }
  }

  const list = await readJson('telegram_users.json');
  await writeJson('telegram_users.json', []);
  return list.length;
}

export async function getUser(chatId) {
  if (!useJsonFallback) {
    try {
      const r = await query('SELECT * FROM "TelegramUsers" WHERE "ChatId" = @chatId', { chatId: { value: String(chatId) } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server getUser failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query('SELECT * FROM "TelegramUsers" WHERE "Enabled" = TRUE');
      return r.recordset;
    } catch (err) {
      console.warn('⚠️  SQL Server getAllUsers failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query("UPDATE \"TelegramUsers\" SET \"Routine\" = @routine, \"UpdatedAt\" = NOW() WHERE \"ChatId\" = @chatId RETURNING *", {
        chatId: { value: String(chatId) },
        routine: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(routine) },
      });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server updateUserRoutine failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query("UPDATE \"TelegramUsers\" SET \"Enabled\" = NOT \"Enabled\", \"UpdatedAt\" = NOW() WHERE \"ChatId\" = @chatId RETURNING *", { chatId: { value: String(chatId) } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server toggleUserStatus failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query('SELECT COUNT(*)::int AS totalUsers, COUNT(*) FILTER (WHERE "Enabled")::int AS enabledUsers, COUNT(*) FILTER (WHERE NOT "Enabled")::int AS disabledUsers FROM "TelegramUsers"');
      const row = r.recordset[0] || {};
      return { totalUsers: row.totalUsers || 0, enabledUsers: row.enabledUsers || 0, disabledUsers: row.disabledUsers || 0, lastUpdated: new Date().toISOString() };
    } catch (err) {
      console.warn('⚠️  SQL Server getStats failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query('SELECT COUNT(1)::int AS cnt FROM "TelegramUsers" WHERE "ChatId" = @chatId', { chatId: { value: String(chatId) } });
      return (r.recordset[0]?.cnt || 0) > 0;
    } catch (err) {
      console.warn('⚠️  SQL Server isRegistered failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
        INSERT INTO "AttendanceRecords" ("ChatId", "CourseCode", "Attended", "RecordDate", "Timestamp")
        VALUES (@chatId, @course, @attended, CURRENT_DATE, NOW())
        ON CONFLICT ("ChatId", "CourseCode", "RecordDate") DO UPDATE SET
          "Attended" = EXCLUDED."Attended",
          "Timestamp" = NOW()
        RETURNING *;
      `, { chatId: { value: String(chatId) }, course: { value: courseCode }, attended: { type: sql.Bit, value: attended } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server saveAttendanceRecord failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
        INSERT INTO "AttendanceRecords" ("ChatId", "CourseCode", "Attended", "RecordDate", "Timestamp")
        VALUES (@chatId, @course, @attended, @recordDate::date, NOW())
        ON CONFLICT ("ChatId", "CourseCode", "RecordDate") DO UPDATE SET
          "Attended" = EXCLUDED."Attended",
          "Timestamp" = NOW()
        RETURNING *;
      `, {
        chatId: { value: String(chatId) },
        course: { value: courseCode },
        attended: { type: sql.Bit, value: attended },
        recordDate: { value: recordDate },
      });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server saveAttendanceRecordForDate failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query("SELECT * FROM \"AttendanceRecords\" WHERE \"ChatId\" = @chatId AND \"CourseCode\" = @course AND \"RecordDate\" = CURRENT_DATE", { chatId: { value: String(chatId) }, course: { value: courseCode } });
      return r.recordset[0] || null;
    } catch (err) {
      console.warn('⚠️  SQL Server getTodayAttendanceRecord failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query('SELECT * FROM "AttendanceRecords" WHERE "ChatId" = @chatId ORDER BY "RecordDate" DESC, "Timestamp" DESC', { chatId: { value: String(chatId) } });
      return r.recordset;
    } catch (err) {
      console.warn('⚠️  SQL Server getUserAttendanceRecords failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
      const r = await query("SELECT COUNT(1)::int AS total, COUNT(*) FILTER (WHERE \"Attended\")::int AS attended, COUNT(*) FILTER (WHERE NOT \"Attended\")::int AS absent FROM \"AttendanceRecords\" WHERE \"ChatId\" = @chatId AND \"CourseCode\" = @course", { chatId: { value: String(chatId) }, course: { value: courseCode } });
      const row = r.recordset[0] || {};
      return { course: courseCode, total: row.total || 0, attended: row.attended || 0, absent: row.absent || 0, percentage: row.total > 0 ? Math.round((row.attended / row.total) * 100) : 0 };
    } catch (err) {
      console.warn('⚠️  SQL Server getAttendanceSummary failed, using JSON database fallback:', err.message);
      if (process.env.DATABASE_URL || process.env.DB_PASSWORD) throw err;
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
