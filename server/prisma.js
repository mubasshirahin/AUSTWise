/**
 * Prisma client singleton + PostgreSQL-backed data access layer.
 * Falls back to local JSON file-based database when Prisma is unavailable.
 */

import { readJson, writeJson } from './jsonDB.mjs';

// ── Lazy PrismaClient initialization ─────────────────────────────────────────

let _prisma = null;
let _prismaAvailable = false;

function getPrisma() {
  if (!_prismaAvailable) {
    throw new Error('PrismaClient unavailable — driver adapter required for Prisma v7. Use mssql-based DB modules instead.');
  }
  return _prisma;
}

// Build the mssql connection config from the same env vars db.mjs uses, so
// the Prisma driver adapter talks to the same SQL Server database.
function mssqlConfig() {
  const useTrusted = process.env.DB_TRUSTED === 'true';
  const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE || 'AUSTWise',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: true,
    },
  };
  if (useTrusted) {
    config.authentication = { type: 'ntlm', options: { userName: '', password: '', domain: '' } };
  } else {
    config.user = process.env.DB_USER || 'sa';
    config.password = process.env.DB_PASSWORD || '';
  }
  return config;
}

async function initPrisma() {
  try {
    const mod = await import('@prisma/client');
    const { PrismaMssql } = await import('@prisma/adapter-mssql');
    const adapter = new PrismaMssql(mssqlConfig());
    _prisma = new mod.PrismaClient({ adapter });
    // Ping the database so a missing/incorrect connection is caught here
    // (and falls back to JSON below) instead of failing lazily on the first
    // API call.
    await _prisma.$queryRaw`SELECT 1`;
    _prismaAvailable = true;
    console.log('✅ PrismaClient connected (SQL Server via @prisma/adapter-mssql)');
  } catch (e) {
    console.warn('⚠️  PrismaClient unavailable (' + (e?.message || e) + '). DB-backed features disabled, using JSON fallback.');
    _prismaAvailable = false;
    await initJsonDatabase();
  }
}

// Seeding initial database from frontend mock data
async function initJsonDatabase() {
  console.log('ℹ️  Initializing JSON database fallback...');

  // 1. Seed courses
  const courses = await readJson('courses.json');
  if (courses.length === 0) {
    console.log('ℹ️  Seeding courses from src/data/courses.js...');
    try {
      const originalFetch = global.fetch;
      global.fetch = () => new Promise(() => {});
      const coursesData = await import('../src/data/courses.js');
      global.fetch = originalFetch;

      const allCourses = [];
      if (coursesData && coursesData.AUST_COURSES) {
        for (const [dept, list] of Object.entries(coursesData.AUST_COURSES)) {
          for (const c of list) {
            allCourses.push({
              code: c.code,
              name: c.name,
              credit: c.credit || 3.0,
              department: dept
            });
          }
        }
      }
      if (allCourses.length > 0) {
        await writeJson('courses.json', allCourses);
        console.log(`✅ Seeded ${allCourses.length} courses successfully.`);
      }
    } catch (err) {
      console.error('⚠️  Failed to seed courses from src/data/courses.js:', err.message);
    }
  }

  // 2. Seed notices
  const notices = await readJson('notices.json');
  if (notices.length === 0) {
    try {
      const mock = await import('../src/data/mockData.js');
      if (mock && Array.isArray(mock.notices) && mock.notices.length > 0) {
        const list = mock.notices.map((n, index) => ({
          id: n.id || `not-${index}`,
          title: n.title,
          body: n.body || n.content || '',
          postedBy: n.postedBy || 'ADM-MSOP6VG6BVL4',
          postedAt: n.postedAt || new Date().toISOString(),
          pinned: !!n.pinned
        }));
        await writeJson('notices.json', list);
        console.log(`✅ Seeded ${list.length} notices successfully.`);
      }
    } catch (err) {
      console.warn('⚠️  Failed to seed notices:', err.message);
    }
  }

  // 3. Seed clubs
  const clubs = await readJson('clubs.json');
  if (clubs.length === 0) {
    try {
      const mock = await import('../src/data/mockData.js');
      const mockClubs = mock.clubs || mock.clubPortalClubs;
      if (mockClubs && Array.isArray(mockClubs) && mockClubs.length > 0) {
        const list = mockClubs.map((c, index) => ({
          id: c.id?.toString() || `club-${index}`,
          name: c.name,
          description: c.description || '',
          category: c.category || ''
        }));
        await writeJson('clubs.json', list);
        console.log(`✅ Seeded ${list.length} clubs successfully.`);
      }
    } catch (err) {
      console.warn('⚠️  Failed to seed clubs:', err.message);
    }
  }

  // 4. Seed cheatsheets
  const cheatsheets = await readJson('cheatsheets.json');
  if (cheatsheets.length === 0) {
    try {
      const mock = await import('../src/data/mockData.js');
      if (mock && Array.isArray(mock.cheatsheets) && mock.cheatsheets.length > 0) {
        const list = mock.cheatsheets.map((c, index) => ({
          id: c.id?.toString() || `cheat-${index}`,
          title: c.title,
          category: c.category || 'General',
          course: c.course || '',
          formulas: JSON.stringify(c.formulas || []),
          createdAt: new Date().toISOString()
        }));
        await writeJson('cheatsheets.json', list);
        console.log(`✅ Seeded ${list.length} cheatsheets successfully.`);
      }
    } catch (err) {
      console.warn('⚠️  Failed to seed cheatsheets:', err.message);
    }
  }

  // 5. Seed canteen items
  const canteenItems = await readJson('canteen.json');
  if (canteenItems.length === 0) {
    const defaultMenu = [
      { id: 'cant-1', day: 'Sunday', mealType: 'lunch', name: 'Chicken Khichuri', price: 90, available: true },
      { id: 'cant-2', day: 'Sunday', mealType: 'snacks', name: 'Samosa', price: 15, available: true },
      { id: 'cant-3', day: 'Monday', mealType: 'lunch', name: 'Beef Tehari', price: 100, available: true },
      { id: 'cant-4', day: 'Monday', mealType: 'snacks', name: 'Singara', price: 10, available: true },
      { id: 'cant-5', day: 'Tuesday', mealType: 'lunch', name: 'Fish Rice Curry', price: 80, available: true },
      { id: 'cant-6', day: 'Wednesday', mealType: 'lunch', name: 'Chicken Biryani', price: 110, available: true },
      { id: 'cant-7', day: 'Thursday', mealType: 'lunch', name: 'Egg Khichuri', price: 70, available: true }
    ];
    await writeJson('canteen.json', defaultMenu);
    console.log(`✅ Seeded default canteen menu successfully.`);
  }

  // 6. Seed campus locations
  const locations = await readJson('locations.json');
  if (locations.length === 0) {
    try {
      const mock = await import('../src/data/mockData.js');
      if (mock && Array.isArray(mock.campusFloors)) {
        const list = [];
        let autoId = 1;
        for (const floorObj of mock.campusFloors) {
          if (Array.isArray(floorObj.rooms)) {
            for (const r of floorObj.rooms) {
              list.push({
                id: autoId++,
                floor: floorObj.floor,
                roomId: r.id,
                name: r.name,
                type: r.type,
                hotspotData: JSON.stringify(r.hotspot || r.hotspots || {}),
                x: r.x || null,
                y: r.y || null,
                mapImage: floorObj.mapImage || ''
              });
            }
          }
        }
        await writeJson('locations.json', list);
        console.log(`✅ Seeded ${list.length} campus locations successfully.`);
      }
    } catch (err) {
      console.warn('⚠️  Failed to seed campus locations:', err.message);
    }
  }
}

