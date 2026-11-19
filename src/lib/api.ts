import { auth } from './firebase.ts';

// Keep authentication tokens strictly in memory (never in localStorage)
let inMemoryToken: string | null = null;
let inMemorySelectedOfficeId: number | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function setSelectedOfficeMemory(officeId: number | null) {
  inMemorySelectedOfficeId = officeId;
}

async function resolveBearerToken(): Promise<string | null> {
  if (inMemoryToken && inMemoryToken.startsWith('erp_')) {
    return inMemoryToken;
  }
  if (auth.currentUser) {
    const fresh = await auth.currentUser.getIdToken();
    inMemoryToken = fresh;
    return fresh;
  }
  return inMemoryToken;
}

export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveBearerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (inMemorySelectedOfficeId) {
    headers['X-Office-Id'] = String(inMemorySelectedOfficeId);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore non-json
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function downloadExcelExport(queryString: string, filename = 'Samity_List_Export.xlsx') {
  const token = await resolveBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (inMemorySelectedOfficeId) headers['X-Office-Id'] = String(inMemorySelectedOfficeId);

  const res = await fetch(`/api/samitys/export?${queryString}`, { headers });
  if (!res.ok) {
    let message = 'Export failed';
    try {
      const err = await res.json();
      if (err?.error) message = err.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
