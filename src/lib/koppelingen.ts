import { formatAgo } from '@/lib/account';
import { formatClock } from '@/lib/format';
import { life360LiveLine } from '@/lib/life360';
import type { Life360AdminStatus } from '@/types/Life360';
import type { TelegramAdminStatus } from '@/types/Telegram';

/** Beheer → Koppelingen (K1): what one integration card shows for a server status. */
export type IntegrationTone = 'ok' | 'off' | 'warn';

export interface IntegrationView {
  tone: IntegrationTone;
  /** The status pill next to the name */
  pill: 'Verbonden' | 'Niet gekoppeld' | 'Aandacht nodig';
  /** Under the name: "Gekoppeld als …", what it does, or "Bezig met koppelen…" */
  line: string;
  /** Last-sync line (only while it works) */
  sync?: string;
  /** The amber bar */
  problem?: string;
  /** "Koppelen" */
  canLink: boolean;
  /** "Ontkoppelen" */
  canUnlink: boolean;
  /** "Opnieuw koppelen" in the amber bar */
  canRelink: boolean;
}

const PILL = { ok: 'Verbonden', off: 'Niet gekoppeld', warn: 'Aandacht nodig' } as const;
const NONE = { canLink: false, canUnlink: false, canRelink: false };
const LINKING = 'Bezig met koppelen…';

/** "Silke (@silke)", "Silke (+31 6 •••• 4821)", "Silke", or "Telegram" when unknown. */
function telegramAccount(status: TelegramAdminStatus): string {
  const account = status.account;
  if (!account) return 'Telegram';
  if (account.username) return `${account.name} (@${account.username})`;
  return account.phoneMasked ? `${account.name} (${account.phoneMasked})` : account.name;
}

export function telegramIntegration(status: TelegramAdminStatus, now: number): IntegrationView {
  switch (status.state) {
    case 'unavailable':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Niet ingesteld op de server (TELEGRAM_API_ID/HASH).' };
    case 'unlinked':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Leest berichten van @Jotihunt_bot: tegenhunts en happy hours worden automatisch gemeld.', canLink: true };
    case 'qr':
    case 'password':
      return { ...NONE, tone: 'off', pill: PILL.off, line: LINKING };
    case 'linked': {
      const line = `Gekoppeld als ${telegramAccount(status)}`;
      if (status.connected === false) {
        // The server reconnects by itself: no "Opnieuw koppelen" (that would log the account out)
        return { ...NONE, tone: 'warn', pill: PILL.warn, line, problem: status.lastError ?? 'Geen verbinding met Telegram. De server probeert het opnieuw.', canUnlink: true };
      }
      const sync = status.lastMessageAt ? `Laatste bericht van @Jotihunt_bot ${formatAgo(status.lastMessageAt, now)}` : 'Nog geen berichten van @Jotihunt_bot';
      return { ...NONE, tone: 'ok', pill: PILL.ok, line, sync, canUnlink: true };
    }
  }
}

export function life360Integration(status: Life360AdminStatus, now: number): IntegrationView {
  switch (status.state) {
    case 'unavailable':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Niet ingesteld op de server (LIFE360_SESSION_KEY).' };
    case 'unlinked':
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Iedereen in de team-cirkel verschijnt als eigen laag op de kaart.', canLink: true };
    case 'code':
    case 'circle':
      return { ...NONE, tone: 'off', pill: PILL.off, line: LINKING };
    case 'linked':
      return { ...NONE, tone: 'ok', pill: PILL.ok, line: `Gekoppeld als ${status.email} · ${status.circleName}`, sync: life360LiveLine(status, now), canUnlink: true };
    case 'paused':
      return {
        ...NONE,
        tone: 'warn',
        pill: PILL.warn,
        line: `Gekoppeld als ${status.email} · ${status.circleName}`,
        problem: `Life360 vraagt ons te wachten. Volgende poging om ${formatClock(status.retryAt)}.`,
        canUnlink: true,
      };
    case 'loggedOut':
      return {
        ...NONE,
        tone: 'warn',
        pill: PILL.warn,
        line: `Gekoppeld als ${status.email} · ${status.circleName}`,
        problem: 'Life360 heeft de sessie beëindigd. Laatste posities blijven grijs op de kaart.',
        canRelink: true,
      };
  }
}
