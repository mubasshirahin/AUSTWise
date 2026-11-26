/**
 * Questions the student added by hand (cut out of an original page because
 * the AI missed them). Kept per course in localStorage and turned into one
 * extra Markdown part by manualQuestionsToMarkdown(), so the parser, crops,
 * trends and predictions see them exactly like AI rows.
 */

import { useCallback, useState } from 'react';

const PREFIX = 'aust-qba-manual-v1:';

function storageKey(courseKey) {
  const key = String(courseKey || '').trim().toLowerCase().replace(/\s+/g, '-');
  return key ? `${PREFIX}${key}` : '';
}

export function readManualQuestions(courseKey) {
  const key = storageKey(courseKey);
  if (!key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.id && entry.semester) : [];
  } catch {
    return [];
  }
}

function writeManualQuestions(courseKey, entries) {
  const key = storageKey(courseKey);
  if (!key) return;
  try {
    if (entries.length) localStorage.setItem(key, JSON.stringify(entries));
    else localStorage.removeItem(key);
  } catch {
    /* storage full or blocked — the in-memory list still works this visit */
  }
}

export default function useManualQuestions(courseKey) {
  const [entries, setEntries] = useState(() => readManualQuestions(courseKey));
  const [loadedKey, setLoadedKey] = useState(courseKey);

  // Another course was typed: read its list during render (no effect needed).
  if (loadedKey !== courseKey) {
    setLoadedKey(courseKey);
    setEntries(readManualQuestions(courseKey));
  }

  const add = useCallback((entry) => {
    setEntries((current) => {
      const next = [...current, { ...entry, id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
      writeManualQuestions(courseKey, next);
      return next;
    });
  }, [courseKey]);

  const remove = useCallback((id) => {
    setEntries((current) => {
      const next = current.filter((entry) => entry.id !== id);
      writeManualQuestions(courseKey, next);
      return next;
    });
  }, [courseKey]);

  return { entries, add, remove, enabled: Boolean(storageKey(courseKey)) };
}
