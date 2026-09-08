import { useState, useEffect, useCallback } from 'react';

const DEFAULT = { featureHidden: ['admin', 'moderator'], statsAllowed: ['admin', 'moderator'] };

export function useRoleAccess(pageKey) {
  const key = pageKey || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : 'default');
  const storageKey = `aust-role-access-v2:${key}`;
  const [config, setConfig] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/role-access?key=${encodeURIComponent(key)}`, { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        const cfg = { featureHidden: data.featureHidden || DEFAULT.featureHidden, statsAllowed: data.statsAllowed || DEFAULT.statsAllowed };
        setConfig(cfg);
        try { localStorage.setItem(storageKey, JSON.stringify(cfg)); } catch {}
        return cfg;
      }
    } catch {}
    // fallback to localStorage
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.featureHidden) && Array.isArray(p.statsAllowed)) {
          setConfig(p);
          return p;
        }
      }
    } catch {}
    return DEFAULT;
  }, [key, storageKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cfg = await fetchConfig();
      if (!cancelled) {
        setConfig(cfg);
        setLoading(false);
      }
    })();
    const onUpdate = (e) => {
      if (e.detail?.key === storageKey || e.detail?.pageKey === key) {
        if (e.detail.featureHidden) setConfig({ featureHidden: e.detail.featureHidden, statsAllowed: e.detail.statsAllowed });
      } else if (e.detail?.key && e.detail.key.includes(key)) {
        // fallback
      }
    };
    const onStorage = (e) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const p = JSON.parse(e.newValue);
          if (p.featureHidden) setConfig(p);
        } catch {}
      }
    };
    const onBroadcast = (e) => {
      if (e.detail?.type === 'role-access' && e.detail?.payload?.pageKey === key) {
        setConfig({ featureHidden: e.detail.payload.featureHidden, statsAllowed: e.detail.payload.statsAllowed });
      }
    };
    window.addEventListener('role-access-updated', onUpdate);
    window.addEventListener('storage', onStorage);
    // WS broadcast via custom event if server pushes
    window.addEventListener('message', onBroadcast);
    // Also listen for WS via global
    const wsHandler = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'role-access' && data.payload?.pageKey === key) {
          setConfig({ featureHidden: data.payload.featureHidden, statsAllowed: data.payload.statsAllowed });
        }
      } catch {}
    };
    // Try to attach to existing WS if any
    return () => {
      window.removeEventListener('role-access-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onBroadcast);
    };
  }, [key, storageKey, fetchConfig]);

  const save = useCallback(async (newCfg) => {
    setConfig(newCfg);
    try { localStorage.setItem(storageKey, JSON.stringify(newCfg)); } catch {}
    try {
      const res = await fetch('/api/admin/role-access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageKey: key, featureHidden: newCfg.featureHidden, statsAllowed: newCfg.statsAllowed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('Role access save failed', data.error);
      }
    } catch (e) {
      console.warn('Role access save failed', e.message);
    }
    try {
      window.dispatchEvent(new CustomEvent('role-access-updated', { detail: { ...newCfg, key: storageKey, pageKey: key } }));
    } catch {}
  }, [key, storageKey]);

  return { config, loading, save, key, storageKey };
}
