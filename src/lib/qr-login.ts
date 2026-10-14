import { isAxiosError } from 'axios';
import type { QrPoll } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';

/** The laptop asks every 1.5 s whether the code was scanned */
export const QR_POLL_MS = 1500;
/** Codes live 2 minutes; the login page makes new ones for 10 minutes, then waits for a click (a forgotten tab stops polling) */
export const QR_RENEW_FOR_MS = 10 * 60 * 1000;

export type QrPanelState =
  | { phase: 'loading' }
  | { phase: 'waiting'; url: string; expiresAt: number }
  | { phase: 'scanned'; url: string; name: string }
  | { phase: 'done'; name: string }
  | { phase: 'expired' }
  | { phase: 'error' };

/** What the QR half shows after a poll; 'renew' = make a new code now. Approvals are handled by the caller. */
export function panelAfterPoll(poll: Exclude<QrPoll, { status: 'approved' }> | 'gone', url: string, renewingSince: number, now: number): QrPanelState | 'renew' {
  if (poll !== 'gone' && poll.status === 'waiting') return { phase: 'waiting', url, expiresAt: Date.parse(poll.expiresAt) };
  if (poll !== 'gone' && poll.status === 'scanned') return { phase: 'scanned', url, name: poll.scannedBy.name };
  return now - renewingSince < QR_RENEW_FOR_MS ? 'renew' : { phase: 'expired' };
}

/** Where to go after logging in: only back to a QR confirm link (`/l/<code>`), never to another page or site. */
export function nextAfterLogin(next: string | null): string {
  return next && /^\/l\/[A-Za-z0-9_-]{1,64}$/.test(next) ? next : '/';
}

export interface QrProblem {
  message: string;
  /** Offer "Passkey toevoegen" (the account has none, so it can not confirm) */
  addPasskey: boolean;
}

/** Why the phone can not confirm the code, in words for the drawer. */
export function qrProblem(error: unknown): QrProblem {
  if (isAxiosError<{ code?: unknown }>(error)) {
    const code = error.response?.data?.code;
    if (code === 'QR_GONE') return { message: 'Deze code werkt niet meer. Vernieuw de code op het andere apparaat.', addPasskey: false };
    if (code === 'QR_TAKEN') return { message: 'Iemand anders heeft deze code al gescand.', addPasskey: false };
    if (code === 'NO_PASSKEY') return { message: 'Je hebt nog geen passkey. Voeg er een toe en scan de code opnieuw.', addPasskey: true };
  }
  return { message: PASSKEY_MESSAGES[classifyPasskeyError(error)], addPasskey: false };
}

/** After a failed confirm: stay on the confirm view only when the prompt was cancelled or the passkey did not match (the code still waits). */
export function canRetryConfirm(error: unknown): boolean {
  if (isAxiosError<{ code?: unknown }>(error)) return error.response?.data?.code === 'PASSKEY_FAILED';
  return classifyPasskeyError(error) === 'cancelled';
}
