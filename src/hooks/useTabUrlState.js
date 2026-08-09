import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sync a tab id with `?tab=` in the URL.
 *
 * - On mount: `?tab=<id>` wins over any saved default (deep links land on the
 *   right subpage). If no url tab, falls back to the component's default.
 * - On change: tab id written to the URL (replace, so back button stays clean)
 *   and to localStorage. `onChange` still fires for any side effects.
 */
export default function useTabUrlState({
  storageKey,
  defaultValue,
  onChange,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Collections mutate the URL, so lock the inactive ones when mounted so we
  // don't overwrite a fresh deep link with a stale collection tab.
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) localStorage.setItem(storageKey, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (tab) => {
    setSearchParams(tab === defaultValue ? {} : { tab }, { replace: true });
    localStorage.setItem(storageKey, tab);
    onChange?.(tab);
  };
}