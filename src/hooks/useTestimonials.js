import { useEffect, useState } from 'react';
import { topTestimonials, bottomTestimonials } from '../data/testimonials';

// Review cards for the Landing and See Plans rails. Cards come from the admin
// panel (/api/testimonials); until an admin edits them the bundled list is
// used. setTestimonials() pushes a saved value to every mounted rail.

export const DEFAULT_TESTIMONIALS = { top: topTestimonials, bottom: bottomTestimonials };
const EVENT = 'aust-testimonials';

let cache = null;
let inflight = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/api/testimonials', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        cache = data?.success && data.value ? data.value : DEFAULT_TESTIMONIALS;
        return cache;
      })
      .catch(() => DEFAULT_TESTIMONIALS)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Push a fresh value (or null for the defaults) to every mounted rail. */
export function setTestimonials(value) {
  cache = value || DEFAULT_TESTIMONIALS;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cache }));
}

export function useTestimonials() {
  const [value, setValue] = useState(() => cache || DEFAULT_TESTIMONIALS);
  useEffect(() => {
    let active = true;
    load().then((v) => { if (active) setValue(v); });
    const onChange = (e) => setValue(e.detail);
    window.addEventListener(EVENT, onChange);
    return () => { active = false; window.removeEventListener(EVENT, onChange); };
  }, []);
  return value;
}
