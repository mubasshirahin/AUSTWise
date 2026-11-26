import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Hand,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  SquareDashedMousePointer,
  X,
} from 'lucide-react';
import {
  deleteOverride,
  getPageCount,
  isWholePageRegion,
  matchSourceFile,
  renderPagePreview,
  saveQuestionFix,
} from './qbaOriginal';
import './CropFixer.css';

/*
 * Fix the original of one question.
 *
 * The whole paper opens page by page with the question's box drawn on it.
 * The student can move or resize the box, pan and zoom the page, or draw a
 * new box. A new box replaces the old one ("Draw new"); "Add box" keeps the
 * old one too, for a question that runs onto the next page or has its
 * figure somewhere else. Saving stores the boxes for this question only, so
 * 2a and 2b keep their own crops.
 */

const ZOOMS = [1, 1.5, 2, 3, 4];
const MIN_SIZE = 0.01;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const round = (value) => Math.round(value * 10000) / 10000;

let nextId = 1;
const newId = () => `box-${nextId++}`;

function sameFile(name, file) {
  return Boolean(file && matchSourceFile(name, [file]));
}

function fmtBox(box) {
  return box.map((value) => value.toFixed(2)).join(', ');
}

/** Every other question's box on one page, drawn faintly for orientation. */
function otherBoxesOn(data, file, page, self) {
  const out = [];
  (data?.semesterPapers || []).forEach((paper) => {
    (paper.questions || []).forEach((question, index) => {
      const number = question.number ?? index + 1;
      const part = String(question.part || '').toLowerCase();
      if (paper.semester === self.semester && String(number) === String(self.number) && part === String(self.part || '')) return;
      (question.sourceRegions || []).forEach((region) => {
        if (region?.kind !== 'box' || region.page !== page || isWholePageRegion(region)) return;
        if (!sameFile(region.file, file)) return;
        out.push({ label: `${number}${part}`, box: region.box });
      });
    });
  });
  return out;
}

function BoxPreview({ imageUrl, box, natural }) {
  const [x1, y1, x2, y2] = box;
  const width = Math.max(MIN_SIZE, x2 - x1);
  const height = Math.max(MIN_SIZE, y2 - y1);
  const ratio = natural ? (width * natural.w) / (height * natural.h) : width / height;
  return (
    <span className="qcf-preview-cut" style={{ aspectRatio: String(ratio) }}>
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        style={{
          width: `${100 / width}%`,
          left: `${(-x1 / width) * 100}%`,
          top: `${(-y1 / height) * 100}%`,
        }}
      />
    </span>
  );
}

