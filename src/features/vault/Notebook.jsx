import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { ImageIcon, Trash2, Move, Type, Check, Link2, Link2Off, Download, MoreVertical, NotebookPen, ZoomIn, ZoomOut, Pencil } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

const STORAGE_PREFIX = 'aust-notebook-';

function loadNotes(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveNotes(key, data) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data)); }
  catch (e) { console.error('Failed to save notebook:', e); }
}

// Resolve a theme CSS variable to its concrete color. html2canvas 1.4.1 reads
// INLINE styles literally and throws on var()/color-mix(), so any color that
// ends up in an inline style must be a plain hex/rgb value.
function resolveThemeVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    // Only accept plain colors (hex / rgb / hsl / named). Anything else
    // (var() chains, color-mix(), oklch(), …) would make html2canvas throw
    // again, so fall back to a safe literal.
    return v && /^(#([0-9a-f]{3,8})|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|white|black|currentColor)$/i.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function fitFontSize(text, width, height) {
  if (typeof document === 'undefined' || !text) return 24;
  const el = document.createElement('span');
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.style.left = '-9999px';
  el.style.whiteSpace = 'pre-wrap';
  el.style.wordBreak = 'break-word';
  el.style.width = `${Math.max(1, width)}px`;
  el.style.lineHeight = '1.4';
  el.style.fontFamily = 'inherit';
  el.textContent = text;
  document.body.appendChild(el);
  const fit = (px) => { el.style.fontSize = `${px}px`; return el.getBoundingClientRect().height; };
  let lo = 8, hi = 600, best = 24;
  for (let i = 0; i < 24; i++) {
    const mid = Math.round((lo + hi) / 2);
    if (fit(mid) <= height) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  document.body.removeChild(el);
  return best;
}

// Find the closest point where a new rect (w×h) does not overlap any existing
// item. Returns { x, y } in canvas coords, or a centering fallback.
function findFreeSpot(w, h, items, areaW, areaH) {
  const margin = 12;
  const maxX = Math.max(0, (areaW || 1000) - w - margin);
  const maxY = Math.max(0, (areaH || 600) - h - margin);
  const cx = maxX / 2 + w / 2;
  const cy = maxY / 2 + h / 2;

  const overlaps = (x, y) => {
    const r = { x, y, w, h };
    for (const it of items) {
      const a = { x: it.x, y: it.y, w: it.w, h: it.h };
      if (r.x < a.x + a.w && r.x + r.w > a.x && r.y < a.y + a.h && r.y + r.h > a.y) return true;
    }
    return false;
  };

  let best = null;
  let bestDist = Infinity;
  for (let gy = margin; gy <= maxY; gy += 40) {
    for (let gx = margin; gx <= maxX; gx += 40) {
      if (overlaps(gx, gy)) continue;
      const dx = gx + w / 2 - cx;
      const dy = gy + h / 2 - cy;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = { x: gx, y: gy }; }
    }
  }
  if (best) return best;
  return { x: cx - w / 2, y: cy - h / 2 };
}

const bottomSpot = (w, h, items, areaW) => {
  const margin = 12;
  if (items.length === 0) return { x: margin, y: margin };
  let maxBottom = -Infinity, anchorX = margin;
  for (const it of items) {
    const bottom = it.y + it.h;
    if (bottom > maxBottom) { maxBottom = bottom; anchorX = it.x; }
  }
  const maxX = Math.max(0, (areaW || 1000) - w - margin);
  return { x: Math.min(anchorX, maxX), y: maxBottom + margin };
}

