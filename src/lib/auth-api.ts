import axios from 'axios';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';
import type { User } from '@/types/User';
import type { InviteReason } from '@/lib/passkey';

/** Passkey prompts wait for the user (fingerprint, phone nearby): the server calls themselves are quick */
const api = axios.create({ baseURL: import.meta.env.API_BASE_URL, timeout: REQUEST_TIMEOUT_MS });

export interface SessionResult {
  token: string;
  user: User;
}

export interface InviteInfo {
  valid: boolean;
  reason: InviteReason | null;
  group: { name: string; logoUrl: string | null };
  invitedBy: string | null;
  memberCount: number;
  onlineCount: number;
}

type Options = { challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] };
type LoginOptions = { challengeId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] };

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function passkeyLogin(): Promise<SessionResult> {
  const { data } = await api.post<LoginOptions>('/auth/passkey/login/options');
  const response = await startAuthentication({ optionsJSON: data.options });
  return (await api.post<SessionResult>('/auth/passkey/login/verify', { challengeId: data.challengeId, response })).data;
}

export async function fetchInvite(code: string): Promise<InviteInfo> {
  const response = await api.get<InviteInfo>(`/invites/${encodeURIComponent(code)}`, { validateStatus: (status) => status === 200 || status === 404 });
  if (response.status === 404) return { valid: false, reason: 'unknown', group: { name: '', logoUrl: null }, invitedBy: null, memberCount: 0, onlineCount: 0 };
  return response.data;
}

export async function registerWithInvite(code: string, name: string): Promise<SessionResult> {
  const path = `/invites/${encodeURIComponent(code)}/register`;
  const { data } = await api.post<Options>(`${path}/options`, { name });
  const response = await startRegistration({ optionsJSON: data.options });
  return (await api.post<SessionResult>(`${path}/verify`, { challengeId: data.challengeId, response })).data;
}

export async function registerWithInviteWithoutPasskey(code: string, name: string): Promise<SessionResult> {
  return (await api.post<SessionResult>(`/invites/${encodeURIComponent(code)}/register/no-passkey`, { name })).data;
}

export async function fetchRecovery(token: string): Promise<{ valid: boolean; name?: string }> {
  const response = await api.get<{ valid: boolean; name?: string }>(`/herstel/${encodeURIComponent(token)}`, { validateStatus: (status) => status === 200 || status === 404 });
  return response.status === 404 ? { valid: false } : response.data;
}

export async function recoverWithPasskey(token: string): Promise<SessionResult> {
  const path = `/herstel/${encodeURIComponent(token)}`;
  const { data } = await api.post<Options>(`${path}/register/options`);
  const response = await startRegistration({ optionsJSON: data.options });
  return (await api.post<SessionResult>(`${path}/register/verify`, { challengeId: data.challengeId, response })).data;
}

export async function recoverWithoutPasskey(token: string): Promise<SessionResult> {
  return (await api.post<SessionResult>(`/herstel/${encodeURIComponent(token)}/no-passkey`)).data;
}

/** Add a passkey to the logged-in account; resolves to the updated user. */
export async function addPasskey(authHeader: string): Promise<User> {
  const headers = { Authorization: authHeader };
  const { data } = await api.post<Options>('/account/passkeys/options', undefined, { headers });
  const response = await startRegistration({ optionsJSON: data.options });
  return (await api.post<{ user: User }>('/account/passkeys/verify', { challengeId: data.challengeId, response }, { headers })).data.user;
}

/** Revoke this browser's session on the server (best effort: logging out locally always works). */
export async function logoutSession(authHeader: string): Promise<void> {
  await api.post('/auth/logout', undefined, { headers: { Authorization: authHeader } }).catch(() => undefined);
}