// Kick off initialization but don't block exports
initPrisma().catch(() => {});

export { _prisma as prisma, _prismaAvailable as prismaAvailable };

// ═══════════════════════════════════════════════════════════════════════════════
// Library Occupancy (replaces libraryDB.mjs)
// ═══════════════════════════════════════════════════════════════════════════════

const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 23.7634);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 90.4074);
const LIBRARY_RADIUS_M = Number(process.env.LIBRARY_RADIUS_M || 80);
const LIBRARY_CAPACITY = Number(process.env.LIBRARY_CAPACITY || 350);

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function recordCheckIn(userId, lat, lng) {
  if (!_prismaAvailable) {
    if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng))
      throw new Error('userId, lat and lng are required.');

    const distance = haversineMeters(LIBRARY_LAT, LIBRARY_LNG, lat, lng);
    const inside = distance <= LIBRARY_RADIUS_M;

    let list = await readJson('library_presence.json');
    if (inside) {
      const idx = list.findIndex(c => c.userId === userId);
      const entry = {
        userId,
        lat,
        lng,
        checkedInAt: idx !== -1 ? list[idx].checkedInAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (idx !== -1) {
        list[idx] = entry;
      } else {
        list.push(entry);
      }
    } else {
      list = list.filter(c => c.userId !== userId);
    }

    // Filter check-ins older than 10 mins
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    list = list.filter(c => new Date(c.updatedAt).getTime() >= tenMinAgo);

    await writeJson('library_presence.json', list);
    const occupied = list.length;

    return { inside, distance: Math.round(distance), radius: LIBRARY_RADIUS_M, occupied, capacity: LIBRARY_CAPACITY };
  }

  const p = getPrisma();
  if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng))
    throw new Error('userId, lat and lng are required.');

  const distance = haversineMeters(LIBRARY_LAT, LIBRARY_LNG, lat, lng);
  const inside = distance <= LIBRARY_RADIUS_M;

  if (inside) {
    await p.libraryCheckin.upsert({
      where: { userId },
      create: { userId, lat, lng },
      update: { lat, lng },
    });
  } else {
    await p.libraryCheckin.deleteMany({ where: { userId } });
  }

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  await p.libraryCheckin.deleteMany({ where: { updatedAt: { lt: tenMinAgo } } });

  const occupied = await p.libraryCheckin.count();
  return { inside, distance: Math.round(distance), radius: LIBRARY_RADIUS_M, occupied, capacity: LIBRARY_CAPACITY };
}

export async function recordCheckOut(userId) {
  if (!_prismaAvailable) {
    let list = await readJson('library_presence.json');
    list = list.filter(c => c.userId !== userId);
    await writeJson('library_presence.json', list);
    return { occupied: list.length, capacity: LIBRARY_CAPACITY };
  }

  const p = getPrisma();
  await p.libraryCheckin.deleteMany({ where: { userId } });
  const occupied = await p.libraryCheckin.count();
  return { occupied, capacity: LIBRARY_CAPACITY };
}

