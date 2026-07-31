/**
 * Library occupancy compatibility layer.
 * The old implementation used SQL Server MERGE/DATEADD queries; the Prisma
 * implementation in server/prisma.js now handles the same API on PostgreSQL.
 */

export {
  recordCheckIn,
  recordCheckOut,
  getOccupancy,
} from './prisma.js';