export default function Notebook({ vaultContext, batch, noteKey, title, path, onBack, onSaved, onPathCrumb }) {
  const { department, yearSem } = vaultContext;
  // noteKey (from the Notebook library) gives every note its own storage slot:
  // `aust-notebook-<noteKey>`. Without it we fall back to the legacy single
  // per-batch key so old canvases keep working.
  const storageKey = noteKey || `${department}-${yearSem}-${batch?.id || 'default'}`;

  const [saved, setSaved] = useState(true);

  // Canvas state
  // Concrete theme accents for html2canvas-safe inline styles (no var()/color-mix).
  const accentBlue = resolveThemeVar('--nb-accent', '#F5A623');
  const accentPurple = resolveThemeVar('--nb-accent', '#F5A623');
  const [items, setItems] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState(null);
  const resizeStartRef = useRef(null); // { id, clientX, clientY, w, h, snapshot }
  const canvasRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const lastCanvasPoint = useRef(null);
  const [canvasZoom, setCanvasZoom] = useState(1);

  // Ctrl + scroll zooms the canvas (native listener so preventDefault works).
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCanvasZoom(z => Math.min(3, Math.max(0.3, z * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const [pasteFlash, setPasteFlash] = useState(null);
  const pasteFlashTimer = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const editedSessionRef = useRef(false); // true once the user typed during the current edit session
  const [connections, setConnections] = useState([]);
  const [connectFrom, setConnectFrom] = useState(null);
  const [boxColor, setBoxColor] = useState('#F5A623');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [editItemId, setEditItemId] = useState(null); // which item's edit menu is open
  const [drawMode, setDrawMode] = useState(false);
  const [drawPhase, setDrawPhase] = useState('idle'); // idle | placing | done
  const [drawStart, setDrawStart] = useState(null);
  const [manualLines, setManualLines] = useState([]);
  const [drawPreview, setDrawPreview] = useState(null);
  const [lineColor, setLineColor] = useState('#22c55e');
  const [lineStyle, setLineStyle] = useState('solid'); // solid | dashed | dotted
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [selectedConnId, setSelectedConnId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the ⋮ menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // Load saved data (with one-time migration from the old per-batch vault keys)
  useEffect(() => {
    let saved = loadNotes(storageKey);
    if (!saved && !noteKey) {
      // Notebook used to live inside the Vault, where notes were saved under a
      // per-batch key. Fold any legacy canvas notes into this page's key so
      // nothing is stranded after the Notebook moved to its own sidebar entry.
      const legacy = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX) && k !== STORAGE_PREFIX + storageKey) {
          try {
            const d = JSON.parse(localStorage.getItem(k));
            if (d && (Array.isArray(d.items) && d.items.length > 0)) legacy.push(d);
          } catch { /* skip unreadable entries */ }
        }
      }
      if (legacy.length > 0) {
        saved = {
          items: legacy.flatMap((d, idx) => (d.items || []).map(it => ({ ...it, y: (it.y || 0) + idx * 40 }))),
          connections: legacy.flatMap(d => d.connections || []),
          manualLines: legacy.flatMap(d => d.manualLines || []),
        };
        saveNotes(storageKey, saved);
      }
    }
    if (saved) {
      if (saved.items) setItems(saved.items);
      if (saved.connections) setConnections(saved.connections);
      if (saved.manualLines) setManualLines(saved.manualLines);
    }
  }, [storageKey, noteKey]);

  // Auto-save
  const doSave = useCallback(() => {
    const data = { items, connections, manualLines };
    saveNotes(storageKey, data);
    setSaved(true);
    if (noteKey) onSaved?.(noteKey);
  }, [items, connections, manualLines, storageKey, noteKey, onSaved]);

  useEffect(() => {
    if (!saved) {
      const timer = setTimeout(doSave, 500);
      return () => clearTimeout(timer);
    }
  }, [saved, doSave]);

  const markDirty = () => setSaved(false);

  // ─── Auto-size text boxes: bigger content → bigger box, wrapping grows the box, no scroll ───
  const TEXT_MAX_W = 440;
  const TEXT_MIN_W = 160;
  const TEXT_MIN_H = 56;

  const sizeToContent = (id, el) => {
    if (!el) return;
    // Natural width = widest unwrapped line
    const prevWs = el.style.whiteSpace;
    const prevH = el.style.height;
    const prevO = el.style.overflow;
    el.style.whiteSpace = 'nowrap';
    el.style.height = 'auto';
    el.style.overflow = 'hidden';
    const naturalW = el.scrollWidth;
    const newW = Math.max(TEXT_MIN_W, Math.min(TEXT_MAX_W, naturalW + 6));

    // Height measured at the new target width — with wrapping ENABLED so
    // multi-line text grows the box to fit everything (no inner scroll).
    el.style.width = `${newW}px`;
    el.style.whiteSpace = 'pre-wrap';
    const contentH = el.scrollHeight;
    const newH = Math.max(TEXT_MIN_H, contentH + 4);

    el.style.whiteSpace = prevWs;
    el.style.height = prevH;
    el.style.overflow = prevO;
    el.style.width = '';

    setItems(prev => prev.map(i => (i.id === id ? { ...i, w: newW, h: newH } : i)));
    markDirty();
  };

  // ─── Canvas / Whiteboard ───

  const addCanvasImage = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      pushUndo();
      setItems(prev => {
        const spot = bottomSpot(300, 200, prev, wrapSize.w ? wrapSize.w / canvasZoom : 1000);
        return [...prev, {
          id: Date.now(),
          type: 'image',
          src: ev.target.result,
          x: spot.x,
          y: spot.y,
          w: 300,
          h: 200,
          borderColor: boxColor,
        }];
      });
      markDirty();
    };
    reader.readAsDataURL(file);
  };

  const addTextBox = () => {
    pushUndo();
    setItems(prev => {
      const spot = bottomSpot(200, 60, prev, wrapSize.w ? wrapSize.w / canvasZoom : 1000);
      return [...prev, {
        id: Date.now(),
        type: 'text',
        content: 'Double-click to edit',
        x: spot.x,
        y: spot.y,
        w: 200,
        h: 60,
        borderColor: boxColor,
      }];
    });
    setEditingId(null);
    markDirty();
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files) {
      for (const f of files) {
        if (f.type.startsWith('image/')) { addCanvasImage(f); break; }
      }
    }
  };

  const handleCanvasDragOver = (e) => { e.preventDefault(); };

  // ─── Canvas paste (Ctrl+V): screenshot / image → image item, text → text box ───
  const handleCanvasPaste = useCallback((e) => {
    const flash = (msg) => {
      setPasteFlash(msg);
      clearTimeout(pasteFlashTimer.current);
      pasteFlashTimer.current = setTimeout(() => setPasteFlash(null), 1400);
    };

    // Snapshot the current canvas state before a mutation so undo can restore it
    const pushSnapshot = () => {
      undoStack.current.push({
        items: [...stateRef.current.items],
        connections: [...stateRef.current.connections],
        manualLines: [...stateRef.current.manualLines],
      });
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
    };

    const addImage = (blob) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target.result;
        const probe = new Image(); // global Image constructor (icon import is renamed)
        probe.onload = () => {
          // Fit the pasted image sensibly on the canvas, keeping aspect ratio
          const maxW = 360;
          const maxH = 240;
          const scale = Math.min(1, maxW / probe.naturalWidth, maxH / probe.naturalHeight);
          const w = Math.max(80, Math.round(probe.naturalWidth * scale));
          const h = Math.max(60, Math.round(probe.naturalHeight * scale));
          // Place where the user last clicked, else a staggered default spot
          const pos = lastCanvasPoint.current || { x: 100 + Math.random() * 120, y: 100 + Math.random() * 120 };
          pushSnapshot();
          setItems(prev => [...prev, {
            id: Date.now(),
            type: 'image',
            src,
            x: pos.x,
            y: pos.y,
            w,
            h,
            borderColor: boxColor,
          }]);
          flash('Image pasted to canvas');
          setSaved(false);
        };
        probe.onerror = () => flash('Could not paste image');
        probe.src = src;
      };
      reader.readAsDataURL(blob);
    };

    // Prefer clipboardData.items (Chromium, Firefox); fall back to files for Safari
    let handled = false;
    const clipboardItems = e.clipboardData?.items;
    if (clipboardItems) {
      for (const item of clipboardItems) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            addImage(blob);
            handled = true;
            break;
          }
        }
      }
    }
    if (!handled) {
      const file = e.clipboardData?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        addImage(file);
        handled = true;
      }
    }
    if (handled) return true;

    // Plain text → create a text box, unless focus is in an input/textarea or
    // the user is editing an existing canvas text box (let native paste handle it)
    const active = document.activeElement;
    const inEditable = active && (
      active.isContentEditable ||
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA'
    );
    if (!inEditable) {
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim()) {
        e.preventDefault();
        const pos = lastCanvasPoint.current || { x: 100 + Math.random() * 120, y: 100 + Math.random() * 120 };
        pushSnapshot();
        const newId = Date.now();
        setItems(prev => [...prev, {
          id: newId,
          type: 'text',
          content: text.trim(),
          x: pos.x,
          y: pos.y,
          w: 200,
          h: 60,
          borderColor: boxColor,
        }]);
        requestAnimationFrame(() => {
          const el = canvasRef.current?.querySelector(`[data-item-id="${newId}"] .nb-canvas-text`);
          if (el) sizeToContent(newId, el);
        });
        flash('Text pasted to canvas');
        setSaved(false);
        return true;
      }
    }
    return false;
  }, []);

  // Window-level paste fallback (fires when focus is outside the canvas).
  // Lets the editor/inputs handle their own paste natively, otherwise routes
  // the clipboard into the canvas so Ctrl+V reliably delivers clipboard data.
  useEffect(() => {
    const onWindowPaste = async (e) => {
      if (e.defaultPrevented) return; // already handled by the canvas onPaste
      // Let inputs handle their own paste natively
      const active = document.activeElement;
      if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      // 1) Synchronous clipboardData path.
      if (handleCanvasPaste(e)) return;
      // 2) Async Clipboard API fallback for browsers where the paste event
      //    doesn't expose the image data (some Safari / restricted contexts).
      try {
        const cb = navigator.clipboard;
        if (cb && typeof cb.read === 'function') {
          const items = await cb.read();
          for (const item of items) {
            const imgType = item.types.find(t => t.startsWith('image/'));
            if (imgType) {
              const blob = await item.getType(imgType);
              // Synthesize a minimal paste-like event so the same handler runs
              handleCanvasPaste({
                clipboardData: { items: null, files: [blob], getData: () => '' },
                preventDefault: () => {},
              });
              return;
            }
          }
        }
      } catch { /* clipboard read unavailable / permission denied */ }
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handleCanvasPaste]);

  // Clear the paste-flash timer on unmount
  useEffect(() => () => clearTimeout(pasteFlashTimer.current), []);

  // ─── Undo / Redo (Ctrl+Z undo · Ctrl+Shift+Z redo) ───
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const dragStartState = useRef(null);
  const stateRef = useRef({ items: [], connections: [], manualLines: [] });
  useEffect(() => { stateRef.current = { items, connections, manualLines }; }, [items, connections, manualLines]);

  const pushUndo = () => {
    undoStack.current.push({
      items: [...stateRef.current.items],
      connections: [...stateRef.current.connections],
      manualLines: [...stateRef.current.manualLines],
    });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  };

  // Canvas keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo.
  // The undo/redo logic is inlined here so the listener only depends on stable
  // refs/setters and never needs to re-subscribe.
  useEffect(() => {
    const restore = (snap) => {
      setItems(snap.items);
      setConnections(snap.connections);
      setManualLines(snap.manualLines);
      // Cancel any in-progress draw / connect / edit / drag state
      setDrawPhase('idle');
      setDrawStart(null);
      setDrawPreview(null);
      setConnectFrom(null);
      setEditingId(null);
      setDragId(null);
      setResizingId(null);
      resizeStartRef.current = null;
      setSaved(false);
    };
    const undoNow = () => {
      const prev = undoStack.current.pop();
      if (!prev) return;
      redoStack.current.push({
        items: [...stateRef.current.items],
        connections: [...stateRef.current.connections],
        manualLines: [...stateRef.current.manualLines],
      });
      restore(prev);
    };
    const redoNow = () => {
      const next = redoStack.current.pop();
      if (!next) return;
      undoStack.current.push({
        items: [...stateRef.current.items],
        connections: [...stateRef.current.connections],
        manualLines: [...stateRef.current.manualLines],
      });
      restore(next);
    };
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Don't hijack shortcuts while typing inside a text box / input
      const active = document.activeElement;
      if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && e.shiftKey) { e.preventDefault(); redoNow(); }
      else if (k === 'z') { e.preventDefault(); undoNow(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Deselect the active line / connection with Escape
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setSelectedLineId(null);
        setSelectedConnId(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const startDrag = (e, id) => {
    if (drawMode) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    dragStartState.current = stateRef.current;
    setDragId(id);
    setDragOff({ x: e.clientX - item.x * canvasZoom, y: e.clientY - item.y * canvasZoom });
  };

  // ─── Real-time resize (drag the corner handle) ───
  const startResize = (e, id) => {
    if (drawMode) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    e.stopPropagation(); // don't start a move-drag / connect
    resizeStartRef.current = {
      id,
      clientX: e.clientX,
      clientY: e.clientY,
      w: item.w,
      h: item.h,
      snapshot: stateRef.current,
    };
    setResizingId(id);
  };

  const onCanvasMouseMove = (e) => {
    if (resizingId) {
      const rs = resizeStartRef.current;
      if (!rs) return;
      const dx = (e.clientX - rs.clientX) / canvasZoom;
      const dy = (e.clientY - rs.clientY) / canvasZoom;
      const newW = Math.max(80, rs.w + dx);
      const newH = Math.max(40, rs.h + dy);
      setItems(prev => prev.map(i => (i.id === resizingId ? { ...i, w: newW, h: newH } : i)));
      return;
    }
    if (!dragId) return;
    setItems(prev => prev.map(i =>
      i.id === dragId
        ? { ...i, x: (e.clientX - dragOff.x) / canvasZoom, y: (e.clientY - dragOff.y) / canvasZoom }
        : i
    ));
  };

  const stopDrag = () => {
    if (resizingId) {
      const rs = resizeStartRef.current;
      const after = stateRef.current;
      const afterItem = after.items.find(i => i.id === resizingId);
      if (rs && afterItem && (rs.w !== afterItem.w || rs.h !== afterItem.h)) {
        undoStack.current.push({
          items: [...rs.snapshot.items],
          connections: [...rs.snapshot.connections],
          manualLines: [...rs.snapshot.manualLines],
        });
        redoStack.current = [];
      }
      setResizingId(null);
      resizeStartRef.current = null;
      markDirty();
      return;
    }
    if (dragId) {
      // Record an undo step only if the item actually moved
      const before = dragStartState.current;
      const after = stateRef.current;
      const beforeItem = before?.items.find(i => i.id === dragId);
      const afterItem = after.items.find(i => i.id === dragId);
      if (beforeItem && afterItem && (beforeItem.x !== afterItem.x || beforeItem.y !== afterItem.y)) {
        undoStack.current.push({
          items: [...before.items],
          connections: [...before.connections],
          manualLines: [...before.manualLines],
        });
        redoStack.current = [];
      }
      setDragId(null);
      markDirty();
    }
  };

  const updateItemContent = (id, content) => {
    const current = items.find(i => i.id === id);
    if (current && current.content === content) return; // no change → no junk undo entry
    pushUndo();
    setItems(prev => prev.map(i => i.id === id ? { ...i, content } : i));
    markDirty();
  };


  // ─── Connections ───
  const toggleConnectMode = () => {
    setConnectFrom(prev => prev === null ? 'ready' : null);
    setDrawMode(false);
    setSelectedLineId(null);
    setSelectedConnId(null);
  };

  const handleItemClick = (id) => {
    if (!connectFrom) return;
    if (connectFrom === 'ready') {
      setConnectFrom(id);
    } else if (connectFrom !== id) {
      pushUndo();
      setConnections(prev => {
        const exists = prev.find(c => c.fromId === connectFrom && c.toId === id);
        if (exists) return prev.filter(c => c.id !== exists.id);
        const newConn = {
          id: Date.now(),
          fromId: connectFrom,
          toId: id,
        };
        return [...prev, newConn];
      });
      setConnectFrom('ready');
      markDirty();
    } else {
      setConnectFrom('ready');
    }
  };

  const deleteConnection = (connId) => {
    pushUndo();
    setConnections(prev => prev.filter(c => c.id !== connId));
    if (selectedConnId === connId) setSelectedConnId(null);
    markDirty();
  };

  const updateConnectionStyle = (connId, patch) => {
    pushUndo();
    setConnections(prev => prev.map(c => c.id === connId ? { ...c, ...patch } : c));
    markDirty();
  };

  // Remove orphan connections when an item is deleted
  const deleteItem = (id) => {
    pushUndo();
    setItems(prev => prev.filter(i => i.id !== id));
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    if (connectFrom === id || connectFrom === 'ready') setConnectFrom(null);
    markDirty();
  };

  const setItemBorderColor = (id, color) => {
    pushUndo();
    setItems(prev => prev.map(i => (i.id === id ? { ...i, borderColor: color } : i)));
    markDirty();
  };

  const shapeStyle = (s) => {
    switch (s) {
      case 'rounded': return { borderRadius: 16 };
      case 'circle': return { borderRadius: '50%', aspectRatio: '1 / 1' };
      case 'oval': return { borderRadius: '50%' };
      case 'triangle': return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' };
      case 'hexagon': return { clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' };
      default: return { borderRadius: 0 };
    }
  };

  const setItemShape = (id, shape) => {
    pushUndo();
    setItems(prev => prev.map(i => (i.id === id ? { ...i, shape } : i)));
    markDirty();
  };

  const SHAPES = [
    { key: 'rect', label: 'Rectangle' },
    { key: 'rounded', label: 'Rounded' },
    { key: 'circle', label: 'Circle' },
    { key: 'oval', label: 'Oval' },
    { key: 'triangle', label: 'Triangle' },
    { key: 'hexagon', label: 'Hexagon' },
  ];

  // ─── Manual drawing ───
  const getCanvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / canvasZoom, y: (e.clientY - rect.top) / canvasZoom };
  };

  const handleDrawClick = (e) => {
    if (!drawMode) return;
    const pt = getCanvasPoint(e);

    if (drawPhase === 'idle') {
      setDrawStart(pt);
      setDrawPreview(pt);
      setDrawPhase('placing');
    } else if (drawPhase === 'placing') {
      const dx = pt.x - drawStart.x;
      const dy = pt.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        pushUndo();
        setManualLines(prev => [...prev, { x1: drawStart.x, y1: drawStart.y, x2: pt.x, y2: pt.y, id: Date.now(), color: lineColor, style: lineStyle }]);
        markDirty();
      }
      setDrawPhase('idle');
      setDrawPreview(null);
      setDrawStart(null);
    }
  };

  const onDrawMouseMove = (e) => {
    if (drawPhase === 'placing') {
      const pt = getCanvasPoint(e);
      setDrawPreview(pt);
    } else if (drawPreview) {
      setDrawPreview(null);
    }
  };

  const deleteLine = (lineId) => {
    pushUndo();
    setManualLines(prev => prev.filter(l => l.id !== lineId));
    if (selectedLineId === lineId) setSelectedLineId(null);
    markDirty();
  };

  const updateLineStyle = (lineId, patch) => {
    pushUndo();
    setManualLines(prev => prev.map(l => l.id === lineId ? { ...l, ...patch } : l));
    markDirty();
  };

  const toggleDrawMode = () => {
    setDrawMode(prev => !prev);
    setDrawPhase('idle');
    setDrawStart(null);
    setDrawPreview(null);
    setConnectFrom(null);
    setSelectedLineId(null);
    setSelectedConnId(null);
  };

  // ─── Clear ───
  const clearCanvas = () => {
    pushUndo();
    setItems([]);
    setConnections([]);
    setManualLines([]);
    setDrawStart(null);
    setDrawPreview(null);
    setDrawPhase('idle');
    setSelectedLineId(null);
    setSelectedConnId(null);
    markDirty();
  };

  const canvasHeight = useMemo(() => {
    if (items.length === 0) return 800;
    const maxY = Math.max(...items.map(i => (i.y || 0) + (i.h || 100)));
    return Math.max(800, maxY + 300);
  }, [items]);

  // Track the visible wrapper viewport so the grid/background can always fill it.
  // The canvas is rendered at layout size then scaled with transform: scale().
  // Without compensation, zooming out shrinks the visual canvas below the
  // wrapper and the grid stops mid-viewport (background "cut off").
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const update = () => setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layout size that, once scaled, still covers the whole wrapper viewport.
  const zoomFillW = wrapSize.w ? wrapSize.w / canvasZoom : 0;
  const zoomFillH = wrapSize.h ? wrapSize.h / canvasZoom : 0;
  const canvasLayoutW = Math.max(wrapSize.w, zoomFillW);
  const canvasLayoutH = Math.max(canvasHeight, zoomFillH);

  const linksCount = connections.length + manualLines.length;

  // ─── Export (whole board, regardless of zoom/scroll) ───
  const getBoardBounds = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const include = (x, y, w, h) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + (w || 0)); maxY = Math.max(maxY, y + (h || 0));
    };
    items.forEach(i => include(i.x || 0, i.y || 0, i.w || 0, i.h || 0));
    manualLines.forEach(l => {
      minX = Math.min(minX, l.x1, l.x2); minY = Math.min(minY, l.y1, l.y2);
      maxX = Math.max(maxX, l.x1, l.x2); maxY = Math.max(maxY, l.y1, l.y2);
    });
    connections.forEach(c => {
      const from = items.find(i => i.id === c.fromId);
      const to = items.find(i => i.id === c.toId);
      if (from) include(from.x, from.y, from.w, from.h);
      if (to) include(to.x, to.y, to.w, to.h);
    });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 800; }
    return { minX, minY, maxX, maxY };
  };

  // Temporarily sizes the canvas element to the full content bounds (selection
  // UI hidden), captures the whole board with html2canvas, then restores.
  const captureFullCanvas = async () => {
    const el = canvasRef.current;
    if (!el) return null;
    const PAD = 40;
    const b = getBoardBounds();
    // Clamp to the origin so the shift never becomes negative padding (which
    // is invalid CSS and silently breaks the capture).
    const minX = Math.min(0, Math.floor(b.minX));
    const minY = Math.min(0, Math.floor(b.minY));
    const maxX = Math.max(400, Math.ceil(b.maxX));
    const maxY = Math.max(400, Math.ceil(b.maxY));
    const width = maxX - minX + PAD * 2;
    const height = maxY - minY + PAD * 2;

    const orig = {
      transform: el.style.transform,
      width: el.style.width,
      height: el.style.height,
      minHeight: el.style.minHeight,
      paddingTop: el.style.paddingTop,
      paddingLeft: el.style.paddingLeft,
      paddingRight: el.style.paddingRight,
      paddingBottom: el.style.paddingBottom,
    };

    el.classList.add('nb-exporting');
    try {
      el.style.transform = 'none';
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.minHeight = '0';
      // Shift absolutely-positioned children so the whole board (including any
      // content dragged to negative coordinates) lands inside the padded box.
      el.style.paddingLeft = `${PAD - minX}px`;
      el.style.paddingTop = `${PAD - minY}px`;
      el.style.paddingRight = `${PAD}px`;
      el.style.paddingBottom = `${PAD}px`;

      return await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
      });
    } finally {
      el.classList.remove('nb-exporting');
      el.style.transform = orig.transform;
      el.style.width = orig.width;
      el.style.height = orig.height;
      el.style.minHeight = orig.minHeight;
      el.style.paddingTop = orig.paddingTop;
      el.style.paddingLeft = orig.paddingLeft;
      el.style.paddingRight = orig.paddingRight;
      el.style.paddingBottom = orig.paddingBottom;
    }
  };

  const flashExport = (msg) => {
    setPasteFlash(msg);
    clearTimeout(pasteFlashTimer.current);
    pasteFlashTimer.current = setTimeout(() => setPasteFlash(null), 2000);
  };

  const exportAsImage = async () => {
    try {
      const canvas = await captureFullCanvas();
      if (!canvas) { flashExport('Nothing to export'); return; }
      const link = document.createElement('a');
      link.download = `notebook-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      // The anchor must be in the DOM for the download attribute to fire
      // in Chrome/Firefox — a detached anchor's click() silently no-ops.
      document.body.appendChild(link);
      link.click();
      link.remove();
      flashExport('PNG downloaded ✓');
    } catch (e) {
      console.error('Export failed:', e);
      flashExport('Export failed — try again');
    }
  };

  const exportAsPDF = async () => {
    try {
      const canvas = await captureFullCanvas();
      if (!canvas) { flashExport('Nothing to export'); return; }
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let heightLeft = pdfH;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
      while (heightLeft > pdf.internal.pageSize.getHeight()) {
        position -= pdf.internal.pageSize.getHeight();
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`notebook-${Date.now()}.pdf`);
      flashExport('PDF downloaded ✓');
    } catch (e) {
      console.error('PDF export failed:', e);
      flashExport('Export failed — try again');
    }
  };

  // ─── Canvas image upload via click ───
  const canvasFileRef = useRef(null);

  return (
    <div className="glass-card-static schedule-widget nb-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        {/* Left: title block */}
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <NotebookPen size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Study Canvas</span>
            <div className="schedule-title">Notebook</div>
            <span className="schedule-subtitle">Paste Ctrl+V · drag &amp; drop images</span>
          </div>
        </div>

        {/* Center: stats */}
        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{items.length}</span>
              <span className="schedule-stat-label">Items</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{linksCount}</span>
              <span className="schedule-stat-label">Links</span>
            </div>
            <div className="schedule-stat">
              <span className={`schedule-stat-value nb-saved-value${saved ? ' is-saved' : ''}`}>
                {saved ? '✓' : '…'}
              </span>
              <span className="schedule-stat-label">Saved</span>
            </div>
          </div>
        </div>

        {/* Right: zoom nav + ⋮ menu */}
        <div className="schedule-actions">
          <div className="schedule-week-nav">
            <button className="schedule-nav-btn" onClick={() => setCanvasZoom(z => Math.max(0.3, z - 0.1))} title="Zoom out">
              <ZoomOut size={16} />
            </button>
            <div className="schedule-week-pill">
              <span className="schedule-week-pill-value">{Math.round(canvasZoom * 100)}%</span>
            </div>
            <button className="schedule-nav-btn" onClick={() => setCanvasZoom(z => Math.min(3, z + 0.1))} title="Zoom in">
              <ZoomIn size={16} />
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
                <button className="export-menu-item" onClick={() => { addTextBox(); setMenuOpen(false); }}>
                  <Type size={14} /> Add Text Box
                </button>
                <button className="export-menu-item" onClick={() => { canvasFileRef.current?.click(); setMenuOpen(false); }}>
                  <ImageIcon size={14} /> Add Image
                </button>
                <div className="export-menu-sep" />
                <button className={`export-menu-item${drawMode ? ' menu-active' : ''}`} onClick={() => { toggleDrawMode(); setMenuOpen(false); }}>
                  <Move size={14} /> Draw Line {drawMode && <Check size={14} className="menu-check" />}
                </button>
                <button className={`export-menu-item${connectFrom ? ' menu-active' : ''}`} onClick={() => { toggleConnectMode(); setMenuOpen(false); }}>
                  {connectFrom ? <Link2Off size={14} /> : <Link2 size={14} />} Connect Items {connectFrom && <Check size={14} className="menu-check" />}
                </button>
                <div className="export-menu-sep" />
                <button className="export-menu-item" onClick={() => { exportAsImage(); setMenuOpen(false); }}>
                  <Download size={14} /> Export as PNG
                </button>
                <button className="export-menu-item" onClick={() => { exportAsPDF(); setMenuOpen(false); }}>
                  <Download size={14} /> Export as PDF
                </button>
                <div className="export-menu-sep" />
                <button className="export-menu-item" onClick={() => { clearCanvas(); setMenuOpen(false); }}>
                  <Trash2 size={14} /> Clear Canvas
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {(title || (path && path.length > 0)) && (
        <div className="nb-location-bar">
          <div className="nb-location-crumbs">
            <button className="nb-location-crumb" onClick={() => onPathCrumb?.(null)}>Home</button>
            {(path || []).map((p, i) => (
              <span key={p.id || i} className="nb-location-seg">
                <span className="nb-location-sep">›</span>
                <button className="nb-location-crumb" onClick={() => onPathCrumb?.(p.id)}>{p.title}</button>
              </span>
            ))}
          </div>
          {title && <span className="nb-location-title">{title}</span>}
        </div>
      )}

      {/* Contextual draw toolbar (shown while Draw mode is on) */}
      {drawMode && (
        <div className="nb-draw-bar">
          <span className="nb-draw-label">Line</span>
          {['#22c55e','#ef4444','#3b82f6','#eab308','#a855f7','#f97316'].map(c => (
            <button
              key={c}
              className={`nb-line-swatch ${lineColor === c ? 'active' : ''}`}
              onClick={() => setLineColor(c)}
              title={c}
              style={{ background: c }}
            />
          ))}
          <span className="nb-fmt-sep" />
          {['solid','dashed','dotted'].map(s => (
            <button key={s} className={`nb-line-style-btn ${lineStyle === s ? 'active' : ''}`} onClick={() => setLineStyle(s)}>
              {s === 'solid' ? '━━' : s === 'dashed' ? '╌╌' : '┅┅'}
            </button>
          ))}
          <span className="nb-draw-hint">
            {drawPhase === 'placing' ? 'Click to end · Right-click cancel' : 'Click to draw · Right-click remove'} · Ctrl+Z undo · Ctrl+Shift+Z redo
          </span>
        </div>
      )}
      {connectFrom && connectFrom !== 'ready' && (
        <div className="nb-connect-hint">Click another item to connect</div>
      )}

      <input ref={canvasFileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) addCanvasImage(f); e.target.value = ''; }} />

      <div
        className="nb-canvas-wrap"
        ref={canvasWrapRef}
        style={{
          // Grid tiles live on the scrolling wrapper and must scale with the
          // canvas so lines stay aligned with the zoomed items.
          backgroundSize: `${40 * canvasZoom}px ${40 * canvasZoom}px`,
        }}
      >
        <div
          ref={canvasRef}
          className={`nb-canvas ${drawMode ? 'draw-active' : ''}`}
          tabIndex={-1}
          onPaste={handleCanvasPaste}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          onMouseMove={(e) => { onDrawMouseMove(e); onCanvasMouseMove(e); }}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              lastCanvasPoint.current = getCanvasPoint(e);
              setConnectFrom(null);
              setSelectedLineId(null);
              setSelectedConnId(null);
              setSelectedItemId(null);
              setEditItemId(null);
              canvasRef.current?.focus({ preventScroll: true });
            }
            if (drawMode) { handleDrawClick(e); return; }
          }}
          onContextMenu={(e) => {
            if (!drawMode) return; // keep the browser menu outside draw mode
            e.preventDefault();
            if (drawPhase === 'placing') {
              // Right-click while placing cancels the in-progress line
              setDrawPhase('idle');
              setDrawPreview(null);
              setDrawStart(null);
            } else if (manualLines.length > 0) {
              // Right-click removes the last drawn line
              pushUndo();
              setManualLines(prev => prev.slice(0, -1));
              setSaved(false);
            }
          }}
          style={{ transform: `scale(${canvasZoom})`, transformOrigin: '0 0', width: canvasLayoutW, height: canvasLayoutH }}
        >
          {/* Canvas grid background */}
          <div className="nb-canvas-grid" />

          {/* Manual lines */}
          {manualLines.map(line => {
            const dx = line.x2 - line.x1;
            const dy = line.y2 - line.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const col = line.color || '#22c55e';
            const isSolid = !line.style || line.style === 'solid';
            return (
              <Fragment key={line.id}>
                <div style={{
                  position: 'absolute',
                  left: line.x1,
                  top: line.y1 - (isSolid ? 1 : 0),
                  width: len,
                  height: isSolid ? 3 : 0,
                  background: isSolid ? `linear-gradient(90deg, ${col}, ${col}cc)` : 'transparent',
                  borderTop: isSolid ? 'none' : line.style === 'dashed' ? `2px dashed ${col}` : `2px dotted ${col}`,
                  borderRadius: 2,
                  filter: `drop-shadow(0 0 4px ${col})`,
                  transformOrigin: '0 0',
                  transform: `rotate(${angle}deg)`,
                  pointerEvents: 'none',
                  zIndex: 0,
                }} />
                <div
                  className={`nb-line-hit ${selectedLineId === line.id ? 'selected' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedConnId(null); setSelectedLineId(prev => prev === line.id ? null : line.id); }}
                  style={{
                    position: 'absolute',
                    left: line.x1,
                    top: line.y1 - 7,
                    width: len,
                    height: 14,
                    transformOrigin: '0 0',
                    transform: `rotate(${angle}deg)`,
                    cursor: 'pointer',
                    pointerEvents: drawMode ? 'none' : 'auto',
                    zIndex: 1,
                  }}
                  title="Edit line"
                />
                <div
                  className="nb-line-arrow"
                  onClick={(e) => { e.stopPropagation(); deleteLine(line.id); }}
                  style={{
                    position: 'absolute',
                    left: line.x2 - 6,
                    top: line.y2 - 6,
                    width: 12,
                    height: 12,
                    background: col,
                    clipPath: 'polygon(0% 20%, 100% 50%, 0% 80%)',
                    filter: `drop-shadow(0 0 3px ${col})`,
                    transform: `rotate(${angle}deg)`,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 2,
                  }}
                  title="Delete line"
                />
                <div style={{
                  position: 'absolute',
                  left: line.x1 - 3,
                  top: line.y1 - 3,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: col,
                  filter: `drop-shadow(0 0 3px ${col})`,
                  pointerEvents: 'none',
                  zIndex: 0,
                }} />
              </Fragment>
            );
          })}
          {/* Line / connection options popover — shows when a line or connection is selected */}
          {(selectedLineId || selectedConnId) && (() => {
            const isConn = !!selectedConnId;
            const line = isConn
              ? connections.find(c => c.id === selectedConnId)
              : manualLines.find(l => l.id === selectedLineId);
            if (!line) return null;
            let mx;
            let my;
            if (isConn) {
              const from = items.find(i => i.id === line.fromId);
              const to = items.find(i => i.id === line.toId);
              if (!from || !to) return null;
              mx = (from.x + from.w / 2 + to.x + to.w / 2) / 2;
              my = (from.y + from.h / 2 + to.y + to.h / 2) / 2;
            } else {
              mx = (line.x1 + line.x2) / 2;
              my = (line.y1 + line.y2) / 2;
            }
            const activeCol = line.color || (isConn ? '#3b82f6' : '#22c55e');
            const activeStyle = line.style || 'solid';
            const applyPatch = (patch) =>
              isConn ? updateConnectionStyle(line.id, patch) : updateLineStyle(line.id, patch);
            return (
              <div
                className="nb-line-options"
                style={{ left: mx, top: my }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="nb-line-options-row">
                  {['#22c55e','#ef4444','#3b82f6','#eab308','#a855f7','#f97316'].map(c => (
                    <button
                      key={c}
                      className={`nb-line-swatch ${activeCol === c ? 'active' : ''}`}
                      onClick={() => applyPatch({ color: c })}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="nb-line-options-row">
                  {['solid','dashed','dotted'].map(s => (
                    <button
                      key={s}
                      className={`nb-line-style-btn ${activeStyle === s ? 'active' : ''}`}
                      onClick={() => applyPatch({ style: s })}
                    >
                      {s === 'solid' ? '━━' : s === 'dashed' ? '╌╌' : '┅┅'}
                    </button>
                  ))}
                  <button
                    className="nb-line-del-btn"
                    title={isConn ? 'Remove connection' : 'Delete line'}
                    onClick={() => isConn ? deleteConnection(line.id) : deleteLine(line.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })()}
          {/* Preview line */}
          {drawPreview && drawStart && (() => {
            const dx = drawPreview.x - drawStart.x;
            const dy = drawPreview.y - drawStart.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const col = lineColor;
            const isSolid = lineStyle === 'solid';
            const norm = ((angle % 360) + 360) % 360;
            const straightDeg = Math.round(norm / 90) * 90;
            const isStraight = Math.abs(straightDeg - norm) <= 1.5;
            const guideDeg = straightDeg % 360;
            return (
              <div style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0, opacity: 0.6 }}>
                <div style={{
                  position: 'absolute',
                  left: drawStart.x,
                  top: drawStart.y - (isSolid ? 1 : 0),
                  width: len,
                  height: isSolid ? 3 : 0,
                  background: isSolid ? `linear-gradient(90deg, ${col}, ${col}cc)` : 'transparent',
                  borderTop: isSolid ? 'none' : lineStyle === 'dashed' ? `2px dashed ${col}` : `2px dotted ${col}`,
                  borderRadius: 2,
                  filter: `drop-shadow(0 0 4px ${col})`,
                  transformOrigin: '0 0',
                  transform: `rotate(${angle}deg)`,
                }} />
                {isStraight && (
                  <>
                    <div style={{
                      position: 'absolute',
                      left: drawStart.x,
                      top: drawStart.y - 1,
                      width: len + 24,
                      height: 0,
                      borderTop: '2px dotted rgba(245,166,35,0.95)',
                      transformOrigin: '0 0',
                      transform: `rotate(${angle}deg)`,
                    }} />
                    <span style={{
                      position: 'absolute',
                      left: drawStart.x - 11,
                      top: drawStart.y - 28,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: 'rgba(245,166,35,0.18)',
                      color: '#f5a623',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      whiteSpace: 'nowrap',
                      filter: 'brightness(1.1)',
                    }}>{guideDeg}°</span>
                  </>
                )}
                <div style={{
                  position: 'absolute',
                  left: drawStart.x - 4,
                  top: drawStart.y - 4,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: col,
                  filter: `drop-shadow(0 0 3px ${col})`,
                  opacity: 0.8,
                }} />
              </div>
            );
          })()}
          {/* Connection lines between items */}
          {connections.map(conn => {
            const from = items.find(i => i.id === conn.fromId);
            const to = items.find(i => i.id === conn.toId);
            if (!from || !to) return null;
            const x1 = from.x + from.w / 2;
            const y1 = from.y + from.h / 2;
            const x2 = to.x + to.w / 2;
            const y2 = to.y + to.h / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const col = conn.color;
            const connStyle = conn.style || 'solid';
            const isSolid = connStyle === 'solid';
            const connColorCss = col || accentBlue;
            return (
              <Fragment key={conn.id}>
                <div style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}>
                  <div style={{
                    position: 'absolute',
                    left: x1,
                    top: y1 - (isSolid ? 1 : 0),
                    width: len,
                    height: isSolid ? 3 : 0,
                    borderRadius: 2,
                    background: isSolid
                      ? col
                        ? `linear-gradient(90deg, ${col}, ${col}cc)`
                        : `linear-gradient(90deg, ${accentBlue}, ${accentPurple})`
                      : 'transparent',
                    borderTop: isSolid ? 'none' : connStyle === 'dashed' ? `2px dashed ${connColorCss}` : `2px dotted ${connColorCss}`,
                    filter: `drop-shadow(0 0 5px ${connColorCss})`,
                    transformOrigin: '0 0',
                    transform: `rotate(${angle}deg)`,
                  }} />
                </div>
                <div
                  className={`nb-line-hit ${selectedConnId === conn.id ? 'selected' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedLineId(null); setSelectedConnId(prev => prev === conn.id ? null : conn.id); }}
                  style={{
                    position: 'absolute',
                    left: x1,
                    top: y1 - 7,
                    width: len,
                    height: 14,
                    transformOrigin: '0 0',
                    transform: `rotate(${angle}deg)`,
                    cursor: 'pointer',
                    pointerEvents: drawMode ? 'none' : 'auto',
                    zIndex: 1,
                  }}
                  title="Edit connection"
                />
                <div
                  className="nb-line-arrow"
                  onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                  style={{
                    position: 'absolute',
                    left: (x1 + x2) / 2 - 5,
                    top: (y1 + y2) / 2 - 5,
                    width: 10,
                    height: 10,
                    background: connColorCss,
                    clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)',
                    filter: `drop-shadow(0 0 3px ${connColorCss})`,
                    transform: `rotate(${angle}deg)`,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 3,
                  }}
                  title="Remove connection"
                />
              </Fragment>
            );
          })}

          {items.map(item => (
            <div
              key={item.id}
              className={`nb-canvas-item ${selectedItemId === item.id ? 'selected' : ''} ${connectFrom === item.id ? 'connecting' : ''} ${connectFrom && connectFrom !== 'ready' && connectFrom !== item.id ? 'connect-target' : ''} ${resizingId === item.id ? 'resizing' : ''}`}
              data-item-id={item.id}
              style={{ left: item.x, top: item.y, width: item.w, height: item.h, borderColor: item.borderColor || undefined }}
              onMouseDown={(e) => { setSelectedItemId(item.id); if (connectFrom) { e.stopPropagation(); handleItemClick(item.id); } else { startDrag(e, item.id); } }}
            >
              {item.type === 'image' ? (
                <img src={item.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
              ) : (
                <div
                  className={`nb-canvas-text ${editingId === item.id ? 'editing' : ''}`}
                  style={{ fontSize: `${fitFontSize(item.content, item.w - 20, item.h - 20)}px` }}
                  contentEditable={editingId === item.id}
                  suppressContentEditableWarning
                  onInput={(e) => { if (editingId === item.id) { editedSessionRef.current = true; sizeToContent(item.id, e.currentTarget); } }}
                  onBlur={(e) => { updateItemContent(item.id, e.currentTarget.textContent); if (editedSessionRef.current) sizeToContent(item.id, e.currentTarget); editedSessionRef.current = false; setEditingId(null); }}
                  onDoubleClick={(e) => { e.stopPropagation(); editedSessionRef.current = false; setEditingId(item.id); }}
                >
                  {item.content}
                </div>
              )}
              <button className="nb-canvas-del" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); if (editItemId === item.id) setEditItemId(null); if (selectedItemId === item.id) setSelectedItemId(null); }}
                onMouseDown={e => e.stopPropagation()}>
                <Trash2 size={12} />
              </button>
              {selectedItemId === item.id && (
                <button className="nb-canvas-edit" title="Edit box" onClick={(e) => { e.stopPropagation(); setEditItemId(editItemId === item.id ? null : item.id); }}
                  onMouseDown={e => e.stopPropagation()}>
                  <Pencil size={13} />
                </button>
              )}
              <div className="nb-resize-handle" title="Resize" onMouseDown={(e) => startResize(e, item.id)} />
            </div>
          ))}

          {(() => {
            const editItem = items.find(i => i.id === editItemId);
            if (!editItem) return null;
            return (
              <div className="nb-item-edit-menu" onMouseDown={e => e.stopPropagation()}
                style={{ left: editItem.x + editItem.w - 4, top: editItem.y + 34 }}>
                <div className="nb-item-edit-label">Border colour</div>
                <div className="nb-item-edit-swatches">
                  {['#F5A623', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#22d3ee', '#ec4899', '#fafafa', '#a1a1aa'].map(c => (
                    <button key={c} className={`nb-item-swatch ${(editItem.borderColor || '#F5A623') === c ? 'active' : ''}`}
                      style={{ background: c }} onClick={() => setItemBorderColor(editItem.id, c)} title={c} />
                  ))}
                </div>
                <div className="nb-item-edit-wheel">
                  <input type="color" value={editItem.borderColor || '#F5A623'}
                    onChange={(e) => setItemBorderColor(editItem.id, e.target.value)} title="Custom colour" />
                  <span>Custom</span>
                </div>
              </div>
            );
          })()}
        </div>

        {items.length === 0 && !drawMode && (
          <div className="nb-canvas-empty-hint">
            <ImageIcon size={22} />
            <span>Paste a screenshot, image or text with <kbd>Ctrl</kbd>+<kbd>V</kbd>, or drag &amp; drop an image</span>
          </div>
        )}

        {pasteFlash && (
          <div className="nb-paste-flash">{pasteFlash}</div>
        )}
      </div>

      <div className="nb-float-tool" role="toolbar" aria-label="Canvas tools">
        <button className={`nb-float-btn${drawMode ? ' active' : ''}`} onClick={toggleDrawMode} title="Draw line">
          <Move size={18} />
        </button>
        <button className={`nb-float-btn${connectFrom ? ' active' : ''}`} onClick={toggleConnectMode} title="Connect items">
          {connectFrom ? <Link2Off size={18} /> : <Link2 size={18} />}
        </button>
        <span className="nb-float-sep" />
        <button className="nb-float-btn" onClick={() => canvasFileRef.current?.click()} title="Add image">
          <ImageIcon size={18} />
        </button>
        <button className="nb-float-btn" onClick={addTextBox} title="Add text box">
          <Type size={18} />
        </button>
      </div>
    </div>
  );
}
