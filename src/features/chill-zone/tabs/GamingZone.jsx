import { Gamepad2, Swords, Users, Star, Sparkles } from 'lucide-react';
import '../ChillZonePage.css';

export default function GamingZone() {
  return (
    <div className="cz-tab-page">
      <div className="cz-coming-card">
        <div className="cz-coming-icon" style={{ background: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)' }}>
          <Gamepad2 size={32} strokeWidth={1.5} />
        </div>
        <h2>Gaming Zone</h2>
        <p>
          Play browser-based mini games right inside AUSTWise — challenge friends,
          climb the ranks, and take a proper break between lectures.
        </p>
        <div className="cz-feature-pills" style={{ '--pill-color': 'var(--accent-emerald)' }}>
          <span><Swords size={13} /> 1v1 Battles</span>
          <span><Users size={13} /> Multiplayer</span>
          <span><Star size={13} /> Rankings</span>
          <span><Sparkles size={13} /> Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
