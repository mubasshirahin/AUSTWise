// Marketplace storage — backed by server-side sharedStore for cross-device sync.
// All functions keep identical signatures so UI components don't change.

const storageKey = 'aust-marketplace-v1';
const contributorKey = 'aust-marketplace-contributor-id';
const userStorageKey = 'aust-user-profile';

import { sanitizeUserInput, MAX_SHORT_TEXT_LENGTH, MAX_TITLE_LENGTH } from './sanitize';
import { sharedStore } from './storageService';

const emptyStore = () => ({
  exchange: [],
  tolet: [],
  lostFound: [],
  partners: [],
  mentors: [],
  mentorRequests: [],
});

// ── Local cache + async server sync ──────────────────────────────────────────

let _cache = null;
let _loading = null;

/** Load the full marketplace store (server-first, localStorage cache). */
async function loadStoreAsync() {
  if (_cache) return _cache;
  if (_loading) return _loading;
  _loading = (async () => {
    // Try server first
    const serverData = await sharedStore.get(storageKey);
    if (serverData && typeof serverData === 'object' && serverData.exchange) {
      _cache = { ...emptyStore(), ...serverData };
      // Update localStorage cache
      try { localStorage.setItem(storageKey, JSON.stringify(_cache)); } catch { /* ignore */ }
      _loading = null;
      return _cache;
    }
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        _cache = { ...emptyStore(), ...JSON.parse(raw) };
        // Push to server for future reads
        await sharedStore.set(storageKey, _cache);
      } else {
        _cache = emptyStore();
      }
    } catch {
      _cache = emptyStore();
    }
    _loading = null;
    return _cache;
  })();
  return _loading;
}

function loadStore() {
  // Synchronous fallback (for initial render) — returns cache or empty
  return _cache || emptyStore();
}

async function saveStore(store) {
  _cache = store;
  // Write to localStorage immediately (instant, offline-safe)
  try { localStorage.setItem(storageKey, JSON.stringify(store)); } catch { /* ignore */ }
  // Push to server async (cross-device sync)
  await sharedStore.set(storageKey, store);
}

/** Invalidate cache so next read fetches fresh from server. */
export function invalidateMarketplaceCache() {
  _cache = null;
  _loading = null;
}

// ── Auto-load on module init ─────────────────────────────────────────────────
loadStoreAsync();

// ── Existing helpers (unchanged) ─────────────────────────────────────────────

export function getContributorId() {
  try {
    const existing = localStorage.getItem(contributorKey);
    if (existing) return existing;
    const nextId = crypto.randomUUID();
    localStorage.setItem(contributorKey, nextId);
    return nextId;
  } catch {
    return `local-${Date.now()}`;
  }
}

