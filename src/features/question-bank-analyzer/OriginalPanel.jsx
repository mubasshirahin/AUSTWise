import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Crop, Download, RefreshCcw, Upload, X } from 'lucide-react';
import {
  collectQidRows,
  cropRegion,
  deleteOverride,
  getOverrides,
  listSourceFiles,
  matchSourceFile,
  overrideKey,
  renderPagePreview,
  saveOverride,
  storeSourceFile,
} from './qbaOriginal';
import './OriginalPanel.css';

/**
 * Source files: the PDFs / images the Markdown Source cells point at.
 * Files are kept as blobs in IndexedDB (browser-only, never uploaded).
 */
export function SourceFilesPanel({ files, onFiles }) {
  const [stored, setStored] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listSourceFiles();
        if (!cancelled) {
          setStored(list);
          onFiles?.(list);
        }
      } catch { /* IndexedDB unavailable — panel still works with drag/drop */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = async (fileList) => {
    const files = [...(fileList || [])].filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name) || String(f.type || '').startsWith('image/'));
    if (!files.length) {
      setError('Only PDF, PNG or JPG files can be cropped. Other files are text-only.');
      return;
    }
    setError('');
    const saved = [];
    for (const file of files) {
      try {
        saved.push(await storeSourceFile(file));
      } catch (err) {
        setError(err?.message || 'Could not save a file.');
      }
    }
    const next = [...stored.filter((s) => !saved.some((n) => n.name === s.name)), ...saved];
    setStored(next);
    onFiles?.(next);
  };

  const needed = Array.isArray(files) ? files : [];

  return (
    <section className="qba-source-panel" aria-label="Original source files">
      <header className="qba-source-head">
        <div>
          <h3>Original source files</h3>
          <p>Drop the PDFs / images the AI used. They stay in this browser and are never uploaded.</p>
        </div>
      </header>
      <div
        className={`qba-source-drop${dragOver ? ' is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files); }}
      >
        <Upload size={18} aria-hidden="true" />
        <span>Drop PDFs / images here, or</span>
        <label className="qba-source-pick">
          Choose files
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>
      {error ? <p className="qba-source-error" role="alert">{error}</p> : null}
      {needed.length ? (
        <ul className="qba-source-list">
          {needed.map((name) => {
            const found = matchSourceFile(name, stored);
            return (
              <li key={name} className={`qba-source-item${found ? ' is-found' : ' is-missing'}`}>
                <span className="qba-source-name" title={name}>{name}</span>
                <span className="qba-source-status">{found ? 'Found' : 'Missing'}</span>
                {!found && (
                  <label className="qba-source-pick qba-source-pick-sm">
                    Select file for {name}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) await addFiles([f]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="qba-source-note">This Markdown has no <code>files:</code> line — Original shows text only.</p>
      )}
      {stored.length ? (
        <p className="qba-source-note">
          {stored.length} file{stored.length === 1 ? '' : 's'} saved in this browser. Your files stay in this browser and are never uploaded.
        </p>
      ) : null}
    </section>
  );
}

/** The question text with <br> as line breaks and [image] as a chip. */
export function OriginalText({ text }) {
  const parts = String(text || '').split('\n');
  return (
    <div className="qba-original-text">
      {parts.map((part, i) => {
        if (/\[\s*image\s*\]/i.test(part)) {
          return (
            <Fragment key={i}>
              <span className="qba-original-figure-chip">figure — see screenshot</span>
              {part.replace(/\[\s*image\s*\]/gi, '').trim() ? <span>{part.replace(/\[\s*image\s*\]/gi, '').trim()}</span> : null}
              {i < parts.length - 1 ? <br /> : null}
            </Fragment>
          );
        }
        return (
          <Fragment key={i}>
            {part}
            {i < parts.length - 1 ? <br /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function AdjustBox({ imageUrl, initialBox, onSave, onReset, onClose, title }) {
  const [box, setBox] = useState(initialBox || [0.05, 0.15, 0.95, 0.6]);
  const [drag, setDrag] = useState(null);

  const onPointerMove = (e) => {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    if (drag.mode === 'move') {
      const w = drag.box[2] - drag.box[0];
      const h = drag.box[3] - drag.box[1];
      let nx = clamp(fx - drag.dx);
      let ny = clamp(fy - drag.dy);
      nx = Math.min(nx, 1 - w);
      ny = Math.min(ny, 1 - h);
      setBox([+nx.toFixed(4), +ny.toFixed(4), +(nx + w).toFixed(4), +(ny + h).toFixed(4)]);
    } else {
      const next = [...drag.box];
      next[drag.mode] = clamp(drag.mode === 0 || drag.mode === 1 ? Math.min(fx / 1, 1) : fx);
      if (drag.mode === 0) setBox([Math.min(clamp(fx), next[2] - 0.02), next[1], next[2], next[3]]);
      if (drag.mode === 1) setBox([next[0], Math.min(clamp(fy), next[3] - 0.02), next[2], next[3]]);
      if (drag.mode === 2) setBox([next[0], next[1], Math.max(clamp(fx), next[0] + 0.02), next[3]]);
      if (drag.mode === 3) setBox([next[0], next[1], next[2], Math.max(clamp(fy), next[1] + 0.02)]);
    }
  };

  return (
    <div className="qba-adjust-body">
      <p className="qba-original-note">{title} — drag the box to move it, drag a corner to resize. Save persists after reload.</p>
      <div
        className="qba-adjust-stage"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={imageUrl} className="qba-adjust-page" draggable={false} alt="" />
        <div
          className="qba-adjust-box"
          style={{
            left: `${box[0] * 100}%`,
            top: `${box[1] * 100}%`,
            width: `${(box[2] - box[0]) * 100}%`,
            height: `${(box[3] - box[1]) * 100}%`,
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.parentElement.getBoundingClientRect();
            setDrag({ mode: 'move', dx: (e.clientX - rect.left) / rect.width - box[0], dy: (e.clientY - rect.top) / rect.height - box[1], box });
          }}
        >
          {['tl', 'tr', 'bl', 'br'].map((corner, i) => (
            <span
              key={corner}
              className={`qba-adjust-corner qba-adjust-corner-${corner}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDrag({ mode: i, box });
              }}
            />
          ))}
        </div>
      </div>
      <div className="qba-original-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(box)}>Save</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onReset()}>Reset to AI box</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function RegionView({ file, region, override, overrideKeyStr, onSaved }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [pagePreview, setPagePreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    (async () => {
      if (!file) {
        setError('File missing.');
        return;
      }
      if (region.kind === 'unknown') {
        setError('Page unknown — screenshot unavailable. Text only.');
        return;
      }
      if (region.kind === 'none') {
        setError('No pages (text only).');
        return;
      }
      try {
        setError('');
        const effective = override ? { ...region, kind: 'box', page: region.page || 1, box: override } : region;
        const next = await cropRegion(file, effective);
        if (!cancelled) {
          objectUrl = next;
          setUrl(next);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not cut this region.');
      }
    })();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file, region, override]);

  const openAdjust = async () => {
    try {
      const preview = await renderPagePreview(file, region.page || 1);
      setPagePreview(preview);
      setAdjusting(true);
    } catch (err) {
      setError(err?.message || 'Could not load the page.');
    }
  };

  if (adjusting && pagePreview) {
    return (
      <AdjustBox
        imageUrl={pagePreview.url}
        initialBox={override || (region.kind === 'box' ? region.box : [0.05, 0.15, 0.95, 0.6])}
        title={`${region.file} · p${pagePreview.page}`}
        onSave={async (box) => {
          await saveOverride(overrideKeyStr, box);
          await onSaved?.();
          setAdjusting(false);
          setPagePreview(null);
        }}
        onReset={async () => {
          await deleteOverride(overrideKeyStr);
          await onSaved?.();
          setAdjusting(false);
          setPagePreview(null);
        }}
        onClose={() => { setAdjusting(false); setPagePreview(null); }}
      />
    );
  }

  if (error) {
    return (
      <div className="qba-original-region-error">
        <p>{error}</p>
        {!file && region?.file ? (
          <label className="qba-source-pick qba-source-pick-sm">
            Select / drop {region.file}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await storeSourceFile(f); e.target.value = ''; }} />
          </label>
        ) : null}
      </div>
    );
  }

  if (!url) return <p className="qba-original-note">Cutting screenshot…</p>;

  return (
    <figure className="qba-original-shot">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img src={url} alt="Original question screenshot" />
      <figcaption>
        <span>{region.file} · p{region.page || 1}</span>
        {override ? <span className="qba-original-chip">adjusted</span> : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={openAdjust}>
          <Crop size={13} aria-hidden="true" /> Adjust
        </button>
      </figcaption>
    </figure>
  );
}

