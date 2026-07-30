/**
 * Prisma client singleton + PostgreSQL-backed data access layer.
 *
 * Replaces:
 *   server/telegramDB.mjs  (SQL Server → PostgreSQL)
 *   server/libraryDB.mjs   (SQL Server → PostgreSQL)
 *   server/userStore.mjs   (file-based → PostgreSQL)
 *
 * Usage:
 *   import { prisma, getOccupancy, recordCheckIn, ... } from './prisma.js';
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || 'sqlserver://localhost:1433;database=austwise;integratedSecurity=true;encrypt=true;trustServerCertificate=true',
});

export { prisma };

// ═══════════════════════════════════════════════════════════════════════════════
// Library Occupancy (replaces libraryDB.mjs)
// ═══════════════════════════════════════════════════════════════════════════════

const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 23.7634);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 90.4074);
const LIBRARY_RADIUS_M = Number(process.env.LIBRARY_RADIUS_M || 80);
const LIBRARY_CAPACITY = Number(process.env.LIBRARY_CAPACITY || 120);

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function recordCheckIn(userId, lat, lng) {
  if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng))
    throw new Error('userId, lat and lng are required.');

  const distance = haversineMeters(LIBRARY_LAT, LIBRARY_LNG, lat, lng);
  const inside = distance <= LIBRARY_RADIUS_M;

  if (inside) {
    await prisma.libraryCheckin.upsert({
      where: { userId },
      create: { userId, lat, lng },
      update: { lat, lng },
    });
  } else {
    await prisma.libraryCheckin.deleteMany({ where: { userId } });
  }

  // Expire stale checkins (>10 min)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.libraryCheckin.deleteMany({ where: { updatedAt: { lt: tenMinAgo } } });

  const occupied = await prisma.libraryCheckin.count();
  return { inside, distance: Math.round(distance), radius: LIBRARY_RADIUS_M, occupied, capacity: LIBRARY_CAPACITY };
}

export async function recordCheckOut(userId) {
  await prisma.libraryCheckin.deleteMany({ where: { userId } });
  const occupied = await prisma.libraryCheckin.count();
  return { occupied, capacity: LIBRARY_CAPACITY };
}

export async function getOccupancy() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.libraryCheckin.deleteMany({ where: { updatedAt: { lt: tenMinAgo } } });
  const occupied = await prisma.libraryCheckin.count();
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
  const user = await prisma.telegramUser.upsert({
    where: { chatId: String(chatId) },
    create: { chatId: String(chatId), routine, enabled: true },
    update: { routine: routine ?? undefined, enabled: true },
  });
  return user;
}

export async function unregisterTelegramUser(chatId) {
  try {
    await prisma.telegramUser.delete({ where: { chatId: String(chatId) } });
    return true;
  } catch { return false; }
}

export async function getTelegramUser(chatId) {
  return prisma.telegramUser.findUnique({ where: { chatId: String(chatId) } });
}

export async function getAllTelegramUsers() {
  return prisma.telegramUser.findMany({ where: { enabled: true } });
}

export async function updateTelegramUserRoutine(chatId, routine) {
  return prisma.telegramUser.update({
    where: { chatId: String(chatId) },
    data: { routine },
  });
}

export async function toggleTelegramUserStatus(chatId) {
  const user = await prisma.telegramUser.findUnique({ where: { chatId: String(chatId) } });
  if (!user) return null;
  return prisma.telegramUser.update({
    where: { chatId: String(chatId) },
    data: { enabled: !user.enabled },
  });
}

export async function getTelegramStats() {
  const total = await prisma.telegramUser.count();
  const enabled = await prisma.telegramUser.count({ where: { enabled: true } });
  return { totalUsers: total, enabledUsers: enabled, disabledUsers: total - enabled, lastUpdated: new Date().toISOString() };
}

export async function isTelegramRegistered(chatId) {
  const count = await prisma.telegramUser.count({ where: { chatId: String(chatId) } });
  return count > 0;
}

export async function saveAttendanceRecord(chatId, courseCode, attended) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.telegramAttendance.upsert({
    where: { chatId_courseCode_recordDate: { chatId: String(chatId), courseCode, recordDate: today } },
    create: { chatId: String(chatId), courseCode, attended, recordDate: today },
    update: { attended },
  });
}

export async function saveAttendanceRecordForDate(chatId, courseCode, attended, recordDate) {
  return prisma.telegramAttendance.upsert({
    where: { chatId_courseCode_recordDate: { chatId: String(chatId), courseCode, recordDate: new Date(recordDate) } },
    create: { chatId: String(chatId), courseCode, attended, recordDate: new Date(recordDate) },
    update: { attended },
  });
}

export async function getTodayAttendanceRecord(chatId, courseCode) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.telegramAttendance.findUnique({
    where: { chatId_courseCode_recordDate: { chatId: String(chatId), courseCode, recordDate: today } },
  });
}

export async function getUserAttendanceRecords(chatId) {
  return prisma.telegramAttendance.findMany({
    where: { chatId: String(chatId) },
    orderBy: { recordDate: 'desc' },
  });
}

export async function getAttendanceSummary(chatId, courseCode) {
  const records = await prisma.telegramAttendance.findMany({
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
  return prisma.marketplaceListing.findMany({
    where: { listType: type },
    orderBy: { postedAt: 'desc' },
  });
}

export async function addMarketplaceListing(payload) {
  return prisma.marketplaceListing.create({ data: payload });
}

export async function deleteMarketplaceListing(id, userId, isAdmin) {
  const item = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!item) throw new Error('Not found');
  if (!isAdmin && item.contributorId !== userId) throw new Error('Forbidden');
  return prisma.marketplaceListing.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Messages (replaces localStorage messageStorage.js)
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveMessage(data) {
  return prisma.message.create({ data });
}

export async function getConversations(userId) {
  const messages = await prisma.message.findMany({
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
  const convId = [userId, peerId].sort().join('|');
  return prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { timestamp: 'asc' },
    include: { reactions: true },
  });
}

export async function deleteMessageById(messageId) {
  return prisma.message.update({
    where: { id: messageId },
    data: { deleted: true, text: '', edited: false },
  });
}

export async function editMessageById(messageId, text) {
  return prisma.message.update({
    where: { id: messageId },
    data: { text, edited: true, editedAt: new Date() },
  });
}

export async function addReaction(messageId, userId, emoji) {
  try {
    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  } catch {
    // toggle off
    await prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
  }
  return prisma.messageReaction.findMany({ where: { messageId } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Grades (replaces localStorage semester results)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getSemesterResults(userId) {
  return prisma.semesterResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function saveSemesterResult(userId, data) {
  return prisma.semesterResult.upsert({
    where: { userId_semester: { userId, semester: data.semester } },
    create: { userId, semester: data.semester, courses: data.courses, cgpa: data.cgpa || 0 },
    update: { courses: data.courses, cgpa: data.cgpa || 0 },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Notices
// ═══════════════════════════════════════════════════════════════════════════════

export async function listNotices() {
  return prisma.notice.findMany({ orderBy: [{ pinned: 'desc' }, { postedAt: 'desc' }] });
}

export async function createNotice(data) {
  return prisma.notice.create({ data });
}

export async function deleteNotice(id) {
  return prisma.notice.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canteen
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCanteenMenu() {
  return prisma.canteenMenuItem.findMany({ orderBy: { name: 'asc' } });
}

export async function upsertCanteenItem(data) {
  return prisma.canteenMenuItem.create({ data });
}

export async function deleteCanteenItem(id) {
  return prisma.canteenMenuItem.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Clubs
// ═══════════════════════════════════════════════════════════════════════════════

export async function listClubs() {
  return prisma.club.findMany({ include: { members: { include: { user: { select: { id: true, name: true, department: true } } } } } });
}

export async function joinClub(clubId, userId, role = 'member') {
  return prisma.clubMembership.create({ data: { clubId, userId, role } });
}

export async function leaveClub(clubId, userId) {
  return prisma.clubMembership.deleteMany({ where: { clubId, userId } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cheatsheets
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCheatsheets() {
  return prisma.cheatsheet.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createCheatsheet(data) {
  return prisma.cheatsheet.create({ data });
}

export async function deleteCheatsheet(id) {
  return prisma.cheatsheet.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Campus Locations
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCampusLocations() {
  return prisma.campusLocation.findMany({ orderBy: [{ floor: 'asc' }, { roomId: 'asc' }] });
}

export async function upsertCampusLocation(data) {
  const existing = await prisma.campusLocation.findFirst({
    where: { floor: data.floor, roomId: data.roomId },
  });
  if (existing) {
    return prisma.campusLocation.update({ where: { id: existing.id }, data });
  }
  return prisma.campusLocation.create({ data });
}

export async function deleteCampusLocation(id) {
  return prisma.campusLocation.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Courses
// ═══════════════════════════════════════════════════════════════════════════════

export async function listCourses(department) {
  const where = department ? { department } : {};
  return prisma.course.findMany({ where, orderBy: { code: 'asc' } });
}

export async function upsertCourse(data) {
  return prisma.course.upsert({
    where: { code: data.code },
    create: data,
    update: { name: data.name, credit: data.credit, department: data.department },
  });
}

export async function deleteCourse(code) {
  return prisma.course.delete({ where: { code } });
}
