/**
 * useQbaImages — the pictures attached to the questions of one course.
 *
 * Pictures are stored in IndexedDB the moment they are attached, so they work
 * offline and survive a reload. The same pictures are mirrored to the server
 * when the analysis is saved, so another device can pick them up.
 *
 * The hook hands out object URLs for <img src> and revokes them when the
 * picture is removed or the course changes.
 */

/* eslint-disable react-hooks/set-state-in-effect -- the pictures are loaded from IndexedDB and the server mirror, so the state has to be set once the data arrives */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_IMAGES_PER_QUESTION,
  courseSlug,
  deleteImage,
  listImages,
  prepareImageFile,
  pullImagesFromServer,
  pushImagesToServer,
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

  // Load the pictures of this course (local first, server mirror second).
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);

    (async () => {
      let records;
      try {
        records = await listImages(courseKey);
        if (!records.length) {
          const remote = await pullImagesFromServer(courseKey);
          if (remote.length) {
            await Promise.all(remote.map((record) => saveImage(record)));
            records = remote;
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

  const attach = useCallback(async (questionKey, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return { added: 0, error: '' };

    let added = 0;
    let error = '';

    for (const file of files) {
      const existing = mapRef.current[questionKey] || [];
      if (existing.length >= MAX_IMAGES_PER_QUESTION) {
        error = `Up to ${MAX_IMAGES_PER_QUESTION} pictures per question.`;
        break;
      }
      try {
        const prepared = await prepareImageFile(file);
        const record = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
          courseKey,
          questionKey,
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
        error = err?.message || 'That picture could not be attached.';
      }
    }

    return { added, error };
  }, [courseKey, writeMap]);

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
  }, [revokeOne, writeMap]);

  /** Copy every picture of this course to the server. */
  const syncToServer = useCallback(async () => {
    try {
      const records = await listImages(courseKey);
      return await pushImagesToServer(courseKey, records);
    } catch {
      return false;
    }
  }, [courseKey]);

  return { courseKey, byQuestion, attach, remove, syncToServer, loading };
}