export default function CropFixer({ target, sourceFiles = [], data, onClose, onSaved }) {
  const files = sourceFiles;
  const startBoxes = useMemo(() => (target.regions || [])
    .filter((region) => region?.kind === 'box' && !isWholePageRegion(region) && matchSourceFile(region.file, files))
    .map((region) => ({
      id: newId(),
      file: matchSourceFile(region.file, files).name,
      page: region.page || 1,
      box: [...region.box],
    })), [target, files]);
  const startRegion = (target.regions || []).find((region) => matchSourceFile(region?.file, files));

  const [fileName, setFileName] = useState(
    startBoxes[0]?.file || (startRegion ? matchSourceFile(startRegion.file, files).name : files[0]?.name || ''),
  );
  const [page, setPage] = useState(startBoxes[0]?.page || startRegion?.page || 1);
  const [pageCount, setPageCount] = useState(1);
  const [boxes, setBoxes] = useState(startBoxes);
  const [selected, setSelected] = useState(startBoxes[0]?.id || null);
  const [tool, setTool] = useState(startBoxes.length ? 'move' : 'draw');
  const [zoom, setZoom] = useState(1);
  const [image, setImage] = useState(null);
  const [natural, setNatural] = useState(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const file = files.find((item) => item.name === fileName) || null;

  useEffect(() => {
    let cancelled = false;
    if (!file) return undefined;
    getPageCount(file)
      .then((count) => { if (!cancelled) setPageCount(count); })
      .catch(() => { if (!cancelled) setPageCount(1); });
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    setImage(null);
    setError('');
    if (!file) {
      setError('Upload the paper in Setup first.');
      return undefined;
    }
    renderPagePreview(file, page, 1600)
      .then((result) => { if (!cancelled) setImage(result); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'This page could not be shown.'); });
    return () => { cancelled = true; };
  }, [file, page]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const onPage = boxes.filter((item) => item.file === fileName && item.page === page);
  const active = boxes.find((item) => item.id === selected) || null;
  const others = useMemo(
    () => otherBoxesOn(data, file, page, target),
    [data, file, page, target],
  );

  // Bring the chosen box into view when the page loads or the zoom changes.
  useEffect(() => {
    const scroller = scrollRef.current;
    const stage = stageRef.current;
    if (!image || !scroller || !stage) return;
    const focus = onPage.find((item) => item.id === selected) || onPage[0];
    if (!focus) return;
    const [x1, y1, x2, y2] = focus.box;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    scroller.scrollTo({
      left: Math.max(0, ((x1 + x2) / 2) * width - scroller.clientWidth / 2),
      top: Math.max(0, ((y1 + y2) / 2) * height - scroller.clientHeight / 2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, zoom]);

  const pointAt = (event) => {
    const rect = stageRef.current.getBoundingClientRect();
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
  };

  const updateBox = (id, box) => {
    setBoxes((list) => list.map((item) => (item.id === id ? { ...item, box: box.map(round) } : item)));
  };

  const onStagePointerDown = (event) => {
    if (!image || (event.button !== undefined && event.button !== 0)) return;
    if (tool === 'draw' || tool === 'add') {
      event.preventDefault();
      stageRef.current.setPointerCapture?.(event.pointerId);
      const start = pointAt(event);
      dragRef.current = { mode: 'draw', start };
      setDraft([start[0], start[1], start[0], start[1]]);
      return;
    }
    setSelected(null);
    // A finger pans the page natively; a mouse drag pans it here.
    if (event.pointerType === 'touch') return;
    const scroller = scrollRef.current;
    stageRef.current.setPointerCapture?.(event.pointerId);
    dragRef.current = { mode: 'pan', x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
  };

  const onBoxPointerDown = (event, item, handle = '') => {
    if (tool !== 'move') return;
    event.preventDefault();
    event.stopPropagation();
    stageRef.current.setPointerCapture?.(event.pointerId);
    setSelected(item.id);
    dragRef.current = { mode: handle ? 'resize' : 'move', handle, id: item.id, start: pointAt(event), box: [...item.box] };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === 'pan') {
      const scroller = scrollRef.current;
      scroller.scrollLeft = drag.left - (event.clientX - drag.x);
      scroller.scrollTop = drag.top - (event.clientY - drag.y);
      return;
    }
    const [x, y] = pointAt(event);
    if (drag.mode === 'draw') {
      const [sx, sy] = drag.start;
      setDraft([Math.min(sx, x), Math.min(sy, y), Math.max(sx, x), Math.max(sy, y)]);
      return;
    }
    const dx = x - drag.start[0];
    const dy = y - drag.start[1];
    let [x1, y1, x2, y2] = drag.box;
    if (drag.mode === 'move') {
      const width = x2 - x1;
      const height = y2 - y1;
      x1 = clamp(x1 + dx, 0, 1 - width);
      y1 = clamp(y1 + dy, 0, 1 - height);
      updateBox(drag.id, [x1, y1, x1 + width, y1 + height]);
      return;
    }
    const { handle } = drag;
    if (handle.includes('w')) x1 = clamp(x1 + dx, 0, x2 - MIN_SIZE);
    if (handle.includes('e')) x2 = clamp(x2 + dx, x1 + MIN_SIZE, 1);
    if (handle.includes('n')) y1 = clamp(y1 + dy, 0, y2 - MIN_SIZE);
    if (handle.includes('s')) y2 = clamp(y2 + dy, y1 + MIN_SIZE, 1);
    updateBox(drag.id, [x1, y1, x2, y2]);
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.mode !== 'draw') return;
    const box = draft;
    setDraft(null);
    if (!box || box[2] - box[0] < MIN_SIZE * 2 || box[3] - box[1] < MIN_SIZE * 2) return;
    const item = { id: newId(), file: fileName, page, box: box.map(round) };
    // "Draw new" replaces the old box; "Add box" keeps it.
    setBoxes((list) => (tool === 'add' ? [...list, item] : [item]));
    setSelected(item.id);
    setTool('move');
  };

  const removeBox = (id) => {
    setBoxes((list) => list.filter((item) => item.id !== id));
    if (selected === id) setSelected(null);
  };

  const onBoxKey = (event, item) => {
    const step = event.altKey ? 0.002 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeBox(item.id);
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    let [x1, y1, x2, y2] = item.box;
    if (event.shiftKey) {
      // Shift + arrows grows or shrinks from the bottom-right corner.
      x2 = clamp(x2 + move[0], x1 + MIN_SIZE, 1);
      y2 = clamp(y2 + move[1], y1 + MIN_SIZE, 1);
    } else {
      const width = x2 - x1;
      const height = y2 - y1;
      x1 = clamp(x1 + move[0], 0, 1 - width);
      y1 = clamp(y1 + move[1], 0, 1 - height);
      x2 = x1 + width;
      y2 = y1 + height;
    }
    updateBox(item.id, [x1, y1, x2, y2]);
  };

  const changeZoom = (direction) => {
    const index = ZOOMS.indexOf(zoom);
    const next = ZOOMS[clamp(index + direction, 0, ZOOMS.length - 1)];
    setZoom(next);
  };

  const save = async () => {
    if (!boxes.length || saving) return;
    setSaving(true);
    try {
      await saveQuestionFix(target.fixKey, boxes);
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'The box could not be saved.');
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await deleteOverride(target.fixKey);
      await onSaved?.();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const pagesWithBoxes = new Set(boxes.filter((item) => item.file === fileName).map((item) => item.page));
  const elsewhere = boxes.filter((item) => item.file !== fileName || item.page !== page);
  const toolHint = {
    move: onPage.length
      ? 'Drag the box to move it, drag its edges to resize. Drag the page to pan.'
      : 'Drag the page to pan. Draw a box around the question.',
    draw: 'Drag over the question. The new box replaces the old one.',
    add: 'Drag over the rest of the question. The old box stays.',
  }[tool];

  const node = (
    <div className="qba-original-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="qba-original-modal qcf" role="dialog" aria-modal="true" aria-label={`Fix the original of question ${target.label}`}>
        <header className="qcf-head">
          <div className="qcf-head-text">
            <span className="qcf-kicker">
              Fix original · {target.label}{target.semester ? ` · ${target.semester}` : ''}
            </span>
            {target.text ? <p className="qcf-question">{target.text}</p> : null}
          </div>
          <button type="button" className="qba-original-close" onClick={onClose} aria-label="Close" autoFocus>
            <X size={18} />
          </button>
        </header>

        <div className="qcf-bar">
          {files.length > 1 ? (
            <select
              className="input qcf-file"
              value={fileName}
              onChange={(event) => { setFileName(event.target.value); setPage(1); setSelected(null); }}
              aria-label="Paper file"
            >
              {files.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          ) : (
            <span className="qcf-file-name" title={fileName}>{fileName}</span>
          )}
          <div className="qcf-pages" role="group" aria-label="Pages">
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`qcf-page${index + 1 === page ? ' is-current' : ''}${pagesWithBoxes.has(index + 1) ? ' has-box' : ''}`}
                aria-current={index + 1 === page ? 'page' : undefined}
                onClick={() => setPage(index + 1)}
              >
                p{index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="qcf-tools">
          <div className="qcf-seg" role="group" aria-label="Tool">
            <button type="button" aria-pressed={tool === 'move'} className={tool === 'move' ? 'is-on' : ''} onClick={() => setTool('move')}>
              <Hand size={14} aria-hidden="true" /> Move
            </button>
            <button type="button" aria-pressed={tool === 'draw'} className={tool === 'draw' ? 'is-on' : ''} onClick={() => setTool('draw')}>
              <SquareDashedMousePointer size={14} aria-hidden="true" /> Draw new
            </button>
            <button type="button" aria-pressed={tool === 'add'} className={tool === 'add' ? 'is-on' : ''} onClick={() => setTool('add')} disabled={!boxes.length}>
              <Plus size={14} aria-hidden="true" /> Add box
            </button>
          </div>
          <div className="qcf-zoom" role="group" aria-label="Zoom">
            <button type="button" onClick={() => changeZoom(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out"><Minus size={14} /></button>
            <button type="button" className="qcf-zoom-value" onClick={() => setZoom(1)} title="Fit the page width">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => changeZoom(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in"><Plus size={14} /></button>
          </div>
        </div>
        <p className="qcf-hint" aria-live="polite">{toolHint}</p>

        <div className="qcf-scroll" ref={scrollRef}>
          <div
            ref={stageRef}
            className={`qcf-stage is-${tool}`}
            style={{ width: `${zoom * 100}%` }}
            onPointerDown={onStagePointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image ? (
              <img
                src={image.url}
                alt={`${fileName} page ${page}`}
                draggable={false}
                onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
              />
            ) : null}
            {!image && !error ? (
              <div className="qcf-loading"><Loader2 size={18} className="qba-spin" aria-hidden="true" /> Opening page {page}…</div>
            ) : null}
            {error ? <p className="qcf-error">{error}</p> : null}

            {image ? others.map((item, index) => (
              <span
                key={`${item.label}-${index}`}
                className="qcf-other"
                style={{
                  left: `${item.box[0] * 100}%`,
                  top: `${item.box[1] * 100}%`,
                  width: `${(item.box[2] - item.box[0]) * 100}%`,
                  height: `${(item.box[3] - item.box[1]) * 100}%`,
                }}
              >
                <em>{item.label}</em>
              </span>
            )) : null}

            {image ? onPage.map((item) => (
              <div
                key={item.id}
                className={`qcf-box${item.id === selected ? ' is-selected' : ''}`}
                style={{
                  left: `${item.box[0] * 100}%`,
                  top: `${item.box[1] * 100}%`,
                  width: `${(item.box[2] - item.box[0]) * 100}%`,
                  height: `${(item.box[3] - item.box[1]) * 100}%`,
                }}
                role="button"
                tabIndex={0}
                aria-label={`Box for ${target.label}: ${fmtBox(item.box)}. Arrows move it, Shift and arrows resize it, Delete removes it.`}
                onPointerDown={(event) => onBoxPointerDown(event, item)}
                onFocus={() => setSelected(item.id)}
                onKeyDown={(event) => onBoxKey(event, item)}
              >
                <em>{target.label}</em>
                {tool === 'move' ? ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((handle) => (
                  <span
                    key={handle}
                    className={`qcf-handle qcf-handle-${handle}`}
                    onPointerDown={(event) => onBoxPointerDown(event, item, handle)}
                    aria-hidden="true"
                  />
                )) : null}
                {item.id === selected && tool === 'move' ? (
                  <button
                    type="button"
                    className="qcf-box-remove"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => removeBox(item.id)}
                    aria-label="Remove this box"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            )) : null}

            {draft ? (
              <span
                className="qcf-draft"
                style={{
                  left: `${draft[0] * 100}%`,
                  top: `${draft[1] * 100}%`,
                  width: `${(draft[2] - draft[0]) * 100}%`,
                  height: `${(draft[3] - draft[1]) * 100}%`,
                }}
              />
            ) : null}
          </div>
        </div>

        <footer className="qcf-foot">
          <div className="qcf-result">
            <span className="qcf-result-title">The original will show</span>
            {boxes.length ? (
              <div className="qcf-result-list">
                {onPage.map((item) => (image ? <BoxPreview key={item.id} imageUrl={image.url} box={item.box} natural={natural} /> : null))}
                {elsewhere.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="qcf-elsewhere"
                    onClick={() => { setFileName(item.file); setPage(item.page); setSelected(item.id); }}
                  >
                    + a box on p{item.page}{item.file !== fileName ? ` of ${item.file}` : ''}
                  </button>
                ))}
              </div>
            ) : (
              <span className="qcf-result-empty">No box yet. Draw one around the question.</span>
            )}
            {active ? <span className="qcf-coords">p{active.page} · {fmtBox(active.box)}</span> : null}
          </div>
          <div className="qcf-actions">
            {target.hasFix ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={saving}>
                <RotateCcw size={14} aria-hidden="true" /> Use the AI box
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!boxes.length || saving}>
              {saving ? 'Saving…' : 'Save box'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
