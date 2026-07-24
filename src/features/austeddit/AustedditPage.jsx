import { Zap, MessageCircle, ThumbsUp, Hash } from 'lucide-react';
import './AustedditPage.css';
import '../../components/PageHero.css';

export default function AustedditPage() {
  return (
    <div className="aed-page animate-fadeIn">
      <div className="aed-coming-soon">
        <div className="aed-cs-card">
          <Zap size={32} strokeWidth={1.5} />
          <h2>Buzz — Coming Soon</h2>
          <p>A Reddit-style anonymous forum exclusively for AUST students. Post confessions, memes, academic discussions, campus gossip, and more. Upvote, downvote, and comment freely.</p>
          <div className="aed-feature-pills">
            <span><Hash size={14} /> Topic Channels</span>
            <span><ThumbsUp size={14} /> Upvote System</span>
            <span><MessageCircle size={14} /> 100% Anonymous</span>
          </div>
        </div>
      </div>
    </div>
  );
}
