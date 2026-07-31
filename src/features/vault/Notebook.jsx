import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { Image, Trash2, Move, Type, Maximize2, Minimize2, Link2, Link2Off, Download, Undo2, Redo2 } from 'lucide-react';
import html2canvas from 'html2canvas';
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

export default function Notebook({ vaultContext, batch }) {
  const { department, yearSem } = vaultContext;
  const storageKey = `${department}-${yearSem}-${batch?.id || 'default'}`;

  const [saved, setSaved] = useState(true);

  // Canvas state
  const [items, setItems] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [connections, setConnections] = useState([]);
  const [connectFrom, setConnectFrom] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawPhase, setDrawPhase] = useState('idle');
  const [drawStart, setDrawStart] = useState(null);
  const [manualLines, setManualLines] = useState([]);
  const [drawPreview, setDrawPreview] = useState(null);
  const [lineColor, setLineColor] = useState('#22c55e');
  const [lineStyle, setLineStyle] = useState('solid');

  // ─── Undo / Redo history ───
  const MAX_HISTORY = 50;
  const historyRef = useRef({ undoStack: [], redoStack: [] });
  const [, setHistoryTick] = useState(0);

  const snapshot = useCallback(() => ({
    items: JSON.parse(JSON.stringify(items)),
    connections: JSON.parse(JSON.stringify(connections)),
    manualLines: JSON.parse(JSON.stringify(manualLines)),
  }), [items, connections, manualLines]);

  const pushHistory = useCallback(() => {
    const snap = snapshot();
    const h = historyRef.current;
    h.undoStack.push(snap);
    h.redoStack = [];
    if (h.undoStack.length > MAX_HISTORY) h.undoStack.shift();
    setHistoryTick(t => t + 1);
  }, [snapshot]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.undoStack.length === 0) return;
    h.redoStack.push(snapshot());
    const prev = h.undoStack.pop();
    setItems(prev.items);
    setConnections(prev.connections);
    setManualLines(prev.manualLines);
    markDirty();
    setHistoryTick(t => t + 1);
  }, [snapshot]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.redoStack.length === 0) return;
    h.undoStack.push(snapshot());
    const next = h.redoStack.pop();
    setItems(next.items);
    setConnections(next.connections);
    setManualLines(next.manualLines);
    markDirty();
    setHistoryTick(t => t + 1);
  }, [snapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const canUndo = historyRef.current.undoStack.length > 0;
  const canRedo = historyRef.current.redoStack.length > 0;

  // Load saved data
  useEffect(() => {
    const saved = loadNotes(storageKey);
    if (saved) {
      if (saved.items) setItems(saved.items);
      if (saved.connections) setConnections(saved.connections);
      if (saved.manualLines) setManualLines(saved.manualLines);
    }
  }, [storageKey]);

  // Auto-save
  const doSave = useCallback(() => {
    saveNotes(storageKey, { items, connections, manualLines });
    setSaved(true);
  }, [items, connections, manualLines, storageKey]);

  useEffect(() => {
    if (!saved) {
      const timer = setTimeout(doSave, 500);
      return () => clearTimeout(timer);
    }
  }, [saved, doSave]);

  const markDirty = () => setSaved(false);

  // ─── Canvas / Whiteboard ───

  const addCanvasImage = (file) => {
    pushHistory();
    const reader = new FileReader();
    reader.onload = (ev) => {
      setItems(prev => [...prev, {
        id: Date.now(),
        type: 'image',
        src: ev.target.result,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        w: 300,
        h: 200,
      }]);
      markDirty();
    };
    reader.readAsDataURL(file);
  };

  const addTextBox = () => {
    pushHistory();
    setItems(prev => [...prev, {
      id: Date.now(),
      type: 'text',
      content: 'Double-click to edit',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      w: 200,
      h: 60,
    }]);
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

  const startDrag = (e, id) => {
    if (drawMode) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    pushHistory();
    setDragId(id);
    setDragOff({ x: e.clientX - item.x * canvasZoom, y: e.clientY - item.y * canvasZoom });
  };

  const onCanvasMouseMove = (e) => {
    if (!dragId) return;
    setItems(prev => prev.map(i =>
      i.id === dragId
        ? { ...i, x: (e.clientX - dragOff.x) / canvasZoom, y: (e.clientY - dragOff.y) / canvasZoom }
        : i
    ));
  };

  const stopDrag = () => {
    if (dragId) { setDragId(null); markDirty(); }
  };

  const updateItemContent = (id, content) => {
    pushHistory();
    setItems(prev => prev.map(i => i.id === id ? { ...i, content } : i));
    markDirty();
  };

  // ─── Connections ───
  const toggleConnectMode = () => {
    setConnectFrom(prev => prev === null ? 'ready' : null);
    setDrawMode(false);
  };

  const handleItemClick = (id) => {
    if (!connectFrom) return;
    if (connectFrom === 'ready') {
      setConnectFrom(id);
    } else if (connectFrom !== id) {
      pushHistory();
      setConnections(prev => {
        const exists = prev.find(c => c.fromId === connectFrom && c.toId === id);
        if (exists) return prev.filter(c => c.id !== exists.id);
        return [...prev, { id: Date.now(), fromId: connectFrom, toId: id }];
      });
      setConnectFrom('ready');
      markDirty();
    } else {
      setConnectFrom('ready');
    }
  };

  const deleteConnection = (connId) => {
    pushHistory();
    setConnections(prev => prev.filter(c => c.id !== connId));
    markDirty();
  };

  const deleteItem = (id) => {
    pushHistory();
    setItems(prev => prev.filter(i => i.id !== id));
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    if (connectFrom === id || connectFrom === 'ready') setConnectFrom(null);
    markDirty();
  };

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
        pushHistory();
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

  const handleCanvasContextMenu = (e) => {
    if (drawMode && drawPhase === 'placing') {
      e.preventDefault();
      setDrawPhase('idle');
      setDrawPreview(null);
      setDrawStart(null);
      return;
    }
    if (drawMode) e.preventDefault();
  };

  const deleteLine = (lineId) => {
    pushHistory();
    setManualLines(prev => prev.filter(l => l.id !== lineId));
    markDirty();
  };

  const toggleDrawMode = () => {
    setDrawMode(prev => !prev);
    setDrawPhase('idle');
    setDrawStart(null);
    setDrawPreview(null);
    setConnectFrom(null);
  };

  // ─── Canvas paste (Ctrl+V) ───
  const handleCanvasPaste = useCallback((e) => {
    const data = e.clipboardData;
    if (!data) return;
    const pasteItems = data.items;
    if (!pasteItems) return;

    for (const item of pasteItems) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        pushHistory();
        const reader = new FileReader();
        reader.onload = (ev) => {
          const canvasEl = canvasRef.current;
          const sl = canvasEl?.scrollLeft || 0;
          const st = canvasEl?.scrollTop || 0;
          setItems(prev => [...prev, {
            id: Date.now(), type: 'image', src: ev.target.result,
            x: (sl / canvasZoom) + 60 + Math.random() * 40,
            y: (st / canvasZoom) + 60 + Math.random() * 40,
            w: 300, h: 200,
          }]);
          markDirty();
        };
        reader.readAsDataURL(blob);
        return;
      }
    }

    const text = data.getData('text/plain');
    if (text && text.trim()) {
      e.preventDefault();
      pushHistory();
      const canvasEl = canvasRef.current;
      const sl = canvasEl?.scrollLeft || 0;
      const st = canvasEl?.scrollTop || 0;
      setItems(prev => [...prev, {
        id: Date.now(), type: 'text', content: text.trim(),
        x: (sl / canvasZoom) + 80 + Math.random() * 40,
        y: (st / canvasZoom) + 80 + Math.random() * 40,
        w: 300, h: 80,
      }]);
      markDirty();
    }
  }, [canvasZoom, pushHistory]);

  // ─── Clear ───
  const clearCanvas = () => {
    pushHistory();
    setItems([]);
    setConnections([]);
    setManualLines([]);
    setDrawStart(null);
    setDrawPreview(null);
    setDrawPhase('idle');
    markDirty();
  };

  const canvasHeight = useMemo(() => {
    if (items.length === 0) return 800;
    const maxY = Math.max(...items.map(i => (i.y || 0) + (i.h || 100)));
    return Math.max(800, maxY + 300);
  }, [items]);

  // ─── Export ───
  const exportAsImage = async () => {
    const el = canvasRef.current;
    if (!el) return;
    try {
      const origTransform = el.style.transform;
      el.style.transform = 'none';
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      el.style.transform = origTransform;
      const link = document.createElement('a');
      link.download = `notebook-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (e) { console.error('Export failed:', e); }
  };

  const exportAsPDF = async () => {
    const el = canvasRef.current;
    if (!el) return;
    try {
      const origTransform = el.style.transform;
      el.style.transform = 'none';
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      el.style.transform = origTransform;
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
    } catch (e) { console.error('PDF export failed:', e); }
  };

  const canvasFileRef = useRef(null);

  return (
    <div className="nb-container">
      {/* Toolbar */}
      <div className="nb-toolbar">
        <div className="nb-toolbar-left">
          <div className="nb-canvas-tools" style={{ marginLeft: 0, paddingLeft: 0, borderLeft: 'none' }}>
            <button className="nb-fmt-btn" onClick={addTextBox} title="Add text box"><Type size={14} /></button>
            <button className="nb-fmt-btn" onClick={() => canvasFileRef.current?.click()} title="Add image"><Image size={14} /></button>
            <input ref={canvasFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) addCanvasImage(f); e.target.value = ''; }} />
            <span className="nb-fmt-sep" />
            <button className="nb-fmt-btn" onClick={clearCanvas} title="Clear canvas"><Trash2 size={13} /></button>
            <span className="nb-fmt-sep" />
            <button className={`nb-fmt-btn ${drawMode ? 'active' : ''}`} onClick={toggleDrawMode} title="Draw line">
              <Move size={14} />
            </button>
            {drawMode && (
              <>
                <span className="nb-fmt-sep" />
                {['#22c55e','#ef4444','#3b82f6','#eab308','#a855f7','#f97316'].map(c => (
                  <button key={c} className="nb-fmt-btn" onClick={() => setLineColor(c)} title={c}
                    style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: lineColor === c ? '2px solid #fff' : '2px solid transparent', boxSizing: 'content-box' }}
                  />
                ))}
                <span className="nb-fmt-sep" />
                {['solid','dashed','dotted'].map(s => (
                  <button key={s} className={`nb-fmt-btn ${lineStyle === s ? 'active' : ''}`} onClick={() => setLineStyle(s)}
                    style={{ fontSize: 9, padding: '0 4px' }}>
                    {s === 'solid' ? '━━' : s === 'dashed' ? '╌╌' : '┅┅'}
                  </button>
                ))}
                <span className="nb-fmt-sep" />
                <span className="nb-connect-hint">{drawPhase === 'placing' ? 'Click to end line' : 'Click to start line'}</span>
              </>
            )}
            <button className={`nb-fmt-btn ${connectFrom ? 'active' : ''}`} onClick={toggleConnectMode} title="Connect items">
              {connectFrom ? <Link2Off size={14} /> : <Link2 size={14} />}
            </button>
            {connectFrom && connectFrom !== 'ready' && (
              <span className="nb-connect-hint">Click another item to connect</span>
            )}
            <span className="nb-fmt-sep" />
            <button className="nb-fmt-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
              style={{ opacity: canUndo ? undefined : 0.35 }}><Undo2 size={13} /></button>
            <button className="nb-fmt-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
              style={{ opacity: canRedo ? undefined : 0.35 }}><Redo2 size={13} /></button>
            <span className="nb-fmt-sep" />
            <button className="nb-fmt-btn" onClick={() => setCanvasZoom(z => Math.min(3, z + 0.1))} title="Zoom in"><Maximize2 size={13} /></button>
            <span className="nb-zoom-label">{Math.round(canvasZoom * 100)}%</span>
            <button className="nb-fmt-btn" onClick={() => setCanvasZoom(z => Math.max(0.3, z - 0.1))} title="Zoom out"><Minimize2 size={13} /></button>
          </div>
        </div>
        <div className="nb-toolbar-right">
          <div className="nb-export-group">
            <button className="nb-export-btn" onClick={exportAsImage} title="Export as PNG">
              <Download size={12} /> PNG
            </button>
            <button className="nb-export-btn" onClick={exportAsPDF} title="Export as PDF">
              <Download size={12} /> PDF
            </button>
          </div>
          <span className="nb-save-status">{saved ? 'Saved' : 'Unsaved…'}</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        tabIndex={0}
        className={`nb-canvas ${drawMode ? 'draw-active' : ''}`}
        onPaste={handleCanvasPaste}
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
        onContextMenu={handleCanvasContextMenu}
        onMouseMove={(e) => { onDrawMouseMove(e); onCanvasMouseMove(e); }}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onClick={(e) => {
          if (drawMode) { handleDrawClick(e); return; }
          if (e.target === e.currentTarget) setConnectFrom(null);
        }}
        style={{ transform: `scale(${canvasZoom})`, transformOrigin: '0 0', height: canvasHeight }}
      >
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
                position: 'absolute', left: line.x1, top: line.y1, width: len, height: 0,
                borderTop: isSolid ? `3px solid ${col}` : line.style === 'dashed' ? `2px dashed ${col}` : `2px dotted ${col}`,
                transformOrigin: '0 0', transform: `rotate(${angle}deg)`, pointerEvents: 'none', zIndex: 2,
              }} />
              <div onClick={(e) => { e.stopPropagation(); deleteLine(line.id); }}
                style={{
                  position: 'absolute', left: line.x2 - 6, top: line.y2 - 6, width: 12, height: 12,
                  background: col, clipPath: 'polygon(0% 20%, 100% 50%, 0% 80%)',
                  transform: `rotate(${angle}deg)`, cursor: 'pointer', pointerEvents: 'auto', zIndex: 3,
                }} title="Delete line" />
              <div style={{
                position: 'absolute', left: line.x1 - 3, top: line.y1 - 3, width: 6, height: 6,
                borderRadius: '50%', background: col, pointerEvents: 'none', zIndex: 2,
              }} />
            </Fragment>
          );
        })}

        {/* Preview line */}
        {drawPreview && drawStart && (() => {
          const dx = drawPreview.x - drawStart.x;
          const dy = drawPreview.y - drawStart.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          const col = lineColor;
          const isSolid = lineStyle === 'solid';
          return (
            <div style={{ position: 'absolute', pointerEvents: 'none', zIndex: 1, opacity: 0.6 }}>
              <div style={{
                position: 'absolute', left: drawStart.x, top: drawStart.y, width: len, height: 0,
                borderTop: isSolid ? `3px solid ${col}` : lineStyle === 'dashed' ? `2px dashed ${col}` : `2px dotted ${col}`,
                transformOrigin: '0 0', transform: `rotate(${angle}deg)`,
              }} />
              <div style={{
                position: 'absolute', left: drawStart.x - 4, top: drawStart.y - 4, width: 8, height: 8,
                borderRadius: '50%', background: col, opacity: 0.8,
              }} />
            </div>
          );
        })()}

        {/* Connection lines */}
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
          return (
            <div key={conn.id} style={{ position: 'absolute', pointerEvents: 'none', zIndex: 1 }}>
              <div style={{
                position: 'absolute', left: x1, top: y1, width: len, height: 2,
                background: 'var(--accent-blue)', opacity: 0.7,
                transformOrigin: '0 0', transform: `rotate(${angle}deg)`,
              }} />
              <div onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                style={{
                  position: 'absolute', left: x2 - 5, top: y2 - 5, width: 10, height: 10,
                  background: 'var(--accent-blue)', clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)',
                  transform: `rotate(${angle}deg)`, cursor: 'pointer', pointerEvents: 'auto',
                }} title="Remove connection" />
            </div>
          );
        })}

        {/* Canvas items */}
        {items.map(item => (
          <div
            key={item.id}
            className={`nb-canvas-item ${connectFrom === item.id ? 'connecting' : ''} ${connectFrom && connectFrom !== 'ready' && connectFrom !== item.id ? 'connect-target' : ''}`}
            style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
            onMouseDown={(e) => { if (connectFrom) { e.stopPropagation(); handleItemClick(item.id); } else { startDrag(e, item.id); } }}
          >
            {item.type === 'image' ? (
              <img src={item.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
            ) : (
              <div
                className={`nb-canvas-text ${editingId === item.id ? 'editing' : ''}`}
                contentEditable={editingId === item.id}
                suppressContentEditableWarning
                onBlur={(e) => { updateItemContent(item.id, e.currentTarget.textContent); setEditingId(null); }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); }}
              >
                {item.content}
              </div>
            )}
            <button className="nb-canvas-del" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
              onMouseDown={e => e.stopPropagation()}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
