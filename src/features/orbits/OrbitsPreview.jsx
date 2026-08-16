import { Orbit } from 'lucide-react';
import { humanizeKey } from './OrbitsContext';

// Renders one checkpoint's edited fields — the "same to same" content that
// shows in the stalk road-trip when you Drive My Orbit. Fields are edited in
// Checkpoint Control; this only previews them.
export default function OrbitsCheckpointPreview({ label, fields, accent }) {
  const entries = Object.entries(fields || {});
  const itemHasValue = (item) => Object.values(item || {}).some((v) => String(v ?? '').trim() !== '');
  const hasContent = entries.some(([, val]) => {
    if (Array.isArray(val)) return typeof val[0] === 'object' ? val.some(itemHasValue) : val.length > 0;
    return String(val ?? '').trim() !== '';
  });

  return (
    <div className="sr-orbit-cp">
      <header className="sr-orbit-head">
        <span className="sr-orbit-head-icon"><Orbit size={16} /></span>
        <h3 className="sr-orbit-title">{label}</h3>
      </header>
      {hasContent ? (
        <div className="sr-orbit-fields">
          {entries.map(([key, val]) => {
            const isArr = Array.isArray(val);
            if (isArr && typeof val[0] === 'object') {
              const items = val.filter(itemHasValue);
              if (items.length === 0) return null;
              return (
                <div className="sr-orbit-row" key={key}>
                  <span className="sr-orbit-label">{humanizeKey(key)}</span>
                  <div className="sr-orbit-items">
                    {items.map((item, i) => (
                      <span className="sr-orbit-chip" key={i} style={{ '--sa': accent }}>{Object.values(item).filter(Boolean).join(' · ')}</span>
                    ))}
                  </div>
                </div>
              );
            }
            if (isArr) {
              if (val.length === 0) return null;
              return (
                <div className="sr-orbit-row" key={key}>
                  <span className="sr-orbit-label">{humanizeKey(key)}</span>
                  <div className="sr-orbit-items">
                    {val.map((v, i) => <span className="sr-orbit-chip" key={i} style={{ '--sa': accent }}>{String(v)}</span>)}
                  </div>
                </div>
              );
            }
            const text = String(val ?? '').trim();
            if (!text) return null;
            return (
              <div className="sr-orbit-row" key={key}>
                <span className="sr-orbit-label">{humanizeKey(key)}</span>
                <span className="sr-orbit-value">{text}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="sr-orbit-empty">Nothing filled in yet — edit it in Checkpoint Control.</p>
      )}
    </div>
  );
}