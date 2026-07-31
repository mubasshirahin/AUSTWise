/**
 * Telegram persistence compatibility layer.
 *
 * The route layer historically imported these names from a SQL Server module.
 * Keep the public function names stable while using the PostgreSQL Prisma models.
 */

import {
  registerTelegramUser,
  unregisterTelegramUser,
  getTelegramUser,
  getAllTelegramUsers,
  updateTelegramUserRoutine,
  toggleTelegramUserStatus,
  getTelegramStats,
  isTelegramRegistered,
  saveAttendanceRecord as savePrismaAttendanceRecord,
  saveAttendanceRecordForDate as savePrismaAttendanceRecordForDate,
  getTodayAttendanceRecord as getPrismaTodayAttendanceRecord,
  getUserAttendanceRecords as getPrismaUserAttendanceRecords,
  getAttendanceSummary as getPrismaAttendanceSummary,
} from './prisma.js';

export async function registerUser(chatId, routine = null) {
  return registerTelegramUser(chatId, routine);
}

export async function unregisterUser(chatId) {
  return unregisterTelegramUser(chatId);
}

export async function getUser(chatId) {
  return getTelegramUser(chatId);
}

export async function getAllUsers() {
  return getAllTelegramUsers();
}

export async function updateUserRoutine(chatId, routine) {
  return updateTelegramUserRoutine(chatId, routine);
}

export async function toggleUserStatus(chatId) {
  return toggleTelegramUserStatus(chatId);
}

export async function getStats() {
  return getTelegramStats();
}

export async function isRegistered(chatId) {
  return isTelegramRegistered(chatId);
}

export async function saveAttendanceRecord(chatId, courseCode, attended) {
  return savePrismaAttendanceRecord(chatId, courseCode, attended);
}

export async function saveAttendanceRecordForDate(chatId, courseCode, attended, recordDate) {
  return savePrismaAttendanceRecordForDate(chatId, courseCode, attended, recordDate);
}

export async function getTodayAttendanceRecord(chatId, courseCode) {
  return getPrismaTodayAttendanceRecord(chatId, courseCode);
}

export async function getUserAttendanceRecords(chatId) {
  return getPrismaUserAttendanceRecords(chatId);
}

export async function getAttendanceSummary(chatId, courseCode) {
  return getPrismaAttendanceSummary(chatId, courseCode);
}
