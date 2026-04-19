export type AuthRole = 'admin' | 'analyst' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  plan?: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  org: AuthOrg;
  role: AuthRole;
}

interface DecodedAccessToken {
  sub: string;
  orgId: string;
  role: AuthRole;
  exp?: number;
  iat?: number;
}

interface AuthResponsePayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    full_name?: string;
    avatar_url?: string | null;
    created_at?: string;
  };
  org: {
    id: string;
    name: string;
    slug: string;
    plan?: string | null;
  };
  role?: AuthRole;
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

function mapUser(user: AuthResponsePayload['user']): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? user.full_name ?? '',
    avatarUrl: user.avatar_url ?? null,
    createdAt: user.created_at,
  };
}

function mapOrg(org: AuthResponsePayload['org']): AuthOrg {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan ?? null,
  };
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.message === 'string') return data.message;
    if (typeof data?.detail === 'string') return data.detail;
  } catch {
    // Ignore JSON parsing failures and fall back to status text.
  }

  return response.statusText || 'Request failed';
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

function normalizeAuthPayload(
  payload: AuthResponsePayload,
  fallbackRole: AuthRole = 'admin',
): AuthSession {
  return {
    accessToken: payload.accessToken,
    user: mapUser(payload.user),
    org: mapOrg(payload.org),
    role: payload.role ?? fallbackRole,
  };
}

export function decodeAccessToken(token: string): DecodedAccessToken | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as DecodedAccessToken;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeAccessToken(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}

export function buildTenantHeaders(
  accessToken?: string | null,
  orgId?: string | null,
  headers?: Record<string, string>,
): Record<string, string> {
  const nextHeaders: Record<string, string> = { ...(headers ?? {}) };

  if (accessToken) {
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  if (orgId) {
    nextHeaders['x-org-id'] = orgId;
  }

  return nextHeaders;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const payload = await requestJson<AuthResponsePayload>('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return normalizeAuthPayload(payload);
}

export async function signUpWithPassword(input: {
  fullName: string;
  email: string;
  password: string;
  orgName: string;
}): Promise<AuthSession> {
  const payload = await requestJson<AuthResponsePayload>('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return normalizeAuthPayload(payload, 'admin');
}

export async function refreshAccessToken(): Promise<string> {
  const payload = await requestJson<{ accessToken: string }>('/api/auth/refresh', {
    method: 'POST',
  });

  if (!payload.accessToken) {
    throw new Error('Missing access token');
  }

  return payload.accessToken;
}

export async function signOutRequest(): Promise<void> {
  await requestJson<{ message: string }>('/api/auth/signout', { method: 'POST' });
}

export async function loadSessionFromAccessToken(accessToken: string): Promise<AuthSession> {
  const decoded = decodeAccessToken(accessToken);
  if (!decoded?.sub || !decoded?.orgId || !decoded?.role) {
    throw new Error('Invalid access token');
  }

  const authHeaders = buildTenantHeaders(accessToken, decoded.orgId);
  const [mePayload, orgPayload] = await Promise.all([
    requestJson<{ user: AuthResponsePayload['user'] }>('/api/auth/me', {
      headers: authHeaders,
    }),
    requestJson<{ org: AuthResponsePayload['org'] }>(`/api/org/${decoded.orgId}`, {
      headers: authHeaders,
    }),
  ]);

  return {
    accessToken,
    user: mapUser(mePayload.user),
    org: mapOrg(orgPayload.org),
    role: decoded.role,
  };
}
