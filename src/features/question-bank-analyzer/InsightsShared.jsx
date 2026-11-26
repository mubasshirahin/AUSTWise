import { useEffect, useState } from 'react';
import { Check, Copy, ImageOff, Loader2 } from 'lucide-react';
import { cropRegion, getOverrides, matchSourceFile, overrideKey } from './qbaOriginal';
import { TREND_HINTS, TREND_LABELS } from './qbaInsights';
import { copyText } from './qbaClipboard';

/* Adjust-mode box corrections, read once per page visit. */
let overridesPromise = null;
function loadOverrides() {
  if (!overridesPromise) overridesPromise = getOverrides().catch(() => ({}));
  return overridesPromise;
}

/**
 * The original question, cut out of the student's own PDF/image in the
 * browser. Shows nothing when the file was never uploaded.
 */
export function CropImage({ regions = [], sourceFiles = [], semester = '', number = 0, alt = 'Original question', missingHint = true }) {
  const [state, setState] = useState({ status: 'idle', urls: [], missing: '' });
  const boxRegions = regions.filter((region) => region && (region.kind === 'box' || region.kind === 'bare'));
  const signature = JSON.stringify(boxRegions.map((region) => [region.file, region.page, region.box]))
    + sourceFiles.map((file) => `${file.name}:${file.size}`).join(',');

  useEffect(() => {
    let cancelled = false;
    const created = [];
    if (!boxRegions.length) {
      setState({ status: 'none', urls: [], missing: '' });
      return undefined;
    }
    const firstMissing = boxRegions.find((region) => !matchSourceFile(region.file, sourceFiles));
    if (firstMissing && boxRegions.every((region) => !matchSourceFile(region.file, sourceFiles))) {
      setState({ status: 'missing', urls: [], missing: firstMissing.file });
      return undefined;
    }
    setState({ status: 'loading', urls: [], missing: '' });
    (async () => {
      const overrides = await loadOverrides();
      const urls = [];
      for (let index = 0; index < boxRegions.length; index += 1) {
        const region = boxRegions[index];
        const file = matchSourceFile(region.file, sourceFiles);
        if (!file) continue;
        const override = overrides[overrideKey(semester, number, index)];
        try {
          const url = await cropRegion(file, override ? { ...region, kind: 'box', box: override } : region);
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
  }, [signature, semester, number]);

  if (state.status === 'none' || state.status === 'idle') return null;
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
