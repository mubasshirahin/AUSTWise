import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ImageOff, Loader2 } from 'lucide-react';
import { cropRegion, getOverrides, isWholePageRegion, matchSourceFile, resolveRegions } from './qbaOriginal';
import { TREND_HINTS, TREND_LABELS } from './qbaInsights';
import { copyText } from './qbaClipboard';

/* Adjust-mode box corrections, read once per page visit. */
let overridesPromise = null;
/** Forget the cached corrections, e.g. after the student fixed a crop. */
export function resetCropOverrides() {
  overridesPromise = null;
}
function loadOverrides() {
  if (!overridesPromise) overridesPromise = getOverrides().catch(() => ({}));
  return overridesPromise;
}

/**
 * The original question, cut out of the student's own PDF/image in the
 * browser. Shows nothing when the file was never uploaded. A region that is
 * the whole page is never shown as "the question": the student is asked to
 * fix it instead.
 *
 * `resolved` means the caller already applied the student's fixes.
 */
export function CropImage({
  regions = [],
  sourceFiles = [],
  semester = '',
  number = 0,
  part = '',
  printedPart = '',
  alt = 'Original question',
  missingHint = true,
  refreshKey = 0,
  eager = false,
  resolved = false,
  onFix,
}) {
  const [state, setState] = useState({ status: 'idle', urls: [], missing: '' });
  // Cut only what is on (or near) the screen: a closed topic or paper card
  // has no size, so its crops wait until the student opens it.
  const slotRef = useRef(null);
  const [seen, setSeen] = useState(() => eager || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !slotRef.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(slotRef.current);
    return () => observer.disconnect();
  }, [seen]);
  const boxRegions = regions.filter((region) => region && (region.kind === 'box' || region.kind === 'bare'));
  const signature = JSON.stringify(boxRegions.map((region) => [region.file, region.page, region.box, region.kind, Boolean(region.fixed)]))
    + sourceFiles.map((file) => `${file.name}:${file.size}`).join(',');

  useEffect(() => {
    let cancelled = false;
    const created = [];
    if (!seen) return undefined;
    if (!boxRegions.length) {
      setState({ status: 'none', urls: [], missing: '' });
      return undefined;
    }
    (async () => {
      const overrides = resolved ? {} : await loadOverrides();
      if (cancelled) return;
      const effective = resolved
        ? boxRegions
        : resolveRegions(boxRegions, overrides, { semester, number, part, printedPart });
      const tight = effective.filter((region) => region && region.kind === 'box' && !isWholePageRegion(region));
      if (!tight.length) {
        setState({ status: 'wholepage', urls: [], missing: '' });
        return;
      }
      const firstMissing = tight.find((region) => !matchSourceFile(region.file, sourceFiles));
      if (firstMissing && tight.every((region) => !matchSourceFile(region.file, sourceFiles))) {
        setState({ status: 'missing', urls: [], missing: firstMissing.file });
        return;
      }
      setState({ status: 'loading', urls: [], missing: '' });
      const urls = [];
      for (const region of tight) {
        const file = matchSourceFile(region.file, sourceFiles);
        if (!file) continue;
        try {
          const url = await cropRegion(file, region);
          created.push(url);
          urls.push(url);
        } catch {
          /* one bad region should not hide the others */
        }
      }
      if (!cancelled) setState({ status: urls.length ? 'ready' : 'error', urls, missing: '' });
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, semester, number, part, printedPart, refreshKey, seen, resolved]);

  if (state.status === 'idle') return <div ref={slotRef} className="qbi-crop-slot" aria-hidden="true" />;
  if (state.status === 'none') return null;
  if (state.status === 'wholepage') {
    return missingHint || onFix ? (
      <p className="qbi-crop-hint">
        <ImageOff size={13} aria-hidden="true" />
        <span>Your AI marked the whole page, not this question.</span>
        {onFix ? (
          <button type="button" className="qbi-crop-fix" onClick={onFix}>Draw its box</button>
        ) : null}
      </p>
    ) : null;
  }
  if (state.status === 'missing') {
    return missingHint ? (
      <p className="qbi-crop-hint">
        <ImageOff size={13} aria-hidden="true" />
        Upload <strong>{state.missing}</strong> in Step 3 to see the original question here.
      </p>
    ) : null;
  }
  if (state.status === 'loading') {
    return (
      <div className="qbi-crop-loading" aria-live="polite">
        <Loader2 size={15} className="qba-spin" aria-hidden="true" /> Cutting the original…
      </div>
    );
  }
  if (state.status === 'error') return null;
  return (
    <div className="qbi-crop">
      {state.urls.map((url, index) => (
        <img key={url} src={url} alt={index ? `${alt} (part ${index + 1})` : alt} loading="lazy" />
      ))}
    </div>
  );
}

export function BandBadge({ band }) {
  if (!band) return null;
  return <span className={`qbi-band qbi-band-${band.key}`}>{band.label}</span>;
}

export function TrendBadge({ trend }) {
  if (!trend || trend === 'steady') return null;
  return (
    <span className={`qbi-trend qbi-trend-${trend}`} title={TREND_HINTS[trend]}>
      {TREND_LABELS[trend]}
    </span>
  );
}

export function CopyButton({ text, label = 'Copy', className = 'btn btn-secondary btn-sm' }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => setCopied(await copyText(text))}
      disabled={!text}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Question text with its sub-parts on their own lines and [image] as a chip. */
export function QuestionLines({ text }) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <div className="qbi-qtext">
      {lines.map((line, index) => {
        const hasFigure = /\[\s*image\s*\]/i.test(line);
        const clean = line.replace(/\[\s*image\s*\]/gi, '').trim();
        return (
          <p key={index} className={index ? 'qbi-qtext-part' : 'qbi-qtext-stem'}>
            {hasFigure ? <span className="qbi-figure-chip">figure</span> : null}
            {clean}
          </p>
        );
      })}
    </div>
  );
}
