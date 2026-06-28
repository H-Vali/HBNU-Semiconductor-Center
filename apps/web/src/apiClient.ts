const defaultApiBaseUrl = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.hostname.includes('pages.dev')
)
  ? 'https://hbnu-semiconductor-center-api.onrender.com'
  : 'http://localhost:4000';
const apiBaseUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? defaultApiBaseUrl;

type ApiOptions = RequestInit & {
  authToken?: string | null;
};

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T | null> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }

  try {
    const response = await fetch(getApiUrl(normalizedPath), {
      ...options,
      headers
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export function apiGet<T>(path: string, authToken?: string | null) {
  return apiRequest<T>(path, { authToken });
}

export function apiPost<T>(path: string, body: unknown, authToken?: string | null) {
  return apiRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    authToken
  });
}

export function apiPut<T>(path: string, body: unknown, authToken?: string | null) {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    authToken
  });
}

export function apiPatch<T>(path: string, body: unknown, authToken?: string | null) {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    authToken
  });
}

export function apiDelete<T>(path: string, authToken?: string | null) {
  return apiRequest<T>(path, {
    method: 'DELETE',
    authToken
  });
}

export async function apiGetBlob(pathOrUrl: string, authToken?: string | null) {
  const headers = new Headers();
  headers.set('Accept', '*/*');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const targetUrl = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : getApiUrl(pathOrUrl);
  try {
    const response = await fetch(targetUrl, { headers });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}
