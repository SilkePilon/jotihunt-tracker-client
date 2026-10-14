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

export interface QrStart {
  id: string;
  code: string;
  pollSecret: string;
  /** What the QR code contains: `${PUBLIC_APP_URL}/l/<code>` */
  url: string;
  expiresAt: string;
}

export type QrPoll =
  | { status: 'waiting' | 'denied' | 'expired'; expiresAt: string }
  | { status: 'scanned'; scannedBy: { name: string }; expiresAt: string }
  | ({ status: 'approved' } & SessionResult);

export interface QrScan {
  requester: { label: string; location: string | null };
  createdAt: string;
  options: LoginOptions['options'];
}

/** Laptop: a new code for the QR. */
export async function startQrLogin(): Promise<QrStart> {
  return (await api.post<QrStart>('/auth/qr')).data;
}

/** Laptop: 'gone' when the server no longer knows the code; network errors throw (try again on the next tick). */
export async function pollQrLogin(id: string, secret: string): Promise<QrPoll | 'gone'> {
  const response = await api.get<QrPoll>(`/auth/qr/${encodeURIComponent(id)}`, {
    headers: { 'X-Qr-Secret': secret },
    validateStatus: (status) => status === 200 || status === 404,
  });
  return response.status === 404 ? 'gone' : response.data;
}

/** Phone: claim the scanned code; gives who asks and the passkey options to confirm with. */
export async function scanQrLogin(code: string, authHeader: string): Promise<QrScan> {
  return (await api.post<QrScan>(`/auth/qr/scan/${encodeURIComponent(code)}`, undefined, { headers: { Authorization: authHeader } })).data;
}

/** Phone: confirm with a passkey (opens the fingerprint / face prompt). */
export async function approveQrLogin(code: string, scan: QrScan, authHeader: string): Promise<void> {
  const response = await startAuthentication({ optionsJSON: scan.options });
  await api.post(`/auth/qr/scan/${encodeURIComponent(code)}/approve`, { response }, { headers: { Authorization: authHeader } });
}

export async function denyQrLogin(code: string, authHeader: string): Promise<void> {
  await api.post(`/auth/qr/scan/${encodeURIComponent(code)}/deny`, undefined, { headers: { Authorization: authHeader } });
}
