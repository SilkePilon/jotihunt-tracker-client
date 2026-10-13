import { isAxiosError } from 'axios';

export type PasskeyFailure = 'cancelled' | 'unsupported' | 'unknown-passkey' | 'expired' | 'invite-gone' | 'link-gone' | 'rate-limited' | 'offline' | 'failed';

/** What went wrong with a passkey login/signup: a browser ceremony error or the server's answer. */
export function classifyPasskeyError(error: unknown): PasskeyFailure {
  if (isAxiosError<{ code?: unknown; reason?: unknown }>(error)) {
    const status = error.response?.status;
    if (status === undefined || status >= 500) return 'offline';
    if (status === 429) return 'rate-limited';
    if (status === 410) return error.response?.data?.reason ? 'invite-gone' : 'link-gone';
    const code = error.response?.data?.code;
    if (code === 'UNKNOWN_PASSKEY') return 'unknown-passkey';
    if (code === 'CHALLENGE_EXPIRED') return 'expired';
    return 'failed';
  }
  const names = [(error as { name?: unknown })?.name, (error as { cause?: { name?: unknown } })?.cause?.name];
  if (names.some((name) => name === 'NotAllowedError' || name === 'AbortError')) return 'cancelled';
  if (names.some((name) => name === 'NotSupportedError' || name === 'SecurityError')) return 'unsupported';
  return 'failed';
}

export const PASSKEY_MESSAGES: Record<PasskeyFailure, string> = {
  cancelled: 'Niet afgerond. Probeer het opnieuw.',
  unsupported: 'Deze browser ondersteunt geen passkeys. Log in met de QR-code vanaf je telefoon.',
  'unknown-passkey': 'Deze passkey werkt niet meer. Vraag de organisatie om een herstel-link.',
  expired: 'Dat duurde te lang. Probeer het opnieuw.',
  'invite-gone': 'Deze uitnodiging werkt niet meer.',
  'link-gone': 'Deze herstel-link werkt niet meer. Vraag de organisatie om een nieuwe.',
  'rate-limited': 'Te veel pogingen, probeer het over een kwartier opnieuw.',
  offline: 'Kan de server niet bereiken, controleer je verbinding.',
  failed: 'Er ging iets mis, probeer het opnieuw.',
};

export type InviteReason = 'expired' | 'revoked' | 'full' | 'paused' | 'unknown';

export const INVITE_REASON_TEXT: Record<InviteReason, string> = {
  expired: 'De link is verlopen. Vraag de organisatie om een nieuwe.',
  revoked: 'De link is ingetrokken. Vraag de organisatie om een nieuwe.',
  full: 'De link is al te vaak gebruikt. Vraag de organisatie om een nieuwe.',
  paused: 'Uitnodigen staat even uit. Probeer het later opnieuw.',
  unknown: 'Deze link bestaat niet. Controleer of je hem helemaal hebt gekopieerd.',
};

const INVITE_REASONS: readonly InviteReason[] = ['expired', 'revoked', 'full', 'paused', 'unknown'];

/** Why the server refused a signup with a 410 (the invite expired, was revoked, ...); null for any other error. */
export function inviteGoneReason(error: unknown): InviteReason | null {
  if (!isAxiosError<{ reason?: unknown }>(error) || error.response?.status !== 410) return null;
  const reason = error.response.data?.reason;
  if (!reason) return null;
  return INVITE_REASONS.includes(reason as InviteReason) ? (reason as InviteReason) : 'unknown';
}
