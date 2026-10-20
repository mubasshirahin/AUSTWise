/**
 * useQbaImages — the question/answer attachments of one course.
 *
 * Attachments are stored in IndexedDB the moment they are added, so they work
 * offline and survive a reload. Each change is also pushed to the per-user
 * server mirror, so another device can pick them up.
 *
 * Both boxes are kept in the same per-question list; every entry carries
 * `kind: 'question' | 'answer'` so the UI can split them without another key.
 * The hook hands out object URLs and revokes them when an entry is removed or
 * the course changes.
 */

/* eslint-disable react-hooks/set-state-in-effect -- the pictures are loaded from IndexedDB and the server mirror, so the state has to be set once the data arrives */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  courseSlug,
  deleteImage,
  listImages,
  markImageSyncTime,
  mergeImageLists,
  prepareAttachmentFile,
  pullImagesFromServer,
  pushImagesToServer,
  readImageSyncTime,
  saveImage,
} from './qbaImageStore';

function toEntry(record, url) {
  return {
    id: record.id,
    name: record.name,
    url,
    mime: record.mime,
    size: record.size,
    width: record.width,
    height: record.height,
    kind: record.kind === 'answer' ? 'answer' : 'question',
    media: record.media === 'file'
      ? 'file'
      : (String(record.mime || '').startsWith('image/') ? 'image' : 'file'),
  };
}

export default function useQbaImages(courseCode, { enabled = true } = {}) {
  const courseKey = useMemo(() => courseSlug(courseCode), [courseCode]);
  const [byQuestion, setByQuestion] = useState({});
  const [loading, setLoading] = useState(Boolean(enabled));
  const urlsRef = useRef(new Map());
  const mapRef = useRef({});

  const writeMap = useCallback((next) => {
    mapRef.current = next;
    setByQuestion(next);
  }, []);

  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  const revokeOne = useCallback((id) => {
    const url = urlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(id);
    }
  }, []);

  /** Push this course's current picture list (empty included) to the server. */
  const pushNow = useCallback(async () => {
    try {
      const records = await listImages(courseKey);
      const ok = await pushImagesToServer(courseKey, records);
      if (ok) markImageSyncTime(courseKey);
      return ok;
    } catch {
      return false;
    }
  }, [courseKey]);

  // Load the pictures of this course: merge the server mirror into the local
  // cache. The sync time lets a picture deleted on another device disappear
  // here, while a picture attached just before this load is kept and pushed.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);

    (async () => {
      let records;
      try {
        const local = await listImages(courseKey);
        const remote = await pullImagesFromServer(courseKey);

        if (!remote.ok) {
          // Offline (or the request failed) — never treat that as "no pictures".
          records = local;
        } else {
          const lastSync = readImageSyncTime(courseKey);
          const localIds = new Set(local.map((record) => record.id));
          const { merged, unsynced, dropped } = mergeImageLists(
            local,
            remote.records,
            lastSync,
          );

          await Promise.all(remote.records
            .filter((record) => !localIds.has(record.id))
            .map((record) => saveImage(record)));

          await Promise.all(dropped.map((record) => deleteImage(record.id)));

          records = merged;

          if (unsynced.length) {
            try {
              const pushed = await pushImagesToServer(courseKey, merged);
              if (pushed) markImageSyncTime(courseKey);
            } catch {
              /* stays local and is retried on the next attach/save */
            }
          } else {
            markImageSyncTime(courseKey);
          }
        }
      } catch {
        records = [];
      }
      if (cancelled) return;

      revokeAll();
      const next = {};
      records.forEach((record) => {
        const url = URL.createObjectURL(record.blob);
        urlsRef.current.set(record.id, url);
        if (!next[record.questionKey]) next[record.questionKey] = [];
        next[record.questionKey].push(toEntry(record, url));
      });
      writeMap(next);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [courseKey, enabled, revokeAll, writeMap]);

  // Free the object URLs when the component goes away.
  useEffect(() => () => revokeAll(), [revokeAll]);

  const attach = useCallback(async (questionKey, fileList, kind = 'question') => {
    const files = Array.from(fileList || []);
    if (!files.length) return { added: 0, error: '', synced: true };

    const boxKind = kind === 'answer' ? 'answer' : 'question';
    let added = 0;
    const problems = [];

    for (const file of files) {
      try {
        const prepared = await prepareAttachmentFile(file);
        const record = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
          courseKey,
          questionKey,
          kind: boxKind,
          media: prepared.media || 'file',
          name: prepared.name,
          mime: prepared.mime,
          size: prepared.size,
          width: prepared.width,
          height: prepared.height,
          blob: prepared.blob,
          createdAt: new Date().toISOString(),
        };
        await saveImage(record);

        const url = URL.createObjectURL(record.blob);
        urlsRef.current.set(record.id, url);
        const entry = toEntry(record, url);
        const previous = mapRef.current[questionKey] || [];
        writeMap({ ...mapRef.current, [questionKey]: [...previous, entry] });
        added += 1;
      } catch (err) {
        problems.push(err?.message || `"${file.name}" could not be attached.`);
      }
    }

    const synced = added ? await pushNow() : true;

    return {
      added,
      error: problems.join(' '),
      synced,
    };
  }, [courseKey, pushNow, writeMap]);

  const remove = useCallback(async (id) => {
    revokeOne(id);
    const next = {};
    Object.entries(mapRef.current).forEach(([key, list]) => {
      const kept = list.filter((entry) => entry.id !== id);
      if (kept.length) next[key] = kept;
    });
    writeMap(next);
    try {
      await deleteImage(id);
    } catch {
      /* the picture is gone from the screen either way */
    }
    // Keep the server mirror in step, including the "no pictures left" case.
    return pushNow();
  }, [pushNow, revokeOne, writeMap]);

  /** Copy every picture of this course to the server. */
  const syncToServer = pushNow;

  return { courseKey, byQuestion, attach, remove, syncToServer, loading };
}
