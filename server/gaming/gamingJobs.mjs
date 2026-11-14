/**
 * Background housekeeping for the Gaming Zone: close idle squad rooms and
 * remind entrants 30 minutes before an event. Runs every 5 minutes.
 */
import { closeStaleRooms, sendEventReminders } from './gamingService.mjs';

const INTERVAL_MS = 5 * 60 * 1000;
let timer = null;

export async function runGamingJobsOnce(now = Date.now()) {
  const closed = await closeStaleRooms(now);
  const reminded = await sendEventReminders(now);
  return { closed, reminded };
}

export function startGamingJobs({ isDbReady }) {
  if (timer) return;
  timer = setInterval(() => {
    if (!isDbReady()) return;
    runGamingJobsOnce().catch((err) => console.warn('⚠️  gaming jobs failed:', err?.message || err));
  }, INTERVAL_MS);
  timer.unref?.();
}

export function stopGamingJobs() {
  if (timer) clearInterval(timer);
  timer = null;
}