function loadUserProfile() {
  try {
    const savedUser = localStorage.getItem(userStorageKey);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

export function getBatchNoFromUser(user = loadUserProfile()) {
  if (user?.batchNo) return String(user.batchNo);
  const batchDigits = String(user?.batch || '').match(/\d+/)?.[0];
  return batchDigits || '';
}

export function getSellerLabel(user = loadUserProfile()) {
  if (!user) return 'AUST User';
  const department = user.department ? ` • ${user.department}` : '';
  if (user.role === 'faculty') return `Faculty${department}`;
  if (user.role === 'alumni') {
    const batchNo = getBatchNoFromUser(user);
    return batchNo ? `Alumni • Batch ${batchNo}${department}` : `Alumni${department}`;
  }
  const batchNo = getBatchNoFromUser(user);
  return batchNo ? `Batch ${batchNo}${department}` : user.name || 'AUST Student';
}

export function getUserInitials(name) {
  const initials = String(name || 'ST')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'ST';
}

export function formatPostedDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';

  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function createBaseEntry() {
  const profile = loadUserProfile();
  return {
    id: crypto.randomUUID(),
    contributorId: profile?.id || getContributorId(),
    postedAt: new Date().toISOString(),
  };
}

// ── Exchange ─────────────────────────────────────────────────────────────────

export function listExchangeItems() {
  return loadStore().exchange.sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  );
}

export async function addExchangeItem(payload) {
  const title = sanitizeUserInput(String(payload.title || '').trim(), MAX_TITLE_LENGTH);
  const price = Number(payload.price);
  const contact = sanitizeUserInput(String(payload.contact || '').trim(), MAX_TITLE_LENGTH);

  if (!title) throw new Error('Product title is required.');
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid price.');
  if (!contact) throw new Error('Contact number is required.');

  const store = await loadStoreAsync();
  const entry = {
    ...createBaseEntry(),
    title,
    price: Math.round(price),
    condition: payload.condition || 'Good',
    category: payload.category || 'Other',
    image: payload.image || '',
    seller: payload.seller || getSellerLabel(),
    contact,
  };

  store.exchange.unshift(entry);
  await saveStore(store);
  return entry;
}

export function deleteExchangeItem(id, userId, userRole) {
  const store = loadStore();
  const item = store.exchange.find((entry) => entry.id === id);
  if (!item) return;
  const isOwner = item.contributorId === (userId || getContributorId());
  const isAdmin = userRole === 'admin';
  if (!isOwner && !isAdmin) return;

  store.exchange = store.exchange.filter((entry) => entry.id !== id);
  saveStore(store); // async but fire-and-forget
}

// ── ToLet ────────────────────────────────────────────────────────────────────

export function listToLetListings() {
  return loadStore().tolet.sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  );
}

export async function addToLetListing(payload) {
  const title = sanitizeUserInput(String(payload.title || '').trim(), MAX_TITLE_LENGTH);
  const location = sanitizeUserInput(String(payload.location || '').trim(), MAX_TITLE_LENGTH);
  const rent = Number(payload.rent);
  const contact = sanitizeUserInput(String(payload.contact || '').trim(), MAX_TITLE_LENGTH);

  if (!title || !location) throw new Error('Title and location are required.');
  if (!Number.isFinite(rent) || rent < 0) throw new Error('Enter a valid monthly rent.');
  if (!contact) throw new Error('Contact number is required.');

  const store = await loadStoreAsync();
  const entry = {
    ...createBaseEntry(),
    title,
    location,
    rent: Math.round(rent),
    type: payload.type || 'Seat',
    amenities: (payload.amenities || []).filter(Boolean),
    image: payload.image || '',
    available: true,
    contact,
    owner: payload.owner || getSellerLabel(),
    description: sanitizeUserInput(payload.description || '', MAX_SHORT_TEXT_LENGTH),
    environment: payload.environment || 'Male',
    utilities: sanitizeUserInput(payload.utilities || '', MAX_SHORT_TEXT_LENGTH),
  };

  store.tolet.unshift(entry);
  await saveStore(store);
  return entry;
}

export function setToLetAvailability(id, available) {
  const store = loadStore();
  store.tolet = store.tolet.map((listing) =>
    listing.id === id ? { ...listing, available: Boolean(available) } : listing,
  );
  saveStore(store);
  return store.tolet;
}

export function deleteToLetListing(id, userId, userRole) {
  const store = loadStore();
  const item = store.tolet.find((entry) => entry.id === id);
  if (!item) return;
  const isOwner = item.contributorId === (userId || getContributorId());
  const isAdmin = userRole === 'admin';
  if (!isOwner && !isAdmin) return;

  store.tolet = store.tolet.filter((entry) => entry.id !== id);
  saveStore(store);
}

// ── Lost & Found ─────────────────────────────────────────────────────────────

export function listLostFoundItems() {
  return loadStore().lostFound.sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  );
}

