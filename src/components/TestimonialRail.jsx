import { useTestimonials } from '../hooks/useTestimonials';
import './TestimonialRail.css';

// One rail for the Landing and See Plans pages; cards come from useTestimonials.

export function TestimonialCard({ t }) {
  return (
    <div className="testimonial-card">
      <p className="testimonial-quote">{t.quote}</p>
      <div className="testimonial-user">
        {t.avatar
          ? <img src={t.avatar} alt={t.name} className="testimonial-avatar" loading="lazy" decoding="async" width="48" height="48" />
          : <span className="testimonial-avatar testimonial-avatar-initial" aria-hidden="true">{t.name?.[0] || '?'}</span>}
        <div className="testimonial-user-info">
          <div className="testimonial-name">{t.name}</div>
          <div className="testimonial-role">{t.role}</div>
        </div>
      </div>
    </div>
  );
}

const pause = (e, state) => {
  const track = e.currentTarget.querySelector('.testimonials-slider');
  if (track) track.style.animationPlayState = state;
};

export default function TestimonialRail() {
  const { top, bottom } = useTestimonials();
  return (
    <div className="testimonial-rail">
      {[[top, 'track-right'], [bottom, 'track-left']].map(([list, dir]) => (
        <div
          key={dir}
          className="testimonials-slider-wrapper"
          onMouseEnter={(e) => pause(e, 'paused')}
          onMouseLeave={(e) => pause(e, 'running')}
        >
          <div className={`testimonials-slider ${dir}`}>
            {[...list, ...list, ...list].map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