/**
 * Full-screen Original modal: pool text + one screenshot section per
 * SEMESTER_PAPERS row that uses the QID. Closes on X, Esc or backdrop click.
 */
export default function OriginalPanel({ qid, questionText, data, storedFiles, onClose, onCorrected }) {
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getOverrides();
        if (!cancelled) setOverrides(all);
      } catch { /* overrides unavailable */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const rows = useMemo(() => collectQidRows(data, qid), [data, qid]);
  const refreshOverrides = async () => {
    try {
      setOverrides(await getOverrides());
    } catch { /* ignore */ }
    onCorrected?.();
  };

  const node = (
    <div className="qba-original-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }} role="presentation">
      <div className="qba-original-modal" role="dialog" aria-modal="true" aria-label={`Original for ${qid}`}>
        <header className="qba-original-head">
          <div>
            <span className="qba-original-kicker"><Camera size={13} aria-hidden="true" /> Original · {qid}</span>
            <OriginalText text={questionText} />
          </div>
          <button type="button" className="qba-original-close" onClick={onClose} aria-label="Close original" autoFocus>
            <X size={18} />
          </button>
        </header>

        <div className="qba-original-body">
          {rows.length === 0 ? (
            <p className="qba-original-note">No Source rows reference this question. Text only.</p>
          ) : rows.map((row, rowIndex) => (
            <section key={`${row.semester}-${row.n}-${rowIndex}`} className="qba-original-row">
              <h4>{row.semester} — Q{row.n}</h4>
              <p className="qba-original-meta">
                {row.exam}{row.marks != null ? ` · ${row.marks} marks` : ''}
              </p>
              {row.sourceRegions.length === 0 ? (
                <p className="qba-original-note">No Source recorded — text only.</p>
              ) : row.sourceRegions.map((region, regionIndex) => {
                const file = matchSourceFile(region.file, storedFiles || []);
                const key = overrideKey(row.semester, row.n, regionIndex);
                return (
                  <RegionView
                    key={`${region.file}-${regionIndex}`}
                    file={file}
                    region={region}
                    override={overrides[key]}
                    overrideKeyStr={key}
                    onSaved={refreshOverrides}
                  />
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

/** Download the pasted Markdown with override boxes written back into Source cells. */
export function downloadCorrectedMarkdown(markdown, overrides) {
  if (!markdown || !overrides || !Object.keys(overrides).length) return;
  const rewritten = applyOverrides(markdown, overrides);
  const blob = new Blob([rewritten], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'corrected_question_bank.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function applyOverrides(markdown, overrides) {
  // Group flat override keys back into { semester: { n: { idx: box } } }.
  const grouped = {};
  Object.entries(overrides).forEach(([key, box]) => {
    const [semester, n, idx] = key.split('|');
    if (!semester || !n) return;
    grouped[semester] = grouped[semester] || {};
    grouped[semester][n] = grouped[semester][n] || {};
    grouped[semester][n][idx] = box;
  });
  const lines = String(markdown).split('\n');
  let semester = '';
  const out = [];
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s*(.+)$/);
    if (heading && /(?:19|20)\d{2}/.test(heading[1])) semester = heading[1].trim();
    if (/^\s*\|/.test(line) && semester && grouped[semester]) {
      const match = line.match(/^\s*\|\s*(\d+)\s*\|/);
      const n = match ? Number(match[1]) : null;
      const byIdx = n != null ? grouped[semester][n] : null;
      if (byIdx) {
        const cells = splitRow(line);
        const idx = cells.length - 1;
        const regions = String(cells[idx] || '').split(/\s*;\s*/).filter(Boolean);
        const rebuilt = regions.map((region, i) => {
          const box = byIdx[i];
          if (!box) return region;
          const base = region.split('::').map((p) => p.trim());
          const fmt = (v) => Number(v.toFixed(4));
          return `${base[0] || ''} :: ${base[1] || 'p1'} :: ${fmt(box[0])},${fmt(box[1])},${fmt(box[2])},${fmt(box[3])}`;
        });
        cells[idx] = rebuilt.join(' ; ');
        out.push(`| ${cells.join(' | ')} |`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function splitRow(line) {
  let text = String(line).trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  const cells = [];
  let buffer = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && text[i + 1] === '|') { buffer += '|'; i += 1; }
    else if (text[i] === '|') { cells.push(buffer.trim()); buffer = ''; }
    else buffer += text[i];
  }
  cells.push(buffer.trim());
  return cells;
}