export async function addLostFoundItem(payload) {
  const title = sanitizeUserInput(String(payload.title || '').trim(), MAX_TITLE_LENGTH);
  const location = sanitizeUserInput(String(payload.location || '').trim(), MAX_TITLE_LENGTH);
  const description = sanitizeUserInput(String(payload.description || '').trim(), MAX_SHORT_TEXT_LENGTH);
  const contact = sanitizeUserInput(String(payload.contact || '').trim(), MAX_TITLE_LENGTH);
  const type = payload.type === 'found' ? 'found' : 'lost';

  if (!title || !location || !description) {
    throw new Error('Title, location, and description are required.');
  }
  if (!contact) throw new Error('Contact number is required.');

  const store = await loadStoreAsync();
  const entry = {
    ...createBaseEntry(),
    title,
    location,
    description,
    type,
    image: payload.image || '',
    status: 'open',
    contact,
    reporter: payload.reporter || getSellerLabel(),
  };

  store.lostFound.unshift(entry);
  await saveStore(store);
  return entry;
}

export function claimLostFoundItem(id) {
  const store = loadStore();
  let updated = null;

  store.lostFound = store.lostFound.map((item) => {
    if (item.id !== id) return item;
    if (item.status === 'claimed') return item;
    updated = { ...item, status: 'claimed', claimedAt: new Date().toISOString() };
    return updated;
  });

  if (!updated) throw new Error('Item not found or already claimed.');
  saveStore(store);
  return updated;
}

export function deleteLostFoundItem(id, userId, userRole) {
  const store = loadStore();
  const item = store.lostFound.find((entry) => entry.id === id);
  if (!item) return;
  const isOwner = item.contributorId === (userId || getContributorId());
  const isAdmin = userRole === 'admin';
  if (!isOwner && !isAdmin) return;

  store.lostFound = store.lostFound.filter((entry) => entry.id !== id);
  saveStore(store);
}

// ── Study Partners ───────────────────────────────────────────────────────────

export function listStudyPartners() {
  return loadStore().partners.sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  );
}

function splitTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function calcPartnerCompatibility(leftSkills, rightSkills) {
  if (!leftSkills.length || !rightSkills.length) return 50;
  const left = new Set(leftSkills.map((skill) => skill.toLowerCase()));
  const right = new Set(rightSkills.map((skill) => skill.toLowerCase()));
  let overlap = 0;
  for (const skill of left) {
    if (right.has(skill)) overlap += 1;
  }
  const score = Math.round((overlap / Math.max(left.size, right.size)) * 100);
  return Math.max(35, Math.min(98, score || 50));
}

export async function addStudyPartner(payload) {
  const name = String(payload.name || '').trim();
  const contact = String(payload.contact || '').trim();
  const skills = splitTags(payload.skills);
  const lookingFor = splitTags(payload.lookingFor);

  if (!name) throw new Error('Your name is required.');
  if (!skills.length || !lookingFor.length) {
    throw new Error('Add at least one skill and one topic you are looking for.');
  }
  if (!contact) throw new Error('Contact number is required.');

  const user = loadUserProfile();
  const store = await loadStoreAsync();
  const contributorId = getContributorId();

  store.partners = store.partners.filter((partner) => partner.contributorId !== contributorId);

  const entry = {
    ...createBaseEntry(),
    name,
    batch: payload.batch || getBatchNoFromUser(user) || '—',
    department: payload.department || user.department || '—',
    skills,
    lookingFor,
    contact,
    avatar: getUserInitials(name),
  };

  store.partners.unshift(entry);
  await saveStore(store);
  return entry;
}

export function getMyStudyPartner() {
  const contributorId = getContributorId();
  return listStudyPartners().find((partner) => partner.contributorId === contributorId) || null;
}

// ── Mentors ──────────────────────────────────────────────────────────────────

export function listMentors() {
  return loadStore().mentors.sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  );
}

