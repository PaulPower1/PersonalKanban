import { apiFetch, apiFetchRaw, ApiError } from './client';
import { AuthUser } from '../types';

export async function register(data: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const res = await apiFetchRaw('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new ApiError(res.status, body.error || 'Login failed', body);
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await apiFetchRaw('/auth/me');
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
}
