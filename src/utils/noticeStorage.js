/**
 * noticeStorage.js — server-backed notice storage with localStorage fallback.
 *
 * The admin panel publishes/deletes notices; the student-facing NoticeBoard
 * reads them. Both go through this module so they share the same source:
 *   primary:  GET/POST/DELETE /api/notices (Prisma-backed)
 *   fallback: localStorage 'aust-notices' (when the DB is unavailable)
 *
 * Notice shape (frontend):
 *   { id, title, category, date, pinned, content }
 */

const STORAGE_KEY = 'aust-notices';

function readLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeLocal(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Map a server notice (body/postedAt) to the frontend shape. */
function toFrontend(n) {
  return {
    id: n.id,
    title: n.title || '',
    category: n.category || 'Admin',
    date: n.postedAt ? new Date(n.postedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
    pinned: !!n.pinned,
    content: n.body || '',
  };
}

/** Map a frontend notice to the server shape (title/body/pinned). */
function toServer(n) {
  return {
    title: n.title || '',
    body: n.content || n.body || '',
    pinned: !!n.pinned,
    category: n.category || 'Admin',
  };
}

/** Fetch notices — server first, localStorage fallback. */
export async function getNotices() {
  try {
    const res = await fetch('/api/notices', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.notices)) {
        return data.notices.map(toFrontend);
      }
    }
  } catch {
    // fall through to localStorage
  }
  return readLocal();
}

/**
 * Publish a notice. Tries the server (POST /api/notices); if that fails,
 * keeps it in localStorage so the student board still sees it.
 * @returns the persisted notice (frontend shape).
 */
export async function publishNotice(n) {
  const frontend = {
    id: n.id || Date.now(),
    title: n.title || '',
    category: n.category || 'Admin',
    date: n.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    pinned: !!n.pinned,
    content: n.content || '',
  };

  let saved = frontend;
  try {
    const res = await fetch('/api/notices', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toServer(frontend)),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.notice) saved = toFrontend(data.notice);
    }
  } catch {
    // fall through — keep the local shape below
  }

  // Always mirror to localStorage so the fallback stays honest if the DB goes down
  const local = [saved, ...readLocal().filter((n) => n.id !== saved.id)];
  writeLocal(local);
  return saved;
}

/**
 * Delete a notice. Tries the server (DELETE /api/notices/:id); if that fails,
 * removes it from localStorage as a best-effort fallback.
 */
export async function deleteNotice(id) {
  try {
    const res = await fetch(`/api/notices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (res.ok) {
      writeLocal(readLocal().filter((n) => n.id !== id));
      return true;
    }
  } catch {
    // fall through
  }
  writeLocal(readLocal().filter((n) => n.id !== id));
  return false;
}