export async function addMentor(payload) {
  const name = String(payload.name || '').trim();
  const expertise = String(payload.expertise || '').trim();
  const company = String(payload.company || '').trim();
  const availability = String(payload.availability || '').trim();
  const contact = String(payload.contact || '').trim();

  if (!name || !expertise || !availability) {
    throw new Error('Name, expertise, and availability are required.');
  }
  if (!contact) throw new Error('Contact number is required.');

  const user = loadUserProfile();
  const store = await loadStoreAsync();
  const contributorId = getContributorId();

  store.mentors = store.mentors.filter((mentor) => mentor.contributorId !== contributorId);

  const entry = {
    ...createBaseEntry(),
    name,
    batch: payload.batch || getBatchNoFromUser(user) || '—',
    expertise,
    company: company || '—',
    availability,
    contact,
    avatar: getUserInitials(name),
    sessions: 0,
    rating: 5,
  };

  store.mentors.unshift(entry);
  await saveStore(store);
  return entry;
}

export function incrementMentorSessions(id) {
  const store = loadStore();
  store.mentors = store.mentors.map((mentor) =>
    mentor.id === id ? { ...mentor, sessions: (mentor.sessions || 0) + 1 } : mentor,
  );
  saveStore(store);
  return store.mentors;
}

// ── Mentor Requests ──────────────────────────────────────────────────────────

export function listMentorRequests() {
  return loadStore().mentorRequests.sort(
    (left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  );
}

export async function addMentorRequest(payload) {
  const topic = sanitizeUserInput(String(payload.topic || '').trim(), MAX_TITLE_LENGTH);
  const description = sanitizeUserInput(String(payload.description || '').trim(), MAX_SHORT_TEXT_LENGTH);
  const contact = sanitizeUserInput(String(payload.contact || '').trim(), MAX_TITLE_LENGTH);

  if (!topic) throw new Error('Topic is required (e.g., CP, Web Dev, ML).');
  if (!contact) throw new Error('Contact number is required.');

  const user = loadUserProfile();
  const store = await loadStoreAsync();
  const entry = {
    ...createBaseEntry(),
    requesterName: payload.requesterName || user?.name || 'Anonymous',
    batch: payload.batch || getBatchNoFromUser(user) || '—',
    department: payload.department || user?.department || '—',
    topic,
    description,
    contact,
    responses: [],
  };

  store.mentorRequests.unshift(entry);
  await saveStore(store);
  return entry;
}

export function addMentorResponse(requestId, payload) {
  const message = sanitizeUserInput(String(payload.message || '').trim(), MAX_SHORT_TEXT_LENGTH);
  const contact = sanitizeUserInput(String(payload.contact || '').trim(), MAX_TITLE_LENGTH);
  const responderName = String(payload.responderName || '').trim();

  if (!message) throw new Error('Response message is required.');

  const store = loadStore();
  const request = store.mentorRequests.find((r) => r.id === requestId);
  if (!request) throw new Error('Mentor request not found.');

  const response = {
    id: crypto.randomUUID(),
    postedAt: new Date().toISOString(),
    responderName: responderName || loadUserProfile()?.name || 'Anonymous',
    responderBatch: payload.responderBatch || getBatchNoFromUser() || '—',
    message,
    contact,
  };

  request.responses = [...(request.responses || []), response];
  saveStore(store);
  return request;
}

export function deleteMentorRequest(id, userId, userRole) {
  const store = loadStore();
  const item = store.mentorRequests.find((entry) => entry.id === id);
  if (!item) return;
  const isOwner = item.contributorId === (userId || getContributorId());
  const isAdmin = userRole === 'admin';
  if (!isOwner && !isAdmin) return;

  store.mentorRequests = store.mentorRequests.filter((entry) => entry.id !== id);
  saveStore(store);
}

// ── Clipboard helper ─────────────────────────────────────────────────────────

export async function copyContact(contact, label = 'Contact') {
  const value = String(contact || '').trim();
  if (!value) {
    throw new Error(`${label} is not available for this listing.`);
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return `${label} copied: ${value}`;
  }
  return `${label}: ${value}`;
}
