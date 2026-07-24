import { Newspaper } from 'lucide-react';

// Newspaper-style broadsheet nameplate shown atop the Marketplace when the
// Newsprint theme is active. Presentational only — no state, no side effects.

const TICKER_ITEMS = [
  { label: 'Breaking', accent: true },
  { label: 'Textbooks & lab kits changing hands daily' },
  { label: 'Rooms to let near campus' },
  { label: 'Lost something? Post it in the classifieds' },
  { label: 'Seniors mentoring juniors — free' },
  { label: 'Fair prices, fellow students, zero commission' },
];

function formatEdition() {
  // e.g. "Saturday, July 5, 2026"
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function MarketplaceMasthead() {
  return (
    <header className="mp-masthead" aria-label="The Campus Market">
      <div className="mp-masthead-topline">
        <span>Vol. 1 — No. 4</span>
        <span className="mp-masthead-kicker">Classifieds &amp; Exchange</span>
        <span>Price: Free</span>
      </div>

      <div className="mp-masthead-nameplate">
        <Newspaper size={22} strokeWidth={1.5} aria-hidden="true" />
        <h1 className="mp-masthead-title">The Campus Market</h1>
        <Newspaper size={22} strokeWidth={1.5} aria-hidden="true" />
      </div>

      <div className="mp-masthead-edition">
        <span>{formatEdition()}</span>
        <span className="mp-masthead-dot" aria-hidden="true">&bull;</span>
        <span>AUST Edition</span>
        <span className="mp-masthead-dot" aria-hidden="true">&bull;</span>
        <span>Trade, ToLet Mama, Lost &amp; Found, Mentors</span>
      </div>

      {/* Breaking-news crawl. Track is duplicated so the loop is seamless;
          aria-hidden because it is decorative, and motion is disabled under
          prefers-reduced-motion (see MarketplacePage.css). */}
      <div className="mp-ticker" aria-hidden="true">
        <div className="mp-ticker-track">
          {[0, 1].map((copy) => (
            <div className="mp-ticker-group" key={copy}>
              {TICKER_ITEMS.map((item, i) => (
                <span
                  key={`${copy}-${i}`}
                  className={`mp-ticker-item${item.accent ? ' mp-ticker-item--accent' : ''}`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
