/**
 * PostgreSQL database bootstrap for Neon.
 *
 * Runtime queries are handled by server/prisma.js. This module keeps the
 * startup/reset API used by the custom HTTP server without retaining any
 * SQL Server driver or dialect-specific SQL.
 */

import { prisma } from './prisma.js';

export async function initializeDatabase() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ PostgreSQL connected');
  return true;
}

export async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL connection is healthy');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

/**
 * Clear the small set of tables used by the admin reset endpoint.
 * This is intentionally explicit and does not wipe the whole application.
 */
export async function resetDatabase() {
  await prisma.$transaction([
    prisma.telegramAttendance.deleteMany(),
    prisma.telegramUser.deleteMany(),
    prisma.libraryCheckin.deleteMany(),
    prisma.invitation.deleteMany(),
  ]);
  return true;
}
