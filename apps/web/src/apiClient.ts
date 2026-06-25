const apiBaseUrl = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL) ?? 'http://localhost:4000';

type ApiOptions = RequestInit & {
  authToken?: string | null;
};

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
    const response = await fetch(`${apiBaseUrl}${normalizedPath}`, {
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
