import { useState, useCallback, useMemo } from 'react';
import { NotebookPen } from 'lucide-react';
import Notebook from './Notebook';
import GliderTabs from '../../components/GliderTabs';
import NotebookLibrary from './NotebookLibrary';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import { liveLoad, liveSave } from '../../utils/liveStorage';
import { useLiveRefresh } from '../../utils/liveStore';
import useAdminMode from '../../hooks/useAdminMode';
import './Notebook.css';
import './VaultPage.css';
import './vault-tokens.css';

// Standalone Notebook page — the user's notes are synced across their devices.
// `aust-notebook-index` holds a flat list of items (folders and notes) linked
// by `parentId` (null = at the library root), and one `aust-notebook-<id>` key
// per note holds the canvas itself.
const DEFAULT_CONTEXT = { department: 'General', yearSem: 'All' };

const INDEX_KEY = 'aust-notebook-index';
const STORAGE_PREFIX = 'aust-notebook-';

function loadIndex() {
  const list = liveLoad('user', INDEX_KEY, null);
  if (!Array.isArray(list)) return null;
  // Normalize older flat-note entries into the folder/note model.
  return list.map(e => ({
    id: e.id,
    type: e.type || 'note',
    title: e.title || 'Untitled Note',
    parentId: e.parentId ?? null,
    createdAt: e.createdAt || Date.now(),
    updatedAt: e.updatedAt || Date.now(),
  }));
}

function saveIndex(list) {
  liveSave('user', INDEX_KEY, list);
}

// First-run migration: before the library existed, all notes lived in one
// canvas under `aust-notebook-<dept>-<yearSem>-<batch>`. Turn that single
// canvas into the first note so nothing is stranded.
function migrateLegacyNotes() {
  const legacy = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX) || k === INDEX_KEY) continue;
    if (k.startsWith(STORAGE_PREFIX + 'note-')) continue; // already a library note
    try {
      const d = JSON.parse(localStorage.getItem(k));
      if (d && Array.isArray(d.items) && d.items.length > 0) legacy.push({ key: k, data: d });
    } catch { /* skip unreadable entries */ }
  }
  if (legacy.length === 0) return null;
  const first = legacy[0];
  const id = 'note-' + Date.now();
  try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(first.data)); }
  catch { /* best effort — a failed copy just means the old canvas key stays */ }
  return [{ id, type: 'note', title: 'My Notes', parentId: null, createdAt: Date.now(), updatedAt: Date.now() }];
}