export async function getOccupancy() {
  if (!_prismaAvailable) {
    let list = await readJson('library_presence.json');
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    list = list.filter(c => new Date(c.updatedAt).getTime() >= tenMinAgo);
    await writeJson('library_presence.json', list);
    const occupied = list.length;
    return {
      occupied,
      capacity: LIBRARY_CAPACITY,
      occupancyPercent: LIBRARY_CAPACITY > 0 ? Math.round(occupied / LIBRARY_CAPACITY * 100) : 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const p = getPrisma();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  await p.libraryCheckin.deleteMany({ where: { updatedAt: { lt: tenMinAgo } } });
  const occupied = await p.libraryCheckin.count();
  return {
    occupied,
    capacity: LIBRARY_CAPACITY,
    occupancyPercent: LIBRARY_CAPACITY > 0 ? Math.round(occupied / LIBRARY_CAPACITY * 100) : 0,
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Telegram (replaces telegramDB.mjs)
// ═══════════════════════════════════════════════════════════════════════════════

export async function registerTelegramUser(chatId, routine = null) {
  if (!_prismaAvailable) {
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

  const p = getPrisma();
  const user = await p.telegramUser.upsert({
    where: { chatId: String(chatId) },
    create: { chatId: String(chatId), routine, enabled: true },
    update: { routine: routine ?? undefined, enabled: true },
  });
  return user;
}

export async function unregisterTelegramUser(chatId) {
  if (!_prismaAvailable) {
    let list = await readJson('telegram_users.json');
    const initialLen = list.length;
    list = list.filter(u => String(u.chatId) !== String(chatId));
    await writeJson('telegram_users.json', list);
    return list.length < initialLen;
  }

  const p = getPrisma();
  try {
    await p.telegramUser.delete({ where: { chatId: String(chatId) } });
    return true;
  } catch { return false; }
}

export async function getTelegramUser(chatId) {
  if (!_prismaAvailable) {
    const list = await readJson('telegram_users.json');
    return list.find(u => String(u.chatId) === String(chatId)) || null;
  }
  return getPrisma().telegramUser.findUnique({ where: { chatId: String(chatId) } });
}

export async function getAllTelegramUsers() {
  if (!_prismaAvailable) {
    const list = await readJson('telegram_users.json');
    return list.filter(u => u.enabled);
  }
  return getPrisma().telegramUser.findMany({ where: { enabled: true } });
}

export async function updateTelegramUserRoutine(chatId, routine) {
  if (!_prismaAvailable) {
    const list = await readJson('telegram_users.json');
    const idx = list.findIndex(u => String(u.chatId) === String(chatId));
    if (idx === -1) throw new Error('Telegram user not registered');
    list[idx].routine = typeof routine === 'string' ? routine : JSON.stringify(routine);
    list[idx].updatedAt = new Date().toISOString();
    await writeJson('telegram_users.json', list);
    return list[idx];
  }
  return getPrisma().telegramUser.update({
    where: { chatId: String(chatId) },
    data: { routine },
  });
}

export async function toggleTelegramUserStatus(chatId) {
  if (!_prismaAvailable) {
    const list = await readJson('telegram_users.json');
    const idx = list.findIndex(u => String(u.chatId) === String(chatId));
    if (idx === -1) return null;
    list[idx].enabled = !list[idx].enabled;
    list[idx].updatedAt = new Date().toISOString();
    await writeJson('telegram_users.json', list);
    return list[idx];
  }

  const p = getPrisma();
  const user = await p.telegramUser.findUnique({ where: { chatId: String(chatId) } });
  if (!user) return null;
  return p.telegramUser.update({
    where: { chatId: String(chatId) },
    data: { enabled: !user.enabled },
  });
}

export async function getTelegramStats() {
  if (!_prismaAvailable) {
    const list = await readJson('telegram_users.json');
    const total = list.length;
    const enabled = list.filter(u => u.enabled).length;
    return { totalUsers: total, enabledUsers: enabled, disabledUsers: total - enabled, lastUpdated: new Date().toISOString() };
  }

  const p = getPrisma();
  const total = await p.telegramUser.count();
  const enabled = await p.telegramUser.count({ where: { enabled: true } });
  return { totalUsers: total, enabledUsers: enabled, disabledUsers: total - enabled, lastUpdated: new Date().toISOString() };
}

export async function isTelegramRegistered(chatId) {
  if (!_prismaAvailable) {
    const list = await readJson('telegram_users.json');
    return list.some(u => String(u.chatId) === String(chatId));
  }
  const count = await getPrisma().telegramUser.count({ where: { chatId: String(chatId) } });
  return count > 0;
}

export async function saveAttendanceRecord(chatId, courseCode, attended) {
  if (!_prismaAvailable) {
    const today = new Date().toISOString().split('T')[0];
    return saveAttendanceRecordForDate(chatId, courseCode, attended, today);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getPrisma().telegramAttendance.upsert({
    where: { chatId_courseCode_recordDate: { chatId: String(chatId), courseCode, recordDate: today } },
    create: { chatId: String(chatId), courseCode, attended, recordDate: today },
    update: { attended },
  });
}

export async function saveAttendanceRecordForDate(chatId, courseCode, attended, recordDate) {
  if (!_prismaAvailable) {
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

  return getPrisma().telegramAttendance.upsert({
    where: { chatId_courseCode_recordDate: { chatId: String(chatId), courseCode, recordDate: new Date(recordDate) } },
    create: { chatId: String(chatId), courseCode, attended, recordDate: new Date(recordDate) },
    update: { attended },
  });
}

export async function getTodayAttendanceRecord(chatId, courseCode) {
  if (!_prismaAvailable) {
    const list = await readJson('attendance.json');
    const today = new Date().toISOString().split('T')[0];
    return list.find(r => String(r.chatId) === String(chatId) && r.courseCode.toUpperCase() === courseCode.toUpperCase() && r.recordDate === today) || null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getPrisma().telegramAttendance.findUnique({
    where: { chatId_courseCode_recordDate: { chatId: String(chatId), courseCode, recordDate: today } },
  });
}

export async function getUserAttendanceRecords(chatId) {
  if (!_prismaAvailable) {
    const list = await readJson('attendance.json');
    return list.filter(r => String(r.chatId) === String(chatId)).sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate));
  }

  return getPrisma().telegramAttendance.findMany({
    where: { chatId: String(chatId) },
    orderBy: { recordDate: 'desc' },
  });
}

export async function getAttendanceSummary(chatId, courseCode) {
  if (!_prismaAvailable) {
    const list = await readJson('attendance.json');
    const records = list.filter(r => String(r.chatId) === String(chatId) && r.courseCode.toUpperCase() === courseCode.toUpperCase());
    const total = records.length;
    const attended = records.filter(r => r.attended).length;
    return {
      course: courseCode,
      total,
      attended,
      absent: total - attended,
      percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
    };
  }

  const p = getPrisma();
  const records = await p.telegramAttendance.findMany({
    where: { chatId: String(chatId), courseCode },
    select: { attended: true },
  });
  const total = records.length;
  const attended = records.filter(r => r.attended).length;
  return {
    course: courseCode,
    total,
    attended,
    absent: total - attended,
    percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Marketplace (replaces localStorage marketplaceStorage.js)
// ═══════════════════════════════════════════════════════════════════════════════

export async function listMarketplace(type) {
  if (!_prismaAvailable) {
    const list = await readJson('marketplace.json');
    return list.filter(l => l.listType === type).sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }

  return getPrisma().marketplaceListing.findMany({
    where: { listType: type },
    orderBy: { postedAt: 'desc' },
  });
}

export async function addMarketplaceListing(payload) {
  if (!_prismaAvailable) {
    const list = await readJson('marketplace.json');
    const item = {
      id: Math.random().toString(36).substring(2, 11),
      contributorId: payload.contributorId,
      listType: payload.listType,
      title: payload.title,
      price: Number(payload.price || 0),
      condition: payload.condition || '',
      category: payload.category || '',
      image: payload.image || '',
      seller: payload.seller || '',
      contact: payload.contact || '',
      location: payload.location || '',
      rent: Number(payload.rent || 0),
      type: payload.type || '',
      amenities: typeof payload.amenities === 'string' ? payload.amenities : JSON.stringify(payload.amenities || []),
      available: payload.available !== false,
      owner: payload.owner || '',
      description: payload.description || '',
      environment: payload.environment || '',
      utilities: payload.utilities || '',
      status: payload.status || 'open',
      reporter: payload.reporter || '',
      postedAt: new Date().toISOString()
    };
    list.push(item);
    await writeJson('marketplace.json', list);
    return item;
  }

  return getPrisma().marketplaceListing.create({ data: payload });
}

export async function deleteMarketplaceListing(id, userId, isAdmin) {
  if (!_prismaAvailable) {
    let list = await readJson('marketplace.json');
    const idx = list.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Not found');
    if (!isAdmin && list[idx].contributorId !== userId) throw new Error('Forbidden');
    list.splice(idx, 1);
    await writeJson('marketplace.json', list);
    return true;
  }

  const p = getPrisma();
  const item = await p.marketplaceListing.findUnique({ where: { id } });
  if (!item) throw new Error('Not found');
  if (!isAdmin && item.contributorId !== userId) throw new Error('Forbidden');
  return p.marketplaceListing.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Messages (replaces localStorage messageStorage.js)
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveMessage(data) {
  if (!_prismaAvailable) {
    const list = await readJson('messages.json');
    const message = {
      id: Math.random().toString(36).substring(2, 11),
      conversationId: data.conversationId,
      fromId: data.fromId,
      toId: data.toId,
      text: data.text,
      timestamp: new Date().toISOString(),
      read: false,
      deleted: false,
      edited: false,
      editedAt: null,
      replyTo: typeof data.replyTo === 'string' ? data.replyTo : JSON.stringify(data.replyTo || null)
    };
    list.push(message);
    await writeJson('messages.json', list);
    return message;
  }

  return getPrisma().message.create({ data });
}

export async function getConversations(userId) {
  if (!_prismaAvailable) {
    const messages = await readJson('messages.json');
    const users = await readJson('users.json');

    const userMessages = messages.filter(m => (m.fromId === userId || m.toId === userId) && !m.deleted);

    return userMessages.map(m => {
      const sender = users.find(u => u.id === m.fromId) || { id: m.fromId, name: 'Unknown User', department: '', role: 'student' };
      const receiver = users.find(u => u.id === m.toId) || { id: m.toId, name: 'Unknown User', department: '', role: 'student' };
      return {
        ...m,
        sender: { id: sender.id, name: sender.name, department: sender.department, role: sender.role },
        receiver: { id: receiver.id, name: receiver.name, department: receiver.department, role: receiver.role }
      };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  const p = getPrisma();
  const messages = await p.message.findMany({
    where: {
      OR: [{ fromId: userId }, { toId: userId }],
      deleted: false,
    },
    orderBy: { timestamp: 'desc' },
    include: { sender: { select: { id: true, name: true, department: true, role: true } }, receiver: { select: { id: true, name: true, department: true, role: true } } },
  });
  return messages;
}

export async function getThread(userId, peerId) {
  if (!_prismaAvailable) {
    const messages = await readJson('messages.json');
    const reactions = await readJson('reactions.json');
    const convId = [userId, peerId].sort().join('|');
    const thread = messages.filter(m => m.conversationId === convId);

    return thread.map(m => {
      const messageReactions = reactions.filter(r => r.messageId === m.id);
      return { ...m, reactions: messageReactions };
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  const convId = [userId, peerId].sort().join('|');
  return getPrisma().message.findMany({
    where: { conversationId: convId },
    orderBy: { timestamp: 'asc' },
    include: { reactions: true },
  });
}

export async function deleteMessageById(messageId) {
  if (!_prismaAvailable) {
    const list = await readJson('messages.json');
    const idx = list.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      list[idx].deleted = true;
      list[idx].text = '';
      list[idx].edited = false;
      await writeJson('messages.json', list);
      return list[idx];
    }
    throw new Error('Message not found');
  }

  return getPrisma().message.update({
    where: { id: messageId },
    data: { deleted: true, text: '', edited: false },
  });
}

export async function editMessageById(messageId, text) {
  if (!_prismaAvailable) {
    const list = await readJson('messages.json');
    const idx = list.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      list[idx].text = text;
      list[idx].edited = true;
      list[idx].editedAt = new Date().toISOString();
      await writeJson('messages.json', list);
      return list[idx];
    }
    throw new Error('Message not found');
  }

  return getPrisma().message.update({
    where: { id: messageId },
    data: { text, edited: true, editedAt: new Date() },
  });
}

export async function addReaction(messageId, userId, emoji) {
  if (!_prismaAvailable) {
    const list = await readJson('reactions.json');
    const idx = list.findIndex(r => r.messageId === messageId && r.userId === userId && r.emoji === emoji);
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      list.push({
        id: Math.random().toString(36).substring(2, 11),
        messageId,
        userId,
        emoji
      });
    }
    await writeJson('reactions.json', list);
    return list.filter(r => r.messageId === messageId);
  }

  const p = getPrisma();
  try {
    await p.messageReaction.create({ data: { messageId, userId, emoji } });
  } catch {
    await p.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
  }
  return p.messageReaction.findMany({ where: { messageId } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Grades (replaces localStorage semester results)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getSemesterResults(userId) {
  if (!_prismaAvailable) {
    const list = await readJson('grades.json');
    return list.filter(g => g.userId === userId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  return getPrisma().semesterResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function saveSemesterResult(userId, data) {
  if (!_prismaAvailable) {
    const list = await readJson('grades.json');
    const idx = list.findIndex(g => g.userId === userId && g.semester === data.semester);
    const result = {
      id: idx !== -1 ? list[idx].id : Math.random().toString(36).substring(2, 11),
      userId,
      semester: data.semester,
      courses: typeof data.courses === 'string' ? data.courses : JSON.stringify(data.courses || []),
      cgpa: Number(data.cgpa || 0),
      createdAt: idx !== -1 ? list[idx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (idx !== -1) {
      list[idx] = result;
    } else {
      list.push(result);
    }
    await writeJson('grades.json', list);
    return result;
  }

  return getPrisma().semesterResult.upsert({
    where: { userId_semester: { userId, semester: data.semester } },
    create: { userId, semester: data.semester, courses: data.courses, cgpa: data.cgpa || 0 },
    update: { courses: data.courses, cgpa: data.cgpa || 0 },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Notices
// ═══════════════════════════════════════════════════════════════════════════════

export async function listNotices() {
  if (!_prismaAvailable) {
    const list = await readJson('notices.json');
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.postedAt) - new Date(a.postedAt);
    });
  }

  return getPrisma().notice.findMany({ orderBy: [{ pinned: 'desc' }, { postedAt: 'desc' }] });
}

export async function createNotice(data) {
  if (!_prismaAvailable) {
    const list = await readJson('notices.json');
    const notice = {
      id: Math.random().toString(36).substring(2, 11),
      title: data.title,
      body: data.body,
      postedBy: data.postedBy,
      postedAt: new Date().toISOString(),
      expiresAt: data.expiresAt || null,
      pinned: !!data.pinned
    };
    list.push(notice);
    await writeJson('notices.json', list);
    return notice;
  }

  return getPrisma().notice.create({ data });
}

export async function deleteNotice(id) {
  if (!_prismaAvailable) {
    let list = await readJson('notices.json');
    list = list.filter(n => n.id !== id);
    await writeJson('notices.json', list);
    return true;
  }

  return getPrisma().notice.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canteen
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCanteenMenu() {
  if (!_prismaAvailable) {
    return readJson('canteen.json');
  }

  return getPrisma().canteenMenuItem.findMany({ orderBy: { name: 'asc' } });
}

export async function upsertCanteenItem(data) {
  if (!_prismaAvailable) {
    const list = await readJson('canteen.json');
    const item = {
      id: data.id || Math.random().toString(36).substring(2, 11),
      day: data.day,
      mealType: data.mealType,
      name: data.name,
      price: Number(data.price || 0),
      available: data.available !== false
    };
    const idx = list.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    await writeJson('canteen.json', list);
    return item;
  }

  return getPrisma().canteenMenuItem.create({ data });
}

export async function deleteCanteenItem(id) {
  if (!_prismaAvailable) {
    let list = await readJson('canteen.json');
    list = list.filter(i => i.id !== id);
    await writeJson('canteen.json', list);
    return true;
  }

  return getPrisma().canteenMenuItem.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Clubs
// ═══════════════════════════════════════════════════════════════════════════════

export async function listClubs() {
  if (!_prismaAvailable) {
    const clubs = await readJson('clubs.json');
    const memberships = await readJson('clubMemberships.json');
    const users = await readJson('users.json');
    return clubs.map(club => {
      const clubMembers = memberships
        .filter(m => m.clubId === club.id)
        .map(m => {
          const user = users.find(u => u.id === m.userId) || { id: m.userId, name: 'Unknown User', department: '' };
          return {
            id: m.id,
            clubId: m.clubId,
            userId: m.userId,
            role: m.role,
            user: {
              id: user.id,
              name: user.name,
              department: user.department
            }
          };
        });
      return { ...club, members: clubMembers };
    });
  }

  return getPrisma().club.findMany({ include: { members: { include: { user: { select: { id: true, name: true, department: true } } } } } });
}

export async function joinClub(clubId, userId, role = 'member') {
  if (!_prismaAvailable) {
    const list = await readJson('clubMemberships.json');
    const existing = list.find(m => m.clubId === clubId && m.userId === userId);
    if (existing) return existing;
    const membership = {
      id: Math.random().toString(36).substring(2, 11),
      clubId,
      userId,
      role
    };
    list.push(membership);
    await writeJson('clubMemberships.json', list);
    return membership;
  }

  return getPrisma().clubMembership.create({ data: { clubId, userId, role } });
}

export async function leaveClub(clubId, userId) {
  if (!_prismaAvailable) {
    let list = await readJson('clubMemberships.json');
    list = list.filter(m => !(m.clubId === clubId && m.userId === userId));
    await writeJson('clubMemberships.json', list);
    return true;
  }

  return getPrisma().clubMembership.deleteMany({ where: { clubId, userId } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cheatsheets
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCheatsheets() {
  if (!_prismaAvailable) {
    return readJson('cheatsheets.json');
  }

  return getPrisma().cheatsheet.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createCheatsheet(data) {
  if (!_prismaAvailable) {
    const list = await readJson('cheatsheets.json');
    const sheet = {
      id: Math.random().toString(36).substring(2, 11),
      title: data.title,
      category: data.category || 'General',
      course: data.course || '',
      formulas: typeof data.formulas === 'string' ? data.formulas : JSON.stringify(data.formulas || []),
      contributorId: data.contributorId || null,
      createdAt: new Date().toISOString()
    };
    list.push(sheet);
    await writeJson('cheatsheets.json', list);
    return sheet;
  }

  return getPrisma().cheatsheet.create({ data });
}

export async function deleteCheatsheet(id) {
  if (!_prismaAvailable) {
    let list = await readJson('cheatsheets.json');
    list = list.filter(c => c.id !== id);
    await writeJson('cheatsheets.json', list);
    return true;
  }

  return getPrisma().cheatsheet.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Campus Locations
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCampusLocations() {
  if (!_prismaAvailable) {
    return readJson('locations.json');
  }

  return getPrisma().campusLocation.findMany({ orderBy: [{ floor: 'asc' }, { roomId: 'asc' }] });
}

export async function upsertCampusLocation(data) {
  if (!_prismaAvailable) {
    const list = await readJson('locations.json');
    const item = {
      id: data.id || (list.length > 0 ? Math.max(...list.map(l => l.id)) + 1 : 1),
      floor: data.floor,
      roomId: data.roomId,
      name: data.name,
      type: data.type,
      hotspotData: typeof data.hotspotData === 'string' ? data.hotspotData : JSON.stringify(data.hotspotData || {}),
      x: data.x || null,
      y: data.y || null,
      mapImage: data.mapImage || ''
    };
    const idx = list.findIndex(l => l.floor === data.floor && l.roomId === data.roomId);
    if (idx !== -1) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    await writeJson('locations.json', list);
    return item;
  }

  const p = getPrisma();
  const existing = await p.campusLocation.findFirst({
    where: { floor: data.floor, roomId: data.roomId },
  });
  if (existing) {
    return p.campusLocation.update({ where: { id: existing.id }, data });
  }
  return p.campusLocation.create({ data });
}

export async function deleteCampusLocation(id) {
  if (!_prismaAvailable) {
    let list = await readJson('locations.json');
    list = list.filter(l => l.id !== Number(id));
    await writeJson('locations.json', list);
    return true;
  }

  return getPrisma().campusLocation.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Courses
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCourses(department) {
  if (!_prismaAvailable) {
    const list = await readJson('courses.json');
    return department ? list.filter(c => c.department?.toUpperCase() === department.toUpperCase()) : list;
  }

  const where = department ? { department } : {};
  return getPrisma().course.findMany({ where, orderBy: { code: 'asc' } });
}

export async function upsertCourse(data) {
  if (!_prismaAvailable) {
    const list = await readJson('courses.json');
    const idx = list.findIndex(c => c.code.toUpperCase() === data.code.toUpperCase());
    const course = {
      code: data.code,
      name: data.name,
      credit: Number(data.credit || 0),
      department: data.department || ''
    };
    if (idx !== -1) {
      list[idx] = course;
    } else {
      list.push(course);
    }
    await writeJson('courses.json', list);
    return course;
  }

  return getPrisma().course.upsert({
    where: { code: data.code },
    create: data,
    update: { name: data.name, credit: data.credit, department: data.department },
  });
}

export async function deleteCourse(code) {
  if (!_prismaAvailable) {
    let list = await readJson('courses.json');
    const initialLen = list.length;
    list = list.filter(c => c.code.toUpperCase() !== code.toUpperCase());
    if (list.length === initialLen) throw new Error('Course not found');
    await writeJson('courses.json', list);
    return true;
  }

  return getPrisma().course.delete({ where: { code } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Routines (CRs publish their class routine for everyone to load)
// ═══════════════════════════════════════════════════════════════════════════════

// AUST CR capacity: 8 depts (CSE, EEE, CE, ME, IPE, TE, ARCH, BBA)
// × 8 semesters × 4 sections (A-D) × 2 lab groups = 512 CR slots.
export const SHARED_ROUTINE_TOTAL_SLOTS = 512;

export function sharedRoutineSlotKey(record) {
  return `${record.department || ''}|${record.yearSemester || ''}|${record.section || ''}|${record.labSection || ''}`;
}

export async function listSharedRoutines() {
  if (!_prismaAvailable) {
    const list = await readJson('shared_routines.json');
    return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  return getPrisma().sharedRoutine.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function getSharedRoutineBySlot(slot) {
  if (!_prismaAvailable) {
    const list = await readJson('shared_routines.json');
    return list.find(r => sharedRoutineSlotKey(r) === sharedRoutineSlotKey(slot)) || null;
  }

  return getPrisma().sharedRoutine.findFirst({
    where: {
      department: slot.department,
      yearSemester: slot.yearSemester,
      section: slot.section,
      labSection: slot.labSection,
    },
  });
}

// Publishing a routine replaces any existing routine for the same CR slot.
export async function upsertSharedRoutine(data) {
  const record = {
    id: data.id || null,
    crId: data.crId || '',
    crName: data.crName || '',
    department: data.department || '',
    yearSemester: data.yearSemester || '',
    section: data.section || '',
    labSection: data.labSection || '',
    routine: typeof data.routine === 'string' ? data.routine : JSON.stringify(data.routine || {}),
    weekDays: typeof data.weekDays === 'string' ? data.weekDays : JSON.stringify(data.weekDays || []),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!_prismaAvailable) {
    const list = await readJson('shared_routines.json');
    const idx = list.findIndex(r => sharedRoutineSlotKey(r) === sharedRoutineSlotKey(record));
    if (idx !== -1) {
      record.id = list[idx].id;
      record.createdAt = list[idx].createdAt;
      list[idx] = record;
    } else {
      record.id = Math.random().toString(36).substring(2, 11);
      list.push(record);
    }
    await writeJson('shared_routines.json', list);
    return record;
  }

  const p = getPrisma();
  const existing = await p.sharedRoutine.findFirst({
    where: {
      department: record.department,
      yearSemester: record.yearSemester,
      section: record.section,
      labSection: record.labSection,
    },
  });
  if (existing) {
    return p.sharedRoutine.update({
      where: { id: existing.id },
      data: { crId: record.crId, crName: record.crName, routine: record.routine, weekDays: record.weekDays },
    });
  }
  return p.sharedRoutine.create({ data: record });
}

export async function deleteSharedRoutineBySlot(slot) {
  if (!_prismaAvailable) {
    let list = await readJson('shared_routines.json');
    const initialLen = list.length;
    list = list.filter(r => sharedRoutineSlotKey(r) !== sharedRoutineSlotKey(slot));
    await writeJson('shared_routines.json', list);
    return list.length < initialLen;
  }

  const p = getPrisma();
  const deleted = await p.sharedRoutine.deleteMany({
    where: {
      department: slot.department,
      yearSemester: slot.yearSemester,
      section: slot.section,
      labSection: slot.labSection,
    },
  });
  return deleted.count > 0;
}

export async function getSharedRoutineStats() {
  // The total isn't hardcoded — count what the user matrix actually defines:
  // one CR slot per (dept × semester × section × lab group). Dev seed creates
  // 8 depts × 8 sems × 4 sections × 2 lab groups = 512 CRs, so the counter stays
  // correct if the section/lab matrix ever changes again.
  const list = await listSharedRoutines();
  let total = SHARED_ROUTINE_TOTAL_SLOTS;
  try {
    const { countCrSlots } = await import('./userStore.mjs');
    total = await countCrSlots();
  } catch { /* keep static fallback if userStore can't be loaded */ }
  return { shared: list.length, total };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Room / Lab Availability (Free Rooms)
//
// Availability is *derived* from the routines CRs have published. Each shared
// routine's JSON is keyed by day and each class carries { course, name, room,
// teacher, time }. We flatten every (roomId, day, time, course, teacher) into
// bookings, then compute which rooms are busy for a given day + time.
// ═══════════════════════════════════════════════════════════════════════════════

// Normalize a class time string like "08:00 - 08:50" into { start: '08:00', end: '08:50' }
export function parseClassTime(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  const pad = (s) => s.length === 4 ? `0${s}` : s;
  return { start: pad(m[1]), end: pad(m[2]) };
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

// Flatten every shared routine into room bookings.
// Returns [{ roomId, day, time, course, courseName, teacher, dept, semester, section }]
export async function listRoomBookings() {
  const routines = await listSharedRoutines();
  const bookings = [];
  for (const r of routines) {
    const routine = typeof r.routine === 'string' ? safeJson(r.routine, {}) : (r.routine || {});
    for (const day of Object.keys(routine)) {
      const classes = routine[day];
      if (!Array.isArray(classes)) continue;
      for (const cls of classes) {
        const roomId = cls.room || cls.roomId || '';
        if (!roomId) continue;
        const t = parseClassTime(cls.time);
        if (!t) continue;
        bookings.push({
          roomId: String(roomId).trim(),
          day,
          start: t.start,
          end: t.end,
          time: `${t.start} - ${t.end}`,
          course: cls.course || '',
          courseName: cls.name || '',
          teacher: cls.teacher || '',
          dept: r.department || '',
          semester: r.yearSemester || '',
          section: r.section || '',
          labSection: r.labSection || '',
        });
      }
    }
  }
  return bookings;
}

// Which bookings are active for a given day + time? ('' time = treat as busy)
export function activeRoomBookings(bookings, day, time) {
  if (!day || !time) return bookings;
  return bookings.filter((b) => {
    if (b.day !== day) return false;
    return timeOverlaps(b.start, b.end, time, time);
  });
}

// Given the room catalog + bookings + a day/time, build the same shape the
// client already consumes: floors[].rooms[] with status + details.
export function computeRoomAvailabilityServer(roomCatalog, bookings, day, time) {
  const active = activeRoomBookings(bookings, day, time);
  return roomCatalog.floors.map((floor) => ({
    ...floor,
    rooms: floor.rooms.map((room) => {
      const b = active.find((bk) => bk.roomId === room.id);
      if (!b) return { ...room, status: 'free', details: null };
      return {
        ...room,
        status: 'busy',
        details: {
          dept: b.dept,
          semester: b.semester,
          section: b.section ? `${b.section}${b.labSection ? `-${b.labSection}` : ''}` : (b.labSection || ''),
          course: b.course,
          courseName: b.courseName,
          teacher: b.teacher,
          time: b.time,
        },
      };
    }),
  }));
}

function safeJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// Room catalog (mirrors src/data/mockData.js roomCatalog so the server can
// compute availability without importing browser code).
function makeBlockRooms(prefix) {
  const rooms = [];
  for (let n = 3; n <= 7; n += 1) rooms.push({ id: `${prefix}A0${n}`, name: `Room ${prefix}A0${n}`, type: 'classroom' });
  for (let n = 1; n <= 8; n += 1) rooms.push({ id: `${prefix}B0${n}`, name: `Lab ${prefix}B0${n}`, type: 'lab' });
  for (let n = 3; n <= 7; n += 1) rooms.push({ id: `${prefix}C0${n}`, name: `Room ${prefix}C0${n}`, type: 'classroom' });
  return rooms;
}

export const serverRoomCatalog = {
  building: 'Campus Floors',
  floors: [
    { id: 'ground', label: 'Ground Floor', rooms: [
      { id: 'CANTEEN', name: 'Canteen', type: 'canteen' },
      { id: 'MHA', name: 'M.H Khan Auditorium', type: 'auditorium' },
    ]},
    { id: '1st', label: '1st Floor', rooms: makeBlockRooms('1') },
    { id: '2nd', label: '2nd Floor', rooms: makeBlockRooms('2') },
    { id: '3rd', label: '3rd Floor', rooms: makeBlockRooms('3') },
    { id: '4th', label: '4th Floor', rooms: makeBlockRooms('4') },
    { id: '5th', label: '5th Floor', rooms: makeBlockRooms('5') },
    { id: '6th', label: '6th Floor', rooms: makeBlockRooms('6') },
    { id: '7th', label: '7th Floor', rooms: makeBlockRooms('7') },
    { id: 'fm', label: 'FM Lab (Basement)', rooms: [
      { id: 'FM-01', name: 'FM Lab', type: 'lab' },
    ]},
  ],
};
