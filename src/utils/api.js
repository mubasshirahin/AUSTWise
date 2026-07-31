const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

/**
 * The Render API origin in production. When unset, relative URLs preserve the
 * Vite development proxy and same-origin local development behavior.
 */
export const API_BASE_URL = configuredApiUrl;

export function getApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Make a request to the application backend.
 *
 * JSON requests get a default Content-Type, while callers can still provide
 * their own headers or use FormData without us overriding its boundary.
 */
export function getWebSocketUrl() {
  let baseUrl = configuredApiUrl;
  if (!baseUrl && typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    baseUrl = isLocal ? 'http://localhost:5174' : window.location.origin;
  }
  return baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '');
}

export function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(getApiUrl(path), {
    ...options,
    credentials: 'include',
    headers,
  });
}