export default function NotebookPage() {
  const { isAdmin: _isAdmin } = useAdminMode();
  const [items, setItems] = useState(() => {
    // Lazily load the item index on first render (server-synced via liveStore).
    let list = loadIndex();
    if (!list || list.length === 0) {
      const migrated = migrateLegacyNotes();
      list = migrated || [];
      saveIndex(list);
    }
    return list;
  });
  const [folderPath, setFolderPath] = useState([]); // stack of folder ids; [] = library root
  const [openNote, setOpenNote] = useState(null);

  // Live-sync: when another device renames/creates/deletes notebook items,
  // adopt the server's index without a manual refresh.
  useLiveRefresh([INDEX_KEY], () => {
    const next = loadIndex();
    if (Array.isArray(next)) setItems(next);
  });

  const currentFolderId = folderPath.length ? folderPath[folderPath.length - 1] : null;

  const persist = (next) => { setItems(next); saveIndex(next); };

  const handleCreateNote = () => {
    const note = {
      id: 'note-' + Date.now(),
      type: 'note',
      title: 'Untitled Note',
      parentId: currentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...items, note]);
    setOpenNote(note);
  };

  const handleCreateFolder = () => {
    const folder = {
      id: 'folder-' + Date.now(),
      type: 'folder',
      title: 'New Folder',
      parentId: currentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...items, folder]);
    return folder.id; // so the library can jump straight into an inline rename
  };

  const handleRename = (id, title) => {
    persist(items.map(i => i.id === id
      ? { ...i, title: (title || '').trim() || (i.type === 'folder' ? 'New Folder' : 'Untitled Note') }
      : i));
  };

  const handleDelete = (id) => {
    const target = items.find(i => i.id === id);
    const isFolder = target?.type === 'folder';
    if (!window.confirm(isFolder
      ? 'Delete this folder and everything inside it? This cannot be undone.'
      : 'Delete this note? This cannot be undone.')) return;

    // Collect the folder and all of its descendants (recursively).
    const toDelete = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      if (toDelete.has(cur)) continue;
      toDelete.add(cur);
      items.filter(i => i.parentId === cur).forEach(i => stack.push(i.id));
    }
    // Remove canvas data for every deleted note.
    toDelete.forEach(did => {
      const it = items.find(i => i.id === did);
      if (it?.type === 'note') { try { localStorage.removeItem(STORAGE_PREFIX + did); } catch { /* best effort */ } }
    });
    persist(items.filter(i => !toDelete.has(i.id)));
    if (openNote && toDelete.has(openNote.id)) setOpenNote(null);
    setFolderPath(prev => prev.filter(fid => !toDelete.has(fid)));
  };

  const handleOpenFolder = (id) => setFolderPath(prev => [...prev, id]);

  const handleNavigateTo = (id) => {
    if (id === null) { setFolderPath([]); return; }
    // Rebuild the path by walking up the parent chain from the target.
    const chain = [];
    let cur = items.find(i => i.id === id);
    while (cur) {
      chain.unshift(cur.id);
      cur = cur.parentId ? items.find(i => i.id === cur.parentId) : null;
    }
    setFolderPath(chain);
  };

  // Per-note canvas item count, used as the density signal in the library.
  const noteCounts = useMemo(() => {
    const m = {};
    items.forEach(i => {
      if (i.type !== 'note') return;
      const d = liveLoad('user', STORAGE_PREFIX + i.id, null);
      m[i.id] = Array.isArray(d?.items) ? d.items.length : 0;
    });
    return m;
  }, [items]);

  // Keep the library sorted by last edit: bump updatedAt whenever the open
  // canvas autosaves.
  const handleSaved = useCallback((noteId) => {
    setItems(prev => {
      const next = prev.map(i => i.id === noteId ? { ...i, updatedAt: Date.now() } : i);
      saveIndex(next);
      return next;
    });
  }, []);

  // Breadcrumb path (id + title) from Home down to the open note's folder.
  const openNotePath = useMemo(() => {
    if (!openNote) return [];
    const chain = [];
    let cur = items.find(i => i.id === openNote.parentId);
    while (cur) { chain.unshift({ id: cur.id, title: cur.title }); cur = cur.parentId ? items.find(i => i.id === cur.parentId) : null; }
    return chain;
  }, [openNote, items]);

  const handlePathCrumb = useCallback((id) => {
    setOpenNote(null);
    handleNavigateTo(id);
  }, []);

  return (
    <div className="vault-page notebook-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="nb-hero">
        <div className="nb-hero-content">
          <div className="nb-hero-eyebrow">
            <span className="nb-hero-period-icon">
              <NotebookPen size={16} />
            </span>
            <span className="nb-hero-date-label">
              Your notes &amp; library
            </span>
          </div>
          <h1 className="nb-hero-title">
            Note<span className="nb-hero-name">book</span>
          </h1>
          <p className="nb-hero-subtitle">
            {openNote ? openNote.title : 'Organize folders, notes and study material — everything lives in your browser.'}
          </p>
        </div>
      </header>

      {/* ── 2. Glider tabs bar (own card) — single-section page, kept for the
          shared hero + tabs layout every page follows ── */}
      <div className="glass-card-static nb-tabs-card">
        <GliderTabs
          tabs={[
            { id: 'notes', label: 'My Notes', icon: NotebookPen, color: 'amber', desc: 'Folders & notes' },
          ]}
          activeTab="notes"
          onChange={() => {}}
          variant="dashboard"
        />
      </div>

      {/* ── 3. Main content box (own card, gated by featureHidden) ── */}
      <MastheadAccessControl pageKey="/notebook">
        <div className="nb-content-card">
          {openNote ? (
            <Notebook
              vaultContext={DEFAULT_CONTEXT}
              batch={null}
              noteKey={openNote.id}
              title={openNote.title}
              path={openNotePath}
              onBack={() => setOpenNote(null)}
              onPathCrumb={handlePathCrumb}
              onSaved={() => handleSaved(openNote.id)}
            />
          ) : (
            <NotebookLibrary
              items={items}
              currentFolderId={currentFolderId}
              noteCounts={noteCounts}
              onOpenNote={setOpenNote}
              onOpenFolder={handleOpenFolder}
              onNavigateTo={handleNavigateTo}
              onCreateNote={handleCreateNote}
              onCreateFolder={handleCreateFolder}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          )}
        </div>
      </MastheadAccessControl>
    </div>
  );
}