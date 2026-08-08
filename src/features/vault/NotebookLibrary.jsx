import { useState, useRef, useEffect } from 'react';
import { Folder, StickyNote, ChevronUp, Home, MoreVertical, Pencil, Trash2, Check } from 'lucide-react';

function fmtDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// Density signal for a cell = its item/canvas count. Red is reserved for the
// packed/urgent threshold (≥3); there is no rotating per-item palette.
function isHot(count) {
  return count >= 3;
}

// Library / folder view for the Notebook — redesigned to the dashboard
// Semester View widget language (same masthead, stats, ⋮ menu, density cells).
// All data lives in the user's localStorage (see NotebookPage) — no backend.
export default function NotebookLibrary({
  items,
  currentFolderId,
  noteCounts,
  onOpenNote,
  onOpenFolder,
  onNavigateTo,
  onCreateNote,
  onCreateFolder,
  onRename,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const byId = (id) => items.find(i => i.id === id);
  const currentFolder = currentFolderId ? byId(currentFolderId) : null;
  const visible = items.filter(i => i.parentId === currentFolderId);

  const crumbs = [];
  let walk = currentFolder;
  while (walk) {
    crumbs.unshift(walk);
    walk = walk.parentId ? byId(walk.parentId) : null;
  }

  const folders = visible.filter(i => i.type === 'folder');
  const notes = visible.filter(i => i.type === 'note');
  const totalFolders = items.filter(i => i.type === 'folder').length;
  const totalNotes = items.filter(i => i.type === 'note').length;

  const commitEdit = (id) => { onRename(id, editTitle); setEditingId(null); };
  const startEdit = (item) => { setEditingId(item.id); setEditTitle(item.title); };

  const handleNewFolder = () => {
    const id = onCreateFolder();
    if (id) { setEditingId(id); setEditTitle('New Folder'); }
  };

  // ONE shared renderer for every list item — folders and notes look identical,
  // only their icon/density/meta differ.
  const renderCell = (item) => {
    const isFolder = item.type === 'folder';
    const count = isFolder
      ? items.filter(i => i.parentId === item.id).length
      : (noteCounts[item.id] || 0);
    const open = () => (isFolder ? onOpenFolder(item.id) : onOpenNote(item));
    const title = item.title || (isFolder ? 'New Folder' : 'Untitled Note');
    const cellClass = `nb-cell${currentFolderId === item.id ? ' active' : ''}${isHot(count) ? ' is-hot' : ''}`;
    return (
      <div
        key={item.id}
        className={cellClass}
        onClick={open}
        onKeyDown={e => { if (e.key === 'Enter') open(); }}
        role="button"
        tabIndex={0}
        title={item.title}
      >
        <span className={`nb-count${count >= 3 ? ' hot' : ''}`}>{count}</span>
        <div className={`nb-cell-icon${isFolder ? ' folder' : ''}`}>
          {isFolder ? <Folder size={18} /> : <StickyNote size={18} />}
        </div>
        {editingId === item.id ? (
          <input
            className="nb-note-editor"
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => commitEdit(item.id)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') commitEdit(item.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
        ) : (
          <span className="nb-cell-title">{title}</span>
        )}
        <span className="nb-cell-sub">
          {isFolder ? `${count} item${count === 1 ? '' : 's'}` : fmtDate(item.updatedAt || item.createdAt)}
        </span>
        <div className="nb-cell-actions" onClick={e => e.stopPropagation()}>
          {editingId === item.id ? (
            <button className="schedule-nav-btn" onClick={() => commitEdit(item.id)} title="Save name">
              <Check size={14} />
            </button>
          ) : (
            <button className="schedule-nav-btn" onClick={() => startEdit(item)} title={isFolder ? 'Rename folder' : 'Rename note'}>
              <Pencil size={14} />
            </button>
          )}
          <button className="schedule-nav-btn" onClick={() => onDelete(item.id)} title={isFolder ? 'Delete folder' : 'Delete note'}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const ordered = [...folders, ...notes];

  return (
    <div className="glass-card-static schedule-widget nb-widget nb-library-widget animate-fadeInUp">

      {/* ── Masthead (mirrors dashboard Semester View) ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <StickyNote size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Notebook</span>
            <p className="schedule-title">Local Vault</p>
            <span className="schedule-subtitle">
              {currentFolder ? crumbs.map(c => c.title).join(' › ') : 'Notes, folders & whiteboards'}
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{totalFolders}</span>
              <span className="schedule-stat-label">Folders</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{totalNotes}</span>
              <span className="schedule-stat-label">Notes</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="schedule-week-nav">
            <button className="schedule-nav-btn" onClick={() => onNavigateTo(null)} title="Home">
              <Home size={16} />
            </button>
          </div>

          <div className="export-dropdown" ref={menuRef}>
            <button
              className="schedule-nav-btn"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="Options"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="export-menu">
                <button className="export-menu-item" onClick={() => { onCreateNote(); setMenuOpen(false); }}>
                  <StickyNote size={14} /> New Note
                </button>
                <button className="export-menu-item" onClick={() => { handleNewFolder(); setMenuOpen(false); }}>
                  <Folder size={14} /> New Folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* Breadcrumb for nested folders */}
      {crumbs.length > 0 && (
        <nav className="nb-crumbs" aria-label="Breadcrumb">
          <button className="nb-crumb" onClick={() => onNavigateTo(null)}>Home</button>
          {crumbs.map((c, i) => (
            <span key={c.id} className="nb-crumb-seg">
              <span className="nb-crumb-sep">›</span>
              <button className={`nb-crumb${i === crumbs.length - 1 ? ' active' : ''}`} onClick={() => onNavigateTo(c.id)}>
                {c.title}
              </button>
            </span>
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        <div className="nb-empty">
          {currentFolder ? <Folder size={38} className="nb-empty-icon" /> : <StickyNote size={38} className="nb-empty-icon" />}
          <h3>{currentFolder ? 'This folder is empty' : 'No notes yet'}</h3>
          <p>{currentFolder ? 'Add a note or a subfolder from the ⋮ menu.' : 'Open the ⋮ menu and choose “New Note” to start your first whiteboard.'}</p>
        </div>
      ) : (
        <div className="nb-grid">{ordered.map(renderCell)}</div>
      )}
    </div>
  );
}