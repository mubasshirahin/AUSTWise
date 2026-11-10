import { getAllAccounts } from './authStorage';

const CACHE_KEY = 'aust-public-members-v1';
const MIN_REFRESH_GAP = 15_000;
let membersInMemory = null;
let lastFetchedAt = 0;
let pendingRequest = null;

export function getCachedMembers() {
  if (membersInMemory) return membersInMemory;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    if (Array.isArray(cached)) membersInMemory = cached;
  } catch { /* Ignore an invalid or unavailable cache. */ }
  if (membersInMemory) return membersInMemory;

  // Seed the first render with profiles already known on this device.
  try { return getAllAccounts(); } catch { return []; }
}

export function refreshMemberDirectory({ force = false } = {}) {
  if (pendingRequest) return pendingRequest;
  if (!force && Date.now() - lastFetchedAt < MIN_REFRESH_GAP) {
    return Promise.resolve(getCachedMembers());
  }

  pendingRequest = fetch('/api/presence/members', { credentials: 'same-origin' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      if (!Array.isArray(data?.members)) return getCachedMembers();
      membersInMemory = data.members;
      lastFetchedAt = Date.now();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(membersInMemory)); } catch { /* Cache is best effort. */ }
      return membersInMemory;
    })
    .catch(() => getCachedMembers())
    .finally(() => { pendingRequest = null; });
  return pendingRequest;
}
