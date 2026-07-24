import { MessageCircleQuestion, ThumbsUp, ThumbsDown, Flame, Sparkles } from 'lucide-react';
import '../ChillZonePage.css';

export default function RumourOrReal() {
  return (
    <div className="cz-tab-page">
      <div className="cz-coming-card">
        <div className="cz-coming-icon" style={{ background: 'var(--accent-rose-glow)', color: 'var(--accent-rose)' }}>
          <MessageCircleQuestion size={32} strokeWidth={1.5} />
        </div>
        <h2>Rumour or Real?</h2>
        <p>
          Campus buzzing with a rumour? Drop it here — the community votes whether it's
          fact or fiction. Verified claims get a badge; busted ones get roasted.
        </p>
        <div className="cz-feature-pills" style={{ '--pill-color': 'var(--accent-rose)' }}>
          <span><ThumbsUp size={13} /> Community Votes</span>
          <span><ThumbsDown size={13} /> Bust It</span>
          <span><Flame size={13} /> Hot Rumours</span>
          <span><Sparkles size={13} /> Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
