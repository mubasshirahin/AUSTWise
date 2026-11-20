import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ListOrdered } from 'lucide-react';
import './InfoPage.css';
import './TermsPage.css';
import LandingNav from '../features/landing/LandingNav';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Shared layout for the footer pages (Terms, Privacy, Docs, Blog, ...):
 * masthead + Contents dropdown + one flat card per section.
 * On desktop only the sections column scrolls (see TermsPage.css).
 *
 * sections: [{ id, title, meta?, body }]
 */
export default function InfoShell({ icon: Icon, overline, title, subtitle, stats = [], sections, numbered = true }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const ddRef = useRef(null);

  const jump = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    setCurrentId(id);
    document.getElementById(`tos-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ddRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const idx = sections.findIndex((s) => s.id === currentId);
  const current = idx >= 0 ? { ...sections[idx], n: idx + 1 } : null;

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="tos-widget">
        <header className="tos-head">
          <div className="tos-head-title">
            <div className="tos-head-tile" aria-hidden="true"><Icon size={20} strokeWidth={2.1} /></div>
            <div className="tos-head-text">
              <span className="tos-head-overline">{overline}</span>
              <h1 className="tos-head-name">{title}</h1>
              {subtitle && <span className="tos-head-subtitle">{subtitle}</span>}
            </div>
          </div>
          {stats.length > 0 && (
            <dl className="tos-head-stats">
              {stats.map((s) => (
                <div className="tos-head-stat" key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
              ))}
            </dl>
          )}
          <button type="button" className="tos-back" onClick={() => navigate('/')}>
            <ArrowLeft size={13} /> Home
          </button>
        </header>

        <div className="tos-main-grid is-dd">
          <nav className="tos-dd" ref={ddRef} aria-label="Contents">
            <button
              type="button"
              className="tos-dd-btn"
              aria-expanded={open}
              aria-controls="tos-dd-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <ListOrdered size={14} className="tos-dd-icon" />
              <span className="tos-dd-label">Contents</span>
              <span className="tos-dd-current">
                {current
                  ? <>{numbered && <span className="tos-num">{pad(current.n)}</span>}{current.title}</>
                  : `${sections.length} section${sections.length === 1 ? '' : 's'}`}
              </span>
              <ChevronDown size={15} className="tos-dd-caret" />
            </button>
            {open && (
              <ol className="tos-toc-list tos-dd-menu" id="tos-dd-menu">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#tos-${s.id}`} onClick={jump(s.id)} aria-current={current?.id === s.id ? 'true' : undefined}>
                      <span className="tos-num">{pad(i + 1)}</span>
                      <span className="tos-toc-name">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </nav>

          <div className="tos-sections">
            {sections.map((s, i) => (
              <section key={s.id} id={`tos-${s.id}`} className="tos-card tos-section">
                <h2 className="tos-section-title">
                  {numbered && <span className="tos-num">{pad(i + 1)}</span>}
                  {s.title}
                </h2>
                {s.meta && <p className="tos-section-meta">{s.meta}</p>}
                <div className="tos-section-body">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
      <div className="tos-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
